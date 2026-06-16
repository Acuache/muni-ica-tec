# SPEC 12 — Adjuntos en solicitudes: imágenes (webp) y PDF

> **Estado:** Implementado · **Depende de:** SPEC 02, SPEC 05, SPEC 06, SPEC 07 · **Fecha:** 2026-06-16
> **Objetivo:** Permitir que el trabajador adjunte imágenes (comprimidas a `.webp` en el navegador) y PDFs al crear una solicitud, que el técnico y el jefe puedan descargarlos, y que los archivos se eliminen automáticamente cuando la solicitud se cierra o a los ~21 días de subidos.

## Alcance

**Incluye:**

- Bucket privado de Storage `solicitud-adjuntos` y tabla `solicitud_adjuntos` para rastrear cada archivo (ruta, nombre original, tipo, tamaño, fecha).
- Trabajador, **solo al crear la solicitud**: seleccionar archivos sin límite de cantidad.
  - **Imágenes** (JPG / PNG / WEBP): se comprimen a `.webp` en el navegador; cada una con **modal de previsualización** para confirmarla o **eliminarla** antes de enviar; tope **≤ 1 MB** ya comprimida.
  - **PDFs**: se adjuntan sin previsualización (solo se listan), se pueden **quitar** antes de enviar; tope **≤ 3 MB** por archivo.
- Subida **directa del navegador a Storage** tras crear la solicitud; las filas en `solicitud_adjuntos` se registran con un Server Action.
- Trabajador en la pantalla de seguimiento: lista de solo lectura de los archivos que adjuntó.
- Técnico (card "Solicitud activa", cuando atiende el caso): lista de los archivos del trabajador con botón **Descargar**.
- Jefe (tabla de solicitudes, bajo "Descripción"): **nombre del archivo + botón Descargar** (sin previsualización).
- Descargas vía **URL firmada** generada en el servidor (Storage API con cliente admin); sin política pública de lectura en Storage.
- Borrado automático con **un cron diario** (`pg_cron` + `pg_net` → Route Handler) que elimina, vía Storage API, los adjuntos cuya solicitud esté **cerrada** (`cancelado`/`solucionado`/`no_solucionado`) **o** que tengan **> 21 días**.

**Fuera de alcance (specs posteriores):**

- Adjuntar archivos **después** de crear la solicitud (mientras está en espera/proceso).
- Soporte de **HEIC** u otros formatos de imagen que el navegador no decodifica nativamente.
- Validar el **número de páginas** real del PDF (se acota solo por tamaño).
- Compresión/optimización de los **PDFs** (solo se valida tamaño).
- Previsualización **inline** de imágenes/PDF para técnico o jefe (solo descargan).
- Borrado **instantáneo** al cerrar (se usa el barrido diario; máx. ~24 h de retraso).
- Antivirus / escaneo de contenido de los archivos subidos.

## Modelo de datos

Este spec introduce **una tabla nueva**, **un bucket** y políticas de Storage. Reutiliza `solicitudes` y `profiles` de SPEC 02.

### Tabla `solicitud_adjuntos`

```sql
create table solicitud_adjuntos (
  id              uuid primary key default gen_random_uuid(),
  solicitud_id    uuid not null references solicitudes(id) on delete cascade,
  tipo            text not null check (tipo in ('imagen', 'pdf')),
  storage_path    text not null unique,        -- '{solicitud_id}/{uuid}.webp' | '.pdf'
  nombre_original text not null,               -- lo que ve el jefe/técnico
  tamano_bytes    integer not null,
  created_at      timestamptz not null default now()
);

create index on solicitud_adjuntos (solicitud_id);
```

### Bucket de Storage

```sql
insert into storage.buckets (id, name, public)
values ('solicitud-adjuntos', 'solicitud-adjuntos', false)
on conflict (id) do nothing;
```

Convención de ruta: `{solicitud_id}/{uuid-aleatorio}.{ext}`. El primer segmento de la ruta es el `solicitud_id`, usado por la política de Storage para validar propiedad.

### RLS de `solicitud_adjuntos`

| Operación | Quién |
|-----------|-------|
| SELECT | trabajador (de sus solicitudes); técnico y jefe (todas) |
| INSERT | trabajador, solo si el `solicitud_id` es una solicitud suya |
| UPDATE | — |
| DELETE | solo `service_role` (lo hace el cron) |

