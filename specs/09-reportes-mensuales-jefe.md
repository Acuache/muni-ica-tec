# SPEC 09 — Reportes mensuales del jefe

> **Estado:** Implementado · **Depende de:** SPEC 02, SPEC 07, SPEC 07f, SPEC 08, SPEC 08b · **Fecha:** 2026-06-11
> **Objetivo:** Agregar una sección "Reportes" al panel del jefe (`/jefe/reportes`) que
> genera, guarda en Supabase Storage y permite descargar un PDF mensual (mini-dashboard
> + listado de solicitudes solucionadas/no solucionadas) de los últimos 3 meses
> cerrados —generado automáticamente vía cron mensual, con respaldo manual—, además
> de un PDF del mes en curso generado al vuelo con los datos desde el día 1 hasta hoy.

## Scope

**In:**

- Nuevo ítem "Reportes" en el navbar del jefe (`app/jefe/shell.tsx` → `NAV_LINKS`),
  que enlaza a `/jefe/reportes`.
- Nuevo bucket privado de Supabase Storage `reportes`. Un PDF por mes cerrado,
  guardado como `reportes/YYYY-MM.pdf` (ej. `2026-05.pdf` = mayo 2026).
- **Mes "cerrado"** = solicitudes con `estado IN ('solucionado', 'no_solucionado')`
  y `updated_at` dentro de ese mes calendario (zona horaria `America/Lima`,
  UTC-5 fijo, sin horario de verano).
- **Contenido de cada PDF mensual:**
  - Mini-dashboard: total de solicitudes cerradas, total solucionadas, total no
    solucionadas, tasa de éxito (%).
  - Listado detallado de TODAS las solicitudes solucionadas/no solucionadas del
    mes, con columnas: Fecha, Trabajador, Lugar, Área, Puesto, Título, Técnico
    asignado, Resultado.
- **Retención:** máximo 3 PDFs guardados en el bucket (los 3 meses cerrados más
  recientes). Al subir uno nuevo y haber más de 3, se borra el más antiguo.
- **Generación automática mensual:** cron (`pg_cron` + `pg_net`) que el día 1 de
  cada mes llama a un Route Handler de Next.js (`app/api/cron/reportes/route.ts`),
  protegido con un secreto compartido (`CRON_SECRET`), que genera el reporte del
  mes que acaba de cerrar.
- **Respaldo manual:** en `/jefe/reportes`, si falta el reporte de alguno de los 3
  meses esperados (ej. el cron falló), aparece un botón "Generar ahora" (Server
  Action) que genera ese mes específico bajo demanda.
- **Reporte del mes en curso (parcial):** botón "Descargar reporte de este mes"
  que genera al vuelo (sin guardar en Storage) un PDF con el mismo contenido
  (mini-dashboard + listado) pero con datos desde el día 1 hasta hoy.
- **Backfill inicial:** al implementar este spec, generar retroactivamente los
  reportes de los 3 meses cerrados más recientes con los datos ya existentes en
  la base, vía un script en `scripts/`.
- Librerías nuevas: `jspdf` + `jspdf-autotable` para la generación de PDF.

**Fuera de alcance (specs posteriores):**

- Edge Functions de Supabase (Deno) — la automatización usa un Route Handler de
  Next.js.
- Otros formatos de exportación (CSV, Excel).
- Reportes para roles distintos del jefe (técnico, trabajador).
- Filtros configurables del reporte (rango de fechas custom, por área, por
  técnico, etc.) — solo mes calendario completo (cerrados) o parcial del mes
  actual (1 al día de hoy).
- Desglose por área o por técnico dentro del PDF — el mini-dashboard solo
  muestra totales y tasa de éxito.
- Notificaciones cuando se genera un nuevo reporte.
- Eliminar o regenerar manualmente un reporte ya existente desde la UI (solo
  "Generar ahora" para meses faltantes).
- Configuración de zona horaria — fija a `America/Lima`.

## Modelo de datos

### Bucket de Storage

```sql
insert into storage.buckets (id, name, public)
values ('reportes', 'reportes', false)
on conflict (id) do nothing;
```

Privado: sin políticas adicionales de Storage RLS — solo se accede con el
cliente `service_role` (`createAdminClient()`), nunca desde el navegador.

