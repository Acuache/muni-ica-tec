# SPEC 06 — Técnico: cola y atención

> **Estado:** Implementado · **Depende de:** SPEC 02, SPEC 03, SPEC 05 · **Fecha:** 2026-06-05
> **Objetivo:** Que el técnico vea la cola de solicitudes en espera, atienda una
> a la vez, gestione su estado de disponibilidad y consulte las métricas del día.

## Scope

**In:**

- Layout del panel del técnico: header ("Soporte Municipal" + avatar con inicial
  del `username` + menú hamburguesa sin funcionalidad) y barra de navegación
  inferior ("Inicio" activo, "Perfil" como placeholder visible).
- Card **ESPERANDO**: total de solicitudes `en_espera` en todo el sistema.
- Card **FINALIZADAS HOY**: total de solicitudes `solucionado` en todo el sistema
  cuya fecha de cierre (`updated_at`) sea hoy.
- Card **"TU ESTADO ACTUAL"**: grid 2×2 con Disponible / En Oficina / Virtual /
  Descanso; persiste en `estado_tecnico`; los botones se deshabilitan cuando el
  técnico está en `atendiendo` (ese estado lo asigna el sistema, no el técnico).
- Card **"Solicitud activa"**: visible solo cuando `estado_tecnico.estado =
  'atendiendo'`; muestra área, título y `username` del trabajador; botón
  "Liberar" que devuelve la solicitud a `en_espera`, limpia `tecnico_id` y
  cambia el estado del técnico a `disponible`.