### Políticas de Storage (`storage.objects`, bucket `solicitud-adjuntos`)

| Operación | Política |
|-----------|----------|
| INSERT (subir) | `authenticated`; `(storage.foldername(name))[1]::uuid` corresponde a una solicitud con `trabajador_id = auth.uid()` |
| SELECT (leer) | — (sin política; las descargas usan URL firmada generada por el cliente admin en el servidor) |
| DELETE | — (solo `service_role` vía cron) |

### Límites de validación (cliente y servidor)

```ts
const IMG_MAX_BYTES = 1_000_000   // 1 MB, ya comprimida a webp
const PDF_MAX_BYTES = 3_000_000   // 3 MB
const IMG_INPUT_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const WEBP_QUALITY = 0.8          // calidad de compresión canvas
const WEBP_MAX_LADO = 1920        // px máximo del lado mayor antes de comprimir
```

### Criterio de borrado del cron

Un adjunto se elimina cuando:

```sql
-- la solicitud asociada ya está cerrada…
solicitudes.estado in ('cancelado', 'solucionado', 'no_solucionado')
-- …o el adjunto supera los 21 días calendario (~15 hábiles)
or solicitud_adjuntos.created_at < now() - interval '21 days'
```

## Plan de implementación

1. **Migración SQL.**
   `supabase/migrations/20260616000001_spec12_adjuntos.sql`: crear tabla `solicitud_adjuntos` con su índice, insertar el bucket `solicitud-adjuntos`, habilitar RLS y crear las políticas de la tabla y de `storage.objects` (INSERT del trabajador con `storage.foldername`).
   Verificar: `npx supabase db push` aplica sin errores; tabla, bucket y políticas aparecen en el Dashboard.

2. **Helpers de cliente (`lib/adjuntos/comprimir.ts`).**
   `comprimirImagenAWebp(file)`: decodifica con `createImageBitmap`, reescala al lado mayor ≤ 1920 px, dibuja en canvas y exporta `image/webp` calidad 0.8; rechaza si el resultado supera 1 MB o si el formato no es decodificable (HEIC). `validarPdf(file)`: tipo `application/pdf` y ≤ 3 MB.
   Verificar: en una página de prueba, una imagen grande devuelve un Blob webp < 1 MB; un PDF de 4 MB es rechazado.

3. **Server Actions de adjuntos.**
   En `app/trabajador/actions.ts`: `registrarAdjuntos(solicitudId, metadatos[])` — valida que la solicitud es del trabajador, inserta las filas en `solicitud_adjuntos`. En `app/adjuntos/actions.ts` (`'use server'`): `descargarAdjunto(adjuntoId)` — autoriza (trabajador dueño / técnico / jefe), genera y devuelve una **URL firmada** (TTL corto) con el cliente admin.
   Verificar: insertar filas de prueba; `descargarAdjunto` devuelve una URL que abre el archivo.

4. **`crearSolicitud` devuelve el id.**
   Modificar `crearSolicitud` para retornar `{ ok: true, solicitudId }` en éxito en lugar de redirigir, manteniendo el manejo de error actual.
   Verificar: enviar el formulario sin archivos sigue creando la solicitud y navegando correctamente.

5. **UI de selección + staging en el formulario del trabajador (`app/trabajador/panel.tsx`).**
   Input de archivos; al elegir una imagen se comprime y se agrega al estado local mostrando un **modal de previsualización** con "Confirmar" / "Eliminar"; los PDF se listan con botón "Quitar". Nada se sube todavía.
   Verificar: se pueden agregar/quitar imágenes y PDFs antes de enviar; el modal muestra la imagen comprimida.

6. **Orquestación de envío en dos pasos.**
   Al enviar: llamar `crearSolicitud` → con el `solicitudId`, subir cada archivo staged a `solicitud-adjuntos/{solicitudId}/{uuid}.{ext}` con el cliente browser de Supabase → llamar `registrarAdjuntos` → `router.refresh()`.
   Verificar: tras enviar, los archivos aparecen en Storage y en `solicitud_adjuntos`; la solicitud pasa a seguimiento.

7. **Lista de solo lectura para el trabajador (seguimiento).**
   En la card "Estado de Solicitud", listar los `nombre_original` de los adjuntos de la solicitud activa (con descarga vía `descargarAdjunto`).
   Verificar: el trabajador ve los archivos que adjuntó.

