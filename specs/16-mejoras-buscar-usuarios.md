# SPEC 16 — Mejoras de Buscar usuarios: paginación numerada, loading, búsqueda por correo y cursor

> **Estado:** Implementado · **Depende de:** SPEC 14 (gestión de usuarios — pantalla Buscar, tabla y paginación actuales) · **Fecha:** 2026-07-09
> **Objetivo:** Mejorar la pantalla `/jefe/usuarios/buscar` con paginación numerada (‹ 1 … 4 [5] 6 … 20 ›), feedback de carga al navegar (tabla atenuada + spinner vía `useTransition`), búsqueda que encuentra por **nombre o correo** desde la misma caja, y cursor pointer en todos los botones de la app mediante una regla CSS global.

## Alcance

**Dentro:**

- **Paginación numerada** (`app/jefe/usuarios/tabla-usuarios.tsx`, solo modo texto — el modo sede sigue sin paginar):
  - Se reemplazan los botones "Anterior/Siguiente" por: flecha `‹` + números de página + flecha `›`.
  - Con pocas páginas (≤ 7) se muestran todos los números; con más, elipsis alrededor de la actual: `‹ 1 … 4 [5] 6 … 20 ›`. Siempre visibles la primera y la última.
  - La página actual va resaltada y no es clickeable; las flechas se deshabilitan en los extremos.
  - Se conserva el texto "Página X de Y".
  - La lógica vive en un componente nuevo **`components/paginacion.tsx`** (reutilizable a futuro, pero en este spec **solo se conecta en Buscar** — `tabla-solicitudes.tsx` no se toca).

- **Feedback de carga** (`tabla-usuarios.tsx`):
  - Toda navegación de la pantalla (`navegar()`: cambio de página, buscar, cambiar sede, toggle de desactivados) se envuelve en `useTransition`; mientras `isPending`, la tabla se atenúa (`opacity`) con un **spinner superpuesto**, sin salto de layout.
  - Los controles (caja, botones de paginación, select de sede, toggle) se deshabilitan mientras carga, para evitar navegaciones dobles.

- **Búsqueda por nombre o correo** (`app/jefe/usuarios/buscar/page.tsx`):
  - La misma caja busca coincidencia parcial en `username` **o** `email` (`.or()` con `ilike` en ambas columnas), tanto en la query de lista como en la de conteo.
  - El término se **sanitiza** (se remueven `,`, `(`, `)`, `%`) porque esos caracteres rompen la sintaxis de `.or()` de PostgREST.
  - Placeholder actualizado: *"Buscar por nombre o correo…"*.

- **Cursor pointer global** (`app/globals.css`):
  - Una regla global `button:not(:disabled) { cursor: pointer }` que restaura el cursor de mano en **todos los botones de la app** (Tailwind v4 lo quitó del preflight). No se edita ningún botón individual.

**Fuera de alcance (specs posteriores):**

- Cambiar la paginación de otras tablas (`tabla-solicitudes.tsx` del jefe) — el componente queda listo, pero conectarlo ahí es otro cambio.
- Paginar el modo sede (sigue sin paginación, como decidió SPEC 14).
- Búsqueda por teléfono, rol u otros criterios.
- Búsqueda "en vivo" mientras se escribe (debounce): se mantiene el submit explícito con el botón Buscar / Enter.
- Cambios de hover/estilos más allá del cursor (colores, transiciones nuevas, rediseños).
- Cambios de esquema o RLS: **ninguno** (la búsqueda por `email` usa el `SELECT` ya permitido sobre `profiles`).

## Modelo de datos

Este spec **no introduce datos nuevos**: no hay tablas, columnas, enums ni migraciones. La búsqueda por correo lee la columna `profiles.email` ya existente con el `SELECT` que RLS ya permite (SPEC 14).

## Plan de implementación

> Cada paso deja la app funcionando y es commiteable por separado. Antes de tocar el paso Server→Client o `useTransition`, consultar `node_modules/next/dist/docs/` (mandato de `AGENTS.md`).

1. **Cursor pointer global.**
   `app/globals.css`: añadir la regla `button:not(:disabled) { cursor: pointer; }` (los botones deshabilitados conservan su `disabled:cursor-not-allowed` donde ya lo tienen; no se toca ningún botón individual).
   *Verificar:* pasar el mouse por botones de login, paneles y modales muestra la mano; los botones deshabilitados no.

