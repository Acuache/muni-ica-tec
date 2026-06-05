# SPEC 04 — Primer ingreso + recuperación de contraseña

> **Estado:** Implementado · **Depende de:** SPEC 03 · **Fecha:** 2026-06-04
> **Objetivo:** Forzar a todo usuario a registrar su teléfono y confirmar su correo
> en el primer login, y permitirle recuperar su contraseña vía email una vez
> que haya completado ese paso.

## Scope

**In:**

- Detección de primer ingreso: tras el login, si `profiles.primer_ingreso = true`,
  redirigir a `/primer-ingreso` antes de llegar al panel.
- Página `/primer-ingreso` con formulario obligatorio de dos campos:
  - **Teléfono** — campo de texto, no puede estar vacío.
  - **Correo** — campo de texto con label "Escribe tu correo para confirmarlo";
    el valor enviado debe coincidir con `auth.users.email` de la sesión activa.
- Al enviar correctamente: guardar `telefono` y `email` en `profiles`,
  poner `primer_ingreso = false` y redirigir al panel del rol.
- Protección de la ruta `/primer-ingreso`: solo accesible con sesión activa;
  si el usuario ya tiene `primer_ingreso = false`, redirigir a su panel.
- Link "¿Olvidaste tu contraseña?" en `/login`, debajo del botón de ingreso.
- Página `/solicitar-recuperacion`: formulario con campo de email para pedir
  el link de recuperación (llama a `supabase.auth.resetPasswordForEmail`).
- Página `/actualizar-contrasena`: recibe el token de Supabase en la URL,
  muestra formulario de nueva contraseña y la actualiza con
  `supabase.auth.updateUser({ password })`.

**Fuera de alcance (specs posteriores):**

- Edición general del perfil (nombre, apellidos, foto) — spec de edición de perfil.
- Cambio de contraseña estando ya autenticado — mismo spec de edición de perfil.
- Verificación del teléfono por SMS — fuera del MVP.
- Verificación del correo por link de confirmación — basta con que coincida con
  `auth.users.email`.

## Modelo de datos

Este spec no introduce tablas ni columnas nuevas. Utiliza los campos ya
definidos en SPEC 02 sobre la tabla `profiles`:

| Campo            | Tipo      | Uso en este spec                                        |
| ---------------- | --------- | ------------------------------------------------------- |
| `telefono`       | `text`    | Se guarda al completar el formulario de primer ingreso. |
| `email`          | `text`    | Se guarda al completar el formulario; debe coincidir    |
|                  |           | con `auth.users.email` de la sesión activa.             |
| `primer_ingreso` | `boolean` | Empieza en `true`. Se pone a `false` tras completar     |
|                  |           | el formulario. El Server Action de cada panel lo lee    |
|                  |           | para redirigir si aún no se completó.                   |

**Flujo de datos del primer ingreso:**

- Login → Server Action de login (SPEC 03) consulta `profiles.primer_ingreso`.
- Si `true` → redirige a `/primer-ingreso`.
- Usuario envía el formulario → Server Action valida que el correo coincida con
  `session.user.email` → hace `update profiles set telefono, email, primer_ingreso = false
where id = auth.uid()`.
- Redirección al panel del rol.

**Flujo de datos de recuperación de contraseña:**

- Usuario pulsa "¿Olvidaste tu contraseña?" → `/solicitar-recuperacion`.
- Escribe su email → `supabase.auth.resetPasswordForEmail(email, { redirectTo: '/actualizar-contrasena' })`.
- Supabase envía el link; el usuario hace clic y aterriza en `/actualizar-contrasena`
  con token en la URL.
- Usuario escribe la nueva contraseña → `supabase.auth.updateUser({ password })`.

## Plan de implementación

1. **Modificar el Server Action de login (`app/login/actions.ts`).**
   Tras autenticación exitosa, consultar `profiles.primer_ingreso` del usuario.
   Si es `true`, redirigir a `/primer-ingreso`; si es `false`, continuar al panel
   del rol (comportamiento actual de SPEC 03).
   Verificar: un usuario con `primer_ingreso = true` aterriza en `/primer-ingreso`
   al hacer login; uno con `false` sigue yendo a su panel.