### Convención de archivos

`reportes/{YYYY-MM}.pdf` — ej. `reportes/2026-05.pdf` = reporte de mayo 2026.
El nombre `YYYY-MM` ordena cronológicamente con orden lexicográfico simple, lo
que facilita detectar "el más antiguo" para la retención.

### Extensiones + cron job

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'generar-reporte-mensual',
  '10 5 1 * *', -- día 1 de cada mes, 05:10 UTC = 00:10 America/Lima
  $$
  select net.http_post(
    url := '<URL_DEPLOY>/api/cron/reportes',
    headers := jsonb_build_object('Authorization', 'Bearer <CRON_SECRET>')
  );
  $$
);
```

> `<URL_DEPLOY>` y `<CRON_SECRET>` se reemplazan por valores reales al ejecutar
> esta migración a mano — no se puede automatizar sin conocer el dominio del
> despliegue.

### Variable de entorno nueva

```
CRON_SECRET=<valor-aleatorio-largo>
```

Se agrega a `.env.local`, `.env.local.example` y al entorno de despliegue.

### Función núcleo — `lib/reportes/generar.ts`

```ts
type ResultadoGeneracion = { ok: true } | { error: string }

export async function generarReporteMensual(mesISO: string): Promise<ResultadoGeneracion>
```

`mesISO` = `"YYYY-MM"`. Pasos: calcula el rango `[inicio, fin)` del mes en
`America/Lima`, consulta `solicitudes` con
`estado in ('solucionado','no_solucionado')` y `updated_at` en ese rango (JOIN
a `profiles` del trabajador y del técnico), arma el PDF con
`construirPdfReporte`, lo sube a `reportes/{mesISO}.pdf` con `upsert: true`, y
aplica retención: lista el bucket, conserva los 3 nombres más recientes y
borra el resto.

### Helper de fechas — `lib/reportes/fechas.ts`

```ts
export function rangoMesLima(mesISO: string): { inicio: string; fin: string }
export function mesAnteriorISO(): string        // "YYYY-MM" del mes recién cerrado
export function ultimosMesesCerrados(n: number): string[] // orden desc, ej. ["2026-05","2026-04","2026-03"]
```

Todos calculan sobre la zona horaria fija `America/Lima` (offset constante
`-05:00`, sin horario de verano) y devuelven/reciben timestamps ISO en UTC
para las queries a Supabase.

### Helper de PDF — `lib/reportes/pdf.ts`

```ts
type FilaSolicitud = {
  fecha: string
  trabajador: string
  lugar: string | null
  area: string | null
  puesto: string | null
  titulo: string
  tecnico: string | null
  resultado: 'Solucionado' | 'No solucionado'
}

type ResumenMes = {
  totalCerradas: number
  totalSolucionadas: number
  totalNoSolucionadas: number
  tasaExito: string // "82 %" o "—" si totalCerradas === 0
}

