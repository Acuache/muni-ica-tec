# SPEC 02 — Esquema de base de datos + RLS base

> **Estado:** Implementado · **Depende de:** SPEC 01 · **Fecha:** 2026-06-04
> **Objetivo:** Crear las tablas núcleo (`profiles`, `areas`, `solicitudes`,
> `technician_status`) con sus enums y políticas RLS para que cada rol vea
> y modifique solo lo que le corresponde.

## Scope

**In:**

- Definir enums de Postgres: `user_role` (`jefe`, `tecnico`, `trabajador`),
  `solicitud_estado` (`en_espera`, `en_proceso`, `solucionado`, `no_solucionado`),
  `tecnico_estado` (`disponible`, `atendiendo`, `en_oficina`, `virtual`, `descanso`),
  `ayuda_tipo` (`presencial`, `virtual`).
- Tabla `areas` (`id`, `nombre`) con 6 filas de seed para pruebas.
- Tabla `profiles` vinculada a `auth.users.id` con campos: `rol`, `dni`, `username`,
  `telefono`, `email`, `primer_ingreso` (flag para SPEC 04).
- Tabla `solicitudes` con campos: `trabajador_id`, `area_id`, `tipo_ayuda`, `titulo`,
  `descripcion`, `estado`, `tecnico_id`, `created_at`, `updated_at`.
- Tabla `technician_status` con campos: `tecnico_id`, `estado`, `ubicacion`,
  `atendiendo_solicitud_id`, `updated_at`.
- Políticas RLS para los cuatro roles sobre las cuatro tablas.
- Seed de usuarios de prueba: 1 jefe, 2 técnicos (con credenciales comentadas
  en la migración para que el equipo las reemplace).

**Fuera de alcance (specs posteriores):**

- UI, formularios y lógica de cola (SPEC 05–07).
- Login, sesión y protección de rutas (SPEC 03).
- Primer ingreso y recuperación de contraseña (SPEC 04).
- Historial filtrable y exportación (SPEC 08).
- Notificaciones (SPEC 09).
- Tiempo real con Supabase Realtime (SPEC 10).

## Modelo de datos

### Enums

```sql
create type user_role        as enum ('jefe', 'tecnico', 'trabajador');
create type solicitud_estado as enum ('en_espera', 'en_proceso', 'solucionado', 'no_solucionado');
create type tecnico_estado   as enum ('disponible', 'atendiendo', 'en_oficina', 'virtual', 'descanso');
create type ayuda_tipo       as enum ('presencial', 'virtual');
```

### Tabla `areas`

```sql
create table areas (
  id     uuid primary key default gen_random_uuid(),
  nombre text not null unique
);
```

Seed de prueba (reemplazable): Tesorería, Urbanismo, Rentas,
Secretaría General, Recursos Humanos, Logística.

### Tabla `profiles`

Vinculada 1-a-1 con `auth.users`. Un trigger `on insert on auth.users`
crea la fila automáticamente.

```sql
create table profiles (
  id             uuid primary key references auth.users(id) on delete cascade,
  rol            user_role not null,
  dni            text,
  username       text not null unique,
  telefono       text,
  email          text,
  primer_ingreso boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
```

`primer_ingreso` empieza en `true`; SPEC 04 lo pone a `false` al completar
el formulario obligatorio de celular y correo.

### Tabla `solicitudes`

```sql
create table solicitudes (
  id            uuid primary key default gen_random_uuid(),
  trabajador_id uuid not null references profiles(id),
  area_id       uuid not null references areas(id),
  tipo_ayuda    ayuda_tipo not null,
  titulo        text not null,
  descripcion   text,
  estado        solicitud_estado not null default 'en_espera',
  tecnico_id    uuid references profiles(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
```

### Tabla `technician_status`

Una fila por técnico. Se crea junto con el perfil (mismo trigger).

```sql
create table technician_status (
  tecnico_id              uuid primary key references profiles(id) on delete cascade,
  estado                  tecnico_estado not null default 'disponible',
  ubicacion               text,
  atendiendo_solicitud_id uuid references solicitudes(id),
  updated_at              timestamptz not null default now()
);
```

### Políticas RLS (resumen)