2. **Crear `app/primer-ingreso/page.tsx`.**
   Componente cliente con dos campos: "Teléfono" y "Escribe tu correo para
   confirmarlo". Muestra el error devuelto por el Server Action si el correo
   no coincide o algún campo está vacío.
   Verificar: la página carga sin errores tras el login de un usuario nuevo.

3. **Crear `app/primer-ingreso/actions.ts`.**
   Server Action que:
   - Valida que ambos campos no estén vacíos.
   - Compara el correo enviado con `session.user.email`; si no coincide, devuelve
     error al formulario.
   - Hace `update profiles set telefono, email, primer_ingreso = false where
id = auth.uid()`.
   - Redirige al panel según `profiles.rol`.
     Verificar: al enviar el formulario correctamente, `profiles` se actualiza y
     el usuario llega a su panel; si el correo no coincide, aparece el error.

4. **Actualizar `proxy.ts`.**
   Añadir `/primer-ingreso` a las rutas que requieren sesión activa.
   Si hay sesión pero `primer_ingreso = false` (leído de `user_metadata` si está
   disponible, o dejando la verificación al paso 5), redirigir al panel del rol.
   Verificar: sin sesión, `/primer-ingreso` redirige a `/login`.

5. **Actualizar los paneles esqueleto.**
   En `app/trabajador/page.tsx`, `app/tecnico/page.tsx` y `app/jefe/page.tsx`
   (Server Components): consultar `profiles.primer_ingreso`; si es `true`,
   redirigir a `/primer-ingreso`.
   Verificar: un usuario con `primer_ingreso = true` que navega directamente a
   su panel es redirigido a `/primer-ingreso`.

6. **Añadir link "¿Olvidaste tu contraseña?" en `app/login/page.tsx`.**
   Link debajo del botón de ingreso que lleva a `/solicitar-recuperacion`.
   Verificar: el link aparece en la pantalla de login y navega correctamente.

