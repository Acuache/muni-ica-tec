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

- **Trabajador** — crea una solicitud (área, tipo de ayuda presencial/virtual,
  título, descripción), ve su posición en la cola, puede cancelarla y confirma la
  resolución (¿quién te ayudó? → Resuelto / No resuelto).
- **Técnico** — ve la cola de espera, atiende solicitudes ("Atender ahora"),
  cambia su propio estado (Disponible / En Oficina / Virtual / Descanso) y ve sus
  métricas del día.
- **Jefe de informática** — panel de control: KPIs (esperando, solucionados hoy,
  tasa de éxito, no solucionados / escalamiento), cola completa, estado de los
  técnicos con indicador "última actualización hace X", e historial.

Las pantallas de referencia (mockups) están en `assets/`:
`panel_del_jefe_de_informatica/`, `panel_del_tecnico/`, `panel_del_trabajador/`.

## Stack (los 2 únicos requisitos de plataforma)

1. **Frontend / framework:** Next.js `16.2.7` (App Router) + React `19.2.4`.
2. **Backend:** Supabase (Postgres + Auth + RLS). Es el único backend.

Apoyo de UI ya presente: Tailwind v4, shadcn/ui, Radix, `@tabler/icons-react`.
No introducir otro backend, ORM ni servicio de auth: todo va contra Supabase.

## Convenciones

- TypeScript en todo el código. App Router bajo `app/`.
- En Next 16 el middleware se llama `proxy` (no `middleware`). Verifícalo en los
  docs antes de tocarlo.
- Componentes de UI reutilizables en `components/`; utilidades en `lib/`.
- Los usuarios los crea el equipo (no hay auto-registro). Ver el flujo de primer
  ingreso y recuperación de contraseña en el spec correspondiente.
- Acceso a datos: respeta RLS de Supabase. Nunca confíes solo en el cliente para
  autorizar por rol; la política vive en la base.

## Cómo trabajamos: spec-driven

Este repo usa **diseño guiado por especificaciones**. No se escribe código de una
feature grande sin un spec aprobado.

- El plan de qué specs existen y cómo dependen entre sí está en
  **[spec-draft.md](./spec-draft.md)**. Léelo antes de proponer arquitectura.
- Los specs ya escritos viven en `specs/` (numerados `NN-slug.md`).
- Flujo:
  1. `/spec <descripción>` — diseña un spec sección por sección (no escribe código).
  2. El humano revisa y marca el estado como `Aprobado`.
  3. `/spec-impl <NN-slug>` — implementa el spec aprobado, paso a paso.
- Definiciones de estos comandos: `.agents/skills/spec/` y `.agents/skills/spec-impl/`.

## Guías de referencia (leer bajo demanda, no precargar)

- **Next.js:** `.agents/skills/next-best-practices/SKILL.md` — índice por tema
  (file conventions, RSC boundaries, async APIs, route handlers, etc.).
- **Supabase / Postgres:** `.agents/skills/supabase-postgres-best-practices/SKILL.md`
  — reglas de rendimiento, RLS y diseño de esquema.

Consulta el archivo concreto del tema que estés tocando; no leas todas las guías a la vez.

## Comandos

```bash
npm run dev     # desarrollo (http://localhost:3000)
npm run build   # build de producción
npm run start   # servir el build
npm run lint    # eslint
```
