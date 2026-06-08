# SPEC 07e — Rediseño del header y la navegación de los tres paneles

> **Estado:** Implementado · **Depende de:** SPEC 07d (header/shell actuales) · **Fecha:** 2026-06-08
> **Objetivo:** Reemplazar el header y la barra de navegación inferior de los
> tres paneles por un nuevo header (logo de la municipalidad que lleva a
> inicio, campana de notificaciones placeholder en técnico/jefe, y menú
> desplegable de usuario con "Perfil" / "Salir sesión") que además luzca bien
> en pantallas anchas, junto con las pantallas de Inicio y Perfil.

## Scope

**In:**

- Reemplazar el header actual de los tres shells (`app/trabajador/shell.tsx`,
  `app/tecnico/shell.tsx`, `app/jefe/shell.tsx`) por un nuevo diseño:
  - **Izquierda:** logo (`assets/muni-ica.png`, vía `next/image`, mismo
    patrón que `app/login/page.tsx`) + texto "Soporte Municipal", ambos como
    un único enlace a la pantalla de inicio del rol (`/trabajador`,
    `/tecnico`, `/jefe`).
  - **Derecha, solo técnico y jefe:** ícono de campana de notificaciones
    (`IconBell`), decorativo/sin función — placeholder visual para SPEC 09.
  - **Más a la derecha, los tres roles:** nombre de usuario (`username`) +
    ícono de flecha hacia abajo (`IconChevronDown`) que abren un menú
    desplegable (`DropdownMenu` de `radix-ui`) con dos opciones: **"Perfil"**
    (navega a `/[rol]/perfil`) y **"Salir sesión"** (abre el diálogo de
    confirmación ya existente y ejecuta `logout`).
- Quitar la barra de navegación inferior ("Inicio"/"Perfil") de los tres
  shells — su función queda cubierta por el logo (→ inicio) y el menú de
  usuario (→ perfil).
- Quitar del header los elementos que el nuevo diseño no contempla: el ícono
  de cerrar sesión aislado (`IconLogout` independiente), el avatar circular
  con inicial, y el ícono de buscador del jefe (`IconSearch`).
- Ajustar el contenedor de los tres shells y de las pantallas de Inicio y
  Perfil de los tres roles para que, en pantallas anchas (laptop/escritorio),
  el contenido se mantenga centrado con un ancho máximo razonable en vez de
  estirarse borde a borde o desbordarse.

**Fuera de alcance (para specs futuros):**

- La funcionalidad real de las notificaciones (eventos, contador, panel) —
  va en SPEC 09; aquí la campana es solo un ícono visual sin acción.
- Rediseñar cómo se acomodan las tarjetas/formularios dentro de Inicio o
  Perfil en pantallas anchas (grillas multi-columna, layouts de escritorio) —
  solo se evita que se vean rotos/desbordados/estirados; un rediseño de
  layout más profundo de cada panel va en spec aparte si se decide.
- Cambios al contenido o lógica de negocio de cada panel (cola, atención,
  KPIs, polling, formularios, confirmación de resolución, etc.).
- Cambios a `datos-perfil.tsx` o a los datos que muestra el perfil — sigue
  de solo lectura, sin cambios (eso fue SPEC 07d).
- Cambios a la lógica de "primer ingreso", auth, o a la server action
  `logout` — se reutilizan tal cual.
- Cualquier otro punto de navegación adicional (menú lateral, breadcrumbs,
  etc.) — el patrón confirmado es solo logo→inicio y menú de usuario→perfil/salir.

## Modelo de datos

Este spec **no introduce ni modifica estructuras de datos**. Es puramente de
presentación/navegación: reutiliza `username` (ya disponible vía `profiles`,
consultado por cada `layout.tsx` desde SPEC 07d), la imagen estática
`assets/muni-ica.png`, y la server action `logout` existente en
`app/actions/auth.ts`.

## Implementation plan

