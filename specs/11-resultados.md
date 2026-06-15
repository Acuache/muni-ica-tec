# SPEC 11 — Resultados de optimización (línea base y antes/después)

> Evidencia de la optimización definida en
> [11-optimizacion-rendimiento.md](./11-optimizacion-rendimiento.md).
> El spec define el método; este archivo guarda las mediciones.

## Nota de método (decisiones tomadas con el usuario)

- **Volumen de datos:** la base tiene **23 solicitudes, 4 perfiles, 2
  estados de técnico, 6 áreas**. A ese volumen el planner de Postgres ignora
  los índices (un `Seq Scan` de 23 filas es más barato que un índice). Por
  eso la usabilidad de cada índice se verifica **forzando el planner**
  (`SET enable_seqscan = off`), no sembrando datos sintéticos (decisión 1.b).
- **Herramienta:** no hay `psql` ni driver de Postgres local. Se mide con una
  función temporal `explain_sql(text, boolean)` (migración
  `20260615000001`, SECURITY DEFINER, EXECUTE solo a `service_role`),
  invocada vía `supabase-js` (decisión 2.a). **Se elimina en el cierre del
  spec** (migración `20260615000099`).

---

## Paso 1 — Línea base

### 1.a · Build (`npm run build`)

- **Warnings:** ninguno. El build de Turbopack (Next 16.2.7) **no imprime la
  tabla de tamaños "First Load JS"** por ruta; se mide el bundle por
  inspección de `.next` (abajo).
- **Rutas generadas:** 17 (`/`, `/login`, `/primer-ingreso`,
  `/solicitar-recuperacion`, `/actualizar-contrasena`, `/auth/callback`,
  paneles trabajador/técnico/jefe + perfiles + `/jefe/solicitudes`,
  `/jefe/reportes`, 2 rutas API). Estáticas: `/`, `/_not-found`, `/login`,
  `/primer-ingreso`, `/solicitar-recuperacion`. El resto, dinámicas (ƒ).
- **Bundle de cliente (`.next/static/chunks`): 964 KB** en total.
- **`jspdf` / `jspdf-autotable` en el bundle de CLIENTE:** **NO aparecen**
  (`grep` sobre `.next/static/chunks` → vacío). La generación de PDF es
  100% server-side (route handler `/api/jefe/reportes/actual` + action
  `generarReporteManual` → `lib/reportes/generar.ts` → `lib/reportes/pdf.ts`).
  → El criterio "jspdf fuera del bundle inicial de cliente" **ya se cumple**.
  - Pendiente real (paso 7): `pdf.ts` importa `jspdf`/`jspdf-autotable` de
    forma **estática**, así que entran al grafo de módulos **del servidor**
    de la ruta de reportes aunque solo se visualice la página (sin generar).
    El import dinámico los difiere hasta el momento de generar.

### 1.b · EXPLAIN de las consultas recurrentes

Plan **natural** (volumen real) vs. plan **forzado** (`enable_seqscan=off`,
muestra qué índice es usable). Tablas: `solicitudes` (23), `technician_status` (2).

| Consulta (panel) | Plan natural | Forzado (índice usable) |
|---|---|---|
| count `en_espera` (téc/jefe) | Index Scan (único parcial) | Index Scan ✓ |
| solicitud activa del trabajador | Index Scan (único parcial, por `trabajador_id`) | Index Scan ✓ |
| posición en cola (count + subquery por id) | Seq Scan en subquery por `id` | Index Scan `pkey` ✓ |
| **solucionado hoy** (`estado` + `updated_at`) | **Seq Scan** | **Seq Scan (sin índice usable)** ✗ |
| **no_solucionado hoy** (`estado` + `updated_at`) | **Seq Scan** | **Seq Scan (sin índice usable)** ✗ |
| solicitud en proceso del técnico (`tecnico_id`+`estado`) | Index Scan (único parcial) | Index Scan ✓ |
| cola `en_espera` ordenada | Index Scan (único parcial) + Sort | Index Scan ✓ |
| tabla jefe (orden `created_at` + limit) | Seq Scan + Sort | Index Scan `idx_solicitudes_created_at` ✓ |
| count total solicitudes | Seq Scan | Index Only Scan `created_at` ✓ |
| estado del técnico por `tecnico_id` (PK) | Seq Scan | Index Scan `pkey` ✓ |
| todos los estados (orden `tecnico_id`) | Seq Scan + Sort | Index Scan `pkey` ✓ |

