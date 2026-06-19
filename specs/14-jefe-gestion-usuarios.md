# SPEC 14 — Gestión de usuarios (panel del jefe)

> **Estado:** Aprobado · **Depende de:** SPEC 02 (esquema `profiles` + trigger `handle_new_user`), SPEC 03 (login y enrutado por rol), SPEC 04 (primer ingreso), SPEC 07 (shell/navbar del jefe), SPEC 08 (patrón de tabla con filtro y paginación), SPEC 13 (catálogo Sede→Área→Subárea + selects en cascada) · **Fecha:** 2026-06-18
>
> **Objetivo:** Dar al jefe una sección **"Usuario"** en su navbar para **crear** cuentas (individual con rol y datos de primer ingreso opcionales, o masivo solo-trabajadores pegando correos), **buscarlas** por nombre/apellido o por sede (agrupadas por área), **editar** sus datos y rol, **restablecer** su contraseña y **desactivar/reactivar** cuentas — todo con la llave admin del servidor, refrescando los datos tras cada acción y manteniendo siempre al menos **1 jefe activo**.

## Alcance

**Dentro:**

- **Navbar del jefe** (`app/jefe/shell.tsx`): nuevo ítem **"Usuario"** como menú desplegable (mismo patrón que el menú Perfil/Salir) con dos entradas: **Crear** y **Buscar**.

- **Crear — Individual** (`/jefe/usuarios/crear`, pestaña *Individual*):
  - Campos obligatorios: **Correo** y **Rol** (`jefe` / `técnico` / `trabajador`).
  - Texto **"Ver contraseñas"** que revela/oculta las 3 contraseñas por defecto (`trabajador-muni`, `tecnico-muni`, `jefe-muni`). El jefe **nunca escribe** la contraseña: se asigna la del rol.
  - **Sección opcional "Primer ingreso"**: nombre, apellido, teléfono, Sede→Área→Subárea (selects en cascada de SPEC 13) y Puesto.
    - Si se completan **todos** esos campos → la cuenta se crea con `primer_ingreso = false` y `username = "Nombre Apellido"`.
    - Si se completan **solo algunos** (o ninguno) → `primer_ingreso = true`; se guardan los que haya y `username = correo` (temporal, lo reemplaza el usuario en su primer ingreso).
  - Al terminar, **confirmación de éxito** del backend (mensaje con el correo creado y la contraseña por defecto asignada).

- **Crear — Masivo** (`/jefe/usuarios/crear`, pestaña *Masivo*):
  - Un cuadro de texto donde se pegan **muchos correos**, separados por saltos de línea, comas, espacios o punto y coma.
  - Se quitan **duplicados**; cada correo se crea **uno por uno** como **trabajador**, contraseña `trabajador-muni`, `primer_ingreso = true`, `username = correo`.
  - Los correos **inválidos** y los que **ya existen** se omiten.
  - **Reporte final**: N agregados, lista de omitidos (ya existían) y lista de inválidos.
  - **No** hay edición de primer ingreso ni elección de rol aquí (siempre trabajador).

- **Buscar** (`/jefe/usuarios/buscar`): tabla de cuentas (mismo patrón que la tabla de solicitudes) con **todos los roles**. Columnas: Nombre, Correo, Teléfono, Rol, Sede/Área/Subárea/Puesto, Estado (Activo / Pendiente primer ingreso / Desactivado) y Acciones.
  - **Dos filtros:**
    1. **Por defecto:** caja de texto que busca por **nombre y apellido** (`ilike` sobre `username`), con paginación de 10 (como solicitudes).
    2. **Por Sede:** selector de Sede → la tabla se **agrupa por Área**, y bajo cada área aparecen sus cuentas.
  - **Toggle/ícono** para **mostrar/ocultar las cuentas desactivadas** (ocultas por defecto).

- **Editar** (modal desde Buscar): **datos de perfil** (nombre, apellido, teléfono, Sede→Área→Subárea, Puesto), **Rol**, y botón **"Restablecer contraseña"** (la vuelve a la del rol). El **correo no se edita**.
  - Cambiar rol a/desde `técnico` ajusta la fila de `technician_status`.