export function construirPdfReporte(titulo: string, resumen: ResumenMes, filas: FilaSolicitud[]): Uint8Array
```

PDF en orientación horizontal (landscape) con `jsPDF` + `jspdf-autotable`:
bloque de texto con el resumen arriba, tabla con `filas` debajo. Lo usan tanto
`generarReporteMensual` (mes cerrado) como el endpoint del mes en curso
(parcial).

### Endpoints / Server Actions nuevos

| Archivo | Tipo | Quién lo llama | Qué hace |
|---|---|---|---|
| `app/api/cron/reportes/route.ts` | Route Handler (GET) | `pg_cron` vía `pg_net`, header `Authorization: Bearer CRON_SECRET` | Calcula `mesAnteriorISO()` y llama `generarReporteMensual(mes)`. |
| `app/api/jefe/reportes/actual/route.ts` | Route Handler (GET) | Botón "Descargar reporte de este mes" (sesión jefe) | Calcula rango día 1 → hoy (Lima), consulta solicitudes cerradas, arma PDF con `construirPdfReporte`, responde `Content-Type: application/pdf` + `Content-Disposition: attachment`. |
| `generarReporteManual` en `app/jefe/reportes/actions.ts` | Server Action | Botón "Generar ahora" (sesión jefe) | Verifica que `mes` ∈ los 3 meses esperados, llama `generarReporteMensual(mes)`, `revalidatePath('/jefe/reportes')`. |

### Página `/jefe/reportes`

`app/jefe/reportes/page.tsx` (Server Component):
- Calcula `ultimosMesesCerrados(3)`.
- Lista objetos del bucket `reportes` (`supabase.storage.from('reportes').list()`).
- Para cada uno de los 3 meses esperados: si existe `{mes}.pdf`, genera URL
  firmada (`createSignedUrl`, expiración corta, ~60s); si no, marca
  `faltante: true`.
- Pasa `{ mes, label, url: string | null, faltante: boolean }[]` y la fecha de
  hoy al componente cliente `PanelReportes`.

### Script de backfill — `scripts/backfill-reportes.ts`

Llama `generarReporteMensual(mes)` para cada uno de `ultimosMesesCerrados(3)`,
en orden cronológico (más antiguo primero) para que la retención no borre nada
de más durante el backfill.

## Plan de implementación

1. **Migración: bucket de Storage + extensiones.**
   Crear `supabase/migrations/20260611000001_reportes_bucket_extensiones.sql`
   con `insert into storage.buckets (...)` para `reportes` (privado) y
   `create extension if not exists pg_cron; create extension if not exists
   pg_net;`. Ejecutar en Supabase Dashboard → SQL Editor.
   Verificar: el bucket `reportes` aparece en Storage como privado; ambas
   extensiones aparecen habilitadas en Database → Extensions.

2. **Variables de entorno.**
   Generar un valor aleatorio largo para `CRON_SECRET` (ej. `openssl rand -hex
   32`) y agregarlo a `.env.local`; agregar la clave (vacía) a
   `.env.local.example`.
   Verificar: `npm run dev` levanta sin errores.

3. **Instalar dependencias de PDF.**
   `npm install jspdf jspdf-autotable`.
   Verificar: `package.json` lista ambas dependencias; `npm run build` sigue
   pasando.

4. **Helpers de fecha — `lib/reportes/fechas.ts`.**
   Implementar `rangoMesLima(mesISO)`, `mesAnteriorISO()` y
   `ultimosMesesCerrados(n)` sobre zona horaria fija `America/Lima` (UTC-5).
   Verificar manualmente (script temporal): para el mes actual `2026-06`,
   `mesAnteriorISO()` devuelve `"2026-05"` y `ultimosMesesCerrados(3)` devuelve
   `["2026-05","2026-04","2026-03"]`.

5. **Helper de PDF — `lib/reportes/pdf.ts`.**
   Implementar `construirPdfReporte(titulo, resumen, filas)` con `jsPDF` +
   `jspdf-autotable`, orientación landscape: bloque de resumen arriba, tabla
   con `filas` debajo.
   Verificar: una llamada de prueba genera un `Uint8Array` no vacío que, al
   guardarse como `.pdf`, se abre correctamente y muestra resumen + tabla.

6. **Función núcleo — `lib/reportes/generar.ts`.**
   Implementar `generarReporteMensual(mesISO)`: consulta `solicitudes`
   (admin client) con `estado in ('solucionado','no_solucionado')` y
   `updated_at` en `rangoMesLima(mesISO)`, JOIN a `profiles` (trabajador y
   técnico), mapea a `FilaSolicitud[]` + `ResumenMes`, construye el PDF, sube
   a `reportes/{mesISO}.pdf` (`upsert: true`), y aplica retención (lista el
   bucket, conserva los 3 nombres más recientes, borra el resto).
   Verificar: llamarla manualmente para un mes con datos reales sube el PDF al
   bucket, descargable desde el Dashboard de Storage.

7. **Route Handler del cron — `app/api/cron/reportes/route.ts`.**
   GET: valida `Authorization: Bearer ${process.env.CRON_SECRET}` (401 si no
   coincide), calcula `mesAnteriorISO()`, llama `generarReporteMensual` y
   responde `{ ok: true, mes }` o el error.
   Verificar: `curl -H "Authorization: Bearer $CRON_SECRET"
   http://localhost:3000/api/cron/reportes` genera/actualiza el reporte del
   mes anterior; sin header o con secreto incorrecto responde 401.