**Conclusión de la línea base:** el único hueco real de índice es
**`solicitudes(estado, updated_at)`** para las métricas "de hoy" — es la
única consulta que sigue en `Seq Scan` **incluso forzando el planner**
(no hay índice que la cubra). Todas las demás ya tienen un índice usable
(único parcial del SPEC 10, `idx_solicitudes_created_at` del SPEC 08, PKs);
su `Seq Scan` natural es solo efecto del volumen diminuto. → El paso 2 crea
ese índice y deja documentado que el resto ya está cubierto.

### 1.c · Consultas a la base por ciclo de polling

Cada panel refresca con `router.refresh()` cada 180 s, que re-ejecuta el
Server Component (page + layout). Conteo de consultas a la base por refresco:

| Panel | Consultas por refresco | Detalle |
|---|---|---|
| **Trabajador** | 3–5 | layout `username`; page: perfil, solicitud activa, y si hay activa: posición (RPC) + nombre del técnico |
| **Técnico** | 5–6 | layout `username`; page: perfil, estado, count `en_espera`, count solucionado hoy, y cola **o** solicitud en proceso |
| **Jefe (panel)** | 6–7 | layout `username`; page: perfil, 3 counts (espera/solucionado/no_solucionado), estados de técnicos, y si hay atendiendo: nombres de trabajadores |
| **Jefe (solicitudes)** | 3–4 | perfil, página de solicitudes, count total, y count "marcar todos" si filtro = en_proceso |

Notas para los pasos 4–5:
- Los 3 counts del panel del jefe son sobre `solicitudes` y podrían
  consolidarse en una sola consulta con agregación condicional.
- `select('*')` con `head: true` (solo count) aparece en los counts de
  técnico/jefe: traen `head` (no filas) pero piden `*` como columna de
  conteo; se cambiará a una columna concreta o `count` explícito (paso 4).
- El polling hoy **no se pausa** con la pestaña oculta y **siempre
  re-renderiza** (paso 5).

---

## Paso 2 — Índices

Migración `20260615000002_spec11_indices.sql` (**aplicada en Supabase**):
un único índice nuevo, `idx_solicitudes_estado_updated_at` sobre
`solicitudes (estado, updated_at)`.

### Verificación (EXPLAIN forzado, antes → después)

| Consulta | Antes (forzado) | Después (forzado) |
|---|---|---|
| solucionado hoy | **Seq Scan** (sin índice usable) | **Index Only Scan** `idx_solicitudes_estado_updated_at`, `Index Cond: (estado = 'solucionado' AND updated_at >= …)` |
| no_solucionado hoy | **Seq Scan** (sin índice usable) | **Index Only Scan** `idx_solicitudes_estado_updated_at`, `Index Cond: (estado = 'no_solucionado' AND updated_at >= …)` |

Era la única consulta recurrente sin índice usable; ahora todas las
consultas del polling tienen un índice que las cubre (verificado forzando el
planner). No se crearon más índices: el resto ya estaba cubierto y cada
índice extra penaliza las escrituras de `solicitudes`.

---

## Paso 3 — RLS eficiente

Migración `20260615000003_spec11_rls_eficiente.sql` (**aplicada en Supabase**):
se reescribieron 8 políticas envolviendo cada `auth.uid()` en
`(select auth.uid())` para que Postgres lo evalúe una vez por consulta
(InitPlan cacheado) en lugar de una vez por fila — patrón recomendado por
`supabase-postgres-best-practices` (security-rls-performance, 5–10×).

- **Políticas reescritas (8):** `profiles_update_own`, `solicitudes_select`,
  `solicitudes_insert_trabajador`, `solicitudes_update_trabajador`,
  `solicitudes_update_tecnico`, `technician_status_select`,
  `technician_status_update_own`, `technician_status_insert_own`.
- **Sin tocar (2):** `areas_select_authenticated` y
  `profiles_select_authenticated` son `using (true)` — no tienen funciones
  por fila.
- **Solo cambian las expresiones `auth.uid()`**; roles (`to authenticated`),
  columnas (GRANTs del SPEC 10) y semántica quedan idénticos.

### Verificación — los permisos no cambiaron

Batería de pruebas negativas idéntica a la del SPEC 10, con cliente `anon`
y sesión de técnico, tras la reescritura: **11/11 PASS**.