- **Desactivar / Reactivar** (desde Buscar):
  - **Desactivar:** `activo = false` + ban en auth (no puede iniciar sesión). Si el usuario tiene una **solicitud activa** (`en_espera`/`en_proceso`), la modal lo advierte y la **cancela** como parte de la desactivación.
  - **Reactivar:** `activo = true` + quitar el ban.
  - **Invariante:** nunca dejar **0 jefes activos** — desactivar un jefe o cambiarle el rol se bloquea si era el último jefe activo.

- **Login** (`app/login/actions.ts`): rechazar el acceso de cuentas con `activo = false` (defensa adicional al ban).

- **Cambios de esquema** (migración): quitar `UNIQUE` de `profiles.username`, **eliminar** `profiles.dni`, añadir `profiles.activo boolean not null default true`.

- **Consistencia:** cada acción (crear/editar/restablecer/desactivar/reactivar) termina refrescando los datos (`router.refresh()` / revalidación); la pantalla Buscar es dinámica y trae datos frescos en cada entrada.

**Fuera de alcance (specs posteriores):**

- **Editar el correo** de acceso de una cuenta.
- **Capturar/usar DNI** (se elimina la columna).
- **Auto-registro** o invitación por correo (magic link): la contraseña es siempre la del rol.
- **Importar desde archivo** (CSV/Excel) en Masivo: solo pegado de texto.
- **Asignar nombre/teléfono/ubicación por lote** en Masivo: solo correos.
- **Historial/auditoría** de quién creó/editó/desactivó cada cuenta.
- **Reasignar las solicitudes en proceso** de un técnico que se desactiva (queda como está; solo se cancela la solicitud activa del **trabajador** desactivado).
- **Buscar por otros criterios** (correo, teléfono, rol como filtro): solo nombre/apellido y sede.

## Modelo de datos

Este spec **no introduce tablas nuevas**. Solo modifica `profiles` y reutiliza `solicitudes`, `technician_status`, el catálogo `sedes/areas/subareas` (SPEC 13) y `auth.users`.

### Cambios en `profiles`

```sql
-- 1) El nombre ya no es único: dos personas pueden llamarse igual.
alter table profiles drop constraint profiles_username_key;

-- 2) El DNI no se usa: se elimina la columna.
alter table profiles drop column dni;

-- 3) Bandera de cuenta activa (soft-delete). Las cuentas existentes quedan activas.
alter table profiles add column activo boolean not null default true;
```

- `username` sigue siendo `text not null` (la columna existe siempre); solo deja de ser `unique`.
- `activo` arranca en `true` para todos. Desactivar pone `false`; reactivar vuelve a `true`.
- **RLS sin cambios:** `profiles` ya permite `SELECT` a cualquier autenticado (lo usa Buscar y el login). Las escrituras de terceros (crear/editar/desactivar) **no** pasan por RLS: corren con el **cliente admin** tras `autorizar(['jefe'])`. No se añaden políticas `insert`/`delete` de jefe.

### Contraseñas por defecto (constante en el servidor)

```ts
const PASSWORD_POR_ROL: Record<RolApp, string> = {
  jefe:       'jefe-muni',
  tecnico:    'tecnico-muni',
  trabajador: 'trabajador-muni',
}
```

Todas cumplen `MIN_PASSWORD = 8`. Se asignan al **crear** y al **restablecer**. El texto "ver contraseñas" del formulario individual solo muestra estos tres valores como recordatorio.

### Estado derivado (columna "Estado" de Buscar — no se persiste)

| Condición | Etiqueta |
|-----------|----------|
| `activo = false` | **Desactivado** |
| `activo = true` y `primer_ingreso = true` | **Pendiente primer ingreso** |
| `activo = true` y `primer_ingreso = false` | **Activo** |

### Bloqueo de acceso (ban en auth)

