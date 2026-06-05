# SPEC 03 — Autenticación y enrutado por rol

> **Estado:** Implementado · **Depende de:** SPEC 01, SPEC 02 · **Fecha:** 2026-06-04
> **Objetivo:** Permitir el login con email/contraseña a usuarios creados por el
> equipo, proteger todas las rutas desde el proxy de Next.js 16 y redirigir a cada
> rol a su panel.

## Scope

**In:**

- Pantalla de login en `/login` con campos email (label "Usuario / Correo") y
  contraseña; manejo de error para credenciales incorrectas.
- Sesión con Supabase Auth (cookie-based via `@supabase/ssr`).
- Archivo `proxy.ts` en la raíz del proyecto (convención de Next.js 16) que:
  - Redirige `/` al panel del rol activo si hay sesión, o a `/login` si no.
  - Protege las rutas `/trabajador`, `/tecnico` y `/jefe`: si no hay sesión,
    redirige a `/login`; si el rol no coincide, redirige al panel propio.
  - Redirige `/login` al panel del rol si ya hay sesión activa.
- Páginas esqueleto (sin contenido real) para cada panel:
  - `app/trabajador/page.tsx`
  - `app/tecnico/page.tsx`
  - `app/jefe/page.tsx`
- Botón de logout en cada panel esqueleto que cierra la sesión y redirige a `/login`.
- Server Action (o Route Handler) para el logout que invalida la cookie de sesión.

**Fuera de alcance (specs posteriores):**

- Auto-registro de usuarios — no existe en esta app (decisión cerrada).
- Primer ingreso y recuperación de contraseña — SPEC 04.
- Contenido real de los paneles (formularios, colas, KPIs) — SPEC 05, 06, 07.
- Notificaciones y tiempo real — SPEC 09, 10.

## Modelo de datos

Este spec no introduce tablas ni estructuras de base de datos nuevas.
Lee únicamente `profiles.rol` (creado en SPEC 02) para determinar a qué
panel redirigir al usuario tras el login.

**Flujo de datos de sesión:**

- Login → `supabase.auth.signInWithPassword({ email, password })` desde un
  Server Action → Supabase devuelve la sesión → `@supabase/ssr` la persiste
  en cookies HTTP-only.
- Cada request → el proxy lee la sesión con el cliente servidor de
  `lib/supabase/server.ts` (SPEC 01) → consulta `profiles` para obtener `rol`
  → decide si redirigir o dejar pasar.
- Logout → Server Action llama a `supabase.auth.signOut()` → `@supabase/ssr`
  borra las cookies → redirige a `/login`.

## Plan de implementación

1. **Verificar la API del proxy en Next.js 16.**
   Leer `node_modules/next/dist/docs/` para confirmar el nombre del archivo
   (`proxy.ts`), la firma de la función exportada y cómo leer/escribir cookies
   desde el proxy antes de escribir una sola línea.
   Verificar: la firma usada en el código coincide con la documentación local.

2. **Crear la página de login (`app/login/page.tsx`).**
   Componente cliente con campos email (label "Usuario / Correo") y contraseña.
   Muestra el error devuelto por el Server Action si las credenciales son incorrectas.
   Verificar: la página carga en `/login` sin errores de TypeScript ni de consola.

3. **Crear el Server Action de login (`app/login/actions.ts`).**
   Llama a `supabase.auth.signInWithPassword({ email, password })`.
   Si tiene éxito, consulta `profiles` para obtener `rol` y redirige al panel
   correspondiente (`/trabajador`, `/tecnico` o `/jefe`).
   Si falla, devuelve el mensaje de error al formulario.
   Verificar: un usuario de prueba puede iniciar sesión y llegar a su panel.

4. **Crear los paneles esqueleto.**
   Tres páginas con el mínimo: título del rol y botón "Cerrar sesión".
   - `app/trabajador/page.tsx`
   - `app/tecnico/page.tsx`
   - `app/jefe/page.tsx`
     Verificar: cada página carga sin errores una vez autenticado el rol correcto.

5. **Crear el Server Action de logout (`app/actions/auth.ts`).**
   Llama a `supabase.auth.signOut()` y redirige a `/login`.
   El botón "Cerrar sesión" de cada panel esqueleto lo invoca.
   Verificar: al cerrar sesión la cookie se borra y el proxy bloquea el acceso
   a los paneles.

6. **Crear `proxy.ts` con la lógica de protección de rutas.**
   Reglas:
   - Sin sesión + ruta protegida → `/login`.
   - Con sesión + `/login` → panel del rol.
   - Con sesión + `/` → panel del rol.
   - Con sesión + ruta de otro rol → panel propio.
     Configurar el `matcher` para que aplique solo a las rutas relevantes.
     Verificar: los tres escenarios de los criterios de aceptación pasan.

