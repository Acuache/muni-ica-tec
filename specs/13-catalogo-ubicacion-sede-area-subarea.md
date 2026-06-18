# SPEC 13 — Catálogo de ubicación: Sede → Área → Subárea → Puesto

> **Estado:** Implementado · **Depende de:** SPEC 02 (esquema base), SPEC 07f (formulario de primer ingreso) · **Fecha:** 2026-06-18
> **Objetivo:** Reemplazar los campos de texto libre del primer ingreso por un catálogo normalizado Sede → Área → Subárea con selects en cascada más un Puesto de 3 valores fijos, guardando el nombre elegido como texto en `profiles` (`sede`, `area`, `subarea`, `puesto`) y eliminando la tabla `areas` y la columna `solicitudes.area_id` que quedaron sin uso.

## Por qué este spec existe

SPEC 07f reemplazó el formulario de dos campos del primer ingreso por tres inputs de
texto libre (Lugar, Área, Puesto) y dejó explícitamente para "un spec posterior cuando
se definan los catálogos" convertirlos en `<select>`. Ese momento llegó: ahora hay un
organigrama oficial (sede → área → subárea) y un conjunto fijo de puestos. Este spec
formaliza esa jerarquía como catálogo en la base, la conecta a selects en cascada en el
primer ingreso y, de paso, elimina la tabla `areas` y la columna `solicitudes.area_id`
que quedaron muertas (SPEC 07g volvió `area_id` nullable y ningún código consulta `areas`).

## Alcance

**Dentro:**

- **Catálogo normalizado nuevo:** tablas `sedes`, `areas` (con `sede_id`) y `subareas`
  (con `area_id`), con un campo `orden` para mantener el orden numérico del organigrama.
- **Limpieza de lo muerto:** eliminar la tabla `areas` vieja (y su seed de 6 áreas de
  prueba) y la columna `solicitudes.area_id` (nullable, sin uso). Incluye quitar
  `area_id` del `SELECT` en `app/trabajador/page.tsx` y del tipo `Solicitud` en
  `app/trabajador/panel.tsx`.
- **Columnas de `profiles`:** renombrar `lugar` → `sede` y añadir `subarea text`. Las
  columnas siguen siendo texto (modelo snapshot) y nullable.
- **`puesto`:** validación con 3 valores fijos (`Jefe de área`, `Secretaria`,
  `Trabajador`) mediante `CHECK` sobre la columna `puesto` ya existente.
- **Formulario de primer ingreso** (`app/primer-ingreso/page.tsx`), sección "Datos del
  lugar": reemplazar los 3 inputs de texto por **4 selects**:
  - **Sede** — único habilitado al inicio.
  - **Área** — se habilita al elegir Sede; muestra las áreas de esa sede.
  - **Subárea** — se habilita al elegir Área; muestra las subáreas de esa área (siempre
    obligatorio, aunque haya una sola).
  - **Puesto** — independiente, siempre habilitado, 3 opciones fijas.
- **Server Action** `completarPrimerIngreso`: validar que la combinación sede/área/subárea
  elegida existe en el catálogo y que el puesto es uno de los 3 válidos; guardar los
  **nombres** en `profiles.sede/area/subarea/puesto`.
- **Carga del catálogo:** la página de primer ingreso recibe el catálogo completo desde
  el servidor (Server Component) y el cascade filtra en el cliente.
- **Lecturas existentes:** actualizar al rename `lugar`→`sede` y **mostrar también
  `subarea`** donde hoy se muestran esos datos: panel del técnico, tabla del jefe, panel
  del trabajador y reportes PDF.
- **Seed:** 1 sede (`Sede Central`), 17 áreas y 45 subáreas, verbatim salvo el ajuste de
  "Y"→"y" en 15/15.1.

**Fuera de alcance (specs posteriores):**

- Sedes **Campo Ferial** y **Desarrollo Social** y sus áreas/subáreas — se siembran
  cuando se tenga el desglose.
- Edición de sede/área/subárea/puesto desde el perfil tras el primer ingreso — spec de
  edición de perfil.
- UI de administración del catálogo (alta/baja/edición de sedes/áreas/subáreas) — por
  ahora se gestiona por SQL/migración.
- Migrar usuarios existentes (texto libre) al catálogo — se quedan como están (son de prueba).
- Volver a pedir área en "Nueva Solicitud" — el área del trabajador sigue viniendo de su perfil.

## Modelo de datos

### Tablas de catálogo (nuevas)