8. **Técnico: descargar en la card "Solicitud activa".**
   En `app/tecnico/page.tsx` consultar los adjuntos de la solicitud activa; en `app/tecnico/panel.tsx` (`CardSolicitudActiva`) renderizar la lista con icono por tipo + botón "Descargar".
   Verificar: el técnico que atiende ve y descarga los archivos del trabajador.

9. **Jefe: nombre + descarga bajo "Descripción".**
   En la página que alimenta `tabla-solicitudes.tsx` consultar los adjuntos por solicitud; en la celda "Descripción" listar `nombre_original` + botón "Descargar" (sin previsualización). Para solicitudes cerradas (adjuntos ya borrados) mostrar "—".
   Verificar: el jefe ve los nombres y descarga; en una solicitud cerrada no aparecen archivos.

10. **Cron de limpieza.**
    Route Handler `app/api/cron/adjuntos/route.ts` protegido con `CRON_SECRET`: selecciona adjuntos de solicitudes cerradas o con > 21 días, los elimina de Storage con `remove()` (cliente admin) y borra sus filas. Migración `20260616000002_spec12_adjuntos_cron.sql` que programa `cron.schedule` diario vía `pg_net` (mismo patrón que SPEC 09; `<CRON_SECRET>` se reemplaza a mano).
    Verificar: invocar el endpoint con el bearer correcto borra los adjuntos vencidos/cerrados de Storage y de la tabla.

## Criterios de aceptación

- [ ] La migración aplica sin errores y crea la tabla `solicitud_adjuntos`, el bucket `solicitud-adjuntos` y las políticas RLS/Storage.
- [ ] El trabajador puede adjuntar **varias** imágenes y varios PDFs en una misma solicitud (sin límite de cantidad).
- [ ] Al elegir una imagen JPG/PNG/WEBP se sube a Storage como `.webp` y pesa ≤ 1 MB.
- [ ] Una imagen que tras comprimir sigue > 1 MB es rechazada con mensaje claro y no se sube.
- [ ] Un archivo HEIC (u otro no decodificable) muestra error y no se adjunta.
- [ ] Cada imagen muestra un **modal de previsualización** con opción de **confirmarla** o **eliminarla** antes de enviar la solicitud.
- [ ] Un PDF > 3 MB es rechazado; un PDF ≤ 3 MB se adjunta y puede **quitarse** antes de enviar.
- [ ] Los archivos se suben **solo al enviar** la solicitud; nada queda en Storage si el trabajador cancela el formulario.
- [ ] Tras enviar, existe una fila en `solicitud_adjuntos` por cada archivo, con `nombre_original`, `tipo`, `storage_path` y `tamano_bytes` correctos.
- [ ] El trabajador ve en seguimiento la lista de nombres de los archivos que adjuntó.
- [ ] El técnico que atiende el caso ve la lista de archivos del trabajador y puede **descargar** cada uno.
- [ ] El jefe ve, bajo "Descripción", el **nombre** de cada archivo y un botón para **descargarlo** (sin previsualización).
- [ ] Las descargas funcionan mediante **URL firmada**; no existe acceso público de lectura al bucket.
- [ ] Un trabajador no puede subir archivos a la carpeta de una solicitud que no es suya (RLS de Storage lo bloquea).
- [ ] El cron diario elimina de Storage **y** de la tabla los adjuntos de solicitudes cerradas (`cancelado`/`solucionado`/`no_solucionado`) o con > 21 días.
- [ ] Tras el cron, una solicitud cerrada ya no muestra archivos para descargar en el panel del jefe.
- [ ] El endpoint del cron rechaza peticiones sin el `CRON_SECRET` correcto.
- [ ] `npm run build` y `npm run lint` pasan sin errores.

## Decisiones

- **Sí:** tabla `solicitud_adjuntos` separada en vez de listar el bucket. Permite mostrar el `nombre_original` (lo que pide el jefe), filtrar por solicitud y aplicar RLS sin llamadas a la Storage API en cada render.

- **Sí:** subida **directa navegador → Storage**. Evita el límite de ~1 MB de los Server Actions de Next 16; el Server Action solo registra metadatos (carga pequeña).

- **Sí:** compresión a webp con **canvas nativo**, sin dependencia. El stack restringe el backend, no las utilidades de UI, pero canvas evita sumar peso al bundle.