- **Desactivar:** `auth.admin.updateUserById(id, { ban_duration: '876000h' })` (≈100 años) además de `activo = false`.
- **Reactivar:** `auth.admin.updateUserById(id, { ban_duration: 'none' })` además de `activo = true`.
- El login (`app/login/actions.ts`) verifica `profiles.activo`; si es `false`, cierra la sesión y muestra un error. (Defensa en capas: el ban ya rechaza en auth.)

### Flujo de datos — Crear Individual

1. `auth.admin.createUser({ email, password: PASSWORD_POR_ROL[rol], email_confirm: true, user_metadata: { rol, username } })`
   - `username = "Nombre Apellido"` si vienen ambos; si no, `username = email`.
2. El trigger `handle_new_user` crea la fila en `profiles` (`primer_ingreso = true`, `activo = true`) y, si `rol = 'tecnico'`, la fila en `technician_status`.
3. Si la sección de primer ingreso vino **completa**: `update profiles set telefono, sede, area, subarea, puesto, username, primer_ingreso = false where id = <nuevo>` (cliente admin). Si vino **parcial**: se guardan los campos presentes y `primer_ingreso` se queda en `true`.
4. La sede/área/subárea se validan contra el catálogo (igual que en SPEC 13) y se guardan por **nombre**.

### Flujo de datos — Crear Masivo

Por cada correo único y válido del pegado:
- `auth.admin.createUser({ email, password: 'trabajador-muni', email_confirm: true, user_metadata: { rol: 'trabajador', username: email } })`.
- Si auth devuelve "ya existe" → se acumula en *omitidos*; si el formato es inválido → *inválidos*; si crea bien → *agregados*.

### Flujo de datos — Editar / Rol / Restablecer / Desactivar / Reactivar

- **Editar:** `update profiles set username = "Nombre Apellido", telefono, sede, area, subarea, puesto where id` (cliente admin). Sede/área/subárea validadas contra catálogo.
- **Rol:** `update profiles set rol`. Si pasa **a** `tecnico` y no tiene fila en `technician_status`, se inserta; si sale de `tecnico`, la fila se deja (inofensiva, las consultas filtran por `rol`). Si el destino **saca** a un jefe del rol y era el **último jefe activo** → se bloquea.
- **Restablecer:** `auth.admin.updateUserById(id, { password: PASSWORD_POR_ROL[rol] })`.
- **Desactivar:** valida invariante de jefe; si es trabajador con solicitud activa (`en_espera`/`en_proceso`), la cancela; luego `activo = false` + ban.
- **Reactivar:** `activo = true` + quitar ban.

### Invariante "≥1 jefe activo"

Antes de **desactivar** un jefe o **cambiarle el rol** a otro distinto de `jefe`, se cuenta `profiles where rol = 'jefe' and activo = true`. Si el resultado **excluyendo al usuario objetivo** es `0`, la acción se rechaza con un mensaje. (Se cuenta en el servidor con el cliente admin, no se confía en el cliente.)

## Plan de implementación

> Cada paso queda commiteable y deja la app funcionando. Antes de escribir Server Actions, Route Handlers o el paso Server→Client, consultar `node_modules/next/dist/docs/` y `.agents/skills/next-best-practices` (mandato de `AGENTS.md`: este Next no es el conocido).

1. **Migración SQL.**
   `supabase/migrations/20260618000004_spec14_gestion_usuarios.sql`:
   `alter table profiles drop constraint profiles_username_key;` →
   `alter table profiles drop column dni;` →
   `alter table profiles add column activo boolean not null default true;`.
   En código: confirmar con un `grep` que nada lee `dni` (si algo lo referencia, quitarlo).
   *Verificar:* la migración aplica; `username` ya no es único (se pueden insertar dos iguales); `dni` no existe; todas las filas existentes tienen `activo = true`. `npm run build` y `npm run lint` pasan.

2. **Login rechaza cuentas desactivadas.**
   `app/login/actions.ts`: tras autenticar, leer `profiles.activo`; si es `false`, `signOut()` y devolver el error "Tu cuenta está desactivada. Comunícate con el área de informática.".
   *Verificar:* poniendo `activo=false` a un usuario de prueba (por SQL), ese usuario no puede iniciar sesión; con `activo=true` entra normal.