```sql
create table sedes (
  id     uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  orden  int  not null default 0
);

create table areas (                       -- se RECREA (la vieja se elimina antes)
  id      uuid primary key default gen_random_uuid(),
  sede_id uuid not null references sedes(id) on delete cascade,
  nombre  text not null,
  orden   int  not null default 0,
  unique (sede_id, nombre)
);

create table subareas (
  id      uuid primary key default gen_random_uuid(),
  area_id uuid not null references areas(id) on delete cascade,
  nombre  text not null,
  orden   int  not null default 0,
  unique (area_id, nombre)
);
```

- `orden` guarda el número del organigrama (1, 2, … / 1.1, 1.2, …) para listar en el
  mismo orden.
- Índices en las FK (`areas.sede_id`, `subareas.area_id`) siguiendo SPEC 11.
- RLS: `SELECT` para todos los autenticados; sin políticas de escritura (el catálogo se
  gestiona por SQL/migración), igual que la `areas` original en SPEC 02.

### Cambios en `profiles`

```sql
alter table profiles rename column lugar to sede;   -- lugar pasa a llamarse sede
alter table profiles add column subarea text;        -- nueva, nullable

alter table profiles
  add constraint profiles_puesto_check
  check (puesto in ('Jefe de área', 'Secretaria', 'Trabajador'))
  not valid;                                          -- NOT VALID: no rechaza filas viejas
```

- `sede`, `area`, `subarea` siguen siendo **texto nullable** (modelo snapshot).
- El `CHECK` es **`NOT VALID`** a propósito: las filas de prueba existentes tienen
  `puesto` en texto libre y un check normal las rechazaría. `NOT VALID` valida solo
  inserciones/actualizaciones futuras y deja las viejas como están.

### Eliminación de lo muerto

```sql
alter table solicitudes drop column area_id;   -- vestigial, nullable, sin uso (arrastra su FK)
drop table areas;                              -- la vieja, antes de recrearla con el nuevo esquema
```

Orden en la migración: primero `drop column area_id`, luego `drop table areas`, luego
crear `sedes` / `areas` (nueva) / `subareas`.

### Flujo de datos del formulario

Los selects trabajan con **`id`** internamente, pero en `profiles` se guardan **nombres**:

- El Server Component carga las 3 tablas completas (catálogo chico: 1 sede, 17 áreas,
  45 subáreas) y las pasa al cliente.
- El cliente arma el cascade filtrando `areas` por `sede_id` y `subareas` por `area_id`.
- El formulario envía `sede_id`, `area_id`, `subarea_id`, `puesto`.
- El Server Action **valida la jerarquía contra el catálogo** (que `area.sede_id` =
  `sede_id` y `subarea.area_id` = `area_id`), obtiene los **nombres canónicos** y los
  guarda en `profiles.sede/area/subarea`; valida que `puesto` sea uno de los 3.

Guardar `id` + resolver el nombre en el servidor da validación real de la combinación
(no se confía en el cliente), aunque en `profiles` quede el texto.

### Catálogo a sembrar (Sede Central) — referencia verbatim

`sede`: **Sede Central**. Áreas (`orden` = número entero) y sus subáreas
(`orden` = decimal). Texto exacto a insertar:

