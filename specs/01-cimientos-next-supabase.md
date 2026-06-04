# SPEC 01 — Cimientos: Next.js + Supabase

> **Estado:** Implementado · **Depende de:** ninguno · **Fecha:** 2026-06-04
> **Objetivo:** Conectar el proyecto a Supabase instalando los paquetes oficiales,
> creando los clientes de servidor y navegador en `lib/supabase/`, configurando las
> tres variables de entorno y verificando la conexión desde `app/page.tsx`.

## Scope

**In:**

- Instalar `@supabase/supabase-js@latest` y `@supabase/ssr@latest`.
- Crear `.env.local` con las tres variables: `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
- Crear `.env.local.example` documentando las tres variables (sin valores reales).
- Crear `lib/supabase/client.ts` — cliente para el navegador.
- Crear `lib/supabase/server.ts` — cliente para el servidor (con cookie handler
  completo, listo para que SPEC 03 lo use sin modificarlo).
- Actualizar `app/page.tsx` para hacer una consulta trivial a Supabase y mostrar
  el resultado (éxito o error esperado de RLS) en pantalla.

**Fuera de alcance (specs posteriores):**

- Tablas, enums ni políticas RLS (SPEC 02).
- Login, sesión y protección de rutas (SPEC 03).
- Primer ingreso y recuperación de contraseña (SPEC 04).
- Cualquier UI de roles o paneles (SPEC 05–07).

## Modelo de datos

Este spec no introduce tablas ni estructuras de base de datos nuevas.
Crea únicamente dos módulos de utilidad y variables de entorno.

**`lib/supabase/client.ts`** — cliente navegador:

```ts
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

**`lib/supabase/server.ts`** — cliente servidor (cookie-aware, listo para SPEC 03):

```ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )
}
```

**Variables de entorno (`.env.local`):**

```
NEXT_PUBLIC_SUPABASE_URL=https://<proyecto>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
```

## Plan de implementación

1. **Instalar paquetes.**
   Ejecutar `npm install @supabase/supabase-js@latest @supabase/ssr@latest`.
   Verificar: `package.json` muestra ambas dependencias; `npm run dev` levanta sin errores.

2. **Configurar variables de entorno.**
   Crear `.env.local` con las tres variables reales.
   Crear `.env.local.example` con los mismos nombres pero valores vacíos o de ejemplo.
   Verificar: `.env.local` no está en git (`.gitignore` ya lo excluye por defecto en Next.js).

3. **Crear `lib/supabase/client.ts`.**
   Exportar `createClient()` usando `createBrowserClient` de `@supabase/ssr`.
   Verificar: TypeScript no reporta errores al compilar este archivo.

4. **Crear `lib/supabase/server.ts`.**
   Exportar `createClient()` async usando `createServerClient` con el cookie handler
   completo (ver modelo de datos).
   Verificar: TypeScript no reporta errores al compilar este archivo.

5. **Verificar la conexión en `app/page.tsx`.**
   Importar el cliente servidor, hacer `supabase.from('_any_table_').select('*').limit(1)`
   y renderizar el resultado (o el error) en pantalla.
   Verificar: la página carga en `http://localhost:3000`, se ve una respuesta de Supabase
   (puede ser `[]`, un error de tabla inexistente o un error de RLS — lo importante es
   que la conexión llega al servidor de Supabase y responde).

## Criterios de aceptación

- [ ] `npm install` finaliza sin errores; `package.json` lista `@supabase/supabase-js`
      y `@supabase/ssr` como dependencias.
- [ ] `.env.local` existe y contiene las tres variables con valores reales.
- [ ] `.env.local.example` existe, está en git y documenta las tres variables
      con valores vacíos o de ejemplo.
- [ ] `lib/supabase/client.ts` exporta `createClient()` y TypeScript no reporta
      errores en ese archivo.
- [ ] `lib/supabase/server.ts` exporta `createClient()` async con cookie handler
      completo y TypeScript no reporta errores en ese archivo.
- [ ] `npm run dev` levanta en `http://localhost:3000` sin errores en consola
      relacionados con Supabase o variables de entorno.
- [ ] `app/page.tsx` muestra en pantalla una respuesta de Supabase (datos, array
      vacío o error de RLS): prueba que la conexión al servidor de Supabase funciona.
- [ ] `npm run lint` pasa sin errores en los archivos nuevos o modificados.

## Decisiones

- **Sí:** `SUPABASE_SERVICE_ROLE_KEY` desde el inicio. Evita tener que modificar
  `.env.local` y `.env.local.example` en specs futuros que la necesiten.

- **Sí:** clientes en `lib/supabase/`. Sigue la convención del proyecto (`lib/`
  para utilidades) y los mantiene separados de los componentes.

- **Sí:** cookie handler completo en `lib/supabase/server.ts` desde ahora. SPEC 03
  (auth) lo necesitará tal cual; configurarlo aquí evita reescribir el archivo más
  adelante.

- **Sí:** verificación en `app/page.tsx`. No crea rutas extra que habría que limpiar
  y es visible de inmediato en el navegador.

- **No:** ruta `/test-connection` separada. Ensuciaría el árbol de rutas con algo
  temporal.

- **No:** verificación solo por log de servidor. No es visible sin abrir la terminal,
  lo que dificulta confirmar el criterio de aceptación de un vistazo.

- **No:** versiones pinadas de `@supabase/supabase-js` y `@supabase/ssr`. Proyecto
  nuevo, sin razón para congelar versiones todavía.

## Riesgos

| Riesgo | Mitigación |
|--------|------------|
| `cookies()` de `next/headers` cambió su API en Next.js 16. | Verificar en `node_modules/next/dist/docs/` que `await cookies()` sigue siendo la forma correcta antes de escribir `server.ts`. |
| `cookieStore.set()` lanza error cuando se llama desde un Server Component (solo está permitido en Server Actions y Route Handlers). | Envolver el bloque `setAll` en `try/catch` e ignorar el error silenciosamente: en un Server Component la cookie de sesión no se puede renovar, pero la lectura sí funciona. SPEC 03 resolverá esto con el proxy. |
| `.env.local` con claves reales accidentalmente en git. | Confirmar antes de hacer commit que `.gitignore` incluye `.env.local` (Next.js lo agrega por defecto). |

## Lo que **no** está en este spec

- Tablas, enums ni políticas RLS — eso es SPEC 02.
- Login, sesión y protección de rutas — eso es SPEC 03.
- Primer ingreso y recuperación de contraseña — eso es SPEC 04.
- Paneles de trabajador, técnico y jefe — eso es SPEC 05–07.
- Cliente con `SUPABASE_SERVICE_ROLE_KEY` (admin client) — se crea en el spec
  que lo necesite por primera vez.

Cada uno de esos puntos, si se incorpora, va en su propio spec.