1. **Crear `components/logo-soporte.tsx`** — logo (`assets/muni-ica.png` vía
   `next/image`, mismo patrón que `app/login/page.tsx`) + texto "Soporte
   Municipal", envueltos en un único `Link` que recibe `href` como prop (la
   ruta de inicio del rol).
   Verificar: el componente renderiza logo+texto enlazados sin errores de tipos.

2. **Refactor de `components/cerrar-sesion-dialog.tsx` a modo controlado** —
   quitar el `AlertDialog.Trigger` interno (botón `IconLogout`) y exponer
   `open`/`onOpenChange` como props, para que se dispare desde un elemento
   externo (la opción "Salir sesión" del nuevo menú) en vez de su propio botón.
   Verificar: el diálogo muestra el mismo texto y comportamiento (Cancelar /
   Cerrar sesión → logout), ahora controlado externamente.

3. **Crear `components/menu-usuario.tsx`** (cliente) — botón con `username` +
   `IconChevronDown` que abre un `DropdownMenu` (de `radix-ui`) con dos ítems:
   "Perfil" (`Link` a `perfilHref`, recibido como prop) y "Salir sesión"
   (cierra el menú y abre, vía estado controlado, el `CerrarSesionDialog` ya
   refactorizado).
   Verificar: el menú abre, "Perfil" navega, y "Salir sesión" cierra el
   dropdown y abre el diálogo de confirmación sin conflictos de foco entre
   ambos overlays.

4. **Reescribir `app/trabajador/shell.tsx`** — nuevo header:
   `LogoSoporte href="/trabajador"` a la izquierda y
   `MenuUsuario username={username} perfilHref="/trabajador/perfil"` a la
   derecha; quitar avatar, `CerrarSesionDialog` aislado, `<nav>` inferior y
   `NavTab` (sin uso); ajustar el contenedor para centrar el contenido con un
   ancho máximo en pantallas anchas.
   Verificar: como trabajador, el header muestra logo (lleva a `/trabajador`
   al pulsarlo), nombre+flechita con menú funcionando, sin barra inferior, y
   el contenido se ve centrado y sin desbordes en celular y en ventana ancha.

5. **Reescribir `app/tecnico/shell.tsx`** reusando `LogoSoporte` y
   `MenuUsuario`, agregando `IconBell` decorativo entre el logo y el menú de
   usuario; mismas remociones (avatar, `CerrarSesionDialog` aislado, `<nav>`,
   `NavTab`) y mismo ajuste de contenedor.
   Verificar: igual que el paso 4, más la campana visible y sin función, para
   un usuario técnico.

6. **Reescribir `app/jefe/shell.tsx`** reusando `LogoSoporte` (con texto
   "Soporte Municipal", reemplazando "Panel de Control"), `IconBell`
   decorativo y `MenuUsuario`; quitar `IconSearch`. Como el jefe ahora también
   necesita `username`, agregar esa consulta a `profiles` en
   `app/jefe/layout.tsx` (replicando el patrón de los layouts de trabajador/
   técnico) y pasarla como prop a `JefeShell`.
   Verificar: igual que el paso 5, para el jefe; el nombre del menú corresponde
   al usuario autenticado.

7. **Ajustar contenedores de Inicio y Perfil de los tres roles**
   (`panel.tsx` y `perfil/page.tsx`/`datos-perfil.tsx`) para que su contenido
   respete el mismo ancho máximo centrado del shell en pantallas anchas, sin
   reordenar tarjetas ni cambiar contenido.
   Verificar: abrir cada panel y su perfil en una ventana ancha (≥1024px) y
   una angosta (≤480px); en ambas se ve completo, legible y sin overflow horizontal.

8. **Verificación final.** `npm run build` y `npm run lint` — confirmar que no
   quedan props, tipos, componentes ni imports sin usar (`NavTab`, avatar,
   `IconSearch`, `IconHome`, `IconUser`, `IconLogout` aislado, `<nav>`).

## Acceptance criteria