```
1.  Sala de Regidores
    1.1.  Sala de Regidores
2.  Órgano de Control Institucional
    2.1.  Órgano de Control Institucional
3.  Procuraduría Pública Municipal
    3.1.  Procuraduría Pública Municipal
4.  Alcaldía
    4.1.  Alcaldía
5.  Oficina de Secretaria General
    5.1.  Oficina de Secretaria General
6.  Gerencia Municipal
    6.1.  Gerencia Municipal
    6.2.  Unidad de Ejecución Coactiva
    6.3.  Unidad de Relaciones Públicas e Imagen Institucional
    6.4.  Oficina de Integridad Institucional
7.  Oficina de Gestión de Recursos Humanos
    7.1.  Oficina de Gestión de Recursos Humanos
8.  Oficina de Administración
    8.1.  Oficina de Administración
    8.2.  Unidad de Tesorería
    8.3.  Unidad de Contabilidad
    8.4.  Unidad de Abastecimiento
    8.5.  Unidad de Control Patrimonial y Equipo Mecánico
    8.6.  Unidad de Tecnologías de Información
9.  Oficina de Asesoría Jurídica
    9.1.  Oficina de Asesoría Jurídica
10. Oficina de Planeamiento Presupuesto y Racionalización
    10.1. Oficina de Planeamiento Presupuesto y Racionalización
    10.2. Unidad de Presupuesto
    10.3. Unidad de Planeamiento, Programación e Inversiones
    10.4. Unidad de Racionalización y Modernización de la Gestión
11. Gerencia de Desarrollo Económico y Seguridad Ciudadana
    11.1. Gerencia de Desarrollo Económico y Seguridad Ciudadana
    11.2. Subgerencia de Turismo
    11.3. Subgerencia de Seguridad Ciudadana y Policía Municipal
    11.4. Subgerencia de Desarrollo Económico, Promoción Empresarial y Fiscalización
    11.5. Subgerencia de Gestión de Riesgo de Desastres
12. Gerencia de Gestión de Protección del Ambiente y Salubridad
    12.1. Gerencia de Gestión de Protección del Ambiente y Salubridad
    12.2. Subgerencia de Control Ambiental y Salubridad
    12.3. Subgerencia, Parques y Jardines, Áreas Verdes y Omato
    12.4. Subgerencia, Limpieza Pública
13. Gerencia de Desarrollo Social
    13.1. Gerencia de Desarrollo Social
    13.2. Subgerencia de Programas Sociales
    13.3. Subgerencia de Promoción, Prevención de la Salud y Registro Civil
    13.4. Subgerencia de Participación Ciudadana, Juventud, Educación Cultural y Deportes
14. Gerencia de Transportes y Movilidad Urbana
    14.1. Gerencia de Transportes y Movilidad Urbana
    14.2. Subgerencia de Transporte Movilidad Urbana y Seguridad Vial
    14.3. Subgerencia de Fiscalización y Sanciones
15. Gerencia de Desarrollo Urbano y Acondicionamiento Territorial
    15.1. Gerencia de Desarrollo Urbano y Acondicionamiento Territorial
    15.2. Subgerencia de Obras Públicas
    15.3. Subgerencia de Supervisión y Liquidación de Obras
    15.4. Subgerencia de Asentamientos Humanos
    15.5. Subgerencia de Obras Privadas y Calastro
    15.6. Subgerencia de Estudios, Proyectos y Unidad de Formuladora
16. Instituto Vial Provincial
    16.1. Instituto Vial Provincial
17. Agencia Municipal de Huacachina
    17.1. Agencia Municipal de Huacachina
```

> Nota: los textos `Omato` (12.3), `Calastro` (15.5) y `Subgerencia,` (12.3 y 12.4) se
> dejan tal cual por decisión explícita del usuario, que verificó la lista. Pueden
> corregirse luego vía SQL.

### Puesto — valores fijos

`Jefe de área`, `Secretaria`, `Trabajador`. No hay tabla ni enum: viven en el `<select>`
y los valida el `CHECK` de `profiles` y el Server Action.

## Plan de implementación

1. **Migración A — limpieza + tablas de catálogo + código del trabajador.**
   En una migración nueva en `supabase/migrations/`:
   `alter table solicitudes drop column area_id;` → `drop table areas;` (la vieja) →
   crear `sedes`, `areas` (nueva) y `subareas` con sus índices de FK y RLS (`SELECT`
   para autenticados, sin escritura).
   En código: quitar `area_id` del `select` en `app/trabajador/page.tsx` y del tipo
   `Solicitud` en `app/trabajador/panel.tsx`.
   *Verificar:* `npm run build` y `npm run lint` pasan; las tres tablas existen vacías;
   `solicitudes.area_id` ya no existe; la app levanta.

2. **Migración B — seed de Sede Central.**
   `insert` de 1 sede, 17 áreas (`orden` 1–17) y 45 subáreas (`orden` según el decimal),
   texto verbatim según el catálogo de referencia de arriba.
   *Verificar:* `select count(*)` devuelve 1 sede, 17 áreas, 45 subáreas; las subáreas
   cuelgan del área correcta.

3. **Migración C + alinear las 4 lecturas + acción mínima — rename `lugar`→`sede`,
   `subarea`, CHECK de `puesto`.**
   Migración: `rename column lugar to sede`, `add column subarea text`,
   `add constraint profiles_puesto_check … not valid`.
   Actualizar a `sede` y **mostrar `subarea`** en: `app/tecnico/page.tsx` +
   `app/tecnico/panel.tsx`; `app/jefe/solicitudes/page.tsx` +
   `app/jefe/tabla-solicitudes.tsx`; `app/trabajador/page.tsx` +
   `app/trabajador/panel.tsx`; `lib/reportes/generar.ts` + `lib/reportes/pdf.ts`.
   `app/primer-ingreso/actions.ts`: escribir en la columna `sede` (el formulario sigue
   con inputs de texto por ahora; `subarea` queda `null`).
   *Verificar:* build/lint OK; los paneles muestran Sede y Subárea (— para usuarios
   viejos); el primer ingreso con texto sigue guardando sin error.

