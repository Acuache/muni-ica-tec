# SPEC 07f — Ampliar formulario de primer ingreso

> **Estado:** Implementado · **Depende de:** SPEC 04 (primer ingreso original) · **Fecha:** 2026-06-09
> **Objetivo:** Reemplazar el formulario de dos campos del primer ingreso por una
> página de tres secciones (datos del lugar, datos del usuario, datos de la cuenta)
> que captura lugar, área, puesto, nombre, apellido, teléfono, confirmación de correo
> y cambio opcional de contraseña; nombre y apellido se concatenan y se guardan en
> el campo `username` ya existente, y se añaden tres columnas nuevas a `profiles`
> para lugar, área y puesto.

## Scope

**In:**

- Reemplazar `app/primer-ingreso/page.tsx` y `app/primer-ingreso/actions.ts` con
  un formulario de página única dividido en tres secciones visuales:
  a. **Datos del lugar** — campos Lugar, Área y Puesto (texto libre, obligatorios).
  b. **Datos del usuario** — campos Nombre y Apellido (texto libre, obligatorios).
  c. **Datos de la cuenta** — Teléfono (ya existente), Confirmación de correo
     (nuevo label) y Cambio de contraseña (toggle).
- Migración de BD: agregar tres columnas nullable a `profiles`:
  `lugar text`, `area text`, `puesto text`.
- El Server Action concatena Nombre y Apellido (`nombre + " " + apellido`) y
  guarda el resultado en la columna `username` ya existente.
- Validación en el Server Action: todos los campos (lugar, área, puesto, nombre,
  apellido, teléfono, correo) son obligatorios; si alguno está vacío, se devuelve
  error al formulario.
- Correo: el nuevo label dice "Escribe el correo que te fue entregado por el área
  de informática. Si no coincide, comunícate con el área de informática para su
  revisión." La validación contra `session.user.email` se mantiene igual que en
  SPEC 04.
- Toggle de contraseña:
  - **ON (activado):** el usuario mantiene su contraseña actual — no se hace
    ninguna llamada de cambio.
  - **OFF (desactivado):** aparece un `<input type="password">` donde el usuario
    escribe su nueva contraseña; al enviar el formulario se llama a
    `supabase.auth.updateUser({ password })` antes de marcar `primer_ingreso = false`.
- El campo de nueva contraseña tiene un ícono de ojo para mostrar/ocultar el texto.
- Al completar el formulario correctamente, se guarda todo en `profiles` y se
  redirige al panel del rol como hasta ahora.

**Fuera de alcance:**

- Convertir Lugar, Área y Puesto en `<select>` — queda para un spec posterior
  cuando se definan los catálogos.
- Edición de estos campos desde el perfil una vez completado el primer ingreso —
  spec de edición de perfil.
- Mostrar nombre completo en el header en lugar de `username` — el header seguirá
  mostrando el valor de `username` (que tras este spec contendrá "Nombre Apellido").
- Validación de formato o longitud de los campos de texto libre.
- Confirmación de la nueva contraseña con segundo campo "repite tu contraseña".

## Modelo de datos

### Migración: nuevas columnas en `profiles`

```sql
alter table profiles
  add column lugar  text,
  add column area   text,
  add column puesto text;
```

Las tres columnas son `nullable` en la BD (los usuarios existentes no tienen
esos datos). El formulario los hace obligatorios a nivel de aplicación.

### Columnas utilizadas en este spec

| Columna          | Tipo      | Origen  | Uso                                                              |
| ---------------- | --------- | ------- | ---------------------------------------------------------------- |
| `lugar`          | `text`    | Nueva   | Lugar de trabajo (texto libre por ahora).                        |
| `area`           | `text`    | Nueva   | Área de trabajo (texto libre por ahora).                         |
| `puesto`         | `text`    | Nueva   | Puesto/cargo del usuario (texto libre por ahora).                |
| `username`       | `text`    | SPEC 02 | Se sobreescribe con `nombre + " " + apellido` al completar el formulario. Sigue usándose en el header (SPEC 07e). |
| `telefono`       | `text`    | SPEC 04 | Se sigue guardando igual que antes.                              |
| `email`          | `text`    | SPEC 04 | Se valida contra `session.user.email`.                           |
| `primer_ingreso` | `boolean` | SPEC 02 | Pasa a `false` al completar el formulario correctamente.         |