8. **Route Handler del mes actual — `app/api/jefe/reportes/actual/route.ts`.**
   GET: verifica sesión y `profiles.rol === 'jefe'`, calcula el rango día 1 →
   hoy (Lima), consulta solicitudes cerradas, construye el PDF con
   `construirPdfReporte` y responde con `Content-Type: application/pdf` +
   `Content-Disposition: attachment; filename="reporte-{mes}-parcial.pdf"`.
   Verificar: logueado como jefe, la URL descarga un PDF con datos hasta hoy;
   un usuario no-jefe recibe error/redirect.

9. **Server Action `generarReporteManual` — `app/jefe/reportes/actions.ts`.**
   Recibe `{ mes }`, valida que `mes` esté en `ultimosMesesCerrados(3)`, llama
   `generarReporteMensual(mes)` y ejecuta `revalidatePath('/jefe/reportes')`.
   Verificar: invocarla para un mes sin reporte sube el PDF correspondiente y
   la página se actualiza.

10. **Página `/jefe/reportes` — `page.tsx` + `panel.tsx`.**
    Server Component: arma la lista de los 3 meses esperados con URL firmada o
    `faltante: true`, y la pasa a `PanelReportes` (Client Component). UI:
    tarjeta superior "Reporte de este mes" con enlace de descarga a
    `/api/jefe/reportes/actual`; debajo, una fila por mes esperado con su
    nombre y botón "Descargar" (si existe) o "Generar ahora" (si falta, llama
    a `generarReporteManual` con estado de carga).
    Verificar: la página carga para el jefe; cada uno de los 3 meses muestra
    el estado correcto (descargable o "Generar ahora").

11. **Navbar — `app/jefe/shell.tsx`.**
    Agregar `{ href: '/jefe/reportes', label: 'Reportes' }` a `NAV_LINKS`.
    Verificar: el link aparece en el navbar y se resalta como activo en
    `/jefe/reportes`.

12. **Backfill — `scripts/backfill-reportes.ts`.**
    Script que llama `generarReporteMensual(mes)` para cada uno de
    `ultimosMesesCerrados(3)`, en orden cronológico ascendente (más antiguo
    primero). Ejecutar una vez con `npx tsx scripts/backfill-reportes.ts`.
    Verificar: el bucket `reportes` contiene hasta 3 PDFs (según haya datos
    históricos) y `/jefe/reportes` los muestra con botón "Descargar".

13. **Programar el cron job.**
    Crear `supabase/migrations/20260611000002_reportes_cron_schedule.sql` con
    `select cron.schedule('generar-reporte-mensual', '10 5 1 * *', ...)`
    apuntando a la URL real de despliegue, con el valor real de `CRON_SECRET`
    en el header. Ejecutar en el SQL Editor de Supabase.
    Verificar: `select * from cron.job;` muestra el job programado para
    `'10 5 1 * *'`.

14. **Verificación final.**
    `npm run build` y `npm run lint` sin errores. Probar flujo completo: el
    backfill generó hasta 3 reportes; "Descargar reporte de este mes" trae
    datos parciales correctos; "Generar ahora" funciona para un mes sin
    reporte; el endpoint de cron (con el secreto correcto) genera/actualiza el
    reporte del mes anterior y, si ya hay 3, borra el más antiguo.

## Criterios de aceptación

### Navegación
- [ ] El navbar del jefe muestra "Reportes" enlazando a `/jefe/reportes`, con
      el mismo patrón visual que "Panel" y "Solicitudes" (resaltado activo).
- [ ] La página `/jefe/reportes` carga sin errores para un usuario con rol
      `jefe`.

### Storage
- [ ] El bucket `reportes` existe en Supabase Storage y es privado.
- [ ] Cada reporte mensual se guarda como `reportes/YYYY-MM.pdf`.

### Contenido del PDF mensual (mes cerrado)
- [ ] El PDF incluye un mini-dashboard con: total de solicitudes cerradas,
      total solucionadas, total no solucionadas y tasa de éxito (%).
- [ ] La tasa de éxito muestra "—" cuando el total de cerradas es 0.
- [ ] El PDF incluye una tabla con TODAS las solicitudes solucionadas/no
      solucionadas del mes, con columnas Fecha, Trabajador, Lugar, Área,
      Puesto, Título, Técnico y Resultado.