4. **Cascade en el primer ingreso — formulario + acción.**
   `app/primer-ingreso/page.tsx` → Server Component que carga el catálogo (`sedes`,
   `areas`, `subareas`) y lo pasa a un componente cliente nuevo (p. ej. `formulario.tsx`);
   reemplazar los 3 inputs de "Datos del lugar" por **4 selects**: Sede (habilitado),
   Área (se habilita al elegir Sede), Subárea (se habilita al elegir Área), Puesto
   (independiente, 3 opciones fijas).
   `app/primer-ingreso/actions.ts` → recibir `sede_id`/`area_id`/`subarea_id`/`puesto`,
   validar la jerarquía contra el catálogo, resolver nombres, validar `puesto`, guardar
   en `profiles.sede/area/subarea/puesto`.
   *(Implementación: consultar `.agents/skills/next-best-practices` para el patrón de
   pasar datos de Server a Client Component, según la advertencia de `AGENTS.md`.)*
   *Verificar:* el cascade habilita en orden; una combinación válida guarda los nombres
   correctos y `primer_ingreso=false`; combinación incompleta o inválida → error visible.

Cada paso queda commiteable y deja la app funcionando. El paso 3 es el más grande (toca
8 archivos + migración), pero el *rename* obliga a tocar todas las lecturas juntas para
no romper el build.

## Criterios de aceptación

**Base de datos**

- [ ] Existen las tablas `sedes`, `areas` y `subareas` con `id`, `nombre`, `orden` y las
      FK (`areas.sede_id`, `subareas.area_id`).
- [ ] `solicitudes.area_id` ya no existe y la tabla `areas` vieja (esquema `id, nombre`)
      fue reemplazada por la nueva (con `sede_id`).
- [ ] `profiles` tiene la columna `sede` (ya no `lugar`) y la columna `subarea`.
- [ ] Existe el constraint `profiles_puesto_check` (`NOT VALID`); un `update` de `puesto`
      con un valor fuera de los 3 permitidos falla, y las filas viejas no fueron rechazadas.
- [ ] `select count(*)` devuelve 1 sede, 17 áreas y 45 subáreas; cada subárea cuelga de
      su área correcta.
- [ ] Un usuario autenticado puede hacer `SELECT` sobre `sedes`, `areas` y `subareas`.

**Formulario de primer ingreso**

- [ ] Al cargar, solo el select **Sede** está habilitado; **Área** y **Subárea** están
      deshabilitados.
- [ ] Al elegir Sede, **Área** se habilita y lista las 17 áreas de Sede Central en orden.
- [ ] Al elegir Área, **Subárea** se habilita y lista solo las subáreas de esa área.
- [ ] El select **Puesto** está habilitado desde el inicio con exactamente 3 opciones:
      `Jefe de área`, `Secretaria`, `Trabajador`.
- [ ] El formulario no se envía si falta Sede, Área, Subárea o Puesto; se muestra error.
- [ ] Una combinación válida guarda en `profiles.sede/area/subarea/puesto` los **nombres**
      correctos y pone `primer_ingreso = false`.
- [ ] Una combinación manipulada inválida (área que no pertenece a la sede, o subárea que
      no pertenece al área) hace que el Server Action devuelva error y no guarde.
- [ ] Un `puesto` fuera de los 3 valores hace que el Server Action devuelva error.

**Lecturas (rename + subárea)**

- [ ] El panel del técnico muestra Sede, Área, Subárea y Puesto del solicitante.
- [ ] La tabla del jefe muestra Sede, Área, Subárea y Puesto del trabajador.
- [ ] El panel del trabajador muestra Sede, Área, Subárea y Puesto.
- [ ] El reporte PDF incluye Sede, Área, Subárea y Puesto.
- [ ] Los usuarios existentes (texto libre, `primer_ingreso = false`) se leen sin error:
      `sede` conserva el valor que tenía en `lugar`, `subarea` aparece como `—`.

**General**

- [ ] `npm run build` y `npm run lint` pasan sin errores.

## Decisiones

- **Sí:** modelo **texto/snapshot** — el catálogo (`sedes`/`areas`/`subareas`) solo
  alimenta los selects y en `profiles` se guarda el **nombre** elegido. Cero cambios
  estructurales en las lecturas (técnico, jefe, reportes) y coherente con el patrón ya
  existente de SPEC 07f. Costo aceptado: si se renombra un nombre del catálogo, los
  perfiles ya guardados no se auto-actualizan.

- **No:** FK normalizado (`sede_id`/`area_id`/`subarea_id` en `profiles`). Más íntegro,
  pero obligaría a hacer join en todas las lecturas para traer nombres; sobredimensionado
  para un dato que es "dónde estaba el usuario al registrarse".

