# SPEC 08b — Confirmación no bloqueante y acciones simplificadas del jefe

> **Estado:** Implementado
> **Depende de:** SPEC 08, SPEC 02, SPEC 05, SPEC 06
> **Fecha:** 2026-06-10
> **Objetivo:** Ajustar el flujo de doble confirmación de SPEC 08 para que
> ninguna de las dos partes (técnico o trabajador) quede bloqueada esperando
> a la otra tras confirmar "Resuelto" — manteniendo `solucionado` como
> resultado de que ambas confirmen — y reemplazar las acciones de la tabla
> del jefe por botones contextuales según el estado de cada solicitud
> (Cancelar, Marcar Solucionado, Marcar todos Solucionados).

## Scope

**In:**

### Confirmación no bloqueante (técnico y trabajador)

- La regla interna de SPEC 08 **no cambia**: `estado = 'solucionado'` solo
  ocurre cuando `confirmacion_trabajador = true` **y**
  `confirmacion_tecnico = true`.
- **Técnico confirma "Resuelto"** (`confirmarResolucionTecnico`): además de
  actualizar `confirmacion_tecnico` (y `estado` si la otra confirmación ya
  era `true`), el técnico se libera de inmediato — `technician_status.estado
  = 'disponible'` y `atendiendo_solicitud_id = null` — sin necesidad de
  pulsar "Liberar". Esto ocurre tanto si el resultado es `solucionado` como
  si queda `en_proceso` esperando al trabajador.
- **Trabajador confirma "Resuelto"** (`confirmarResolucion`): la consulta de
  `solicitudActiva` deja de incluir esta solicitud en cuanto
  `confirmacion_trabajador = true`, aunque `estado` siga `en_proceso`. El
  panel del trabajador vuelve directo al formulario "Nueva Solicitud".
- Se eliminan los mensajes "Confirmaste que fue resuelto. Esperando
  confirmación de..." de ambos paneles — ya no hay estado de "espera"
  visible para ninguna de las partes.
- "No resuelto" del trabajador y "Liberar" del técnico **no cambian**.

### Tabla del jefe — acciones simplificadas

- Las columnas "Conf. Trab." y "Conf. Téc." pasan a ser **solo indicador**
  (✓ / ✗), sin botones de toggle.
- La columna "Acciones" muestra **un solo botón contextual por fila**, según
  `estado`:
  | Estado | Botón | Efecto |
  |---|---|---|
  | `en_espera` | "Cancelar" (con modal de confirmación) | `estado = 'cancelado'` |
  | `en_proceso` | "Marcar Solucionado" — habilitado solo si `confirmacion_trabajador` o `confirmacion_tecnico` es `true` | ambas confirmaciones → `true`, `estado = 'solucionado'` |
  | `solucionado`, `no_solucionado`, `cancelado` | (sin botón) | — |
- Se elimina por completo la posibilidad de que el jefe fuerce
  `no_solucionado` manualmente.
- **Nuevo botón masivo "Marcar todos como Solucionado"**: visible solo
  cuando el filtro de la tabla = "En Proceso". Aplica a **todas** las
  solicitudes `en_proceso` con al menos una confirmación en `true` en toda
  la base de datos (no solo la página visible). Antes de ejecutar, abre un
  modal de confirmación mostrando cuántas solicitudes se van a cerrar
  ("Se marcarán N solicitudes como Solucionado").

**Fuera de alcance:**

- Migraciones de columnas — `confirmacion_trabajador` / `confirmacion_tecnico`
  ya existen desde SPEC 08.
- El botón "Cancelar ayuda" del trabajador en `en_espera` — ya existe
  (SPEC 05), sin cambios.
- Notificaciones (SPEC 09) y Supabase Realtime (SPEC 10).
- Filtros adicionales por fecha, área o técnico.

## Modelo de datos

No se agregan columnas ni tablas nuevas — `confirmacion_trabajador`,
`confirmacion_tecnico` (SPEC 08) y `technician_status.atendiendo_solicitud_id`
/ `estado` (SPEC 06) ya existen y son suficientes.

### Cambios en consultas existentes

**`app/trabajador/page.tsx` — `solicitudActiva`:**

De:
```ts
.in('estado', ['en_espera', 'en_proceso'])
```
a:
```ts
.or('estado.eq.en_espera,and(estado.eq.en_proceso,confirmacion_trabajador.eq.false)')
```