- [ ] Solo entran solicitudes con `estado in ('solucionado','no_solucionado')`
      y `updated_at` dentro del mes calendario correspondiente en zona horaria
      `America/Lima`.
- [ ] Las solicitudes `cancelado`, `en_espera` o `en_proceso` no aparecen en
      ningún reporte.

### Reporte del mes en curso (parcial)
- [ ] El botón "Descargar reporte de este mes" descarga un PDF con el mismo
      formato (mini-dashboard + tabla) usando datos desde el día 1 del mes
      hasta hoy (Lima).
- [ ] Este PDF no se guarda en el bucket `reportes` ni afecta la retención de
      3 reportes.
- [ ] Un usuario autenticado que no es `jefe` recibe error/redirect al
      intentar acceder a `/api/jefe/reportes/actual`.

### Generación automática (cron)
- [ ] Tras ejecutar la migración del paso 13, `select * from cron.job;`
      muestra el job `generar-reporte-mensual` programado para `'10 5 1 * *'`.
- [ ] `/api/cron/reportes` responde 401 si falta el header `Authorization` o
      el valor no coincide con `CRON_SECRET`.
- [ ] Con el header correcto, `/api/cron/reportes` genera/actualiza el PDF del
      mes que acaba de cerrar (`mesAnteriorISO()`).

### Respaldo manual
- [ ] Si falta el reporte de alguno de los 3 meses esperados, la página
      muestra un botón "Generar ahora" para ese mes específico.
- [ ] Al pulsar "Generar ahora", el PDF de ese mes se genera, se sube al
      bucket y la página pasa a mostrar "Descargar" para ese mes sin recarga
      manual.

### Retención
- [ ] El bucket `reportes` nunca contiene más de 3 archivos `.pdf`.
- [ ] Al generarse un cuarto reporte (cron, manual o backfill), se elimina
      automáticamente el de nombre `YYYY-MM` más antiguo.

### Backfill
- [ ] Tras ejecutar `scripts/backfill-reportes.ts`, el bucket `reportes`
      contiene hasta 3 PDFs correspondientes a los 3 meses cerrados más
      recientes (menos si no hay datos para alguno de ellos).

### General
- [ ] `npm run build` y `npm run lint` pasan sin errores.

## Decisiones

- **Sí:** formato PDF para los reportes (en lugar de CSV/Excel). Mejor para
  presentación/impresión; es lo que pidió el usuario.

- **Sí:** cada PDF combina mini-dashboard (totales + tasa de éxito) y listado
  detallado en un solo documento. Evita generar/guardar dos archivos por mes.

- **Sí:** solo entran al reporte solicitudes `solucionado` / `no_solucionado`
  con `updated_at` en el mes. Las `cancelado`, `en_espera` y `en_proceso` se
  excluyen por completo (ni en KPIs ni en el listado) — el reporte se centra
  en trabajo que llegó a una resolución.

- **No:** desglose por área o por técnico en el mini-dashboard. Se mantiene
  simple (totales + tasa de éxito); puede añadirse en un spec posterior si se
  necesita.

- **Sí:** retención de 3 meses cerrados guardados en Storage (ajustado de 6 a
  3 durante la definición). El reporte del mes en curso es aparte y no cuenta
  para este límite.

- **Sí:** el reporte del mes en curso se genera al vuelo (Route Handler) sin
  guardarse en Storage. Evita gestionar un cuarto "slot" especial en la
  retención y siempre refleja datos hasta el momento de la descarga.

- **Sí:** automatización vía `pg_cron` + `pg_net` llamando a un Route Handler
  de Next.js (`app/api/cron/reportes`), no una Supabase Edge Function. Reutiliza
  el código, librerías y patrones Node ya existentes en el proyecto, sin
  introducir Deno ni un flujo de despliegue nuevo vía Supabase CLI.

- **Sí:** `jsPDF` + `jspdf-autotable` para construir los PDF. Librería madura
  en Node, suficiente para texto + tablas.

- **Sí:** botón "Generar ahora" como respaldo manual cuando falta el reporte
  de un mes esperado (p.ej. el cron falló). Reutiliza la misma función núcleo
  `generarReporteMensual`, así que es idempotente.

