# SPEC 07c — Trabajador: la card de resolución muestra el técnico asignado

> **Estado:** Reemplazado por SPEC 15 · **Depende de:** SPEC 05 · **Fecha:** 2026-06-08
>
> ⚠️ **Superseded:** SPEC 15 (Cambio 1) revirtió este comportamiento a propósito:
> el trabajador ya **no** ve el nombre del técnico; ve el aviso fijo
> "Un técnico ya está atendiendo tu caso" (máx. 20 min). Este spec queda solo
> como registro histórico.
> **Objetivo:** Que la card "¿Se ha resuelto el problema?" del trabajador muestre
> el nombre del técnico que tomó su caso ("El caso fue tomado por el técnico
> **{username}**") en lugar de pedirle que lo seleccione de un dropdown,
> simplificando la confirmación a solo Resuelto / No resuelto.

## Scope

**In:**

- Reemplazar el dropdown "¿Quién te ayudó?" de `CardResolucion`
  (`app/trabajador/panel.tsx`) por un texto fijo de solo lectura:
  **"El caso fue tomado por el técnico {username}"**, usando el `tecnico_id`
  ya asignado a la solicitud (asignado por SPEC 06 al pulsar "Atender ahora").
- Simplificar la acción `confirmarResolucion` (`app/trabajador/actions.ts`)
  para que ya no reciba ni valide `tecnico_id` desde el formulario — el `UPDATE`
  solo cambia `estado`, dejando intacto el `tecnico_id` que ya estaba en la fila.
- Ajustar la consulta de datos en `app/trabajador/page.tsx`: dejar de traer la
  lista completa de técnicos (`profiles WHERE rol = 'tecnico'`) y traer en su
  lugar solo el `username` del técnico asignado a la solicitud activa.

**Fuera de alcance:**

- El trigger de la card — sigue ligado a `estado === 'en_proceso'`, sin cambios
  (confirmado en esta sesión: "cola 0" era la forma de describir "ya te están
  atendiendo"; SPEC 07b ya decidió mantenerlo así).
- El flujo de "doble confirmación" (botón "Resuelto" del lado del técnico,
  sección de "pendientes de confirmación", cierre automático cuando ambas
  partes confirman) — va en un **spec aparte**, posterior, que depende de
  SPEC 06.
- Cambios al modelo de datos o migraciones — no se necesitan; se reutiliza
  `tecnico_id`, ya existente en `solicitudes`.
- Cualquier otro cambio al panel del trabajador (layout, polling, cancelar,
  card de posición en cola, etc.).

## Modelo de datos

Este spec **no introduce ni modifica estructuras de datos**. Reutiliza el
`tecnico_id` ya existente en `solicitudes` (asignado por SPEC 06 al pasar la
solicitud a `en_proceso`). Solo cambia qué se consulta y cómo se presenta.

## Plan de implementación

1. **`app/trabajador/page.tsx`** — Reemplazar la consulta de la lista completa
   de técnicos por una consulta del `username` del técnico ya asignado:

   ```ts
   // antes: profiles WHERE rol = 'tecnico' (lista completa)
   // ahora: profiles WHERE id = solicitudActiva.tecnico_id (solo el asignado), .single()
   ```

   Solo se ejecuta cuando `solicitudActiva?.tecnico_id` no es `null`. Pasar
   `tecnicoNombre: string | null` como prop a `TrabajadorPanel` en lugar de
   `tecnicos: Tecnico[]`.
   Verificar: la página carga sin errores; `tecnicoNombre` llega con el
   `username` correcto cuando hay técnico asignado.

2. **`CardResolucion` (`app/trabajador/panel.tsx`)** — Quitar el `<select
name="tecnico_id">` y el `<input type="hidden" name="tecnico_id">`.
   Reemplazar por un párrafo: "El caso fue tomado por el técnico
   **{tecnicoNombre}**". Quitar también el tipo `Tecnico` y la prop `tecnicos`
   ya no usados (en `Props`, `TrabajadorPanel`, `PantallaSeguimiento` y
   `CardResolucion`), reemplazándolos por `tecnicoNombre: string | null`.
   Verificar: con una solicitud `en_proceso` y técnico asignado, la card
   muestra el nombre correcto y ya no hay ningún dropdown.

3. **`confirmarResolucion` (`app/trabajador/actions.ts`)** — Quitar la lectura
   y validación de `tecnico_id` del `FormData` (ya no llega del formulario).
   El `UPDATE` pasa a actualizar solo `estado`, dejando el `tecnico_id`
   existente intacto:

   ```ts
   .update({ estado: resultado })
   ```

   Verificar: pulsar "Resuelto" cambia `estado` a `solucionado` sin alterar
   `tecnico_id`; "No resuelto" cambia a `no_solucionado` igual, conservando
   el mismo `tecnico_id`.

4. **Verificación final.** `npm run build` y `npm run lint` — confirmar que no
   quedan tipos, props ni variables sin usar (`Tecnico`, `tecnicos`,
   referencias a `tecnico_id` en el formulario).

## Criterios de aceptación

- [ ] Con una solicitud en estado `en_proceso`, la card "¿Se ha resuelto el
      problema?" muestra **"El caso fue tomado por el técnico {username}"**
      con el `username` correcto del `tecnico_id` asignado a esa solicitud.
- [ ] Ya no aparece ningún dropdown ni se le pide al trabajador elegir un
      técnico de una lista.
- [ ] Pulsar **"Resuelto"** cambia el estado de la solicitud a `solucionado`,
      conserva el `tecnico_id` ya asignado (sin alterarlo), y el panel vuelve
      al formulario de "Nueva Solicitud".
- [ ] Pulsar **"No resuelto"** cambia el estado a `no_solucionado`, conserva
      el `tecnico_id` ya asignado (sin alterarlo), y el panel vuelve al
      formulario.
- [ ] La card sigue siendo visible solo cuando el estado es `en_proceso` —
      sin cambios respecto a SPEC 05 / SPEC 07b.
- [ ] La card de posición en cola (`CardPosicionCola`) sigue funcionando sin
      cambios — visible solo en `en_espera`.
- [ ] `npm run build` y `npm run lint` pasan sin errores, sin tipos, props ni
      variables sin usar (`Tecnico`, `tecnicos`, `tecnico_id` del formulario).

## Decisiones

- **Sí:** reemplazar el dropdown "¿Quién te ayudó?" por un texto fijo de solo
  lectura ("El caso fue tomado por el técnico {username}"). Decisión del
  usuario por simplicidad: ya no tiene sentido pedirle al trabajador que elija
  entre una lista cuando el sistema ya sabe quién tomó el caso (el `tecnico_id`
  se asigna en SPEC 06 al pulsar "Atender ahora").

- **Sí:** mantener el trigger de la card ligado a `estado === 'en_proceso'`,
  sin cambiarlo a "posición en cola === 0". Se aclaró que "estar en la cola 0"
  era la forma de describir "ya te están atendiendo" — no un cálculo distinto
  de `posicionCola`. Esto es consistente con la decisión ya tomada en SPEC 07b
  ("no tiene sentido preguntar quién ayudó antes de que un técnico haya tomado
  el caso").

- **Sí:** ambos botones (Resuelto / No resuelto) conservan el `tecnico_id` ya
  asignado, sin pedir ni guardar nada distinto según el resultado. Es más
  simple y más coherente: la persona que tomó el caso es la que queda
  registrada, haya resuelto el problema o no.

- **No:** contemplar el caso de `tecnico_id = null` con `estado = 'en_proceso'`.
  Se confía en el invariante de SPEC 06 (siempre asigna `tecnico_id` al pasar
  una solicitud a `en_proceso`); si llegara a ocurrir, sería un bug de SPEC 06,
  no algo que esta card deba manejar.

- **No:** incluir el flujo de "doble confirmación" (botón "Resuelto" del lado
  del técnico, sección de "pendientes de confirmación", cierre automático
  cuando ambas partes confirman) que surgió en la conversación. Es una feature
  bastante más grande — toca el panel del técnico (SPEC 06, ya implementado),
  el modelo de datos (estado de confirmación por cada lado) y lógica de
  transición automática. Va en un **spec aparte**, posterior, que depende de
  SPEC 06.

## Lo que **no** está en este spec

- El trigger de la card (sigue ligado a `en_proceso`, sin cambios).
- El flujo de "doble confirmación" entre trabajador y técnico — spec aparte.
- Cambios al modelo de datos o migraciones.
- Cualquier otro cambio al panel del trabajador.

Cada uno de esos puntos, si se incorpora, va en su propio spec.