3. **Navbar "Usuario" + rutas esqueleto.**
   `app/jefe/shell.tsx`: añadir el ítem **"Usuario"** como menú desplegable (mismo patrón Radix que `MenuUsuario`) con enlaces a `/jefe/usuarios/crear` y `/jefe/usuarios/buscar`.
   Crear `app/jefe/usuarios/crear/page.tsx` y `app/jefe/usuarios/buscar/page.tsx` como Server Components mínimos que verifican sesión + `rol = 'jefe'` (mismo guard que `app/jefe/solicitudes/page.tsx`) y muestran un placeholder. Añadir sus `loading.tsx`.
   *Verificar:* el jefe ve "Usuario" en el navbar; ambas rutas cargan y están protegidas (otro rol es redirigido).

4. **Server Actions de gestión (base) + extraer selects de ubicación.**
   `app/jefe/usuarios/actions.ts` (`'use server'`): esqueleto con `autorizar(['jefe'])` + cliente admin (`createAdminClient`) y la constante `PASSWORD_POR_ROL`. Implementar **`crearUsuarioIndividual`** (createUser → trigger → update opcional; validación de catálogo y puesto reusando la lógica de SPEC 13; `primer_ingreso=false` solo si vienen todos los campos).
   Extraer los selects en cascada Sede→Área→Subárea de `app/primer-ingreso/formulario.tsx` a un componente reutilizable `components/selects-ubicacion.tsx`.
   *Verificar:* llamando la acción (form temporal o el de la pestaña Individual del paso 5) se crea el usuario en auth + `profiles`; con datos completos queda `primer_ingreso=false` y `username="Nombre Apellido"`; con parciales queda `true` y `username=correo`.

5. **Crear — pestañas Individual y Masivo.**
   `app/jefe/usuarios/crear/page.tsx` → Server Component que carga el catálogo (`sedes/areas/subareas`) y lo pasa a un cliente `app/jefe/usuarios/crear/formulario.tsx` con dos pestañas:
   - *Individual:* Correo + Rol + "ver contraseñas" (revela/oculta los 3 valores) + sección opcional de primer ingreso (con `<SelectsUbicacion>` + Puesto). Al éxito, mensaje de confirmación con el correo y la contraseña por defecto asignada.
   - *Masivo:* textarea de correos + `crearUsuariosMasivo` (parsear por saltos/comas/espacios/`;`, dedup, crear uno por uno como trabajador). Mostrar el **reporte**: agregados, omitidos (ya existían), inválidos.
   Tras crear, `router.refresh()` para limpiar el formulario / reflejar estado fresco.
   *Verificar:* creo un trabajador individual completo y veo la confirmación; pego 5 correos (uno repetido, uno inválido, uno ya existente) y el reporte cuadra; los nuevos usuarios pueden iniciar sesión con la contraseña de su rol.

6. **Buscar — tabla + filtro por nombre/apellido + paginación + toggle desactivados.**
   `app/jefe/usuarios/buscar/page.tsx`: leer `searchParams` (`q`, `page`, `incluirDesactivados`); consultar `profiles` (cliente de servidor, `SELECT` permitido) con `ilike` sobre `username`, `order`, `range` de 10; por defecto `activo=true`. Pasar a un cliente `app/jefe/usuarios/tabla-usuarios.tsx` con las columnas y el Estado derivado; caja de búsqueda, paginación (patrón de `tabla-solicitudes.tsx`) y el toggle "Mostrar desactivados".
   *Verificar:* buscar "juan" filtra por nombre; la paginación funciona; las desactivadas no aparecen hasta activar el toggle; entrar a la pantalla siempre trae datos frescos.