- **Sí:** backfill automático al implementar el spec, generando los 3 meses
  cerrados más recientes con datos ya existentes en la base. Así la sección
  "Reportes" no arranca vacía.

- **Sí:** bucket `reportes` privado, archivos `reportes/YYYY-MM.pdf`, acceso
  solo vía `service_role` (admin client) desde el servidor — sin políticas de
  Storage RLS adicionales, porque la autorización por rol ya ocurre en
  `app/jefe/layout.tsx` y en cada Route Handler/Server Action.

- **Sí:** zona horaria fija `America/Lima` (UTC-5, sin horario de verano) para
  calcular los límites de cada mes. Consistente con la ubicación de la
  Municipalidad de Ica; evita depender de la zona horaria del servidor.

- **Sí:** columnas del listado = Fecha, Trabajador, Lugar, Área, Puesto,
  Título, Técnico, Resultado — combina las columnas "básicas" con el grupo
  Lugar/Área/Puesto de `profiles` que ya usa la tabla del jefe (SPEC 08).

- **No:** incluir teléfono, correo o descripción en la tabla del PDF. Con 8
  columnas en landscape ya es una tabla ancha; agregar más la haría ilegible.

- **No:** notificaciones al generarse un nuevo reporte. Va fuera de alcance
  (sería parte de un spec de notificaciones futuro).

- **No:** filtros configurables (rango de fechas custom, por área, por
  técnico). Solo mes calendario completo (cerrados) o parcial del mes actual
  (día 1 → hoy).

- **Sí:** secreto compartido `CRON_SECRET` (header `Authorization: Bearer`)
  para proteger `/api/cron/reportes`, en lugar de autenticación de sesión —
  `pg_net` no tiene sesión de usuario, y un secreto fijo es el patrón estándar
  para cron HTTP en Next.js.

## Riesgos

| Riesgo | Mitigación |
|--------|-----------|
| **`pg_cron` / `pg_net` no disponibles o no habilitables** en el plan/proyecto de Supabase actual. | Antes del paso 1, verificar en Dashboard → Database → Extensions que ambas se pueden habilitar. Si no, el respaldo manual ("Generar ahora") y el backfill siguen funcionando sin el cron — el sistema queda usable, solo sin automatización. |
| **`CRON_SECRET` queda en texto plano dentro de `cron.job.command`** (tabla interna de Postgres, visible para roles con privilegios de superusuario/`postgres`). | Aceptable para este proyecto: solo el equipo con acceso al Dashboard de Supabase puede leer `cron.job`, el mismo nivel de acceso que ya tienen para `SUPABASE_SERVICE_ROLE_KEY`. |
| **La URL de despliegue cambia** (nuevo dominio, nuevo entorno) y el cron job queda apuntando a una URL inválida — falla silenciosamente cada mes. | Documentar en el spec/migración que, si el dominio cambia, hay que re-ejecutar `select cron.alter_job(...)` o reprogramar el job con la nueva URL. El botón "Generar ahora" cubre el mes que se haya perdido. |
| **Condición de carrera en la retención** si el cron y "Generar ahora" corren casi al mismo tiempo (ambos listan el bucket, ambos suben/borran). | Probabilidad muy baja (cron corre 1 vez al mes, fuera de horario laboral). En el peor caso el bucket queda con 2-4 archivos un instante; la siguiente generación vuelve a aplicar la retención y lo corrige. |
| **Meses sin solicitudes cerradas** generan un PDF "vacío" (mini-dashboard en 0, tabla sin filas). | `construirPdfReporte` debe manejar `filas: []` sin error (tabla con encabezados pero 0 filas, tasa de éxito "—"). Es un caso válido, no un error. |
| **PDF muy largo en meses con muchas solicitudes** podría acercarse al timeout del Route Handler en el entorno de despliegue. | `jspdf-autotable` pagina automáticamente. Si el volumen mensual crece mucho en el futuro, se puede mover la generación a un job en segundo plano — fuera de alcance de este spec dado el volumen actual. |
| **URL firmada expira antes del clic** (60s) si la página `/jefe/reportes` queda abierta sin interacción. | Al pulsar "Descargar" con una URL expirada, el usuario recibe un error 403 de Storage; recargar la página regenera URLs firmadas frescas. Aceptable para el MVP. |