- anon: no ejecuta `get_posicion_en_cola`, no lee `solicitudes`.
- técnico: no cambia su `rol`, no inserta en `areas` ni `solicitudes`, no
  edita `titulo`, no toca la fila de otro técnico (0 filas), no reasigna
  `tecnico_id`.
- controles positivos: SÍ lee la cola y SÍ actualiza su propia fila.

> Nota: a 23 filas el `EXPLAIN` no muestra diferencia de plan observable
> (las tablas caben en una página); la mejora es estructural y la garantiza
> la forma `(select auth.uid())` + el patrón de la guía. La verificación
> dura es la equivalencia de permisos (11/11).

---

## Paso 4 — Consultas de los paneles

### `select('*')` → columna concreta (criterios 4 y 5)

Los 7 `select('*')` del código eran todos consultas de **conteo**
(`{ count: 'exact', head: true }`): no traen filas, pero el criterio 4 exige
que no quede ninguno. Cambiados a `select('id', { count: 'exact', head: true })`:

- `app/jefe/page.tsx` (3): counts esperando / solucionado hoy / no_solucionado hoy.
- `app/tecnico/page.tsx` (2): counts esperando / solucionado hoy.
- `app/jefe/solicitudes/page.tsx` (2): count total + count "marcar todos".

Verificado: `grep "select('\*'"` sobre `app/` → **sin coincidencias**. Las
consultas que devuelven filas ya usaban listas de columnas explícitas (no
`*`) desde specs anteriores.

### Consolidación / paralelización del polling

El plan acepta `Promise.all` para consultas independientes. Estado tras
revisión (no requirió cambios — ya estaba así desde el SPEC 10):

| Panel | Consultas del render | Forma |
|---|---|---|
| Trabajador | solicitud activa → luego `Promise.all(posición, técnico)` | paralelizado |
| Técnico | `Promise.all(estado, count espera, count hoy)` → luego cola **o** activa | paralelizado |
| Jefe panel | `Promise.all(3 counts, estados técnicos)` → nombres si atendiendo | paralelizado |
| Jefe solicitudes | `Promise.all(página, count total, count marcar-todos)` | paralelizado + `.range()` (paginación real) |

**Decisión — no se crean RPCs de KPIs para fusionar los counts en una sola
ida.** Los counts son independientes y ya van en `Promise.all` (resolución
que el plan da por válida). Un RPC fusionado ahorraría idas de red, pero a
este volumen y nº de usuarios el beneficio no justifica la superficie nueva
ni contradecir "no optimizar sin medir" (riesgo del propio spec). Anotado
como candidato si el volumen crece.

### Estado tras el paso 4

- `npm run lint` y `npm run build`: **verdes**, sin warnings.

---

## Paso 5 — Polling eficiente en el cliente

Dos piezas nuevas compartidas por los 3 paneles:

- **`lib/use-polling.ts`** (`usePolling(intervalMs, canRefresh?)`): refresca
  con `router.refresh()` en intervalo; **pausa con la pestaña oculta** y al
  volver **refresca de inmediato** y reanuda (`visibilitychange`). El
  predicado opcional `canRefresh` (vía ref) veta el refresco automático sin
  interrumpir al usuario; el refresco manual lo ignora.
- **`components/etiqueta-actualizado.tsx`**: la etiqueta "actualizado hace X"
  + botón de refresco, aislada para que su tick por segundo **no
  re-renderice las secciones de datos**.

Cada panel ahora:
1. Usa `usePolling` (antes: `setInterval` propio que **nunca se pausaba**).
2. Renderiza `<EtiquetaActualizado>` (el tick de 1 s ya no toca los datos).
3. Envuelve sus datos en un componente **`memo`** con comparador profundo
   (`JSON.stringify`): un ciclo de polling con datos idénticos **no
   re-renderiza** el contenido.

| Panel | Antes | Después |
|---|---|---|
| Trabajador | `setInterval` sin pausa; tick de 1 s re-render del panel completo | `usePolling` (conserva el "no refrescar con campo enfocado" vía `canRefresh`) + `memo` |
| Técnico | `setInterval` sin pausa; ídem | `usePolling` + `memo` (toast y colisión intactos) |
| Jefe | `setInterval` sin pausa; ídem | `usePolling` + `memo` (tarjetas de técnico conservan su tick interno) |

- **Criterio 7** (pausa con pestaña oculta + datos frescos al volver): ✅ por
  `usePolling`.
