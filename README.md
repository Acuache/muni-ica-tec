# Soporte Municipal — Muni Ica (`muni-ica-tec`)

App web de gestión de tickets de soporte técnico interno para la **Municipalidad de Ica**.
Tres roles, un solo flujo: un **trabajador** pide ayuda, un **técnico** la atiende y el
**jefe de informática** supervisa todo sobre una única base de tickets ("solicitudes").

> Para trabajar en el código, lee primero [`CLAUDE.md`](./CLAUDE.md) (arquitectura y
> convenciones) y [`AGENTS.md`](./AGENTS.md) (**aviso crítico:** esta versión de Next.js
> tiene cambios importantes — consulta `node_modules/next/dist/docs/` antes de escribir).

## Roles

- **Trabajador** — crea una solicitud (ayuda presencial/virtual, título, descripción y,
  opcionalmente, código AnyDesk + adjuntos), ve su posición en la cola, puede cancelarla y
  confirma la resolución (Resuelto / No resuelto). Mientras lo atienden ve un aviso de
  espera (máx. 20 min) y, si su caso pasa a virtual, un modal obligatorio le pide el código
  AnyDesk.
- **Técnico** — ve la cola de espera, atiende casos ("Atender ahora"), cambia su propio
  estado (Disponible / En Oficina / Virtual / Descanso), ve sus métricas del día, puede
  convertir un caso presencial↔virtual y "dejarlo para mañana".
- **Jefe de informática** — panel de control: KPIs (esperando, solucionados hoy, tasa de
  éxito, no solucionados), cola completa, estado de los técnicos ("última actualización
  hace X"), historial, reportes mensuales en PDF y gestión de usuarios.

## Stack

| Capa | Tecnología |
|------|------------|
| Framework | **Next.js 16.2.7** (App Router) + **React 19.2.4**, TypeScript |
| Backend | **Supabase** (Postgres + Auth + RLS + Storage) — único backend |
| UI | Tailwind v4, shadcn/ui, Radix, `@tabler/icons-react` |
| Reportes | `jspdf` + `jspdf-autotable` |

No se introduce otro backend, ORM ni servicio de auth: todo va contra Supabase.

## Requisitos

- Node.js 20+
- Un proyecto de **Supabase** (Postgres + Auth + Storage)
- Supabase CLI (para aplicar migraciones)

## Puesta en marcha

```bash
# 1. Instalar dependencias
npm install

# 2. Configurar variables de entorno
cp .env.local.example .env.local   # y completa los valores (ver abajo)

# 3. Aplicar el esquema (migraciones de supabase/migrations/)
supabase db push                   # o el flujo de migraciones que uses

# 4. (Opcional) Crear usuarios de prueba vía Admin SDK
npx tsx scripts/seed-users.ts

# 5. Levantar el servidor de desarrollo
npm run dev                        # http://localhost:3000
```

### Variables de entorno (`.env.local`)

| Clave | Para qué |
|-------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase (clientes browser/server, sujetos a RLS) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clave anon (sujeta a RLS) |
| `SUPABASE_SERVICE_ROLE_KEY` | Solo servidor; **salta RLS**. Únicamente en `lib/supabase/admin.ts` |
| `CRON_SECRET` | Protege los endpoints de cron (`app/api/cron/*`) |
| `NEXT_PUBLIC_SITE_URL` | Base del link de recuperación de contraseña. En local cae a `http://localhost:3000`; en producción es **obligatoria** y sin barra final |

## Comandos

```bash
npm run dev     # desarrollo (http://localhost:3000)
npm run build   # build de producción
npm run start   # servir el build
npm run lint    # eslint
```

- **No hay test runner configurado.** `playwright` está en devDependencies pero no existe
  script `test` ni suite; no asumas que hay `npm test`.
- **Migraciones:** SQL versionado en `supabase/migrations/` (`AAAAMMDD…_slug.sql`), aplicado
  por el flujo de Supabase, **no** por un ORM. Para cambios de esquema añade una migración
  nueva; nunca edites una ya aplicada.
- **Scripts puntuales** (Node/tsx, fuera del build): `scripts/seed-users.ts` crea usuarios
  de prueba; `scripts/backfill-reportes.ts` rellena reportes.

## Estructura del proyecto

```
app/
  <rol>/            trabajador · tecnico · jefe — layout, page (RSC), panel/shell
                    (cliente), actions.ts (Server Actions) y su subpágina perfil/
  perfil/           lógica compartida del perfil (actions + carga del catálogo)
  login/, primer-ingreso/, solicitar-recuperacion/, actualizar-contrasena/
  api/cron/         Route Handlers de cron (reportes, limpieza), protegidos por CRON_SECRET
components/         UI reutilizable (incl. components/ui/ de shadcn)
lib/                clientes Supabase, validación, polling, adjuntos, reportes, horario
supabase/migrations/  esquema versionado en SQL
specs/              especificaciones numeradas (NN-slug.md) — fuente de verdad de cada feature
proxy.ts            middleware de Next 16 (refresca sesión + enruta por rol)
```

### Arquitectura en breve

- **Autorización en capas:** `proxy.ts` (primera barrera, por metadata) → `autorizar()` en
  Server Actions/RSC (lee `profiles.rol`, la base) → **RLS en Postgres** (capa definitiva).
  Nunca autorices solo en el cliente.
- **Datos:** leer en Server Components, escribir en Server Actions (`validar → autorizar →
  mutar → { error } | { ok }`), con concurrencia optimista.
- **Refresco:** polling con `router.refresh()` (`lib/use-polling.ts`), no Realtime.

Detalle completo en [`CLAUDE.md`](./CLAUDE.md).

## Cómo trabajamos: spec-driven

Las features grandes se diseñan como **especificación aprobada** antes de escribir código.
El mapa de specs está en [`spec-draft.md`](./spec-draft.md) y los specs escritos en
`specs/`. El núcleo (01–07) y las extensiones (07b–15) ya están implementados.

1. `/spec <descripción>` — diseña el spec sección por sección.
2. El humano lo revisa y lo marca como `Aprobado`.
3. `/spec-impl <NN-slug>` — lo implementa paso a paso.

## Despliegue

Optimizado para **Vercel** (Next.js) + **Supabase** gestionado. Configura las cinco
variables de entorno en el panel de Vercel (con `NEXT_PUBLIC_SITE_URL` apuntando al dominio
de producción). Los crons (reportes mensuales, limpieza de adjuntos) se programan con
**`pg_cron`** en Supabase: `cron.schedule(...)` hace un `net.http_post` al Route Handler
correspondiente (`/api/cron/*`) con `CRON_SECRET` en la cabecera `Authorization` — ver
`supabase/migrations/*_cron_*.sql` (reemplaza el dominio y el secreto al desplegar).