### Cambio de contraseña

Si el toggle está OFF y el usuario escribe una nueva contraseña, se llama a
`supabase.auth.updateUser({ password })` antes del `update profiles …`.
La contraseña vive en `auth.users`, gestionada por Supabase Auth; no se
introduce ninguna columna nueva para esto.

## Plan de implementación

1. **Migración de BD.**
   Ejecutar `alter table profiles add column lugar text, add column area text,
   add column puesto text;` en Supabase (Dashboard → SQL Editor o nueva
   migración en `supabase/migrations/`).
   Verificar: las tres columnas aparecen en la tabla `profiles` sin errores.

2. **Reescribir `app/primer-ingreso/page.tsx`.**
   Componente cliente con el formulario de una sola página dividido en tres
   secciones con encabezado visual cada una:
   - **Datos del lugar:** inputs texto para Lugar, Área y Puesto.
   - **Datos del usuario:** inputs texto para Nombre y Apellido.
   - **Datos de la cuenta:** input tel para Teléfono; label con el nuevo texto
     para el correo; toggle para contraseña (ON por defecto) con el input de
     nueva contraseña y su ícono de ojo condicional.
   El toggle gestiona un estado local (`useState`); cuando está OFF renderiza
   el `<input type="password">` con botón de mostrar/ocultar.
   Verificar: la página carga sin errores; el toggle muestra/oculta el input
   de contraseña; el ojo muestra/oculta el texto de la contraseña.

3. **Reescribir `app/primer-ingreso/actions.ts`.**
   Server Action que:
   - Valida que lugar, área, puesto, nombre, apellido, teléfono y correo no
     estén vacíos; devuelve error si alguno falta.
   - Compara el correo con `session.user.email` (`.trim().toLowerCase()`);
     devuelve error si no coincide.
   - Concatena nombre y apellido: `` const username = `${nombre.trim()} ${apellido.trim()}` ``.
   - Si el toggle está OFF y se recibió nueva contraseña, llama a
     `supabase.auth.updateUser({ password })` y maneja el error si falla.
   - Hace `update profiles set lugar, area, puesto, username, telefono, email,
     primer_ingreso = false where id = auth.uid()`.
   - Redirige al panel del rol.
   Verificar: formulario completo y correcto → `profiles.username` contiene
   "Nombre Apellido", los tres campos nuevos guardados, `primer_ingreso = false`;
   correo incorrecto → error visible; campo vacío → error visible; cambio de
   contraseña → login con la nueva contraseña funciona.

4. **Verificación final.**
   `npm run build` y `npm run lint` sin errores. Confirmar que el header de
   cada panel muestra el nombre completo ("Nombre Apellido") en el menú de
   usuario tras completar el primer ingreso.

## Criterios de aceptación

- [x] La página `/primer-ingreso` muestra tres secciones visuales claramente
      diferenciadas: "Datos del lugar", "Datos del usuario" y "Datos de la cuenta".
- [x] La sección "Datos del lugar" contiene los campos Lugar, Área y Puesto
      (texto libre, obligatorios).
- [x] La sección "Datos del usuario" contiene los campos Nombre y Apellido
      (texto libre, obligatorios).
- [x] La sección "Datos de la cuenta" contiene Teléfono, Confirmación de correo
      y el toggle de contraseña.
- [x] El label del campo de correo dice: "Escribe el correo que te fue entregado
      por el área de informática. Si no coincide, comunícate con el área de
      informática para su revisión."
- [x] El toggle de contraseña está activado (ON) por defecto; en ese estado no
      aparece ningún input de nueva contraseña.
- [x] Al desactivar el toggle (OFF) aparece un input de nueva contraseña con un
      ícono de ojo que alterna entre mostrar y ocultar el texto.
- [x] El formulario no se puede enviar si alguno de los siete campos obligatorios
      (lugar, área, puesto, nombre, apellido, teléfono, correo) está vacío; se
      muestra un mensaje de error.
- [x] El formulario no se puede enviar si el correo escrito no coincide con el
      email de la sesión activa; se muestra el error correspondiente.