- **Sí:** descargas vía **URL firmada** con cliente admin, sin política `SELECT` pública en Storage. Centraliza la autorización en el servidor y mantiene el bucket privado.

- **Sí:** acotar el PDF **solo por tamaño** (≤ 3 MB ≈ 5 páginas con imágenes). Contar páginas reales requiere parsear el PDF en el navegador (frágil) y el objetivo real es proteger el storage, que el tamaño ya garantiza.

- **Sí:** sin **límite de cantidad** de archivos. Decisión del equipo: el uso será poco concurrente; la protección de storage la dan el tope por archivo y el borrado automático.

- **Sí:** "15 días hábiles" aproximado a **21 días calendario**. Equivale a ~3 semanas excluyendo fines de semana de hecho, sin mantener tabla de feriados.

- **Sí:** borrado mediante **un único cron diario** que cubre cerradas + vencidas. Detectar el cierre dispara desde 5 acciones distintas; un barrido central es más robusto. Coste: hasta ~24 h de retraso tras el cierre.

- **No:** borrado **instantáneo** al cerrar (trigger por acción). Más superficie de error por marginal beneficio; el barrido diario libera el storage igual.

- **No:** soporte **HEIC**. El navegador no lo decodifica de forma fiable y exigiría una librería; se documenta y se rechaza con mensaje.

- **No:** previsualización **inline** para técnico/jefe. Pediste explícitamente solo nombre + descarga para el jefe; el técnico también descarga.

- **No:** adjuntar **después** de crear la solicitud. Mantiene el flujo en un solo formulario; se puede abrir en un spec posterior.

## Riesgos

| Riesgo | Mitigación |
|--------|------------|
| Subida en dos pasos: la solicitud se crea pero falla la subida o `registrarAdjuntos`, dejando una solicitud sin sus archivos o archivos huérfanos en Storage. | Mostrar error al trabajador y permitir reintentar la subida; los huérfanos los recoge el cron (solicitud cerrada o > 21 días). No bloquea el flujo principal. |
| Sin límite de cantidad, un trabajador podría adjuntar muchísimos archivos y abultar el storage. | Tope por archivo (1 MB / 3 MB) + borrado al cerrar/≈21 días + base de usuarios interna pequeña. Si surge abuso, se añade un tope en un spec posterior. |
| Borrar la fila de `storage.objects` por SQL no libera el archivo físico; el storage seguiría ocupado. | El cron borra **siempre** con la Storage API (`remove()`) usando el cliente admin, no por SQL. |
| `createImageBitmap` / `canvas.toBlob('image/webp')` puede fallar o variar entre navegadores (Safari antiguo, HEIC). | Envolver en try/catch; si falla la decodificación o el webp, rechazar el archivo con mensaje claro en lugar de subir un original sin comprimir. |
| La política de Storage usa `(storage.foldername(name))[1]::uuid`; si la ruta no empieza por el `solicitud_id` el cast falla o permite rutas indebidas. | Construir la ruta siempre como `{solicitud_id}/{uuid}.{ext}` en el cliente y verificar la política con un intento de subida a una carpeta ajena (debe fallar). |
| El `CRON_SECRET` real no debe quedar en el historial de git de la migración (igual que SPEC 09). | Dejar `<CRON_SECRET>` como placeholder en la migración y reemplazarlo a mano en el SQL Editor de Supabase. |
| Next 16 tiene convenciones propias (Route Handlers, Server Actions, `proxy`); las APIs pueden diferir de lo conocido. | Antes de implementar, leer la guía relevante en `node_modules/next/dist/docs/` y el `SKILL.md` de next-best-practices (mandato de AGENTS.md). |

## Lo que **no** está en este spec

- Adjuntar archivos después de crear la solicitud (mientras está en espera/proceso).
- Soporte de HEIC u otros formatos que el navegador no decodifica nativamente.
- Validación del número de páginas real del PDF.
- Compresión u optimización de los PDFs.
- Previsualización inline de imágenes/PDF para técnico o jefe.
- Borrado instantáneo al cerrar (se usa el barrido diario, máx. ~24 h).
- Antivirus / escaneo de contenido de los archivos.
- Límite de cantidad de archivos por solicitud.

Cada uno de esos puntos, si se incorpora, va en su propio spec.
