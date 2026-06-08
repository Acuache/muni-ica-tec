# SPEC 07d — Perfil propio y cierre de sesión

> **Estado:** Aprobado · **Depende de:** SPEC 03, SPEC 05, SPEC 06, SPEC 07 · **Fecha:** 2026-06-08
> **Objetivo:** Que trabajadores, técnicos y el jefe puedan ver, desde la
> pestaña "Perfil" de su panel, una pantalla de solo lectura con sus datos
> básicos (username, DNI, teléfono, correo y rol), y cerrar sesión desde un
> ícono en el header con confirmación previa.

## Scope

**In:**

- Pantalla de perfil de solo lectura por rol — `/trabajador/perfil`,
  `/tecnico/perfil`, `/jefe/perfil` — que muestra `username`, `dni`,
  `telefono`, `email` y `rol` (con etiqueta legible: "Trabajador" / "Técnico" /
  "Jefe de informática") del usuario autenticado, leídos de `profiles`.
- Conectar el botón "Perfil" ya existente (pero sin acción) en la barra de
  navegación inferior de los tres paneles a su nueva ruta, resaltándolo como
  pestaña activa — igual que "Inicio" hoy — cuando el usuario está en
  `/perfil`, y "Inicio" vuelve a resaltarse al volver al panel principal.
- Reemplazar el botón de menú (hamburguesa, hoy decorativo y sin función) del
  header de los tres paneles por un ícono de "cerrar sesión" (`IconLogout`).
- Diálogo de confirmación ("¿Seguro que quieres cerrar sesión?" / Cancelar /
  Cerrar sesión) antes de invocar la server action `logout` que ya existe en
  `app/actions/auth.ts` (hace `signOut` + `redirect('/login')`, hoy sin usar).
- Refactor de cada panel (`app/trabajador`, `app/tecnico`, `app/jefe`): extraer
  el header y la barra de navegación inferior — hoy mezclados dentro de cada
  `panel.tsx` — a un `layout.tsx` (servidor) + componente "shell" cliente,
  compartidos entre la página de inicio existente y la nueva de perfil.

**Fuera de alcance (para specs futuros):**

- Editar cualquier dato del perfil (teléfono, correo, contraseña, username,
  DNI) — la pantalla es de solo lectura. SPEC 04 ya dejó anotado que la
  "edición general del perfil" queda para un spec posterior; este es ese
  momento de **mostrarlo**, no de editarlo.
- Cambiar la lógica de "primer ingreso" o el flujo de recuperación de
  contraseña (SPEC 04) — sin cambios; la nueva ruta de perfil replica el mismo
  patrón de redirect que ya usa cada `page.tsx`.
- Información específica de un rol más allá de los campos comunes (p. ej. el
  estado actual del técnico vía `CardEstadoActual`) — el perfil muestra
  exactamente los mismos campos para los tres roles.
- Un menú lateral o cualquier otra función para el botón de hamburguesa — al
  reemplazarlo por el de cerrar sesión, esa funcionalidad decorativa
  simplemente desaparece; no se construye nada nuevo en su lugar.
- Cualquier cambio a la lógica de negocio de los paneles (cola, atención,
  KPIs, polling, formularios) — el refactor solo mueve el header/nav a un
  layout compartido, sin tocar el contenido ni su comportamiento.

## Data model

Este spec **no introduce ni modifica estructuras de datos**. Reutiliza la
tabla `profiles` ya existente (creada en SPEC 02), específicamente las
columnas `username`, `dni`, `telefono`, `email` y `rol` (`user_role`: `'jefe'
| 'tecnico' | 'trabajador'`).

La única "novedad" es de presentación: una etiqueta legible para `rol`,
mapeada en el componente de presentación (no en la base de datos):

```ts
const ROL_LABELS: Record<"jefe" | "tecnico" | "trabajador", string> = {
  trabajador: "Trabajador",
  tecnico: "Técnico",
  jefe: "Jefe de informática",
};
```

## Implementation plan

1. **Crear `components/cerrar-sesion-dialog.tsx`** (cliente) y usarlo en el
   header de `app/trabajador/panel.tsx`, reemplazando el botón `IconMenu2`
   ("Menú", decorativo). El componente es un botón con `IconLogout` que abre
   un `AlertDialog` (de `radix-ui`, ya instalado) con el texto "¿Seguro que
   quieres cerrar sesión?" y los botones "Cancelar" / "Cerrar sesión"; este
   último es un `<form action={logout}>` que invoca la server action ya
   existente en `app/actions/auth.ts`.
   Verificar: como trabajador, pulsar el ícono abre el diálogo; "Cancelar" lo
   cierra sin efecto; "Cerrar sesión" termina la sesión y redirige a `/login`.

2. **Reusar `cerrar-sesion-dialog.tsx`** reemplazando el botón de menú en los
   headers de `app/tecnico/panel.tsx` y `app/jefe/panel.tsx`.
   Verificar: el mismo flujo de confirmación y cierre de sesión funciona para
   técnico y jefe.