7. **Buscar — filtro por Sede agrupado por Área.**
   En la misma página/tabla: un selector de **Sede** (del catálogo); al elegirla, la página consulta las cuentas de esa sede y la tabla las **agrupa por Área** (subsecciones), respetando el toggle de desactivados. La caja de nombre y el modo Sede son los dos filtros descritos.
   *Verificar:* elijo una Sede y veo sus cuentas agrupadas por Área; cambiar de Sede actualiza el agrupado.

8. **Editar (modal) + Rol + Restablecer contraseña.**
   En `tabla-usuarios.tsx`: acción "Editar" abre un modal con datos de perfil (`<SelectsUbicacion>` + nombre/apellido/teléfono/puesto), selector de **Rol** y botón **"Restablecer contraseña"**. Server Actions `editarUsuario`, `cambiarRol` (o integrado), `restablecerPassword` en `actions.ts`, con la **invariante ≥1 jefe activo** y el ajuste de `technician_status` al pasar a técnico. Al guardar, `router.refresh()`.
   *Verificar:* edito nombre/ubicación y se refleja tras guardar; cambio un trabajador a técnico y aparece su fila en `technician_status`; intentar quitar el rol al último jefe activo se bloquea; restablecer deja la contraseña en la del rol.

9. **Desactivar / Reactivar + cancelar solicitud activa.**
   En `tabla-usuarios.tsx`: acción "Desactivar" abre modal de confirmación (si el usuario tiene solicitud activa, lo advierte y avisa que se cancelará); "Reactivar" para las desactivadas. Server Actions `desactivarUsuario` (invariante de jefe + cancelar solicitud activa del trabajador + `activo=false` + ban) y `reactivarUsuario` (`activo=true` + quitar ban). Al terminar, `router.refresh()`.
   *Verificar:* desactivo a un trabajador con solicitud en espera → la solicitud queda cancelada y el usuario no puede entrar; lo reactivo y vuelve a entrar; no puedo desactivar al último jefe activo.

## Criterios de aceptación

**Esquema y migración**

- [ ] La migración aplica sin errores; `profiles.username` deja de ser único (se pueden insertar dos perfiles con el mismo `username`).
- [ ] La columna `profiles.dni` ya no existe y ninguna parte del código la referencia.
- [ ] `profiles.activo` existe (`not null default true`) y todas las filas previas quedaron en `true`.

**Navbar y acceso**

- [ ] El jefe ve un menú desplegable **"Usuario"** en el navbar con las entradas **Crear** y **Buscar**.
- [ ] `/jefe/usuarios/crear` y `/jefe/usuarios/buscar` están protegidas: sin sesión redirige a `/login`; con un rol distinto de `jefe` redirige a su panel.
- [ ] Un usuario con `activo = false` **no** puede iniciar sesión (ni por ban de auth ni por el chequeo del login); ve el mensaje de cuenta desactivada.

**Crear — Individual**

- [ ] Crear con **Correo + Rol** y la sección de primer ingreso **vacía** crea la cuenta con `primer_ingreso = true` y `username = correo`.
- [ ] Crear con **todos** los campos de primer ingreso llenos crea la cuenta con `primer_ingreso = false` y `username = "Nombre Apellido"`.
- [ ] Crear con la sección de primer ingreso **parcialmente** llena guarda los campos presentes y deja `primer_ingreso = true`.
- [ ] La contraseña asignada es la del rol (`trabajador-muni` / `tecnico-muni` / `jefe-muni`); el usuario nuevo inicia sesión con ella.
- [ ] El texto **"Ver contraseñas"** revela los 3 valores por defecto y puede volver a ocultarlos.
- [ ] Crear un técnico genera su fila en `technician_status`.
- [ ] Tras crear, aparece una **confirmación de éxito** del backend con el correo creado y la contraseña asignada.
- [ ] Crear con un correo que ya existe muestra un error claro y no crea duplicado.
- [ ] Una combinación de Sede/Área/Subárea inválida (manipulada) o un Puesto fuera de los 3 válidos es rechazada por el servidor.

**Crear — Masivo**