- [ ] En los tres paneles (trabajador, técnico, jefe), el header muestra el
      logo de la municipalidad junto al texto "Soporte Municipal" a la
      izquierda, como un único enlace que lleva a la pantalla de inicio del
      rol al pulsarlo (`/trabajador`, `/tecnico`, `/jefe`).
- [ ] En técnico y jefe (no en trabajador), el header muestra un ícono de
      campana de notificaciones decorativo, sin contador ni acción al pulsarlo.
- [ ] En los tres paneles, el header muestra el nombre de usuario junto a un
      ícono de flecha hacia abajo; al pulsarlo se abre un menú con dos
      opciones: "Perfil" y "Salir sesión".
- [ ] "Perfil" navega a `/[rol]/perfil`.
- [ ] "Salir sesión" abre el diálogo "¿Seguro que quieres cerrar sesión?";
      "Cancelar" lo cierra sin efecto, y "Cerrar sesión" termina la sesión
      (vía `logout`) y redirige a `/login`.
- [ ] El comportamiento de cerrar sesión funciona igual para los tres roles,
      y el diálogo se ve y comporta exactamente igual que antes de moverlo
      dentro del menú.
- [ ] La barra de navegación inferior ("Inicio"/"Perfil") ya no aparece en
      ningún panel.
- [ ] El avatar circular con inicial, el ícono de cerrar sesión aislado, y el
      ícono de buscador del jefe ya no aparecen en ningún header.
- [ ] El header del jefe muestra "Soporte Municipal" (no "Panel de Control")
      junto al logo, igual que trabajador y técnico.
- [ ] En una ventana ancha (≥1024px), el header y el contenido de Inicio y
      Perfil de los tres roles se ven centrados con un ancho máximo
      razonable, sin estirarse borde a borde ni desbordarse.
- [ ] En una ventana angosta (celular, ≤480px), el header y el contenido de
      Inicio y Perfil se siguen viendo y comportando como hasta ahora (sin
      regresiones del diseño mobile existente).
