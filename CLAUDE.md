# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Soporte Municipal — Muni Ica (muni-ica-tec)

App web de gestión de tickets de soporte técnico para la Municipalidad de Ica.
Tres roles, un solo flujo: un trabajador pide ayuda, un técnico la atiende, el jefe
de informática supervisa todo.

## Reglas heredadas (importadas)

@AGENTS.md

> El import de arriba trae la advertencia crítica sobre esta versión de Next.js.
> **Respétala:** antes de escribir código de Next, lee la guía relevante en
> `node_modules/next/dist/docs/`. Las APIs pueden diferir de lo que conoces.

## Qué es esta app

Soporte técnico interno municipal. Una sola base de tickets ("solicitudes")
compartida por los tres roles:

- **Trabajador** — crea una solicitud (tipo de ayuda presencial/virtual, título,
  descripción, y opcionalmente código AnyDesk + adjuntos), ve su posición en la cola,
  puede cancelarla y confirma la resolución (Resuelto / No resuelto).
- **Técnico** — ve la cola de espera, atiende solicitudes ("Atender ahora"),
  cambia su propio estado (Disponible / En Oficina / Virtual / Descanso) y ve sus
  métricas del día.
- **Jefe de informática** — panel de control: KPIs (esperando, solucionados hoy,
  tasa de éxito, no solucionados / escalamiento), cola completa, estado de los
  técnicos con indicador "última actualización hace X", historial, reportes mensuales
  y gestión de usuarios.

Las pantallas de referencia (mockups) están en `assets/`:
`panel_del_jefe_de_informatica/`, `panel_del_tecnico/`, `panel_del_trabajador/`.

## Stack (los 2 únicos requisitos de plataforma)

1. **Frontend / framework:** Next.js `16.2.7` (App Router) + React `19.2.4`.
2. **Backend:** Supabase (Postgres + Auth + RLS + Storage). Es el único backend.

Apoyo de UI ya presente: Tailwind v4, shadcn/ui, Radix, `@tabler/icons-react`.
PDFs con `jspdf` + `jspdf-autotable` (reportes del jefe).
No introducir otro backend, ORM ni servicio de auth: todo va contra Supabase.

## Comandos

```bash
npm run dev     # desarrollo (http://localhost:3000)
npm run build   # build de producción
npm run start   # servir el build
npm run lint    # eslint
```

- **No hay test runner configurado.** `playwright` está en devDependencies pero no
  existe script `test` ni suite; no asumas que hay `npm test`.
- **Migraciones:** SQL versionado en `supabase/migrations/` (`AAAAMMDD…_slug.sql`),
  aplicado por el flujo de Supabase, **no** por un ORM. Para cambios de esquema añade
  una migración nueva; nunca edites una ya aplicada.
- **Scripts puntuales** (Node/tsx, fuera del build): `scripts/seed-users.ts` crea los
  usuarios de prueba vía Admin SDK; `scripts/backfill-reportes.ts` rellena reportes.

## Variables de entorno (`.env.local`)

Ver `.env.local.example`. Cuatro claves:

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — clientes browser/server (sujetos a RLS).
- `SUPABASE_SERVICE_ROLE_KEY` — solo servidor, **salta RLS**. Únicamente en `lib/supabase/admin.ts`.
- `CRON_SECRET` — protege los endpoints de cron (`app/api/cron/*`).

## Arquitectura

### Auth y enrutado por rol (varias capas, no confíes en una sola)

1. **`proxy.ts`** (middleware de Next 16 — se llama `proxy`, no `middleware`) refresca
   la sesión de `@supabase/ssr` y redirige por rol. **Ojo:** enruta leyendo
   `user.user_metadata.rol`, que el cliente *puede* manipular. Es solo la primera barrera.
2. **`lib/autorizacion.ts` → `autorizar(roles)`** es la autorización real: lee el rol
   desde `profiles.rol` (la base, no metadata) y devuelve un cliente Supabase autenticado.
   **Toda Server Action que toque datos debe empezar por `autorizar([...])`** y cortar si
   `!ok`. Los Server Components que protegen una página repiten la verificación contra
   `profiles.rol` (ver `app/jefe/page.tsx`).
3. **RLS en Postgres** es la capa definitiva: aunque el código falle, la política decide
   qué fila ve/escribe cada usuario. Nunca autorices solo en el cliente.

`primer_ingreso = true` en `profiles` fuerza el redirect a `/primer-ingreso` antes de
dejar entrar a cualquier panel.

### Los tres clientes de Supabase (no los confundas)

- `lib/supabase/server.ts` — Server Components / Server Actions / Route Handlers. Sujeto a RLS.
- `lib/supabase/client.ts` — componentes de navegador (`'use client'`). Sujeto a RLS.
- `lib/supabase/admin.ts` — **service_role, salta RLS.** Solo servidor, jamás importar
  desde cliente. Se usa para crear usuarios (gestión de usuarios, primer ingreso) y crons.

### Patrón de datos: leer en RSC, escribir en Server Action

- **Lectura:** los Server Components (`page.tsx`) hacen las queries con el cliente de
  servidor y pasan datos planos al `panel.tsx`/`shell.tsx` (`'use client'`) que renderiza.
  Los conteos de KPI usan `{ count: 'exact', head: true }` y se degradan a 0 si fallan,
  sin tumbar la página.