- [ ] Pegar correos separados por saltos de línea, comas, espacios o `;` los crea **uno por uno** como **trabajador** con contraseña `trabajador-muni`, `primer_ingreso = true` y `username = correo`.
- [ ] Los **duplicados** dentro del pegado se crean una sola vez.
- [ ] Los correos **inválidos** y los que **ya existen** se omiten (no abortan el resto).
- [ ] Al terminar se muestra un **reporte**: cantidad de agregados, lista de omitidos (ya existían) y lista de inválidos.
- [ ] En Masivo no hay selección de rol ni edición de primer ingreso.

**Buscar — tabla y filtros**

- [ ] La tabla lista cuentas de **todos los roles** con columnas Nombre, Correo, Teléfono, Rol, Sede/Área/Subárea/Puesto, Estado y Acciones.
- [ ] El **Estado** se muestra como Activo / Pendiente primer ingreso / Desactivado según `activo` y `primer_ingreso`.
- [ ] El filtro por defecto busca por **nombre y apellido** (`ilike` sobre `username`) y la lista se **pagina de 10 en 10**.
- [ ] El filtro **por Sede** muestra las cuentas de la sede elegida **agrupadas por Área**.
- [ ] Las cuentas **desactivadas** están **ocultas por defecto** y aparecen solo al activar el toggle "Mostrar desactivados".
- [ ] Entrar a Buscar trae siempre datos frescos (sin caché obsoleto).

**Editar / Rol / Restablecer**

- [ ] Editar nombre/apellido, teléfono, Sede→Área→Subárea y Puesto guarda los cambios y la tabla los refleja tras **Guardar**.
- [ ] El **correo no es editable** en el modal de edición.
- [ ] Cambiar el rol a **técnico** crea su fila en `technician_status` si no existía.
- [ ] **Restablecer contraseña** deja la contraseña en la del rol del usuario y este puede entrar con ella.
- [ ] La edición valida la jerarquía Sede/Área/Subárea contra el catálogo (no se confía en el cliente).

**Desactivar / Reactivar e invariante de jefe**

- [ ] Desactivar una cuenta pone `activo = false`, la banea en auth y la oculta de la lista por defecto.
- [ ] Desactivar a un **trabajador con solicitud activa** (`en_espera`/`en_proceso`) **cancela** esa solicitud, tras avisarlo en la modal.
- [ ] **Reactivar** pone `activo = true`, quita el ban y la cuenta vuelve a poder iniciar sesión.
- [ ] **No** se puede desactivar a un jefe si es el **último jefe activo**; se muestra un mensaje y la acción no procede.
- [ ] **No** se puede cambiar el rol del **último jefe activo** a uno distinto de `jefe`.

**Mecanismo y general**

- [ ] Todas las acciones de crear/editar/restablecer/desactivar/reactivar corren en Server Actions con el **cliente admin** y exigen `autorizar(['jefe'])`; un no-jefe que invoque la acción es rechazado.
- [ ] No se añadieron políticas RLS de `insert`/`delete` sobre `profiles`.
- [ ] `npm run build` y `npm run lint` pasan sin errores.

## Decisiones

- **Sí:** crear/editar/eliminar con el **cliente admin** (`service_role`) en Server Actions, autorizado con `autorizar(['jefe'])`. Crear la cuenta en `auth.users` exige la llave admin de todos modos, y centralizar la autorización en el servidor es el patrón ya usado (descargas firmadas, crons). **No:** políticas RLS de `insert`/`delete` para el rol jefe — duplicarían la regla sin evitar la llave admin.

- **Sí:** **contraseñas por defecto por rol** (`trabajador-muni` / `tecnico-muni` / `jefe-muni`), visibles con "ver contraseñas". Es un entorno interno municipal; simplifica el alta masiva ("pego correos, nada más") y el primer ingreso ya permite cambiarla. **No:** contraseña tipeada por el jefe o autogenerada por usuario — fricción innecesaria para este contexto. **No:** invitación por correo (magic link) — depende de SMTP y rompe el "nada más".