**`app/jefe/solicitudes/page.tsx` — conteo para el botón masivo**, solo
cuando `estadoFiltro === 'en_proceso'`:
```sql
SELECT COUNT(*) FROM solicitudes
WHERE estado = 'en_proceso'
  AND (confirmacion_trabajador = true OR confirmacion_tecnico = true);
```

### Server Actions — nuevos / modificados / eliminados

| Action | Archivo | Cambio |
|---|---|---|
| `confirmarResolucionTecnico` | `app/tecnico/actions.ts` | Modificado: además de actualizar `confirmacion_tecnico` / `estado`, actualiza `technician_status` → `estado='disponible'`, `atendiendo_solicitud_id=null`. |
| `confirmarResolucion` | `app/trabajador/actions.ts` | Sin cambios en su lógica interna. |
| `toggleConfirmacionJefe` | `app/jefe/actions.ts` | **Eliminado.** |
| `forzarEstado` | `app/jefe/actions.ts` | **Eliminado.** |
| `marcarSolucionado` (nuevo) | `app/jefe/actions.ts` | Recibe `solicitudId`. Requiere `estado='en_proceso'` y al menos una confirmación en `true`. Pone ambas confirmaciones en `true` y `estado='solucionado'`. |
| `marcarTodosSolucionados` (nuevo) | `app/jefe/actions.ts` | Sin parámetros. `UPDATE solicitudes SET confirmacion_trabajador=true, confirmacion_tecnico=true, estado='solucionado' WHERE estado='en_proceso' AND (confirmacion_trabajador OR confirmacion_tecnico)`. |
| `cancelarSolicitudJefe` (nuevo) | `app/jefe/actions.ts` | Recibe `solicitudId`. Requiere `estado='en_espera'`. `estado='cancelado'`. |

## Plan de implementación

1. **Modificar `confirmarResolucionTecnico` (`app/tecnico/actions.ts`).**
   Después de actualizar `solicitudes` (igual que hoy: si
   `confirmacion_trabajador` ya es `true` → `confirmacion_tecnico=true,
   estado='solucionado'`; si no → solo `confirmacion_tecnico=true`), agregar
   un `update` a `technician_status`:
   ```ts
   await supabase
     .from('technician_status')
     .update({ estado: 'disponible', atendiendo_solicitud_id: null, updated_at: new Date().toISOString() })
     .eq('tecnico_id', user.id)
   ```
   Si falla, devolver `{ error: '...' }` (la solicitud ya quedó actualizada;
   reintentar "Resuelto" es idempotente).
   Verificar: tras pulsar "Resuelto", `technician_status.estado` pasa a
   `disponible` y `atendiendo_solicitud_id` a `null`, sin importar si
   `solicitudes.estado` quedó en `solucionado` o `en_proceso`.

2. **Simplificar el panel del técnico.**
   - `app/tecnico/page.tsx`: quitar `confirmacion_tecnico` del `select` y del
     tipo `SolicitudActiva` (ya no se usa).
   - `app/tecnico/panel.tsx` (`CardSolicitudActiva`): quitar la prop
     `confirmacionTecnico` y el branch "Confirmaste que fue resuelto.
     Esperando confirmación del trabajador."; el formulario "Resuelto" se
     muestra siempre que la tarjeta esté visible.
   Verificar: tras confirmar "Resuelto", la tarjeta "Atendiendo ahora"
   desaparece (porque `technician_status.estado` ya no es `atendiendo`) y
   vuelve a verse "Cola de Espera".

3. **Cambiar la consulta `solicitudActiva` del trabajador
   (`app/trabajador/page.tsx`).**
   Reemplazar `.in('estado', ['en_espera', 'en_proceso'])` por
   `.or('estado.eq.en_espera,and(estado.eq.en_proceso,confirmacion_trabajador.eq.false)')`.
   Verificar: una solicitud `en_proceso` con `confirmacion_trabajador=true`
   y `confirmacion_tecnico=false` deja de ser `solicitudActiva` para ese
   trabajador.