- [ ] El contenido y comportamiento de cada panel principal (cola, atención,
      KPIs, polling, formularios, confirmación de resolución, "actualizado
      hace X") sigue funcionando exactamente igual que antes — sin
      regresiones funcionales.
- [ ] `npm run build` y `npm run lint` pasan sin errores, sin props, tipos,
      componentes ni imports sin usar.

## Decisions

- **Sí:** rediseño que **reemplaza por completo** la estructura del header de
  SPEC 07d (logo a la izquierda en vez de centrado, menú de usuario a la
  derecha en vez de avatar+ícono aislado de logout). Confirmado por el
  usuario: no es un ajuste incremental sino un nuevo diseño de cabecera.

- **Sí:** la barra de navegación inferior **desaparece por completo**.
  "Inicio" se accede solo pulsando el logo, y "Perfil"/"Salir sesión" solo
  desde el menú del nombre de usuario — el mismo patrón en celular y en
  escritorio, sin agregar otro menú o atajo. Decisión del usuario para
  simplificar la navegación ahora que ambas funciones viven en el header.

- **Sí:** el logo es la imagen `assets/muni-ica.png` ya existente en el
  repo (mismo patrón de `next/image` que usa `app/login/page.tsx`), junto al
  texto "Soporte Municipal" — no solo texto estilizado como hasta ahora.

- **Sí:** el lado derecho del header muestra **solo el nombre + flechita**,
  sin el avatar circular con inicial. Decisión del usuario: el nombre
  completo aporta más contexto que un círculo con una inicial, y evita
  duplicar información (nombre en texto + inicial en avatar).

- **Sí:** "Salir sesión" sigue abriendo el diálogo de confirmación
  "¿Seguro que quieres cerrar sesión?" ya existente — solo cambia desde
  dónde se dispara (de un botón aislado a un ítem dentro del menú
  desplegable). Mantiene la protección contra cierres de sesión accidentales
  que ya se decidió en SPEC 07d.

- **Sí:** la campana de notificaciones aparece como **ícono decorativo sin
  función** en técnico y jefe (no en trabajador, según lo descrito), dejando
  el terreno preparado para que SPEC 09 la conecte. No se construye ninguna
  lógica de notificaciones en este spec.

- **Sí:** el ícono de buscador del jefe (`IconSearch`, decorativo) **se
  quita** — no estaba en la descripción del nuevo header y su remoción hace
  más consistente la cabecera entre los tres roles.

- **Sí:** el texto del header del jefe cambia de **"Panel de Control"** a
  **"Soporte Municipal"**, igual que trabajador y técnico — para que los tres
  roles compartan exactamente el mismo logo+texto, tal como se describió.

- **Sí:** "responsive" se acota a que el **header nuevo y las pantallas de
  Inicio/Perfil** se vean centradas con un ancho máximo en pantallas anchas,
  sin romperse ni desbordarse — **sin** reacomodar las tarjetas en
  grillas/columnas de escritorio. Un rediseño de layout más profundo por
  panel queda fuera, para no mezclar dos objetivos grandes en un spec.

- **No:** crear un nuevo diálogo de confirmación de logout. Se refactoriza
  `cerrar-sesion-dialog.tsx` a modo controlado (sin su propio trigger) para
  reutilizarlo desde el menú desplegable, preservando texto y comportamiento.

- **No:** modificar `datos-perfil.tsx`, la lógica de "primer ingreso", la
  recuperación de contraseña, o la server action `logout` — se reutilizan
  exactamente como están.

## Risks

| Riesgo                                                                                                                                                                                                                                                       | Mitigación                                                                                                                                                                                                                                                                                                                                                                                   |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Anidar un `AlertDialog` dentro de un `DropdownMenu` (ambos de `radix-ui`) es un patrón con gotchas conocidos: si el diálogo se dispara desde un `DropdownMenu.Item`, los dos overlays pueden pelear por el foco o cerrarse entre sí inesperadamente.         | Refactorizar `cerrar-sesion-dialog.tsx` a modo controlado (`open`/`onOpenChange`, sin su propio trigger) y manejar la transición explícitamente desde `menu-usuario.tsx`: cerrar el dropdown primero y abrir el `AlertDialog` después por estado, en vez de anidar los triggers directamente. Verificar visualmente en el primer shell (trabajador) antes de reutilizarlo en técnico y jefe. |
| El rediseño toca el header de los tres paneles ya implementados y en uso — un cambio tan visible podría introducir regresiones funcionales (logout, navegación a perfil) o visuales (logo mal escalado, menú desbordado en pantallas angostas).              | Cada paso del plan deja el shell afectado verificable de inmediato ("se ve y funciona igual o mejor que antes"); el build/lint final detecta props, tipos o imports huérfanos que delaten algo mal movido; se prueba explícitamente en ventana ancha y angosta.                                                                                                                              |
| Quitar la barra de navegación inferior cambia un patrón de navegación con el que los usuarios ya interactuaban — "Perfil" deja de tener una pestaña visible permanente y pasa a vivir dentro de un menú, lo que podría ser menos descubrible la primera vez. | Decisión explícita y confirmada por el usuario (logo→inicio, menú→perfil/salir como único patrón); el ícono de flecha junto al nombre comunica visualmente que es un disparador de menú, siguiendo una convención de UI ampliamente reconocida.                                                                                                                                              |

## Lo que **no** está en este spec

- La funcionalidad real de las notificaciones (eventos, contador, panel) — SPEC 09.
- Rediseño de layout multi-columna de Inicio/Perfil en escritorio — spec aparte si se decide.
- Cambios al contenido o lógica de negocio de cada panel.
- Cambios a `datos-perfil.tsx`, "primer ingreso", recuperación de contraseña o `logout`.
- Cualquier menú lateral, breadcrumbs u otro punto de navegación adicional.

Cada uno de esos puntos, si se incorpora, va en su propio spec.