## Criterios de aceptación

- [ ] `/login` carga sin errores y muestra el formulario con los campos
      "Usuario / Correo" y contraseña.
- [ ] Un usuario de prueba con rol `trabajador` inicia sesión y aterriza en `/trabajador`.
- [ ] Un usuario de prueba con rol `tecnico` inicia sesión y aterriza en `/tecnico`.
- [ ] Un usuario de prueba con rol `jefe` inicia sesión y aterriza en `/jefe`.
- [ ] Credenciales incorrectas muestran un mensaje de error en el formulario;
      no hay redirección ni crash.
- [ ] Un usuario sin sesión que visita `/trabajador`, `/tecnico` o `/jefe` es
      redirigido a `/login`.
- [ ] Un `trabajador` autenticado que visita `/tecnico` o `/jefe` es redirigido
      a `/trabajador`.
- [ ] Un `tecnico` autenticado que visita `/trabajador` o `/jefe` es redirigido
      a `/tecnico`.
- [ ] Un `jefe` autenticado que visita `/trabajador` o `/tecnico` es redirigido
      a `/jefe`.
- [ ] Un usuario autenticado que visita `/` es redirigido al panel de su rol.
- [ ] Un usuario autenticado que visita `/login` es redirigido al panel de su rol.
- [ ] El botón "Cerrar sesión" borra la sesión y redirige a `/login`; tras el
      logout, visitar el panel anterior redirige de vuelta a `/login`.
- [ ] `npm run build` y `npm run lint` pasan sin errores.

## Decisiones

- **Sí:** email + contraseña para Supabase Auth, con label "Usuario / Correo".
  El campo visual no confunde al usuario y el backend funciona nativamente sin
  una búsqueda extra de email por username.

- **Sí:** archivo `proxy.ts` (no `middleware.ts`). Convención de Next.js 16;
  documentada en `node_modules/next/dist/docs/`.

- **Sí:** redirección al panel propio cuando el rol no coincide con la ruta.
  No expone que existe la ruta del otro rol y es más limpio para el usuario.

- **Sí:** logout en este spec. Sin logout la sesión queda atrapada durante el
  desarrollo y no se puede probar el ciclo completo de protección de rutas.

- **Sí:** paneles esqueleto con solo título y botón de logout. SPEC 05–07 los
  rellenarán; crear la estructura ahora evita que el proxy no tenga a dónde
  redirigir.

- **Sí:** consultar `profiles.rol` en el Server Action de login (no en el proxy).
  El proxy solo verifica si hay sesión activa y lee el rol desde los metadatos
  de la sesión; el rol se escribe en los metadatos al crear el usuario
  (SPEC 02, trigger `handle_new_user`), así que no requiere una query extra
  por request.

- **No:** auto-registro. Decisión cerrada del proyecto; los usuarios los crea
  el equipo.

- **No:** login por username. Requeriría una búsqueda de email en `profiles`
  antes de llamar a `signInWithPassword`, añadiendo complejidad sin beneficio
  real para este contexto.

## Riesgos

| Riesgo                                                                                                                                                | Mitigación                                                                                                                                                                               |
| ----------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| La API del proxy en Next.js 16 puede diferir del middleware que conocemos (firma, helpers de cookies, matcher).                                       | Leer `node_modules/next/dist/docs/` antes de escribir `proxy.ts` (paso 1 del plan).                                                                                                      |
| `raw_user_meta_data.rol` puede no propagarse automáticamente al JWT de sesión, haciendo que el proxy no pueda leer el rol sin una query a `profiles`. | Verificar en la sesión de prueba si `session.user.user_metadata.rol` está disponible; si no, añadir una query a `profiles` solo en el proxy y cachear el resultado en una cookie propia. |
| Bucle de redirección si el matcher del proxy aplica a rutas que no debería (ej. assets, API routes).                                                  | Definir el matcher explícitamente excluyendo `/_next/`, `/api/` y archivos estáticos.                                                                                                    |
| `supabase.auth.signOut()` desde un Server Action puede no borrar las cookies si el cliente servidor no tiene acceso de escritura en ese contexto.     | Probar el logout en el paso 5 del plan; si falla, usar un Route Handler en lugar de Server Action para el logout.                                                                        |

## Lo que **no** está en este spec

- Auto-registro de usuarios — no existe en esta app.
- Primer ingreso y formulario obligatorio de celular y correo — SPEC 04.
- Contenido real de los paneles (formularios, colas, KPIs) — SPEC 05, 06, 07.
- Historial filtrable y exportación — SPEC 08.
- Notificaciones — SPEC 09.
- Tiempo real con Supabase Realtime — SPEC 10.