- **Sí:** en Individual, `primer_ingreso = false` **solo si se completan todos** los campos de primer ingreso; si están parciales o vacíos, queda en `true`. Da control total al jefe sin obligarlo a rellenar todo, y el usuario completa lo que falte en su primer login.

- **Sí:** **quitar el `UNIQUE` de `username`**. Dos personas pueden llamarse igual (mismo nombre y apellido); forzar unicidad era incorrecto. **Sí:** usar el **correo como `username` temporal** cuando no hay nombre/apellido — la columna es `not null` y el correo es un identificador legible que el usuario reemplaza en su primer ingreso. Esto vuelve **código muerto** el manejo de error `23505` sobre `username` en `app/primer-ingreso/actions.ts` (se documenta; puede limpiarse).

- **Sí:** **eliminar la columna `profiles.dni`**. Nunca se llenó ni se usa; mantenerla es ruido. Si el DNI se necesita después, va en su propio spec.

- **Sí:** **soft-delete** con bandera `activo` + **ban en auth** + chequeo en el login. Conserva el perfil (y con él el historial de solicitudes y el nombre que muestran), que es lo que pediste preservar, mientras bloquea el acceso de verdad. **No:** borrado físico de la cuenta — borraría el perfil en cascada (FK `profiles → auth.users`) y el historial perdería el nombre del trabajador. **No:** copiar el nombre dentro de cada solicitud para permitir borrado real — más invasivo (columna nueva en `solicitudes` + ajustar todas las lecturas) sin beneficio frente al soft-delete.

- **Sí:** **invariante "≥1 jefe activo"** validada en el servidor antes de desactivar un jefe o sacarlo del rol. Evita dejar el sistema sin administrador. Permite que un jefe desactive a otro o se desactive a sí mismo si queda otro jefe activo. **No:** la regla rígida "el jefe no puede tocar su propia cuenta" — es más estricta de lo necesario y bloquea casos válidos con varios jefes.

- **Sí:** al **desactivar un trabajador con solicitud activa**, cancelar esa solicitud (avisado en la modal). Cierra el flujo en curso de forma limpia. **No:** reasignar/cerrar las solicitudes **en proceso de un técnico** que se desactiva — caso menos frecuente; se deja fuera de alcance para no arrastrar lógica de reasignación.

- **Sí:** **dejar la fila de `technician_status`** cuando un usuario deja de ser técnico (en vez de borrarla). Las consultas filtran por `rol`, así que es inofensiva, y borrarla podría chocar con `solicitudes.tecnico_id` históricos. Al **pasar a** técnico sí se crea la fila si falta.

- **Sí:** Buscar lista **todos los roles** (no solo trabajadores). Crear individual permite los 3 roles; gestionar solo trabajadores sería incoherente (no podrías editar/desactivar un técnico que creaste).

- **Sí:** dos modos de filtro **excluyentes** — caja de texto por nombre/apellido (paginada de 10, como solicitudes) y selector de Sede (agrupado por Área, sin paginar porque una sede está acotada). Coincide con lo que describiste y reutiliza el patrón existente.

- **Sí:** **Masivo flexible con reporte** (separadores varios, dedup, omite inválidos/existentes y los lista). Hace el pegado tolerante y deja claro qué pasó con cada correo. **No:** "todo o nada" — un correo malo no debe frenar a los demás.

- **Sí:** **correo no editable** desde Buscar. Es la credencial de acceso; cambiarla es más delicado y se deja para un spec posterior si se necesita.

- **Sí:** **refrescar tras cada acción** (`router.refresh()`) y Buscar como Server Component dinámico. Cumple tu requisito de consistencia: cada cambio recarga datos frescos.

- **Sí:** **reutilizar los selects en cascada** de SPEC 13 extrayéndolos a `components/selects-ubicacion.tsx`. Evita duplicar la lógica del catálogo entre primer ingreso, crear y editar.

## Riesgos

