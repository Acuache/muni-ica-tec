# SPEC 08 — Doble confirmación y tabla completa del jefe

> **Estado:** Implementado
> **Depende de:** SPEC 02, SPEC 05, SPEC 06, SPEC 07, SPEC 07c, SPEC 07f, SPEC 07g
> **Fecha:** 2026-06-09
> **Objetivo:** Implementar la doble confirmación (técnico + trabajador) para
> cerrar solicitudes como `solucionado`, y expandir la tabla del jefe para
> mostrar todas las solicitudes con columnas completas, paginación de 10 ítems
> y acciones de intervención directa.

## Scope

**In:**

### Doble confirmación
- Migración: dos columnas nuevas en `solicitudes`:
  `confirmacion_trabajador boolean default false` y
  `confirmacion_tecnico boolean default false`.
- **Panel del técnico:** botón "Resuelto" nuevo junto al "Liberar" ya existente.
  Al pulsarlo → `confirmacion_tecnico = true`. Si en ese momento
  `confirmacion_trabajador` ya es `true` → `estado = 'solucionado'`.
  Si no → el estado sigue siendo `en_proceso` y la tarjeta muestra
  "Esperando confirmación del trabajador".
- **Panel del trabajador:** el botón "Resuelto" ahora guarda
  `confirmacion_trabajador = true`. Si `confirmacion_tecnico` ya es `true` →
  `estado = 'solucionado'`. Si no → estado sigue `en_proceso` y el panel
  muestra "Esperando confirmación del técnico" (sin botones de resolución).
  El botón "No resuelto" sigue siendo inmediato: `estado = 'no_solucionado'`
  sin necesitar confirmación del técnico.
- Lógica de transición aplicada en los Server Actions (no triggers de BD).

### Tabla completa del jefe
- La sección "Cola de Espera" del panel del jefe se reemplaza por una tabla
  "Solicitudes" que muestra TODOS los estados:
  `en_espera`, `en_proceso`, `solucionado`, `no_solucionado`, `cancelado`.
- **Por defecto:** todos los estados, ordenados por `created_at` DESC
  (más reciente primero).
- **Paginación:** 10 ítems por página, implementada con search params
  (`?page=1`); navegación con botones Anterior / Siguiente.
- **Filtro:** desplegable de estado (Todos / En Espera / En Proceso /
  Solucionado / No Solucionado / Cancelado); al cambiar resetea a página 1.
- **Columnas de la tabla:**
  | Columna             | Fuente                                          |
  |---------------------|-------------------------------------------------|
  | Fecha y hora        | `solicitudes.created_at`                        |
  | Trabajador          | `profiles.username` (= "Nombre Apellido")       |
  | Teléfono            | `profiles.telefono`                             |
  | Correo trabajador   | `profiles.email`                                |
  | Lugar / Área / Puesto | `profiles.lugar`, `profiles.area`, `profiles.puesto` |
  | Título              | `solicitudes.titulo`                            |
  | Descripción         | `solicitudes.descripcion`                       |
  | Técnico             | `profiles.username` del técnico asignado        |
  | Correo técnico      | `profiles.email` del técnico asignado           |
  | Confirmó trabajador | `confirmacion_trabajador` (✓ / ✗)               |
  | Confirmó técnico    | `confirmacion_tecnico` (✓ / ✗)                  |
  | Estado              | badge con color por estado                      |
  | Acciones del jefe   | ver abajo                                       |
- **Acciones del jefe (por fila):**
  - Toggle `confirmacion_trabajador` (marcar / desmarcar).
  - Toggle `confirmacion_tecnico` (marcar / desmarcar).
  - Al marcar ambas → `estado = 'solucionado'` automáticamente.
  - Botón "Forzar Solucionado" → `estado = 'solucionado'` directo.
  - Botón "Forzar No Solucionado" → `estado = 'no_solucionado'` directo.

**Fuera de alcance:**

- Columna AnyDesk en la tabla del jefe — no aporta valor en vista de gestión.
- Filtros por fecha, área o técnico — se añadirán en un spec posterior si
  se necesitan.
- Exportación CSV — spec posterior.
- Notificaciones — SPEC 09.
- Supabase Realtime — SPEC 10.
- Edición de campos de la solicitud por el jefe (solo puede cambiar
  confirmaciones y estado).
- Acciones del jefe sobre el estado del técnico.

## Modelo de datos

### Migración: nuevas columnas en `solicitudes`

```sql
alter table solicitudes
  add column confirmacion_trabajador boolean not null default false,
  add column confirmacion_tecnico    boolean not null default false;
```