- **Criterio 8** (no re-render si los datos no cambiaron): ✅ por el `memo`
  con comparación profunda + la etiqueta aislada.
- Verificación de comportamiento (pausa/reanuda, sin re-render) → en el
  recorrido manual del paso 9. `build` + `lint` verdes.

---

## Paso 6 — Fronteras RSC y carga

### Fronteras RSC — auditadas, sin cambios necesarios

Inventario de `"use client"` (17 archivos): todos correctos.

- **Hojas legítimas:** los 3 `panel.tsx`, `tabla-solicitudes.tsx`,
  `reportes/panel.tsx`, formularios de `login`/`primer-ingreso`/
  `solicitar-recuperacion`/`actualizar-contrasena`, y los `error.tsx`
  (las error boundaries DEBEN ser cliente).
- **Shells (`{trabajador,tecnico,jefe}/shell.tsx`):** cliente solo por
  `usePathname` (resaltado del nav activo) y `MenuUsuario` (logout). Reciben
  `{children}` y los pasan tal cual, así que **el subárbol de cada página
  sigue siendo Server Component**. Los `layout.tsx` son server. Patrón
  estándar — ningún layout fuerza a su contenido a ser cliente. No se toca.

### `loading.tsx` en los segmentos (criterio 9)

Ningún segmento tenía `loading.tsx`. Se añadió un esqueleto compartido
`components/cargando-panel.tsx` (Server Component, pulso) y un `loading.tsx`
en cada sección navegable, para que la navegación pinte un estado de carga
inmediato (el shell permanece; solo el `<main>` muestra el esqueleto):

- Trabajador: `/trabajador`, `/trabajador/perfil`.
- Técnico: `/tecnico`, `/tecnico/perfil`.
- Jefe: `/jefe`, `/jefe/solicitudes`, `/jefe/reportes`, `/jefe/perfil`
  (las 3 del nav + perfil).

Cada `loading.tsx` crea la frontera `<Suspense>` del segmento. No se añadió
`Suspense` intra-página: no hay un bloque notablemente más lento que el
resto que justifique dividirlo (sería optimizar sin medir); la frontera de
segmento ya da el feedback inmediato.

### Estado tras el paso 6

- `npm run lint` y `npm run build`: **verdes**, sin warnings.

---

## Paso 7 — Bundle

### `jspdf` / `jspdf-autotable` con import dinámico

`lib/reportes/pdf.ts` los importaba de forma estática. `construirPdfReporte`
pasó a **`async`** y ahora hace `await import('jspdf')` /
`await import('jspdf-autotable')` adentro. Llamadores actualizados a `await`:
`lib/reportes/generar.ts` y `app/api/jefe/reportes/actual/route.ts`.

Verificación sobre `.next` (antes → después):

| | Antes | Después |
|---|---|---|
| Chunks de **cliente** con jspdf | ninguno | ninguno (sin cambio: ya era server-only) |
| Chunk del **servidor** | inlineado en el grafo de la ruta de reportes | **chunk(s) separado(s)** `node_modules_jspdf-autotable_…`, cargado(s) por import dinámico |
| `.next/server/app/jefe/reportes/*.js` | referenciaba jspdf | **no lo inlinea** (se carga al generar) |

→ Criterio "jspdf fuera del bundle inicial; solo al generar un PDF": ✅
(cliente ya estaba limpio; ahora también diferido en el servidor).

### Iconos y librerías

- **`@tabler/icons-react` (v3.44.0):** ya está en la lista por defecto de
  `optimizePackageImports` de Next 16 (verificado en
  `next/dist/esm/server/config.js`). Los `import { IconX } from
  '@tabler/icons-react'` se tree-shakean a los iconos usados — **sin cambio
  necesario** (no se añadió config redundante).
- No hay otras librerías que arrastren módulos enteros al cliente
  (los paneles importan solo iconos puntuales; `jspdf` es server-only).

### Estado tras el paso 7

- `npm run lint` y `npm run build`: **verdes**, sin warnings.

---

## Paso 8 — Fuentes e imágenes

Auditoría: **ya cumplen la convención de Next, sin cambios necesarios.**

- **Fuentes:** `app/layout.tsx` usa `next/font/local` (Geist, Geist Mono,
  Roboto Slab auto-hospedadas) desde el SPEC 10 (H-01). No hay `<link>` a
  Google Fonts ni `@font-face` manuales.