2. **Búsqueda por nombre o correo.**
   `app/jefe/usuarios/buscar/page.tsx`: sanitizar `q` (remover `,` `(` `)` `%`) y reemplazar el `ilike('username', …)` por `.or('username.ilike.%q%,email.ilike.%q%')` en la query de lista **y** en la de conteo.
   `tabla-usuarios.tsx`: placeholder *"Buscar por nombre o correo…"*.
   *Verificar:* buscar un fragmento de correo (ej. "gmail") lista esas cuentas; buscar por nombre sigue funcionando; el total de páginas cuadra con el filtro.

3. **Componente `components/paginacion.tsx`.**
   Componente cliente presentacional: recibe `paginaActual`, `totalPaginas`, `onPageChange(n)` y `disabled`. Calcula la ventana de números con elipsis (todos si ≤ 7 páginas; si no, primera + última + vecinas de la actual con `…`). Flechas `‹`/`›` deshabilitadas en los extremos; página actual resaltada y sin acción.
   *Verificar:* render aislado con 1, 5, 8 y 20 páginas produce las secuencias esperadas (`[1]`, `1 2 3 4 5`, `1 … 7 8`, `1 … 4 [5] 6 … 20`).

4. **Conectar paginación numerada en Buscar.**
   `tabla-usuarios.tsx`: reemplazar los dos botones por `<Paginacion>` manteniendo "Página X de Y"; solo en modo texto.
   *Verificar:* con >10 usuarios, clic en un número navega a esa página; las flechas avanzan/retroceden; en la página 1 y en la última las flechas quedan deshabilitadas.

5. **Feedback de carga con `useTransition`.**
   `tabla-usuarios.tsx`: envolver el `router.push` de `navegar()` en `startTransition`; mientras `isPending`, atenuar el contenedor de la tabla con un spinner superpuesto (overlay absoluto, sin salto de layout) y deshabilitar caja, botón Buscar, select de sede, toggle y paginación.
   *Verificar:* al cambiar de página o buscar, la tabla se atenúa y aparece el spinner hasta que llegan los datos nuevos; no se puede disparar una segunda navegación mientras carga.

6. **Cierre.**
   `npm run lint` y `npm run build` pasan; repaso manual de los criterios de aceptación.

## Criterios de aceptación

**Paginación numerada**

- [x] En modo texto con más de 10 usuarios, la paginación muestra flechas `‹`/`›` y números de página en lugar de "Anterior/Siguiente".
- [x] Con 7 páginas o menos se muestran todos los números; con más, aparece elipsis y siempre se ven la primera página, la última y las vecinas de la actual.
- [x] La página actual está resaltada y hacer clic en ella no navega.
- [x] Clic en un número navega a esa página; `‹`/`›` retroceden/avanzan de a una.
- [x] En la página 1 la flecha `‹` está deshabilitada; en la última, la `›`.
- [x] El texto "Página X de Y" sigue visible.
- [x] En modo sede no aparece paginación (sin cambios respecto a SPEC 14).

**Feedback de carga**

- [x] Al cambiar de página, buscar, cambiar de sede o alternar el toggle, la tabla se atenúa y aparece un spinner hasta que llegan los datos nuevos.
- [x] Mientras carga, la caja de búsqueda, el botón Buscar, el select de sede, el toggle y la paginación quedan deshabilitados.
- [x] El overlay no produce saltos de layout (la tabla anterior sigue ocupando su espacio).

**Búsqueda por nombre o correo**

- [x] Buscar un fragmento de correo (ej. "gmail" o "juan@") lista las cuentas cuyo `email` coincide parcialmente.
- [x] Buscar por nombre/apellido sigue funcionando igual que antes.
- [x] Un término que coincide con el nombre de una cuenta y el correo de otra lista ambas.
- [x] El conteo de páginas corresponde al filtro combinado (nombre O correo).
- [x] Un término con `,`, `(`, `)` o `%` no rompe la consulta (se sanitiza y busca con el resto del texto).
- [x] El placeholder de la caja dice "Buscar por nombre o correo…".

**Cursor global**