Las solicitudes existentes quedan con ambas columnas en `false`.
No se introducen tablas ni enums nuevos.

### Migración de datos históricos

```sql
update solicitudes
  set confirmacion_trabajador = true,
      confirmacion_tecnico    = true
  where estado = 'solucionado';
```

Evita que solicitudes ya cerradas muestren ✗/✗ en la tabla del jefe.

### Columnas relevantes en este spec

| Tabla         | Columna                   | Tipo      | Origen   | Uso                                                                  |
|---------------|---------------------------|-----------|----------|----------------------------------------------------------------------|
| `solicitudes` | `confirmacion_trabajador` | `boolean` | Nueva    | El trabajador marcó "Resuelto".                                      |
| `solicitudes` | `confirmacion_tecnico`    | `boolean` | Nueva    | El técnico marcó "Resuelto".                                         |
| `solicitudes` | `estado`                  | `enum`    | SPEC 02  | Pasa a `solucionado` cuando ambas confirmaciones son `true`.         |
| `profiles`    | `username`                | `text`    | SPEC 07f | Nombre completo (trabajador o técnico).                              |
| `profiles`    | `telefono`                | `text`    | SPEC 04  | Teléfono del trabajador.                                             |
| `profiles`    | `email`                   | `text`    | SPEC 04  | Correo del trabajador o del técnico.                                 |
| `profiles`    | `lugar`, `area`, `puesto` | `text`    | SPEC 07f | Ubicación y cargo del trabajador.                                    |

### Regla de transición (aplicada en Server Actions, no en triggers)

```
confirmacion_trabajador = true  AND  confirmacion_tecnico = true
  → estado = 'solucionado'
```

Si el jefe desmarca una confirmación cuando `estado = 'solucionado'`
→ el estado vuelve a `en_proceso`.

### Consulta principal de la tabla del jefe

```sql
SELECT
  s.id,
  s.created_at,
  s.titulo,
  s.descripcion,
  s.estado,
  s.confirmacion_trabajador,
  s.confirmacion_tecnico,
  pw.username  AS trabajador_nombre,
  pw.telefono  AS trabajador_telefono,
  pw.email     AS trabajador_email,
  pw.lugar     AS trabajador_lugar,
  pw.area      AS trabajador_area,
  pw.puesto    AS trabajador_puesto,
  pt.username  AS tecnico_nombre,
  pt.email     AS tecnico_email
FROM solicitudes s
JOIN  profiles pw ON s.trabajador_id = pw.id
LEFT JOIN profiles pt ON s.tecnico_id  = pt.id
WHERE ($estado IS NULL OR s.estado = $estado)
ORDER BY s.created_at DESC
LIMIT 10 OFFSET ($pagina - 1) * 10;
```

Consulta de conteo para la paginación:

```sql
SELECT COUNT(*)
FROM solicitudes s
WHERE ($estado IS NULL OR s.estado = $estado);
```

### Server Actions nuevos / modificados

| Action                       | Quién lo llama  | Qué hace                                                                                                                                                                         |
|------------------------------|-----------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `confirmarResolucion` (mod.) | Trabajador      | Guarda `confirmacion_trabajador = true`; si `confirmacion_tecnico` ya es `true` → `solucionado`. "No resuelto" sigue siendo inmediato (`no_solucionado`).                        |
| `confirmarResolucionTecnico` | Técnico (nuevo) | Guarda `confirmacion_tecnico = true`; si `confirmacion_trabajador` ya es `true` → `solucionado`.                                                                                 |
| `toggleConfirmacionJefe`     | Jefe            | Recibe `{ solicitudId, campo: 'trabajador' \| 'tecnico', valor: boolean }`. Actualiza la columna; si ambas quedan `true` → `solucionado`; si una pasa a `false` y estado era `solucionado` → `en_proceso`. |
| `forzarEstado`               | Jefe            | Recibe `{ solicitudId, estado: 'solucionado' \| 'no_solucionado' }`. Forzar `solucionado` también pone ambas confirmaciones en `true`.                                           |

## Plan de implementación

1. **Migración de BD.**
   Ejecutar en Supabase (Dashboard → SQL Editor):
   ```sql
   alter table solicitudes
     add column confirmacion_trabajador boolean not null default false,
     add column confirmacion_tecnico    boolean not null default false;

   create index if not exists idx_solicitudes_created_at
     on solicitudes (created_at desc);

   update solicitudes
     set confirmacion_trabajador = true,
         confirmacion_tecnico    = true
     where estado = 'solucionado';
   ```
   Verificar: las dos columnas aparecen en `solicitudes`; el índice existe;
   las solicitudes históricas `solucionado` tienen ambas columnas en `true`.