7. **Crear `app/solicitar-recuperacion/page.tsx` y su Server Action.**
   Formulario con campo de email. El Server Action llama a
   `supabase.auth.resetPasswordForEmail(email, { redirectTo: '/actualizar-contrasena' })`.
   Mostrar mensaje de confirmación ("Si el correo existe, recibirás un link en
   breve") sin revelar si el email existe o no.
   Verificar: al enviar un email registrado, Supabase dispara el correo de
   recuperación (visible en Dashboard → Auth → Logs).

8. **Crear `app/actualizar-contrasena/page.tsx` y su Server Action.**
   La página lee el token de la URL y establece la sesión con
   `supabase.auth.exchangeCodeForSession` (o el helper equivalente en la
   versión de `@supabase/ssr` instalada — verificar en docs locales antes de
   escribir). Formulario de nueva contraseña. El Server Action llama a
   `supabase.auth.updateUser({ password })` y redirige a `/login` con mensaje
   de éxito.
   Verificar: el flujo completo (pedir link → clic en correo → nueva contraseña
   → login con la nueva contraseña) funciona de principio a fin.

## Criterios de aceptación

- [ ] Un usuario con `primer_ingreso = true` que hace login es redirigido a
      `/primer-ingreso` antes de llegar a su panel.
- [ ] Un usuario con `primer_ingreso = true` que navega directamente a su panel
      es redirigido a `/primer-ingreso`.
- [ ] `/primer-ingreso` sin sesión activa redirige a `/login`.
- [ ] Un usuario con `primer_ingreso = false` que visita `/primer-ingreso` es
      redirigido a su panel.
- [ ] El formulario de primer ingreso no se puede enviar con el campo teléfono
      vacío; se muestra un error.
- [ ] El formulario de primer ingreso no se puede enviar si el correo escrito
      no coincide con el email de la sesión activa; se muestra un error.
- [ ] Al enviar el formulario correctamente, `profiles.telefono` y
      `profiles.email` se guardan y `profiles.primer_ingreso` pasa a `false`.
- [ ] Tras completar el formulario, el usuario llega al panel de su rol.
- [ ] `/login` muestra el link "¿Olvidaste tu contraseña?" debajo del botón
      de ingreso.
- [ ] Desde `/solicitar-recuperacion`, enviar un email registrado dispara el
      correo de recuperación de Supabase (verificable en Dashboard → Auth → Logs).
- [ ] La página muestra el mensaje de confirmación sin revelar si el email
      existe o no.
- [ ] El link del correo de recuperación lleva a `/actualizar-contrasena`.
- [ ] En `/actualizar-contrasena`, el usuario puede establecer una nueva
      contraseña y tras confirmar es redirigido a `/login`.
- [ ] El usuario puede hacer login con la nueva contraseña.
- [ ] `npm run build` y `npm run lint` pasan sin errores.

## Decisiones

- **Sí:** interceptar el primer ingreso en el Server Action de login y en cada
  panel (Server Component), no en el proxy. Evita una query a `profiles` en
  cada request; el proxy solo verifica sesión activa.

- **Sí:** confirmar el correo haciendo que el usuario lo escriba manualmente
  y validándolo contra `session.user.email`. Garantiza que el usuario conoce
  su correo sin enviar un link de verificación extra; el correo ya existe
  en `auth.users` y es el ground truth.

- **Sí:** mensaje de confirmación genérico en `/solicitar-recuperacion`
  ("Si el correo existe, recibirás un link en breve"). Evita enumerar qué
  emails están registrados (práctica estándar de seguridad).

- **Sí:** redirigir a `/login` tras actualizar la contraseña en
  `/actualizar-contrasena`. El usuario debe autenticarse de nuevo con la
  nueva contraseña; no se inicia sesión automáticamente tras el reset.

- **No:** verificación del teléfono por SMS. Añade complejidad y coste
  (proveedor SMS) fuera del alcance del MVP.

- **No:** link de verificación al confirmar el correo. El correo ya está
  verificado en `auth.users`; pedir un segundo link sería redundante.

- **No:** nombres, apellidos y foto en este spec. Son campos de edición
  de perfil que van en su propio spec posterior.

- **No:** cambio de contraseña estando autenticado. No está en el MVP;
  se añade en un spec de edición de perfil si se necesita.

## Riesgos

| Riesgo                                                                                                                                                                                  | Mitigación                                                                                                  |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `supabase.auth.exchangeCodeForSession` puede tener una firma distinta en la versión de `@supabase/ssr` instalada (el token de recuperación llega de formas distintas según la versión). | Verificar en `node_modules/@supabase/ssr/` la API exacta antes de escribir `/actualizar-contrasena`.        |
| El correo escrito en el formulario puede tener espacios o mayúsculas distintas al `session.user.email`, haciendo fallar la comparación aunque sea el mismo.                             | Normalizar ambos valores con `.trim().toLowerCase()` antes de comparar.                                     |
| Un usuario que completa el formulario de primer ingreso pero la query de update falla a mitad (ej. timeout) puede quedar con `primer_ingreso = true` indefinidamente.                   | El formulario vuelve a mostrarse en el próximo login; el usuario puede reintentar sin perder datos.         |
| `/actualizar-contrasena` con un token expirado o ya usado muestra un error de Supabase.                                                                                                 | Capturar el error y mostrar un mensaje claro con link a `/solicitar-recuperacion` para pedir un nuevo link. |

## Lo que **no** está en este spec

- Nombres, apellidos y foto de perfil — van en un spec de edición de perfil.
- Cambio de contraseña estando autenticado — mismo spec de edición de perfil.
- Verificación del teléfono por SMS — fuera del MVP.
- Edición general del perfil más allá de teléfono y correo — spec posterior.
- Contenido real de los paneles (formularios, colas, KPIs) — SPEC 05, 06, 07.
- Notificaciones — SPEC 09.
- Tiempo real con Supabase Realtime — SPEC 10.

Cada uno de esos puntos, si se incorpora, va en su propio spec.