- **Sí:** **eliminar** `solicitudes.area_id` y la tabla `areas` vieja. Ambas quedaron
  muertas (SPEC 07g volvió `area_id` nullable y nadie consulta `areas`); recrear `areas`
  con el esquema nuevo es más limpio que parchear el viejo.

- **Sí:** enviar `id` desde el formulario y **resolver el nombre en el servidor**. Da
  validación real de la jerarquía contra el catálogo (no se confía en el cliente), aunque
  en `profiles` quede texto.

- **Sí:** `puesto` con **`CHECK NOT VALID`**, sin tabla catálogo. Son 3 valores fijos que
  no cambian; el `CHECK` impone la regla en la base (filosofía RLS del proyecto) y
  `NOT VALID` evita rechazar las filas de prueba existentes.

- **No:** tabla `puestos` ni enum `puesto_tipo`. Una tabla es overkill para 3 valores
  fijos; el enum exigiría migración para cualquier cambio y es más rígido que el `CHECK`.

- **Sí:** renombrar `profiles.lugar` → `sede`. Es el momento de formalizar la jerarquía;
  `lugar` era ambiguo y ahora el dato es claramente la sede. Costo asumido: tocar las 4
  lecturas en el mismo paso.

- **Sí:** **Subárea siempre obligatoria**, aunque el área tenga una sola subárea. Flujo
  uniforme y simple; coincide con el cascade que el usuario describió (el input de
  subárea siempre aparece).

- **No:** autoseleccionar/ocultar la subárea cuando hay una sola. Añadiría lógica
  condicional al formulario sin beneficio claro en este contexto interno.

- **Sí:** **Puesto independiente** del cascade y siempre habilitado. El puesto no depende
  de la sede ni del área.

- **Sí:** etiquetas estándar (`Jefe de área`, `Secretaria`, `Trabajador`), no la forma
  inclusiva con "@". Más limpias para guardar y mostrar.

- **Sí:** seed **solo de Sede Central** (1 sede, 17 áreas, 45 subáreas). Es el único
  desglose disponible; Campo Ferial y Desarrollo Social se siembran cuando se tenga su
  organigrama.

- **Sí:** catálogo **verbatim** según lo entregado, salvo "Y"→"y" en 15/15.1. El usuario
  verificó la lista; los textos `Omato`, `Calastro` y `Subgerencia,` quedan tal cual por
  decisión explícita y pueden corregirse luego vía SQL.

- **No:** migrar usuarios existentes (texto libre) al catálogo. Son datos de prueba; la
  edición de perfil es otro spec.

## Riesgos

| Riesgo | Mitigación |
|--------|------------|
| El rename `lugar`→`sede` y el `drop column area_id` rompen el build si se olvida actualizar alguna lectura. | El paso 3 incluye `build` + `lint` y un `grep` final de `lugar`/`area_id` para confirmar que no queda ninguna referencia. |
| El `CHECK NOT VALID` deja filas viejas con `puesto` en texto libre; un `VALIDATE CONSTRAINT` futuro fallaría sobre ellas. | No se valida el constraint sobre las filas viejas; quedan *grandfathered*. Se documenta en la migración que un `VALIDATE` requeriría limpiar antes esas filas de prueba. |
| Sembrar una sede sin áreas (al añadir Campo Ferial / Desarrollo Social después) dejaría el cascade sin salida: Sede elegible pero Área vacía. | Regla documentada: no insertar una sede sin al menos un área. En este spec solo se siembra Sede Central, que sí tiene áreas. |
| Si el catálogo se cargara con el cliente anónimo, RLS devolvería vacío y los selects saldrían sin datos. | El catálogo se carga en el Server Component con el cliente de servidor autenticado (sesión del usuario en primer ingreso). |
| Ejecutar el DDL fuera de orden (crear `areas` nueva antes de borrar la vieja) aborta la migración. | Orden fijo y documentado en la migración: `drop column area_id` → `drop table areas` → crear catálogo. |

## Lo que **no** está en este spec

- Sedes **Campo Ferial** y **Desarrollo Social** y sus áreas/subáreas — se siembran
  cuando se tenga su organigrama.
- Edición de sede/área/subárea/puesto desde el perfil tras el primer ingreso — spec de
  edición de perfil.
- UI de administración del catálogo (CRUD de sedes/áreas/subáreas) — por ahora se
  gestiona por SQL/migración.
- Migración de usuarios existentes (texto libre) al catálogo.
- Volver a pedir área en el formulario de "Nueva Solicitud".

Cada uno de esos puntos, si se incorpora, va en su propio spec.