| Tabla               | SELECT                                        | INSERT              | UPDATE                              | DELETE |
|---------------------|-----------------------------------------------|---------------------|-------------------------------------|--------|
| `areas`             | todos los autenticados                        | —                   | —                                   | —      |
| `profiles`          | todos los autenticados                        | solo service_role   | solo el propio usuario              | —      |
| `solicitudes`       | trabajador: las propias; técnico y jefe: todas | solo trabajador (las propias) | trabajador: las propias; técnico: las asignadas; jefe: — | — |
| `technician_status` | técnico y jefe: todas                         | solo service_role   | solo el propio técnico              | —      |

### Seed de usuarios de prueba

La migración incluye instrucciones comentadas con los datos exactos para
crear vía Supabase Auth (email, contraseña provisional) y sus filas en
`profiles`. El equipo los reemplaza antes de producción:

- 1 jefe: `jefe@muni-ica.gob.pe` / `Jefe2026!`
- 2 técnicos: `tecnico1@muni-ica.gob.pe` / `Tecnico2026!`, `tecnico2@muni-ica.gob.pe` / `Tecnico2026!`

## Plan de implementación

1. **Crear la migración con los enums.**
   Archivo `supabase/migrations/YYYYMMDDHHMMSS_schema_core.sql` con los cuatro
   `create type`. Aplicar con `npx supabase db push`.
   Verificar: `npx supabase db push` termina sin errores; los tipos aparecen en
   Supabase Dashboard → Database → Types.

2. **Crear las cuatro tablas.**
   En la misma migración, añadir `areas`, `profiles`, `solicitudes` y
   `technician_status` en ese orden (respetando las FK).
   Verificar: las tablas aparecen en Dashboard → Table Editor.

3. **Crear el trigger `handle_new_user`.**
   Función `public.handle_new_user()` que se dispara `after insert on auth.users`:
   inserta en `profiles` usando `new.raw_user_meta_data` (campos `rol`, `username`)
   y, si `rol = 'tecnico'`, inserta también una fila en `technician_status`.
   Verificar: crear un usuario de prueba en Dashboard → Auth → Users con los
   metadatos correctos y confirmar que aparece la fila en `profiles`.

4. **Habilitar RLS y agregar las políticas.**
   `alter table … enable row level security` en las cuatro tablas.
   Crear las políticas según la tabla de RLS del modelo de datos.
   Verificar: con el cliente anon, una consulta a `solicitudes` devuelve vacío (sin
   sesión no se ve nada); con un JWT de trabajador solo se ven sus propias filas.

5. **Seed de áreas.**
   `insert into areas (nombre) values (…)` con las 6 áreas de prueba.
   Verificar: `select * from areas` devuelve 6 filas.

6. **Seed de usuarios de prueba (comentado en la migración).**
   Bloque SQL comentado con los `insert` exactos para crear en Supabase Auth
   (vía `supabase.auth.admin.createUser`) los tres usuarios de prueba (1 jefe,
   2 técnicos) con sus metadatos de rol y username. El equipo los ejecuta una
   sola vez y los reemplaza antes de producción.
   Verificar: los tres usuarios existen en Auth → Users y tienen fila en `profiles`.

## Criterios de aceptación

- [ ] `npx supabase db push` aplica la migración sin errores.
- [ ] Los cuatro enums (`user_role`, `solicitud_estado`, `tecnico_estado`,
      `ayuda_tipo`) existen en Dashboard → Database → Types.
- [ ] Las tablas `areas`, `profiles`, `solicitudes` y `technician_status`
      existen con todas las columnas definidas en el modelo de datos.
- [ ] Crear un usuario con `rol = 'tecnico'` en Auth genera automáticamente
      una fila en `profiles` **y** una fila en `technician_status`.
- [ ] Crear un usuario con `rol = 'trabajador'` o `rol = 'jefe'` genera fila
      en `profiles` pero **no** en `technician_status`.
- [ ] `select * from areas` devuelve exactamente 6 filas.
- [ ] Los tres usuarios de prueba (1 jefe, 2 técnicos) existen en Auth → Users
      y tienen su fila correspondiente en `profiles`.
- [ ] Con el cliente anon (sin sesión), cualquier `select` sobre `solicitudes`,
      `profiles` o `technician_status` devuelve 0 filas (RLS bloquea).
- [ ] Con JWT de trabajador, `select * from solicitudes` devuelve solo las
      solicitudes donde `trabajador_id = auth.uid()`.
- [ ] Con JWT de técnico, `select * from solicitudes` devuelve todas las filas.
- [ ] Con JWT de jefe, `select * from solicitudes` devuelve todas las filas.
- [ ] Un técnico no puede hacer `update` en `technician_status` de otro técnico
      (la query devuelve 0 filas afectadas).