2. **Modificar `confirmarResolucion` (`app/trabajador/actions.ts`).**
   - Rama "Resuelto": en lugar de `update { estado: 'solucionado' }`, leer
     primero `confirmacion_tecnico` de la fila. Si ya es `true` →
     `update { confirmacion_trabajador: true, estado: 'solucionado' }`.
     Si no → `update { confirmacion_trabajador: true }` (estado queda
     `en_proceso`).
   - Rama "No resuelto": sin cambios — sigue siendo `update { estado:
     'no_solucionado' }` directo.
   Verificar: "No resuelto" cierra la solicitud al instante; "Resuelto" sin
   confirmación del técnico deja el estado en `en_proceso` con
   `confirmacion_trabajador = true`.

3. **Actualizar el panel del trabajador (`app/trabajador/panel.tsx`).**
   Añadir la prop `confirmacionTrabajador: boolean`. Lógica de render
   dentro de `CardResolucion`:
   - Si `confirmacionTrabajador = false` → mostrar los botones "Resuelto" /
     "No resuelto" (comportamiento actual).
   - Si `confirmacionTrabajador = true` (y estado sigue `en_proceso`) →
     ocultar botones y mostrar: "Confirmaste que fue resuelto.
     Esperando confirmación del técnico."
   Actualizar `app/trabajador/page.tsx` para pasar `confirmacion_trabajador`
   de `solicitudActiva` como prop.
   Verificar: tras pulsar "Resuelto", el trabajador ve el mensaje de espera
   sin botones; cuando el estado pasa a `solucionado`, el panel vuelve al
   formulario de nueva solicitud.

4. **Nuevo Server Action `confirmarResolucionTecnico` (`app/tecnico/actions.ts`).**
   Recibe `solicitudId`. Lee `confirmacion_trabajador` de la fila. Si ya es
   `true` → `update { confirmacion_tecnico: true, estado: 'solucionado' }`.
   Si no → `update { confirmacion_tecnico: true }` (estado queda `en_proceso`).
   Verificar: con `confirmacion_trabajador = false`, solo cambia la columna;
   con `confirmacion_trabajador = true`, la solicitud pasa a `solucionado`.

5. **Actualizar el panel del técnico (`app/tecnico/`).**
   En la tarjeta de la solicitud activa (estado `en_proceso` asignada al
   técnico), junto al botón "Liberar":
   - Si `confirmacion_tecnico = false` → mostrar botón "Resuelto" que llama
     a `confirmarResolucionTecnico`.
   - Si `confirmacion_tecnico = true` (y estado sigue `en_proceso`) →
     ocultar el botón "Resuelto" y mostrar: "Confirmaste que fue resuelto.
     Esperando confirmación del trabajador."
   Actualizar la consulta de la cola del técnico para traer
   `confirmacion_tecnico` de cada solicitud asignada.
   Verificar: el flujo completo funciona en los dos órdenes (técnico primero
   / trabajador primero).

6. **Server Actions del jefe (`app/jefe/actions.ts`) — archivo nuevo.**
   - `toggleConfirmacionJefe({ solicitudId, campo, valor })`:
     Actualiza `confirmacion_trabajador` o `confirmacion_tecnico` según
     `campo`. Después releer ambas columnas desde DB:
     - Si ambas son `true` → `estado = 'solucionado'`.
     - Si alguna pasó a `false` y `estado` era `'solucionado'` →
       `estado = 'en_proceso'`.
   - `forzarEstado({ solicitudId, estado })`:
     Si `estado = 'solucionado'` → también pone ambas confirmaciones en
     `true`. Si `estado = 'no_solucionado'` → solo actualiza el estado.
   Verificar: cada acción refleja el cambio correcto en DB.

7. **Actualizar `app/jefe/page.tsx` — nueva consulta paginada.**
   Leer `searchParams` de forma asíncrona (Next 16) para extraer `page`
   (default `1`) y `estado` (default `null` = todos). Ejecutar en paralelo
   con `Promise.all`:
   - Consulta principal (10 filas con los JOINs del modelo de datos).
   - Consulta de conteo total (para calcular `totalPaginas`).
   - Consultas existentes de KPIs y estado de técnicos (sin cambios).
   Pasar `solicitudes`, `totalPaginas`, `paginaActual` y `estadoFiltro`
   como props al componente cliente.
   Verificar: `?page=2` devuelve la segunda página; `?estado=en_espera`
   filtra correctamente.