- [x] Al enviar el formulario, `profiles.username` queda con el valor
      `"Nombre Apellido"` (nombre y apellido concatenados con un espacio).
- [x] Al enviar con toggle ON: `profiles` se actualiza con todos los campos y
      `primer_ingreso` pasa a `false`; la contraseña no cambia.
- [x] Al enviar con toggle OFF y nueva contraseña: además de lo anterior, el
      usuario puede hacer login con la nueva contraseña.
- [x] Tras completar el formulario, el usuario llega al panel de su rol.
- [x] El header del panel muestra el nombre completo ("Nombre Apellido") en el
      menú de usuario (vía `username`).
- [x] Las tres columnas nuevas (`lugar`, `area`, `puesto`) existen en la tabla
      `profiles` de Supabase.
- [x  ] `npm run build` y `npm run lint` pasan sin errores.

## Decisiones

- **Sí:** página única con tres secciones visuales, no wizard paso a paso.
  El usuario confirmó que prefiere ver todo de una vez, organizado en bloques
  con encabezado, para que se sienta profesional sin fricción de navegación
  entre pasos.

- **Sí:** Nombre y Apellido se concatenan y se guardan en `username` (ya
  existente), sin crear columnas nuevas. `username` ya se usa en el header
  (SPEC 07e); tras este spec contendrá el nombre completo del usuario en vez
  del valor inicial asignado por el admin.

- **Sí:** columnas `nullable` en la BD (`lugar`, `area`, `puesto`). Los
  usuarios existentes con `primer_ingreso = false` no tienen esos datos;
  hacerlas `not null` rompería registros ya creados. La obligatoriedad se
  impone a nivel de aplicación en el Server Action.

- **Sí:** columna `puesto` (no `cargo`) para el campo "Rol" del formulario.
  `profiles.rol` ya existe como enum del sistema (`jefe`/`tecnico`/`trabajador`);
  usar el mismo nombre crearía ambigüedad. Decisión del usuario: `puesto`.

- **Sí:** toggle ON por defecto (mantener contraseña). Es el caso más frecuente
  en un primer ingreso donde el admin ya asignó una contraseña conocida; forzar
  el cambio siempre añadiría fricción innecesaria.

- **No:** campo "repite tu contraseña". El input tiene ícono de ojo para
  verificar visualmente; un segundo campo añade fricción sin beneficio claro
  en este contexto interno.

- **No:** convertir Lugar, Área y Puesto en `<select>` en este spec. Los
  catálogos aún no están definidos; se implementará en un spec posterior.

- **No:** columnas separadas `nombre` y `apellido` en la BD. La concatenación
  en `username` es suficiente para el MVP; columnas independientes se añadirán
  si un spec futuro necesita operar sobre cada parte por separado.

## Riesgos

| Riesgo                                                                                                                                                          | Mitigación                                                                                                                                                               |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `profiles.username` es `not null unique`; si dos usuarios tienen el mismo nombre completo, el `update` fallará por la restricción de unicidad.                  | El Server Action captura el error de Supabase y muestra un mensaje claro al usuario indicando que contacte al área de informática para resolver el conflicto de nombre.  |
| El toggle en OFF sin escribir contraseña enviaría un string vacío a `supabase.auth.updateUser({ password })`, lo que puede fallar o aceptar contraseña vacía.  | El Server Action valida que, si el toggle está OFF, el campo de contraseña no esté vacío antes de llamar a Supabase; si está vacío, devuelve error al formulario.        |
| Usuarios existentes con `primer_ingreso = false` conservan `username` con el valor inicial del admin y los campos `lugar`, `area`, `puesto` en `null`.          | Este spec no los afecta; un spec de edición de perfil posterior permitirá actualizar esos datos si se necesita.                                                          |

## Lo que **no** está en este spec

- Convertir Lugar, Área y Puesto en `<select>` — spec posterior cuando se definan los catálogos.
- Edición de estos campos desde el perfil — spec de edición de perfil.
- Mostrar nombre completo en el header en lugar de `username` como campo separado.
- Confirmación de contraseña con segundo input.
- Columnas `nombre` y `apellido` independientes en la BD.

Cada uno de esos puntos, si se incorpora, va en su propio spec.
