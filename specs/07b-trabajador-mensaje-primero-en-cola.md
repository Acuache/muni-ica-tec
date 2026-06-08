# SPEC 07b — Trabajador: mensaje cuando es el primero en la cola

> **Estado:** Implementado · **Depende de:** SPEC 05 · **Fecha:** 2026-06-08
> **Objetivo:** Que el trabajador vea, cuando es el primero en la fila de espera
> (0 personas antes que él), el mensaje "Eres el primero en la cola. Un técnico
> te atenderá en unos momentos." en lugar de "Hay 0 personas esperando antes que
> tú", manteniendo el mensaje actual ("Hay N personas esperando antes que tú")
> para 1 persona o más.

## Scope

**In:**

- Modificar la card de posición en cola (`CardPosicionCola` en
  `app/trabajador/panel.tsx`) para que, cuando `posicion === 0`, muestre el
  mensaje **"Eres el primero en la cola. Un técnico te atenderá en unos
  momentos."** en lugar de "Hay 0 personas esperando antes que tú".
- Para `posicion >= 1`, mantener el mensaje actual sin cambios: "Hay N personas
  esperando antes que tú".

**Fuera de alcance:**

- La lógica de cálculo de la posición (`get_posicion_en_cola`) — no cambia.
- La visibilidad o el contenido de la card "¿Quién te ayudó?" (`CardResolucion`)
  — sigue ligada únicamente a `en_proceso`, sin cambios (el mockup
  `despues_de_pedir_apoyo.png` se usó solo como referencia visual de esa card,
  no implica cambiar cuándo aparece).
- Guardar evidencia de la atención en una tabla de historial — irá en un spec
  aparte, posiblemente junto con SPEC 08 — Historial y exportación.
- Cualquier otro cambio al flujo de seguimiento del trabajador (cancelar,
  confirmar resolución, layout, polling, etc.).

## Modelo de datos

Este spec **no introduce ni modifica estructuras de datos**. Es un cambio
puramente de presentación (texto condicional) sobre un valor que ya se calcula
(`posicionCola`, vía la función RPC `get_posicion_en_cola` de SPEC 05).

## Plan de implementación

1. **Modificar `CardPosicionCola`** (`app/trabajador/panel.tsx`, función
   actualmente alrededor de la línea 379). Reemplazar el párrafo único por una
   rama condicional según `posicion`:
   - Si `posicion === 0`: mostrar **"Eres el primero en la cola. Un técnico te
     atenderá en unos momentos."**
   - Si `posicion >= 1`: mantener el párrafo actual **"Hay N personas esperando
     antes que tú"** (con el singular/plural "persona"/"personas" igual que
     ahora).

   Verificar: insertando solicitudes de prueba en DB de modo que la posición
   del trabajador sea 0, el panel muestra el mensaje nuevo; con posición 1 o
   más, sigue mostrando "Hay N personas esperando antes que tú" con el número
   correcto.

## Criterios de aceptación

- [ ] Cuando la posición del trabajador en la cola es 0 (es el primero), la
      card muestra "Eres el primero en la cola. Un técnico te atenderá en unos
      momentos." en lugar de "Hay 0 personas esperando antes que tú".
- [ ] Cuando la posición es 1 o más, la card sigue mostrando "Hay N personas
      esperando antes que tú" con el singular/plural correcto ("1 persona" /
      "N personas").
- [ ] La card de posición sigue visible solo cuando el estado de la solicitud es
      `en_espera` (sin cambios respecto a SPEC 05).
- [ ] La card "¿Quién te ayudó?" sigue apareciendo solo cuando el estado es
      `en_proceso`, sin cambios de visibilidad respecto a SPEC 05.
- [ ] `npm run build` y `npm run lint` pasan sin errores.

## Decisiones

- **Sí:** mensaje especial solo para `posicion === 0`. Es el único caso donde
  el texto actual suena confuso/poco natural ("hay 0 personas esperando"); para
  1 o más, "Hay N personas esperando antes que tú" comunica bien la cola.

- **Sí:** texto formal/profesional — "Eres el primero en la cola. Un técnico te
  atenderá en unos momentos." — en vez de una versión más informal/casual.
  Decisión del usuario: que transmita que la atención está en camino, con un
  tono consistente con el resto del panel.

- **No:** cambiar la visibilidad o el contenido de la card "¿Quién te ayudó?"
  (`CardResolucion`). El mockup `despues_de_pedir_apoyo.png` se usó solo como
  referencia visual de esa card; su lógica sigue ligada a `en_proceso` porque no
  tiene sentido preguntar quién ayudó antes de que un técnico haya tomado el caso.

- **No:** tocar la función `get_posicion_en_cola` ni el modelo de datos. El
  cambio es puramente de presentación sobre un valor que ya se calcula.

- **No:** incluir aquí la funcionalidad de "guardar evidencia de atención en una
  tabla de historial" que surgió en la conversación. Es una feature distinta
  (toca modelo de datos, transición automática de estado, persistencia) que se
  trabajará en un spec aparte, posiblemente junto con SPEC 08 — Historial y
  exportación.

## Lo que **no** está en este spec

- Cambios a la lógica de `get_posicion_en_cola` o al modelo de datos.
- Cambios a la visibilidad o contenido de la card "¿Quién te ayudó?".
- Guardado de evidencia de atención en una tabla de historial — spec aparte.
- Cualquier otro cambio al flujo de seguimiento del trabajador.

Cada uno de esos puntos, si se incorpora, va en su propio spec.