8. **Nuevo componente `TablaSolicitudes` en el panel del jefe.**
   - Reemplaza el bloque "Cola de Espera".
   - Encabezado "Solicitudes" + desplegable de filtro; al cambiar navega a
     `?estado=valor&page=1` con `useRouter`.
   - Tabla con todas las columnas del modelo de datos; confirmaciones
     muestran ✓ (verde) o ✗ (gris).
   - Columna "Acciones": toggles para `confirmacion_trabajador` y
     `confirmacion_tecnico`; botones "Forzar Solucionado" y "Forzar No
     Solucionado". Cada acción llama al Server Action y ejecuta
     `router.refresh()`.
   - Paginación: botones "Anterior" y "Siguiente" por search params;
     "Anterior" deshabilitado en página 1, "Siguiente" en la última;
     etiqueta "Página X de Y".
   Verificar: tabla muestra 10 ítems correctos; acciones modifican DB y la
   tabla se actualiza; paginación y filtro funcionan correctamente.

9. **Verificación final.**
   `npm run build` y `npm run lint` sin errores. Confirmar flujo completo:
   trabajador crea solicitud → técnico atiende → cualquiera confirma primero
   → el otro confirma → `solucionado`. Confirmar también: jefe puede
   marcar/desmarcar confirmaciones y forzar estados desde la tabla.

## Criterios de aceptación

### Migración
- [ ] Las columnas `confirmacion_trabajador` y `confirmacion_tecnico` existen
      en `solicitudes` con tipo `boolean not null default false`.
- [ ] Las solicitudes existentes con `estado = 'solucionado'` tienen ambas
      columnas en `true`.
- [ ] El índice `idx_solicitudes_created_at` existe en la tabla.

### Flujo del trabajador
- [ ] Al pulsar "Resuelto" con `confirmacion_tecnico = false`, el estado
      sigue siendo `en_proceso` y `confirmacion_trabajador` pasa a `true`.
- [ ] Tras pulsar "Resuelto" sin confirmación del técnico, el panel muestra
      "Confirmaste que fue resuelto. Esperando confirmación del técnico."
      sin botones de resolución visibles.
- [ ] Al pulsar "No resuelto", el estado pasa a `no_solucionado`
      inmediatamente, sin importar el valor de `confirmacion_tecnico`.
- [ ] Cuando ambas confirmaciones son `true`, el estado pasa a `solucionado`
      y el panel del trabajador vuelve al formulario de nueva solicitud.

### Flujo del técnico
- [ ] La tarjeta de la solicitud activa muestra el botón "Resuelto" junto
      al "Liberar" cuando `confirmacion_tecnico = false`.
- [ ] Al pulsar "Resuelto" con `confirmacion_trabajador = false`, el estado
      sigue siendo `en_proceso` y `confirmacion_tecnico` pasa a `true`.
- [ ] Tras pulsar "Resuelto" sin confirmación del trabajador, la tarjeta
      muestra "Confirmaste que fue resuelto. Esperando confirmación del
      trabajador." sin el botón "Resuelto".
- [ ] El botón "Liberar" sigue funcionando sin cambios.
- [ ] El flujo completo funciona en ambos órdenes: técnico confirma primero
      y luego trabajador; trabajador confirma primero y luego técnico.
      En ambos casos el estado final es `solucionado`.

### Tabla del jefe
- [ ] La sección "Cola de Espera" ya no existe; en su lugar aparece la
      tabla "Solicitudes".
- [ ] Por defecto muestra todos los estados ordenados por `created_at` DESC,
      10 ítems por página.
- [ ] El desplegable filtra por: Todos, En Espera, En Proceso, Solucionado,
      No Solucionado, Cancelado; al cambiar resetea a página 1.
- [ ] Cada fila muestra: fecha/hora, nombre completo del trabajador,
      teléfono, correo, lugar, área, puesto, título, descripción, nombre
      del técnico, correo del técnico, confirmación del trabajador (✓/✗),
      confirmación del técnico (✓/✗) y estado.
- [ ] Las solicitudes sin técnico asignado muestran las columnas de técnico
      vacías sin error.
- [ ] La paginación muestra "Página X de Y"; "Anterior" deshabilitado en
      página 1; "Siguiente" deshabilitado en la última.

### Acciones del jefe
- [ ] El jefe puede marcar `confirmacion_trabajador`; si `confirmacion_tecnico`
      ya es `true`, el estado pasa a `solucionado`.