- **Escritura:** Server Actions en `app/<rol>/actions.ts`. Forma estándar:
  validar input → `autorizar([...])` → mutar → devolver `{ error }` | `{ ok: true }` o
  `redirect()`. Se consumen con `useActionState`.
- **Concurrencia optimista:** las mutaciones acotan el `update` con `.eq('estado', …)` y
  revisan filas afectadas; 0 filas = "alguien cambió el estado antes que tú, recarga".
  El error `23505` (índice único) se traduce a mensajes de negocio (p. ej. "ya tienes
  una solicitud activa").
- **Validación compartida** sin dependencias externas: `lib/validacion.ts` (email,
  teléfono, UUID, AnyDesk, límites de longitud). Úsala en lugar de regex ad-hoc.

### Refresco: polling, no Realtime (decisión de MVP)

`lib/use-polling.ts` (`usePolling`) refresca con `router.refresh()` en intervalo, se pausa
cuando la pestaña está oculta y refresca al volver. `components/etiqueta-actualizado.tsx`
muestra "actualizado hace X". **No** se usa Supabase Realtime (es spec futuro/opcional).

### Modelo de datos (resumen; la verdad está en `supabase/migrations/`)

- **Enums:** `user_role` (jefe/tecnico/trabajador), `solicitud_estado`
  (en_espera/en_proceso/solucionado/no_solucionado), `tecnico_estado`
  (disponible/atendiendo/en_oficina/virtual/descanso), `ayuda_tipo` (presencial/virtual).
- **`profiles`** (1:1 con `auth.users` vía trigger `handle_new_user`), **`solicitudes`**,
  **`technician_status`** (solo técnicos).
- **Catálogo de ubicación** (SPEC 13): `sedes → areas → subareas`, jerárquico. La vieja
  tabla `areas` (texto libre) y `solicitudes.area_id` fueron eliminadas; la ubicación
  vive en `profiles`. No reintroduzcas el modelo viejo.
- **Adjuntos** (SPEC 12): `solicitud_adjuntos` + bucket de Storage. El navegador sube los
  bytes (imágenes webp comprimidas / PDF); la Server Action solo registra metadatos y
  verifica propiedad.
- **Doble confirmación** (SPEC 08): `confirmacion_tecnico` + `confirmacion_trabajador`;
  una solicitud pasa a `solucionado` solo con ambas.
- **Índice único parcial:** una sola solicitud activa por trabajador.
- Las políticas RLS modelan el acceso por rol en cada tabla; cámbialas en una migración,
  no en código.

### Crons / reportes

`app/api/cron/*` (reportes mensuales, limpieza de adjuntos) son Route Handlers protegidos
por `CRON_SECRET`. Los PDFs de reporte se generan en `lib/reportes/`.

### Layout de carpetas

- `app/<rol>/` — un segmento por rol (`trabajador`, `tecnico`, `jefe`) con `layout.tsx`
  (guarda de sesión + shell), `page.tsx` (RSC que lee datos), `panel.tsx`/`shell.tsx`
  (cliente), `actions.ts` (Server Actions), `loading.tsx` y `error.tsx`.
- `app/primer-ingreso/`, `app/login/`, `app/solicitar-recuperacion/`,
  `app/actualizar-contrasena/` — flujos de cuenta.
- `components/` — UI reutilizable (incl. `components/ui/` shadcn). `lib/` — utilidades,
  clientes Supabase, validación, polling, adjuntos, reportes. Alias de import `@/…`.

## Convenciones

- TypeScript en todo el código. App Router bajo `app/`.
- Mensajes de UI y comentarios en español; los identificadores mezclan español (dominio)
  con términos técnicos en inglés, siguiendo lo existente.
- En Next 16 el middleware se llama `proxy` (no `middleware`). Verifícalo en los docs
  antes de tocarlo.
- Los usuarios los crea el equipo (no hay auto-registro). El primer ingreso obliga a
  registrar celular y correo para poder recuperar la contraseña.
- Acceso a datos: respeta RLS de Supabase. Nunca confíes solo en el cliente para
  autorizar por rol; la política vive en la base.

## Cómo trabajamos: spec-driven

Este repo usa **diseño guiado por especificaciones**. No se escribe código de una
feature grande sin un spec aprobado.

- El plan de qué specs existen y cómo dependen entre sí está en
  **[spec-draft.md](./spec-draft.md)**. Léelo antes de proponer arquitectura.
- Los specs ya escritos viven en `specs/` (numerados `NN-slug.md`). El núcleo (01–07) y
  varias extensiones (07b–14) ya están implementados; consúltalos como fuente de verdad
  del comportamiento de cada feature.
- Flujo:
  1. `/spec <descripción>` — diseña un spec sección por sección (no escribe código).
  2. El humano revisa y marca el estado como `Aprobado`.
  3. `/spec-impl <NN-slug>` — implementa el spec aprobado, paso a paso.
- Definiciones de estos comandos: `.claude/skills/spec/` y `.claude/skills/spec-impl/`.

## Guías de referencia (leer bajo demanda, no precargar)

- **Next.js:** skill `next-best-practices` (`.claude/skills/next-best-practices/SKILL.md`)
  — índice por tema (file conventions, RSC boundaries, async APIs, route handlers, etc.).
- **Supabase / Postgres:** skill `supabase-postgres-best-practices`
  (`.claude/skills/supabase-postgres-best-practices/SKILL.md`) — rendimiento, RLS y esquema.

Consulta el archivo concreto del tema que estés tocando; no leas todas las guías a la vez.