- **Cola de Espera**: lista de todas las solicitudes `en_espera` ordenadas por
  `created_at` ASC (FIFO); cada fila muestra área, badge de posición ("1ero en
  cola", "2do en cola", …), título y botón "Atender ahora"; se oculta cuando el
  técnico está en `descanso` o en `atendiendo`.
- **"Atender ahora"**: UPDATE condicional `WHERE estado = 'en_espera'`
  (first-write-wins); en caso de colisión muestra "Este turno ya fue tomado por
  otro técnico"; en caso de éxito pone la solicitud en `en_proceso`, asigna
  `tecnico_id` y cambia el estado del técnico a `atendiendo`.
- **Trigger de Postgres** `solicitud_cierre_reset_tecnico`: cuando
  `solicitudes.estado` pasa de `en_proceso` a `solucionado` o `no_solucionado`,
  actualiza automáticamente `estado_tecnico` del técnico asignado a `disponible`
  y limpia `a_quien_ayuda`.
- Polling cada 3 minutos + botón de refresco manual + etiqueta "actualizado
  hace X".

**Fuera de alcance (specs posteriores):**

- Panel del jefe (KPIs globales, supervisión de técnicos) — SPEC 07.
- Historial filtrable y exportación — SPEC 08.
- Notificaciones push/campana — SPEC 09.
- Tiempo real con Supabase Realtime — SPEC 10.
- Pantalla de Perfil del técnico — spec posterior.
- Filtrado de cola por área o tipo de ayuda — no está en el MVP.

## Modelo de datos

Este spec no introduce tablas nuevas. Usa `solicitudes`, `estado_tecnico`,
`areas` y `profiles` de SPEC 02. Añade un trigger de Postgres.

### Trigger `solicitud_cierre_reset_tecnico`

Cuando el trabajador confirma "Resuelto" o "No resuelto" (SPEC 05), la solicitud
pasa de `en_proceso` a `solucionado` o `no_solucionado`. Este trigger detecta
ese cambio y libera automáticamente al técnico asignado:

```sql
create or replace function reset_tecnico_en_cierre()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update estado_tecnico
  set estado               = 'disponible',
      a_quien_ayuda        = null,
      ultima_actualizacion = now()
  where tecnico_id = old.tecnico_id;
  return new;
end;
$$;

create trigger solicitud_cierre_reset_tecnico
after update on solicitudes
for each row
when (
  old.estado = 'en_proceso'
  and new.estado in ('solucionado', 'no_solucionado')
  and old.tecnico_id is not null
)
execute function reset_tecnico_en_cierre();
```

### Consultas principales

| Propósito | Query |
|-----------|-------|
| ESPERANDO | `SELECT COUNT(*) FROM solicitudes WHERE estado = 'en_espera'` |
| FINALIZADAS HOY | `SELECT COUNT(*) FROM solicitudes WHERE estado = 'solucionado' AND updated_at::date = CURRENT_DATE` |
| Cola (FIFO) | `SELECT s.id, s.titulo, a.nombre AS area FROM solicitudes s JOIN areas a ON s.area_id = a.id WHERE s.estado = 'en_espera' ORDER BY s.created_at ASC` |
| Estado del técnico | `SELECT estado, a_quien_ayuda FROM estado_tecnico WHERE tecnico_id = auth.uid()` |
| Solicitud activa del técnico | `SELECT s.id, s.titulo, a.nombre AS area, p.username AS trabajador FROM solicitudes s JOIN areas a ON s.area_id = a.id JOIN profiles p ON s.trabajador_id = p.id WHERE s.tecnico_id = auth.uid() AND s.estado = 'en_proceso' LIMIT 1` |

### Transiciones de estado del técnico

| Acción | Estado anterior | Estado nuevo |
|--------|----------------|--------------|
| Seleccionar Disponible / En Oficina / Virtual / Descanso | cualquiera excepto `atendiendo` | el seleccionado |
| Pulsar "Atender ahora" (éxito) | cualquiera excepto `atendiendo` | `atendiendo` |
| Pulsar "Liberar" | `atendiendo` | `disponible` |
| Trabajador cierra la solicitud (trigger) | `atendiendo` | `disponible` |

### Transiciones de estado de la solicitud (lado del técnico)

| Acción | Estado anterior | Estado nuevo |
|--------|----------------|--------------|
| "Atender ahora" (éxito) | `en_espera` | `en_proceso` |
| "Liberar" | `en_proceso` | `en_espera` |

## Plan de implementación

1. **Migración SQL.**
   Crear `supabase/migrations/YYYYMMDDHHMMSS_tecnico_panel.sql` con la función
   `reset_tecnico_en_cierre()` y el trigger `solicitud_cierre_reset_tecnico`.
   Verificar: `npx supabase db push` aplica sin errores; el trigger aparece en
   Dashboard → Database → Functions y Triggers.

2. **Server Actions (`app/tecnico/actions.ts`).**
   Tres acciones con `'use server'`:
   - `cambiarEstado(estado)` — UPDATE en `estado_tecnico` para el técnico
     autenticado; rechaza si el estado actual es `atendiendo`.
   - `atenderAhora(solicitudId)` — UPDATE condicional
     `WHERE id = solicitudId AND estado = 'en_espera'`; si no devuelve filas,
     retorna error de colisión; si tiene éxito, UPDATE en `estado_tecnico` →
     `atendiendo` y `a_quien_ayuda = solicitudId`.
   - `liberarSolicitud(solicitudId)` — UPDATE solicitud → `en_espera`,
     `tecnico_id = null`; UPDATE `estado_tecnico` → `disponible`,
     `a_quien_ayuda = null`.
   Verificar: cada acción ejecuta la query correcta y el estado cambia en DB.

3. **`app/tecnico/page.tsx` — Server Component con datos iniciales.**
   Consultar en paralelo: `profiles` del técnico (username), estado en
   `estado_tecnico`, conteo ESPERANDO, conteo FINALIZADAS HOY, solicitud activa
   del técnico (si `estado = 'atendiendo'`), cola de espera (si `estado ≠
   'atendiendo'` y `≠ 'descanso'`).
   Pasar todos los datos como props al componente cliente `TecnicoPanel`.
   Verificar: la página carga sin errores; los datos llegan como props.

4. **Layout del panel (`app/tecnico/panel.tsx` — Client Component).**
   Mismo esquema visual que SPEC 05: header con "Soporte Municipal", avatar
   circular con inicial del `username`, menú hamburguesa sin funcionalidad;
   barra inferior con "Inicio" (activo) y "Perfil" (placeholder).
   Si los componentes de header y nav del trabajador son genéricos, reutilizarlos;
   si no, duplicar y refactorizar en un spec posterior.
   Verificar: el layout se muestra correctamente.

5. **Cards ESPERANDO y FINALIZADAS HOY.**
   Dos cards en la parte superior con los conteos del servidor.
   Verificar: los números coinciden con los conteos reales en DB.

6. **Card "TU ESTADO ACTUAL".**
   Grid 2×2 con Disponible / En Oficina / Virtual / Descanso. El botón del estado
   activo lleva fondo verde y checkmark. Todos los botones deshabilitados cuando
   `estado = 'atendiendo'`. Al pulsar un botón llama a `cambiarEstado` y hace
   `router.refresh()`.
   Verificar: cambiar el estado persiste en DB y el botón activo cambia
   visualmente; los botones no responden cuando el técnico está `atendiendo`.

7. **Card "Solicitud activa".**
   Visible solo cuando `estado = 'atendiendo'`. Muestra área, título y username
   del trabajador. Botón "Liberar" que llama a `liberarSolicitud` y hace
   `router.refresh()`.
   Verificar: la card aparece al tomar una solicitud y desaparece al liberarla
   o cuando el trabajador la cierra (tras el siguiente refresco).

8. **Cola de Espera.**
   Visible solo cuando `estado ≠ 'descanso'` y `≠ 'atendiendo'`. Lista ordenada
   por `created_at` ASC; cada fila muestra área, badge de posición calculado por
   índice en el array ("1ero en cola", "2do en cola", etc.), título y botón
   "Atender ahora". Al pulsar, llama a `atenderAhora`; si la acción retorna error
   de colisión, muestra toast "Este turno ya fue tomado por otro técnico" y hace
   `router.refresh()`; si tiene éxito, hace `router.refresh()`.
   Verificar: la cola muestra todas las solicitudes `en_espera` en orden FIFO;
   pulsar "Atender ahora" asigna la solicitud y muestra la card de solicitud
   activa; la colisión muestra el toast y refresca la lista.

9. **Polling cada 3 minutos + refresco manual + etiqueta "actualizado hace X".**
   Mismo esquema que SPEC 05: `useEffect` con `setInterval(router.refresh,
   180_000)`; botón de refresco manual; estado local `lastRefreshed: Date`
   actualizado en cada refresh; etiqueta calculada cada segundo.
   Verificar: el panel se refresca solo cada 3 minutos; el botón manual refresca
   al instante; la etiqueta muestra el tiempo correctamente.

## Criterios de aceptación

- [ ] El panel carga sin errores para un usuario con rol `tecnico`.
- [ ] El header muestra "Soporte Municipal", el avatar con la inicial del
      `username` y el menú hamburguesa sin funcionalidad.
- [ ] La barra inferior muestra "Inicio" (activo) y "Perfil" (placeholder sin
      funcionalidad).
- [ ] La card ESPERANDO muestra el total de solicitudes `en_espera` del sistema.
- [ ] La card FINALIZADAS HOY muestra el total de solicitudes `solucionado` del
      sistema cuya fecha de cierre sea hoy.
- [ ] La card "TU ESTADO ACTUAL" resalta el estado actual del técnico con fondo
      verde y checkmark.
- [ ] Pulsar Disponible / En Oficina / Virtual / Descanso persiste el nuevo
      estado en `estado_tecnico` y actualiza el botón activo.
- [ ] Los botones de estado están deshabilitados cuando el técnico está
      `atendiendo`.
- [ ] La Cola de Espera muestra todas las solicitudes `en_espera` ordenadas por
      `created_at` ASC (la más antigua primero).
- [ ] Cada fila de la cola muestra área, badge de posición ("1ero en cola",
      "2do en cola", …) y título.
- [ ] La Cola de Espera se oculta cuando el técnico está en `descanso`.
- [ ] La Cola de Espera se oculta cuando el técnico está `atendiendo`.
- [ ] Pulsar "Atender ahora" pone la solicitud en `en_proceso`, asigna
      `tecnico_id` y cambia el estado del técnico a `atendiendo`.
- [ ] Si dos técnicos pulsan "Atender ahora" simultáneamente sobre la misma
      solicitud, solo uno la obtiene; el otro ve el toast "Este turno ya fue
      tomado por otro técnico" y la cola se refresca.
- [ ] Al tomar una solicitud aparece la card "Solicitud activa" con área, título
      y username del trabajador.
- [ ] Pulsar "Liberar" devuelve la solicitud a `en_espera`, limpia `tecnico_id`
      y cambia el estado del técnico a `disponible`.
- [ ] Cuando el trabajador confirma "Resuelto" o "No resuelto", el trigger
      cambia automáticamente el estado del técnico a `disponible` (visible tras
      el siguiente refresco).
- [ ] La etiqueta "actualizado hace X" se actualiza cada segundo.
- [ ] El panel se refresca automáticamente cada 3 minutos.
- [ ] El botón de refresco manual actualiza los datos al instante.
- [ ] `npm run build` y `npm run lint` pasan sin errores.

## Decisiones

- **Sí:** una solicitud activa por técnico a la vez. Simplifica el modelo de
  estado y el flujo visual; múltiples atenciones simultáneas se pueden añadir
  en un spec posterior si surge la necesidad.

- **Sí:** estado `atendiendo` asignado automáticamente por el sistema al pulsar
  "Atender ahora", no seleccionable manualmente. Evita que el técnico quede en
  `atendiendo` sin solicitud asignada o que tome una solicitud sin actualizar
  su estado.

- **Sí:** trigger de Postgres `solicitud_cierre_reset_tecnico` para resetear el
  estado del técnico al cerrar la solicitud. Garantiza la consistencia aunque
  el cliente del trabajador falle o pierda conexión; no depende de que SPEC 05
  actualice explícitamente `estado_tecnico`.

- **Sí:** first-write-wins con UPDATE condicional `WHERE estado = 'en_espera'`
  para la race condition. Suficiente para el MVP sin lógica de bloqueo extra;
  el técnico que pierde ve un mensaje claro y la cola se refresca.

- **Sí:** badge de posición calculado por índice en el array del cliente, no
  por función RPC. El técnico puede leer todas las solicitudes `en_espera`
  directamente (sin restricción de RLS como el trabajador), por lo que el orden
  del array ya da la posición correcta sin coste adicional de DB.

- **Sí:** cola oculta en `descanso` y en `atendiendo`. En `descanso` el técnico
  señala que no está disponible; mostrar la cola generaría presión innecesaria.
  En `atendiendo` ya tiene una solicitud activa y no puede tomar otra.

- **Sí:** botón "Liberar" para devolver la solicitud a la cola. Cubre el caso
  real de que el técnico tome una solicitud por error o deba pasarla a otro.

- **Sí:** ESPERANDO y FINALIZADAS HOY son métricas del sistema completo, no
  solo del técnico. Dan visibilidad de la carga global de la cola y el
  rendimiento del equipo en el día.

- **No:** filtrado de la cola por área o tipo de ayuda. No está en el MVP;
  se puede añadir en un spec posterior si el volumen de solicitudes lo justifica.

- **No:** estado `atendiendo` en los botones manuales de "TU ESTADO ACTUAL".
  No tiene sentido que el técnico se ponga manualmente en `atendiendo` sin
  haber tomado una solicitud del sistema.

## Riesgos

| Riesgo | Mitigación |
|--------|-----------|
| El trigger `reset_tecnico_en_cierre` usa `SECURITY DEFINER` y asume que existe una fila en `estado_tecnico` para cada técnico. Si la fila no se creó al registrar el usuario, el UPDATE no hace nada y el técnico queda en `atendiendo` para siempre. | En la migración, verificar que SPEC 02 garantiza la creación de la fila en `estado_tecnico` al insertar un perfil con `rol = 'tecnico'`. Si no, añadir un INSERT de relleno en la misma migración. |
| El campo `updated_at` de `solicitudes` debe actualizarse automáticamente al cambiar el estado para que FINALIZADAS HOY sea correcto. Si SPEC 02 no añadió un trigger `set_updated_at`, la fecha puede quedar desactualizada. | Verificar en Dashboard que `solicitudes.updated_at` se actualiza en cada UPDATE. Si no, añadir `set updated_at = now()` explícitamente en las Server Actions de SPEC 05 que cierran solicitudes, o agregar el trigger en esta migración. |
| El campo `a_quien_ayuda` en `estado_tecnico` (definido en SPEC 02) puede referirse al `trabajador_id` o al `solicitud_id`; la card "Solicitud activa" necesita ambos. | Antes de implementar el paso 7, leer SPEC 02 para confirmar qué almacena `a_quien_ayuda`. Si solo guarda uno, ajustar la consulta para obtener el otro por JOIN desde `solicitudes`. |
| El polling con `router.refresh()` cada 3 minutos puede coincidir con el momento en que el técnico acaba de pulsar "Atender ahora" y el optimistic update aún no se ha consolidado, mostrando brevemente la cola vacía o el estado anterior. | Es un parpadeo visual menor y aceptable en el MVP. Si molesta, añadir un flag local `isRefreshing` para suprimir el refresco automático durante los 5 segundos posteriores a una acción del técnico. |
| Si el RLS de SPEC 02 no permite al técnico hacer UPDATE sobre `solicitudes`, `atenderAhora` fallará silenciosamente. | Revisar las políticas RLS de `solicitudes` antes de implementar el paso 2 y, si es necesario, añadir una política `FOR UPDATE` que permita a técnicos actualizar filas en `en_espera`. |

## Lo que **no** está en este spec

- Panel del jefe (KPIs globales, cola completa, supervisión de técnicos) — SPEC 07.
- Historial filtrable y exportación — SPEC 08.
- Notificaciones push/campana — SPEC 09.
- Tiempo real con Supabase Realtime — SPEC 10.
- Pantalla de Perfil del técnico — spec posterior.
- Filtrado de la cola por área o tipo de ayuda — no contemplado en el MVP.
- Múltiples solicitudes activas simultáneas por técnico — no contemplado en el MVP.
- Métricas personales del técnico (sus propias finalizadas, tasa de éxito) — SPEC 07 o spec posterior.

Cada uno de esos puntos, si se incorpora, va en su propio spec.