- [x] Todos los botones habilitados de la app muestran `cursor: pointer` al pasar el mouse (login, paneles, modales).
- [x] Los botones deshabilitados no muestran la mano.
- [x] No se modificó ninguna clase de botones individuales para lograrlo (solo `app/globals.css`).

**General**

- [x] `npm run lint` y `npm run build` pasan sin errores.

## Decisiones

- **Sí:** paginación con **números + flechas y elipsis** (`‹ 1 … 4 [5] 6 … 20 ›`). Es el patrón estándar, escala a cualquier cantidad de páginas y permite saltar directo. **No:** solo flechas (lo actual, incómodo con muchas páginas) ni todos los números sin elipsis (fila interminable con 30+ páginas).
- **Sí:** componente **`components/paginacion.tsx`** reutilizable, conectado solo en Buscar. La lógica de elipsis es la parte con casos borde; encapsularla evita duplicarla cuando otra tabla la necesite. **No:** migrar `tabla-solicitudes.tsx` en este spec — alcance acotado a la pantalla que motivó el pedido.
- **Sí:** feedback de carga con **`useTransition` + tabla atenuada + spinner** (elegido por el usuario). Mantiene el contenido visible sin saltos y es el patrón idiomático de App Router para navegaciones con `router.push`. **No:** skeleton (pierde el contenido anterior y salta) ni barra de progreso (menos evidente). **No:** depender de `loading.tsx` — no cubre las navegaciones cliente con `router.push` dentro de la misma ruta.
- **Sí:** **una sola caja** que busca nombre **o** correo con `.or()` + `ilike` (elegido por el usuario). Cero fricción; el jefe no decide "por cuál campo". **No:** selector "buscar por" — un clic extra sin beneficio real.
- **Sí:** **sanitizar el término** removiendo `,`, `(`, `)`, `%` antes del `.or()`. La sintaxis de `.or()` de PostgREST usa comas y paréntesis como separadores; un correo o texto con esos caracteres rompería la consulta.
- **Sí:** cursor pointer con **una regla global en `app/globals.css`** (pedido explícito del usuario: "no toques nada, solo el cursor"). Tailwind v4 eliminó `cursor: pointer` de los botones en su preflight; una regla global lo restaura en toda la app sin editar botón por botón. **No:** añadir `cursor-pointer` clase por clase — decenas de ediciones para el mismo efecto. **No:** cambiar colores, transiciones u otros estilos de hover — fuera de alcance.
- **Nota de proceso:** las secciones de criterios, decisiones y riesgos se redactaron sin revisión sección por sección, a pedido del usuario ("haz el archivo") tras aprobar encabezado, alcance y plan.
- **Nota:** SPEC 14 dejó "buscar por correo" explícitamente fuera de alcance; este spec lo incorpora y lo reemplaza en ese punto.

## Riesgos

| Riesgo | Mitigación |
|--------|------------|
| La sintaxis de `.or()` de PostgREST trata `,` y `()` como separadores; un término con esos caracteres rompería el filtro o permitiría inyectar condiciones. | Sanitizar el término (remover `,`, `(`, `)`, `%`) antes de interpolarlo; criterio de aceptación explícito. El riesgo es de robustez, no de fuga de datos: RLS ya limita lo visible. |
| La regla global de cursor podría afectar botones que hoy dependen del cursor por defecto (casos raros con `disabled:` mal aplicado). | La regla excluye `:disabled` (`button:not(:disabled)`); revisión visual rápida de las pantallas principales en el paso 1. |
| `useTransition` con `router.push` puede comportarse distinto en este Next 16 de lo conocido. | Leer la guía en `node_modules/next/dist/docs/` antes del paso 5 (mandato de `AGENTS.md`). |
| Deshabilitar controles durante `isPending` podría dejar la UI bloqueada si la navegación falla silenciosamente. | `isPending` es estado de React ligado a la transición: al terminar (bien o mal) vuelve a `false` y los controles se rehabilitan solos. |

## Lo que **no** está en este spec

- Paginación numerada en `tabla-solicitudes.tsx` u otras tablas.
- Paginación del modo sede.
- Búsqueda por teléfono, rol u otros criterios; búsqueda en vivo con debounce.
- Cambios de estilos de hover más allá del cursor (colores, transiciones, rediseños).
- Cambios de esquema, RLS o migraciones.

Cada uno de esos puntos, si se incorpora, va en su propio spec.