4. **Simplificar el panel del trabajador (`app/trabajador/panel.tsx`).**
   - `CardResolucion` / `PantallaSeguimiento`: quitar la prop
     `confirmacionTrabajador` y el branch "Confirmaste que fue resuelto.
     Esperando confirmación del técnico."; el formulario "Resuelto / No
     resuelto" se muestra siempre que la tarjeta esté visible (lo cual,
     tras el paso 3, implica `confirmacion_trabajador=false`).
   - `app/trabajador/page.tsx`: quitar `confirmacion_trabajador` del
     `select` y del tipo `Solicitud` si queda sin uso.
   Verificar: tras pulsar "Resuelto" sin que el técnico haya confirmado, el
   panel del trabajador vuelve directo al formulario "Nueva Solicitud".

5. **Reescribir `app/jefe/actions.ts`.**
   - Eliminar `toggleConfirmacionJefe` y `forzarEstado`.
   - `marcarSolucionado({ solicitudId })`: con `createAdminClient()`, leer
     `estado, confirmacion_trabajador, confirmacion_tecnico`; si
     `estado !== 'en_proceso'` o ambas confirmaciones son `false` →
     `{ error: ... }`; si no, `update { confirmacion_trabajador: true,
     confirmacion_tecnico: true, estado: 'solucionado' }`.
   - `marcarTodosSolucionados()`: con `createAdminClient()`,
     `update { confirmacion_trabajador: true, confirmacion_tecnico: true,
     estado: 'solucionado' }` con `.eq('estado','en_proceso')
     .or('confirmacion_trabajador.eq.true,confirmacion_tecnico.eq.true')`.
   - `cancelarSolicitudJefe({ solicitudId })`: con `createAdminClient()`,
     `update { estado: 'cancelado' }` con `.eq('id', solicitudId)
     .eq('estado','en_espera')`.
   Verificar: cada acción aplica el cambio correcto en DB y respeta sus
   condiciones (no actúa sobre filas que no cumplen).

6. **Actualizar `app/jefe/solicitudes/page.tsx`.**
   Cuando `estadoFiltro === 'en_proceso'`, ejecutar en paralelo (junto a las
   consultas existentes) el conteo de solicitudes `en_proceso` con al menos
   una confirmación `true`. Pasar ese conteo (`0` si el filtro no es
   `en_proceso`) como prop a `TablaSolicitudes`.
   Verificar: con `?estado=en_proceso`, el conteo refleja correctamente las
   filas con al menos una confirmación `true`.