3. **Refactor de trabajador a `layout.tsx` + `shell.tsx`.** Crear
   `app/trabajador/layout.tsx` (servidor: obtiene `user` —redirige a
   `/login` si no existe— y `profiles.username`, renderiza
   `<TrabajadorShell username={...}>{children}</TrabajadorShell>`) y
   `app/trabajador/shell.tsx` (cliente: contiene el `<header>` —título, avatar
   con inicial, botón de cerrar sesión— el `<main>{children}</main>` y la
   `<nav>` inferior con "Inicio"/"Perfil" como `Link`, resaltando la pestaña
   activa según `usePathname()`). Sacar ese mismo header/nav de
   `app/trabajador/panel.tsx` (que pasa a devolver solo su contenido) y quitar
   el ahora redundante `if (!user) redirect('/login')` de
   `app/trabajador/page.tsx` (la redirección ya la hace el layout).
   Verificar: `/trabajador` se ve y funciona exactamente igual que antes
   (header, nav, contenido, polling, cerrar sesión); "Perfil" sigue sin
   acción todavía.

4. **Crear `components/datos-perfil.tsx`** (presenta `username`, `dni`,
   `telefono`, `email` y `rol` con su etiqueta legible, de solo lectura) y
   `app/trabajador/perfil/page.tsx` (servidor: replica el patrón de
   `page.tsx` — auth + redirect a `/primer-ingreso` si aplica— consulta esos
   campos de `profiles` y renderiza `<DatosPerfil .../>`). Conectar el botón
   "Perfil" del shell a `/trabajador/perfil`.
   Verificar: navegar a `/trabajador/perfil` muestra los datos correctos del
   trabajador autenticado, con "Perfil" resaltado en azul e "Inicio" en gris;
   volver a `/trabajador` restaura el resaltado de "Inicio".

5. **Repetir el patrón del paso 3+4 para técnico**: `app/tecnico/layout.tsx`
   - `app/tecnico/shell.tsx` (mismo header con avatar/inicial que trabajador),
     simplificar `app/tecnico/panel.tsx` y `page.tsx`, y crear
     `app/tecnico/perfil/page.tsx` reusando `DatosPerfil`.
     Verificar: igual que el paso 4, pero para un usuario técnico.

6. **Repetir el patrón para el jefe**: `app/jefe/layout.tsx` +
   `app/jefe/shell.tsx` (header sin avatar, con buscador/campana como hoy —
   solo cambia el botón de menú por el de cerrar sesión), simplificar
   `app/jefe/panel.tsx` y `page.tsx`, y crear `app/jefe/perfil/page.tsx`
   reusando `DatosPerfil`.
   Verificar: igual que el paso 4, pero para el jefe.

7. **Verificación final.** `npm run build` y `npm run lint` — confirmar que
   no quedan props, tipos ni imports sin usar tras mover el header/nav fuera
   de cada `panel.tsx` (p. ej. `username` si ya no se usa ahí, `IconMenu2`,
   `IconHome`, `IconUser` que se trasladan al shell).

## Acceptance criteria

- [ ] Cada uno de los tres roles (trabajador, técnico, jefe) puede pulsar la
      pestaña "Perfil" de su barra inferior y llegar a `/[rol]/perfil`, donde
      ve, de solo lectura, su `username`, `dni`, `telefono`, `email` y `rol`
      (con etiqueta legible: "Trabajador" / "Técnico" / "Jefe de informática").
- [ ] Los datos mostrados corresponden al usuario autenticado (no a otro), y
      coinciden con lo guardado en `profiles`.
- [ ] Estando en `/perfil`, la pestaña "Perfil" se ve resaltada en azul como
      activa e "Inicio" en gris; al volver al panel principal, "Inicio" vuelve
      a resaltarse y "Perfil" queda en gris.
- [ ] El botón de menú (hamburguesa) ya no aparece en el header de ningún
      panel; en su lugar hay un ícono de cerrar sesión (`IconLogout`).
- [ ] Pulsar el ícono de cerrar sesión abre un diálogo "¿Seguro que quieres
      cerrar sesión?" con botones "Cancelar" y "Cerrar sesión".
- [ ] "Cancelar" cierra el diálogo sin cerrar la sesión ni navegar.
- [ ] "Cerrar sesión" termina la sesión (vía la server action `logout` de
      `app/actions/auth.ts`) y redirige a `/login`; intentar volver a un panel
      protegido redirige de nuevo a `/login`.
- [ ] Este comportamiento de cerrar sesión funciona igual para los tres roles.
- [ ] Un usuario con `primer_ingreso = true` que navega directamente a
      `/[rol]/perfil` es redirigido a `/primer-ingreso`, igual que en la
      página principal de su rol.
- [ ] El contenido y comportamiento de cada panel principal (cola, atención,
      KPIs, polling, formularios, "actualizado hace X") sigue funcionando
      exactamente igual que antes del refactor — sin regresiones visuales ni
      funcionales.