| Riesgo | Mitigación |
|--------|------------|
| El **cliente admin** (`service_role`) en Server Actions omite RLS; una acción sin re-autorizar dejaría a cualquier rol crear/editar/borrar usuarios. | **Toda** acción empieza con `autorizar(['jefe'])` antes de tocar el cliente admin; se verifica el rol contra `profiles.rol` (no metadata), igual que el resto de la app. Criterio de aceptación explícito para un no-jefe. |
| **Desactivar en vez de borrar** deja la cuenta en `auth.users`; recrear luego un usuario con el **mismo correo** chocaría (email único en auth). | Documentado: una cuenta desactivada conserva su correo; para "revivirla" se usa **Reactivar**, no recrear. Si se requiere reasignar el correo, es un caso de spec posterior. |
| El **ban de auth** y la **bandera `activo`** pueden quedar **desincronizados** si una de las dos escrituras falla (p. ej. `activo=false` pero sin ban, o al revés). | Las acciones aplican ambas en la misma Server Action y, ante error parcial, devuelven error visible para reintentar; el **chequeo de `activo` en el login** garantiza el bloqueo aunque el ban no se haya aplicado (defensa en capas). |
| El **alta masiva** hace un `createUser` por correo; con muchos correos la Server Action puede tardar o exceder el tiempo límite de Next 16, dejando un alta a medias. | Acotar el número de correos por pegado (límite razonable, p. ej. ≤200) y reportar lo procesado; los ya creados no se duplican (el reintento los marca "ya existían"). Documentar el límite en el textarea. |
| La **invariante "≥1 jefe activo"** mal contada (race entre dos jefes actuando a la vez) podría dejar 0 jefes activos. | El conteo se hace en el servidor con el cliente admin **dentro** de la misma acción, justo antes de escribir, excluyendo al usuario objetivo; el caso es de baja concurrencia (pocos jefes) y el costo de un fallo es recuperable por SQL. |
| El **trigger `handle_new_user`** exige `rol` y `username` en `raw_user_meta_data`; si `createUser` se llama sin ellos, la creación aborta. | El `user_metadata` siempre incluye `rol` y `username` (nombre completo o correo). Verificado en el paso 4/5 con un alta real. |
| Eliminar la columna `dni` rompe el build si algún `select`/tipo la referencia. | El paso 1 incluye un `grep` de `dni` y `npm run build`/`lint` antes de cerrar el paso. |
| Quitar el `UNIQUE` de `username` deja **código muerto** (manejo de `23505`) en `app/primer-ingreso/actions.ts` que podría confundir a futuro. | Se documenta como código muerto inofensivo; opcionalmente se limpia en el mismo paso 1. |
| Cambiar el rol de un técnico que **atiende** una solicitud (`tecnico_id` asignado) lo deja como no-técnico con un caso en proceso a su nombre. | Fuera de alcance la reasignación; se documenta. La fila de `technician_status` se conserva y las lecturas filtran por `rol`, así que no rompe; el jefe puede marcar/reasignar la solicitud manualmente. |
| Next 16 tiene convenciones propias (Server Actions, Server→Client, `proxy`); las APIs pueden diferir de lo conocido. | Antes de implementar, leer la guía relevante en `node_modules/next/dist/docs/` y `.agents/skills/next-best-practices` (mandato de `AGENTS.md`). |
| El **catálogo** (sedes/areas/subareas) cargado con cliente anónimo devolvería vacío por RLS y los selects/agrupado saldrían sin datos. | Cargar el catálogo en el Server Component con el cliente de servidor autenticado (sesión del jefe), como en SPEC 13. |

## Lo que **no** está en este spec

- Editar el **correo** de acceso de una cuenta.
- **DNI** (la columna se elimina).
- **Auto-registro** o invitación por correo (magic link).
- **Importar desde archivo** (CSV/Excel) en Masivo.
- Asignar nombre/teléfono/ubicación **por lote** en Masivo.
- **Historial/auditoría** de quién creó/editó/desactivó cada cuenta.
- **Reasignar** las solicitudes en proceso de un técnico desactivado.
- **Buscar** por correo, teléfono o rol como filtro.

Cada uno de esos puntos, si se incorpora, va en su propio spec.