7. **Reescribir `app/jefe/tabla-solicitudes.tsx`.**
   - Quitar los botones "Trab. ✓→✗" / "Téc. ✓→✗" — "Conf. Trab." /
     "Conf. Téc." quedan como indicador puro (✓ verde / ✗ gris).
   - Columna "Acciones", según `estado`:
     - `en_espera` → botón "Cancelar" → abre modal ("¿Cancelar esta
       solicitud?") → al confirmar, llama a `cancelarSolicitudJefe` y
       `router.refresh()`.
     - `en_proceso` → botón "Marcar Solucionado", `disabled` si
       `!confirmacion_trabajador && !confirmacion_tecnico` → al pulsarlo
       (sin modal) llama a `marcarSolucionado` y `router.refresh()`.
     - otros estados → sin botón.
   - Encabezado de la tabla: si `estadoFiltro === 'en_proceso'` y el conteo
     del paso 6 es `> 0`, mostrar el botón "Marcar todos como Solucionado"
     junto al filtro → abre modal ("Se marcarán {N} solicitudes como
     Solucionado. ¿Continuar?") → al confirmar, llama a
     `marcarTodosSolucionados` y `router.refresh()`.
   - El modal de confirmación puede implementarse con el `Dialog` de
     shadcn/ui (ya disponible en el proyecto) o un overlay simple con
     Tailwind.
   Verificar: cada botón aparece solo en el estado correspondiente, respeta
   su condición de habilitado/deshabilitado, y "Cancelar" / "Marcar todos"
   piden confirmación antes de ejecutar.

8. **Verificación final.**
   `npm run build` y `npm run lint` sin errores. Probar el flujo completo:
   - Técnico confirma primero → queda `disponible` de inmediato y puede
     atender otra solicitud; cuando el trabajador confirma después, pasa a
     `solucionado` sin acción extra del técnico.
   - Trabajador confirma primero → vuelve al formulario "Nueva Solicitud" de
     inmediato; cuando el técnico confirma después, pasa a `solucionado`.
   - Jefe: "Cancelar" (con modal) en una fila `en_espera`; "Marcar
     Solucionado" en una fila `en_proceso` con una sola confirmación;
     "Marcar todos como Solucionado" (con modal) cuando el filtro = "En
     Proceso" y hay varias filas con al menos una confirmación.

## Criterios de aceptación

### Confirmación del técnico
- [ ] Al pulsar "Resuelto" con `confirmacion_trabajador = false`, se guarda
      `confirmacion_tecnico = true`, `estado` sigue `en_proceso`, y
      `technician_status` pasa a `estado='disponible'`,
      `atendiendo_solicitud_id=null`.
- [ ] Al pulsar "Resuelto" con `confirmacion_trabajador = true`, `estado`
      pasa a `solucionado` y `technician_status` también pasa a
      `disponible` / `atendiendo_solicitud_id=null`.
- [ ] Tras confirmar, la tarjeta "Atendiendo ahora" desaparece del panel del
      técnico y vuelve a mostrarse "Cola de Espera".
- [ ] El mensaje "Confirmaste que fue resuelto. Esperando confirmación del
      trabajador." ya no aparece en ningún caso.
- [ ] El botón "Liberar" sigue funcionando sin cambios para solicitudes no
      resueltas.

### Confirmación del trabajador
- [ ] Al pulsar "Resuelto" con `confirmacion_tecnico = false`, se guarda
      `confirmacion_trabajador = true`, `estado` sigue `en_proceso`, y el
      panel vuelve directo al formulario "Nueva Solicitud".
- [ ] Al pulsar "Resuelto" con `confirmacion_tecnico = true`, `estado` pasa a
      `solucionado` y el panel también vuelve al formulario "Nueva
      Solicitud".
- [ ] El mensaje "Confirmaste que fue resuelto. Esperando confirmación del
      técnico." ya no aparece en ningún caso.
- [ ] "No resuelto" sigue cerrando la solicitud de inmediato como
      `no_solucionado`, sin importar `confirmacion_tecnico`.

### Flujo combinado (doble confirmación)
- [ ] Si el técnico confirma primero y luego el trabajador confirma,
      `estado` termina en `solucionado`.
- [ ] Si el trabajador confirma primero y luego el técnico confirma,
      `estado` termina en `solucionado`.
- [ ] En ambos casos, quien confirma segundo no necesita ninguna acción
      adicional — el cambio a `solucionado` es automático.

### Tabla del jefe — indicadores y acciones
- [ ] Las columnas "Conf. Trab." y "Conf. Téc." muestran ✓/✗ sin botones de
      toggle.
- [ ] En filas `en_espera` aparece el botón "Cancelar"; al pulsarlo se abre
      un modal de confirmación; al confirmar, `estado → 'cancelado'`.
- [ ] En filas `en_proceso` con ambas confirmaciones en `false`, el botón
      "Marcar Solucionado" aparece deshabilitado.
- [ ] En filas `en_proceso` con al menos una confirmación en `true`, el
      botón "Marcar Solucionado" está habilitado; al pulsarlo, ambas
      confirmaciones pasan a `true` y `estado → 'solucionado'`.
- [ ] En filas `solucionado`, `no_solucionado` o `cancelado` no aparece
      ningún botón de acción.
- [ ] Ya no existe ninguna forma de marcar `no_solucionado` manualmente
      desde la tabla del jefe.

### Acción masiva "Marcar todos como Solucionado"
- [ ] El botón solo aparece cuando el filtro de la tabla = "En Proceso".
- [ ] El botón no aparece si no hay ninguna solicitud `en_proceso` con al
      menos una confirmación en `true`.
- [ ] Al pulsarlo, se abre un modal mostrando la cantidad de solicitudes que
      se van a marcar como solucionadas.
- [ ] Al confirmar, TODAS las solicitudes `en_proceso` con al menos una
      confirmación en `true` (en toda la base, no solo la página visible)
      pasan a `solucionado` con ambas confirmaciones en `true`.
- [ ] Las solicitudes `en_proceso` con ambas confirmaciones en `false` no se
      modifican.

### General
- [ ] `npm run build` y `npm run lint` pasan sin errores.

## Decisiones

- **Sí:** la regla `solucionado` requiere ambas confirmaciones
  (`confirmacion_trabajador = true` y `confirmacion_tecnico = true`) se
  mantiene sin cambios respecto a SPEC 08. Lo que cambia es la experiencia
  de quien confirma primero, no la condición de cierre.

- **Sí:** el técnico se libera automáticamente
  (`technician_status.estado = 'disponible'`,
  `atendiendo_solicitud_id = null`) al confirmar "Resuelto", sin usar
  "Liberar". Así puede atender otra solicitud de inmediato sin quedar
  bloqueado esperando la confirmación del trabajador.

- **Sí:** el trabajador vuelve al formulario "Nueva Solicitud" al confirmar
  "Resuelto", aunque la solicitud siga `en_proceso` en segundo plano
  esperando al técnico. Evita que el trabajador quede "atrapado" en una
  pantalla de espera sin nada que hacer.

- **Sí:** se eliminan los mensajes "Esperando confirmación de...". Ya no
  existe un estado de espera visible para ninguna de las dos partes; el
  cierre a `solucionado` ocurre de forma silenciosa cuando confirma la
  segunda parte.

- **Sí:** la tabla del jefe usa un solo botón contextual por fila según
  `estado` (Cancelar / Marcar Solucionado / sin botón), en lugar de toggles
  + "Forzar ✓" / "Forzar ✗". Más intuitivo para el jefe.

- **Sí:** se elimina la capacidad de marcar `no_solucionado` manualmente
  desde la tabla del jefe. Con el nuevo flujo ninguna de las partes queda
  bloqueada, y "Marcar Solucionado" cubre el caso de que una de las dos se
  olvide de confirmar.

- **Sí:** "Marcar Solucionado" (individual) requiere al menos una
  confirmación en `true` — existe específicamente para resolver el caso
  "una de las partes se olvidó de confirmar".

- **Sí:** "Marcar todos como Solucionado" (masivo) solo aparece con el
  filtro "En Proceso", aplica a toda la base (no solo la página visible) y
  pide confirmación mostrando el conteo previo — evita cambios masivos
  accidentales.

- **Sí:** "Cancelar" (en_espera) pide confirmación con modal — cierra una
  solicitud antes de ser atendida, es una acción que conviene confirmar.

- **Sí:** "Marcar Solucionado" individual NO pide modal de confirmación —
  acción de bajo impacto sobre una sola fila, igual que el "Forzar ✓"
  anterior.

- **No:** pasar a `solucionado` con una sola confirmación (primera idea
  discutida). El usuario aclaró que la doble confirmación interna debe
  mantenerse; lo que se corrige es la experiencia de espera, no la regla de
  cierre.

- **No:** mantener los mensajes "Esperando confirmación de..." — se
  reemplazan por el regreso directo a la vista normal de cada rol.

- **No:** mantener "Forzar No Solucionado" — ya no es necesario dado que
  "Marcar Solucionado" cubre el caso de olvido y ninguna de las partes queda
  bloqueada.

## Riesgos

| Riesgo | Mitigación |
|--------|-----------|
| **Solicitud "invisible" para el trabajador.** Tras confirmar primero, el trabajador puede crear una nueva solicitud mientras la anterior sigue `en_proceso` (`confirmacion_trabajador=true`, `confirmacion_tecnico=false`) sin aparecer en su panel. | El jefe sigue viendo esa solicitud en su tabla con `Conf. Trab.=✓ / Conf. Téc.=✗`, y puede usar "Marcar Solucionado" si el técnico nunca confirma. |
| **Falla parcial en `confirmarResolucionTecnico`.** Si el `update` a `solicitudes` tiene éxito pero el `update` a `technician_status` falla, el técnico queda `atendiendo` una solicitud que ya tiene `confirmacion_tecnico=true`. | Reintentar "Resuelto" es idempotente: vuelve a calcular `confirmacion_tecnico=true` (sin efecto adicional) y reintenta el `update` de `technician_status`. |
| **Alcance del botón masivo.** "Marcar todos como Solucionado" actualiza TODAS las solicitudes `en_proceso` con ≥1 confirmación en `true` en toda la base, no solo la página visible — podría sorprender al jefe si filtra por página. | El modal de confirmación muestra el conteo total antes de ejecutar, calculado con la misma condición del `UPDATE`. |