- [ ] `npm run build` y `npm run lint` pasan sin errores, sin props, tipos ni
      imports sin usar.

## Decisions

- **Sí:** pantalla de perfil de **solo lectura**. SPEC 04 ya dejó anotado que
  la edición del perfil más allá de teléfono/correo del primer ingreso queda
  para un spec posterior; este spec resuelve la parte de **mostrar** los
  datos, sin abrir el frente de edición (que implicaría validaciones, RLS de
  escritura y, para contraseña, un flujo nuevo distinto al de recuperación).

- **Sí:** mismos campos para los tres roles (`username`, `dni`, `telefono`,
  `email`, `rol`). Decisión del usuario por simplicidad y consistencia: evita
  ramas condicionales por rol en el componente de presentación y mantiene el
  spec acotado a "ver mis datos", no "ver mi actividad".

- **Sí:** el ícono de cerrar sesión **reemplaza** el botón de menú existente
  (en vez de agregar uno nuevo junto al avatar). El botón de menú es hoy
  decorativo —no abre nada—, así que reutilizar ese espacio evita saturar el
  header con un ícono adicional.

- **Sí:** diálogo de confirmación antes de cerrar sesión, usando `AlertDialog`
  de `radix-ui` (ya instalado, visto en uso vía `Slot` en
  `components/ui/button.tsx`). Decisión del usuario para evitar cierres de
  sesión accidentales por un toque sin querer.

- **Sí:** reusar la server action `logout` ya existente en
  `app/actions/auth.ts` (hace `signOut` + `redirect('/login')`) en lugar de
  escribir una nueva. Ya estaba implementada pero sin conectar a ningún botón.

- **Sí:** extraer el header y la barra de navegación a un `layout.tsx` +
  componente "shell" **por rol** (tres pares, no uno compartido). Aunque
  trabajador y técnico comparten el mismo estilo de header (avatar + título
  "Soporte Municipal"), el del jefe es distinto (sin avatar, con
  buscador/campana, título "Panel de Control"). Forzar un solo shell
  parametrizado para los tres añadiría condicionales que no aportan claridad;
  mantenerlos separados sigue el patrón ya existente del repo (cada rol tiene
  su propio `panel.tsx`/`actions.ts`).

- **Sí:** componente compartido `components/datos-perfil.tsx` para la
  presentación de los datos (sí se reutiliza, a diferencia del shell, porque
  el contenido es **idéntico** en los tres roles — no hay diferencias de
  estilo que justifiquen triplicarlo).

- **No:** mover la verificación de `primer_ingreso` al `layout.tsx`. Se queda
  en cada `page.tsx` (incluida la nueva de perfil), replicando el patrón ya
  existente, para no alterar la arquitectura de un flujo de SPEC 04 ya
  implementado y aprobado. Solo se centraliza en el layout la verificación de
  sesión (`if (!user) redirect('/login')`), porque es la que necesita el
  layout de todas formas para consultar `username`.

- **No:** construir un menú lateral o cualquier función nueva para el botón de
  hamburguesa. Era decorativo; al quitarlo, esa "funcionalidad" (inexistente)
  simplemente desaparece.

## Risks

| Riesgo                                                                                                                                                                                    | Mitigación                                                                                                                                                                                                                                     |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| El refactor de header/nav a `layout.tsx` + `shell.tsx` podría introducir una regresión visual o funcional (polling, estilos, props) en los tres paneles ya implementados y en producción. | Cada paso del plan deja el panel afectado verificable de inmediato ("se ve y funciona igual que antes"); el build/lint final detecta props, tipos o imports huérfanos que delaten algo mal movido.                                             |
| `AlertDialog` de `radix-ui` es un primitivo nuevo en este proyecto (hoy solo se usa `Slot`) — su integración con estilos Tailwind/shadcn podría no calzar a la primera.                   | Seguir el patrón de `components/ui/button.tsx` (mismo paquete `radix-ui`, mismas convenciones de Tailwind v4) al construir `cerrar-sesion-dialog.tsx`; verificar visualmente en el primer rol (paso 1) antes de reutilizarlo en los otros dos. |

## What is **not** in this spec

- Editar cualquier dato del perfil (teléfono, correo, contraseña, username,
  DNI) — la pantalla es de solo lectura; la edición va en un spec aparte.
- Cambios a la lógica de "primer ingreso" o al flujo de recuperación de
  contraseña (SPEC 04).
- Información específica de un rol en la pantalla de perfil (p. ej. el estado
  actual del técnico) — los tres roles ven exactamente los mismos campos.
- Un menú lateral o cualquier función nueva para el botón de hamburguesa que
  se reemplaza.
- Cambios a la lógica de negocio de los paneles (cola, atención, KPIs,
  polling, formularios) más allá de mover el header/nav a un layout
  compartido.

Cada uno de esos puntos, si se incorpora, va en su propio spec.