- [ ] El jefe puede desmarcar `confirmacion_trabajador`; si el estado era
      `solucionado`, vuelve a `en_proceso`.
- [ ] El jefe puede marcar y desmarcar `confirmacion_tecnico` con la misma
      lógica.
- [ ] "Forzar Solucionado" pone ambas confirmaciones en `true` y el estado
      en `solucionado`.
- [ ] "Forzar No Solucionado" pone el estado en `no_solucionado`
      directamente.
- [ ] Después de cada acción del jefe, la tabla se actualiza con los datos
      nuevos.

### General
- [ ] `npm run build` y `npm run lint` pasan sin errores.

## Decisiones

- **Sí:** columnas booleanas `confirmacion_trabajador` / `confirmacion_tecnico`
  en lugar de nuevos valores en el enum de estado. Las columnas permiten ver
  el estado de cada parte de forma independiente y mantienen el enum limpio
  para que los filtros del jefe sigan siendo directos.

- **Sí:** lógica de transición a `solucionado` en los Server Actions, no en
  triggers de BD. El volumen de transacciones es bajo y el código en el
  Server Action es más fácil de leer, depurar y modificar que un trigger SQL.

- **Sí:** "No resuelto" del trabajador sigue siendo inmediato, sin requerir
  confirmación del técnico. El trabajador es quien recibió la ayuda; si
  declara que no se resolvió, es definitivo desde su perspectiva.

- **Sí:** la tabla "Solicitudes" del jefe reemplaza "Cola de Espera" en lugar
  de convivir con ella. La nueva tabla engloba todo lo que la anterior
  mostraba más el historial completo; duplicar sería confuso.

- **Sí:** paginación con search params (`?page=1&estado=...`). Funciona de
  forma natural con el App Router de Next 16; la URL queda compartible y los
  botones del navegador funcionan correctamente.

- **Sí:** desmarcar una confirmación del jefe cuando estado es `solucionado`
  revierte a `en_proceso`. Si se quita una confirmación, el cierre deja de
  ser válido; dejarlo en `solucionado` con una confirmación en `false` sería
  inconsistente.

- **Sí:** "Forzar Solucionado" también pone ambas confirmaciones en `true`.
  Evita tener `estado = 'solucionado'` con confirmaciones en `false`, lo que
  produciría indicadores contradictorios en la tabla (✗/✗ pero cerrado).

- **Sí:** migración de datos históricos para solicitudes `solucionado`.
  Evita que registros anteriores a este spec aparezcan con ✗/✗ en la tabla
  del jefe pese a estar cerrados correctamente.

- **No:** triggers de BD para la transición automática a `solucionado`.
  Añade lógica en Postgres difícil de inspeccionar desde la aplicación y
  sin beneficio real al nivel de carga actual.

- **No:** filtros por fecha, área o técnico. Se añadirán en un spec posterior
  si el equipo los necesita; el filtro por estado cubre el caso principal.

- **No:** columna AnyDesk en la tabla del jefe. Confirmado por el usuario.

## Riesgos

| Riesgo | Mitigación |
|--------|-----------|
| **RLS del jefe insuficiente para UPDATE.** Las políticas de SPEC 02 permiten al jefe leer `solicitudes`, pero probablemente no escribir. Los Server Actions `toggleConfirmacionJefe` y `forzarEstado` necesitan `FOR UPDATE` en la política del jefe. | Antes del paso 6, verificar en Dashboard → Authentication → Policies que el rol `jefe` tiene política `FOR UPDATE` en `solicitudes`. Si no existe, añadirla en la migración. Alternativa: ejecutar esos actions con el cliente `service_role` (solo server-side). |
| **Condición de carrera en la doble confirmación.** Si trabajador y técnico pulsan "Resuelto" al mismo tiempo, ambos Server Actions podrían leer `confirmacion_otro = false` y ninguno activar la transición a `solucionado`. | Después de actualizar la propia columna, releer ambas desde DB. Si ambas son `true`, ejecutar el UPDATE a `solucionado`. En el peor caso queda una solicitud con ambas columnas en `true` y estado `en_proceso`; el jefe puede forzar el cierre desde la tabla. |
| **Rendimiento de la consulta paginada.** `ORDER BY created_at DESC` sin índice puede degradarse con volumen. | Índice `idx_solicitudes_created_at` incluido en la migración del paso 1. |
| **`searchParams` asíncrono en Next 16.** Accederlos de forma síncrona causa build error. | En `app/jefe/page.tsx` usar `const { page, estado } = await searchParams;` siguiendo la guía en `.agents/skills/next-best-practices/`. |