- [ ] `npm run lint` pasa sin errores en los archivos nuevos o modificados.

## Decisiones

- **Sí:** tabla `profiles` separada vinculada a `auth.users.id`. Mantiene la
  lógica de Auth de Supabase intacta y es el patrón estándar; extender
  `auth.users` directamente no es soportado.

- **Sí:** `username` en `profiles` para todos los roles, no solo trabajadores.
  Coherencia en el modelo: jefe y técnicos también necesitan un nombre de
  usuario legible para mostrarse en la UI.

- **Sí:** tabla `technician_status` separada. Evita columnas nulas en los
  perfiles de jefe y trabajador, y simplifica las políticas RLS de esa tabla.

- **Sí:** trigger `handle_new_user` en `auth.users`. La fila de `profiles`
  se crea automáticamente al registrar el usuario; no hay riesgo de usuarios
  Auth sin perfil huérfano.

- **Sí:** `primer_ingreso boolean default true` en `profiles`. Flag sencillo
  que SPEC 04 usa para detectar el primer login sin lógica extra.

- **Sí:** tabla `areas` normalizada. Permite agregar o renombrar áreas sin
  tocar el código ni hacer una migración de enum.

- **Sí:** posición en cola derivada por query (`order by created_at where
  estado = 'en_espera'`). Evita mantener un número sincronizado que se
  desincroniza con cancelaciones o reasignaciones.

- **Sí:** `tecnico_id` en `solicitudes` es el técnico que atiende (y que el
  trabajador confirma como "quien me ayudó"). Un solo campo, sin duplicar.

- **Sí:** seed de usuarios de prueba comentado en la migración. El equipo
  ejecuta el bloque una sola vez y lo reemplaza antes de producción; no
  queda lógica de seed activa en el código.

- **No:** enum para `areas`. Agregar un área nueva requeriría una migración
  de Postgres; la tabla normalizada es más flexible.

- **No:** columnas de estado del técnico dentro de `profiles`. Mezclaría
  datos de identidad con datos operativos de turno.

- **No:** RLS de solo lectura para el trabajador sobre `technician_status`.
  En el MVP el trabajador no necesita ver el estado de los técnicos; si
  cambia en un spec futuro, se agrega la política entonces.

## Riesgos

| Riesgo | Mitigación |
|--------|------------|
| El trigger `handle_new_user` falla silenciosamente si `raw_user_meta_data` no incluye `rol` o `username`, dejando un usuario Auth sin perfil. | Validar en la función que ambos campos existen; si no, lanzar `raise exception` para que la creación del usuario falle de forma visible en lugar de crear un huérfano. |
| `raw_user_meta_data->>'rol'` llega como texto y el cast a `user_role` falla si el valor no coincide exactamente con el enum (mayúsculas, tildes, etc.). | Documentar en el seed y en el `CLAUDE.md` los valores exactos aceptados; el cast fallido lanza error en Postgres y es fácil de depurar. |
| Una política RLS mal escrita puede exponer filas de otros usuarios sin que los tests lo detecten si se prueban solo con el cliente service_role (que ignora RLS). | Los criterios de aceptación exigen probar explícitamente con JWTs de cada rol usando el cliente anon, no el service_role. |
| `technician_status` puede quedar desincronizada si un técnico es eliminado de Auth pero el `on delete cascade` no se activa (ej. borrado directo en la tabla `profiles`). | La FK `profiles.id → auth.users.id on delete cascade` propaga el borrado; documentar que los usuarios solo se eliminan desde Auth, nunca directamente de `profiles`. |

## Lo que **no** está en este spec

- Login, sesión y protección de rutas — eso es SPEC 03.
- Primer ingreso y formulario obligatorio de celular y correo — eso es SPEC 04.
- Formulario de nueva solicitud y vista de cola del trabajador — eso es SPEC 05.
- Cola y atención del técnico — eso es SPEC 06.
- Panel de control del jefe con KPIs — eso es SPEC 07.
- Historial filtrable y exportación — eso es SPEC 08.
- Notificaciones — eso es SPEC 09.
- Tiempo real con Supabase Realtime — eso es SPEC 10.
- Cliente admin con `SUPABASE_SERVICE_ROLE_KEY` en el código de la app —
  se crea en el spec que lo necesite por primera vez.

Cada uno de esos puntos, si se incorpora antes de su spec, va en su propio spec.