- **Imágenes:** las dos únicas (`components/logo-soporte.tsx`,
  `app/login/page.tsx`) usan `next/image` con import estático de
  `@/assets/muni-ica.png` (dimensiones conocidas en build), `width`/`height`
  explícitos y `alt`; el login usa `priority` (LCP). No hay etiquetas
  `<img>` crudas en el código.

### Estado tras el paso 8

- Sin cambios de código. `npm run lint` y `npm run build`: **verdes**.

---

## Paso 9 — Verificación final

### Limpieza del helper de medición

- Migración `20260615000099_spec11_drop_explain_helper.sql` (**aplicada**):
  elimina `explain_sql()`. Verificado: la RPC ya no existe
  (`Could not find the function public.explain_sql`).
- Scripts temporales (`tmp-explain.mjs`, etc.) borrados. `scripts/` queda
  solo con los originales (`backfill-reportes.ts`, `seed-users.ts`).
- Migraciones local = remoto, sincronizadas hasta `20260615000099`.

### Criterios de aceptación — repaso

| # | Criterio | Estado | Evidencia |
|---|---|---|---|
| 1 | `build` sin errores ni warnings | ✅ | Build limpio en cada paso; sin warnings |
| 2 | `lint` sin errores | ✅ | Verde |
| 3 | Consultas recurrentes usan índice (sin `Seq Scan` en polling) | ✅* | Forzando el planner, **todas** usan índice; el único hueco (métricas por `updated_at`) se cerró con `idx_solicitudes_estado_updated_at`. *El `Seq Scan` en plan natural es por el volumen de 23 filas, no por falta de índice (ver nota de método) |
| 4 | Ningún `select('*')` | ✅ | `grep` → sin coincidencias; counts usan `select('id', …)` |
| 5 | Counts solo-número con `head: true` | ✅ | Los 7 counts usan `{ count: 'exact', head: true }` |
| 6 | RLS con `(select …)`, permisos sin cambios | ✅ | 8 políticas reescritas; batería de permisos 11/11 PASS |
| 7 | Polling se pausa oculto y reanuda fresco | ✅ | `usePolling` (`visibilitychange`); confirmación en vivo → recorrido manual |
| 8 | Polling no re-renderiza si datos iguales | ✅ | `memo` + comparación profunda + etiqueta aislada; confirmación en vivo → recorrido manual |
| 9 | `jspdf`/`jspdf-autotable` fuera del bundle inicial | ✅ | Cliente: nunca; servidor: ahora chunk dinámico (import dinámico) |
| 10 | `loading.tsx` en los 3 paneles | ✅ | 8 `loading.tsx` + esqueleto compartido |
| 11 | `11-resultados.md` con antes/después | ✅ | Este documento |
| 12 | Funcionalidad visible sin cambios | ⚠️ | Requiere recorrido manual por rol (abajo) |

### Pendiente: recorrido manual por rol (criterio 12 y confirmación de 7–8)

`build` + `lint` + `EXPLAIN` (forzado) + batería de permisos cubren lo
automatizable. Queda el recorrido manual con un usuario de cada rol contra
`npm run dev`, confirmando que todo funciona igual y, específicamente:

- **Polling/visibilidad (7):** abrir un panel, cambiar de pestaña y volver →
  refresca al instante; la etiqueta "actualizado hace X" sigue siendo
  honesta. Con la pestaña oculta no debe refrescar.
- **Navegación (10):** moverse entre secciones (jefe: Panel/Solicitudes/
  Reportes/Perfil) → aparece el esqueleto de carga al instante.
- **Reportes (9):** descargar el reporte del mes en curso y generar uno de un
  mes cerrado → el PDF se genera bien (jspdf ahora se carga dinámicamente).
- **Trabajador:** crear/cancelar/confirmar; no debe refrescar mientras se
  escribe en un campo.

Si el recorrido se comporta igual que antes del spec, el criterio 12 queda
cubierto y el spec puede marcarse **Implementado**.

### Migraciones generadas en el SPEC 11

1. `20260615000001_spec11_tmp_explain_helper.sql` — helper temporal (revertido por #5).
2. `20260615000002_spec11_indices.sql` — `idx_solicitudes_estado_updated_at`.
3. `20260615000003_spec11_rls_eficiente.sql` — 8 políticas con `(select auth.uid())`.
4. `20260615000099_spec11_drop_explain_helper.sql` — elimina el helper.

Todas **aplicadas en Supabase**; local y remoto sincronizados.
