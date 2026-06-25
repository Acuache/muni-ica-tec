# SPEC 15 — Ajustes de flujo: espera del trabajador, tipo de ayuda editable y horario de atención

> **Estado:** Implementado · **Depende de:** SPEC 05 (flujo del trabajador), SPEC 06 (cola y atención del técnico), SPEC 07c (card de resolución que hoy muestra el técnico), SPEC 07g (AnyDesk + tipo de ayuda en la tarjeta del técnico) · **Fecha:** 2026-06-25
> **Objetivo:** Aplicar tres ajustes al flujo trabajador↔técnico — (1) ocultar el nombre del técnico al trabajador y avisar un tiempo de espera de máximo 20 min; (2) permitir al técnico cambiar el tipo de ayuda (presencial↔virtual) mientras atiende, pidiendo al trabajador su código AnyDesk con un modal obligatorio al pasar a virtual; y (3) mostrar el horario de atención (Lun–Vie 8:00–14:30) dejando la cola viva al día siguiente y dando al técnico un botón para dejar un caso para mañana.

## Alcance

**Dentro:**

**Cambio 1 — Card de atención del trabajador**

- En `CardResolucion` (`app/trabajador/panel.tsx`), quitar "El caso fue tomado por el técnico {nombre}" y mostrar en su lugar un aviso fijo de dos líneas: **"Un técnico ya está atendiendo tu caso."** + **"Tiempo de atención: máximo 20 minutos."** Solo en estado `en_proceso`; texto fijo (sin contador).
- Quitar la consulta del `username` del técnico y la prop `tecnicoNombre` del lado del trabajador (`app/trabajador/page.tsx` y el hilo de props en `panel.tsx`).
- El **panel del jefe no cambia**: sigue viendo qué técnico tomó cada caso.

**Cambio 2 — Técnico cambia tipo de ayuda + AnyDesk del trabajador**

- En la card **"Solicitud activa"** del técnico, un control para cambiar `tipo_ayuda` **presencial↔virtual** (bidireccional) mientras el caso está `en_proceso`. Nueva Server Action `cambiarTipoAyuda`.
- Al pasar a **virtual sin código** (`anydesk_code` null), el caso queda **"esperando código"**: la card del técnico lo indica y el caso **se aparta de la cola tomable** (nadie puede "Atender ahora").
- El trabajador, en su próximo refresco, ve un **modal obligatorio** para ingresar el código AnyDesk (validación: solo números; sin botón de cerrar). Nueva Server Action `registrarAnydeskCode`. El modal se dispara siempre que su solicitud activa cumpla `tipo_ayuda = 'virtual'` ∧ `anydesk_code` null (tanto en `en_espera` como en `en_proceso`).
- Al pasar a **presencial**, se limpia `anydesk_code`.
- El técnico puede **"Liberar"** (existente) y tomar otro caso; el caso liberado vuelve a la cola **en su posición por antigüedad, nunca al final**. Mientras siga virtual+sin código, no es tomable.
- Cuando el trabajador **envía el código**, el caso vuelve a ser tomable en su posición por antigüedad; **cualquier técnico libre** lo toma con "Atender ahora" (sin reserva, sin auto-asignación).

**Cambio 3 — Horario de atención**

- Nuevo `lib/horario.ts` con el horario **fijo en código**: **Lun–Vie 08:00–14:30, America/Lima**, y utilidades `estaEnHorario(fecha)` / `proximaApertura(fecha)`.
- El Server Component del trabajador calcula dentro/fuera de horario y lo pasa al cliente. **Fuera de horario no se desactiva nada**; el panel muestra un aviso: *"Fuera del horario de atención (Lun–Vie 8:00–14:30). Tu solicitud será atendida el próximo día hábil a las 8:00."*
- La **cola persiste**: las solicitudes no expiran; **nada automático ocurre a las 14:30**.
- Botón **"Dejar para mañana"** en la card de solicitud activa del técnico, que reutiliza `liberarSolicitud` (devuelve el caso a la cola por antigüedad). El técnico **puede terminar** un caso aunque pasen las 14:30; nada se libera solo.

**Fuera de alcance (specs posteriores):**

- **Cambios de esquema:** ninguno (no se crean/alteran tablas, columnas ni enums). **Excepción descubierta en implementación:** una migración mínima de **privilegios por columna** — `grant update (tipo_ayuda, anydesk_code) on solicitudes to authenticated` — necesaria porque SPEC 10 (H-29) había acotado el `UPDATE` de `solicitudes` por columna. El horario es solo código.
- **Panel del jefe:** sin cambios (sigue viendo el técnico asignado).
- **Realtime / polling acelerado:** se mantiene el polling actual (~3 min); el modal del trabajador llega en el próximo refresco.
- **Horario configurable** por el jefe, **feriados** y calendario especial: no (solo la ventana fija Lun–Vie).
- **Forzar el cierre del turno** del técnico a las 14:30 (cerrar sesión, bloquear acciones): no; el técnico gestiona su estado manualmente.
- **Contador en vivo** del "20 minutos": no (texto fijo).
- **Reservar** el caso convertido a un técnico específico: no (vuelve al pool).

## Modelo de datos

Este spec **no introduce ni modifica tablas, columnas ni enums**. Reutiliza `solicitudes.tipo_ayuda` (enum `ayuda_tipo`: `presencial`/`virtual`) y `solicitudes.anydesk_code` (`text` nullable, de SPEC 07g). Todo el comportamiento nuevo se deriva de combinar esos dos campos con el `estado`. El horario vive solo en código.

> **Privilegios (descubierto en implementación):** SPEC 10 (H-29) acotó el `UPDATE` de `solicitudes` por columna a `(estado, tecnico_id, confirmacion_trabajador, confirmacion_tecnico)`. `tipo_ayuda`/`anydesk_code` no estaban incluidas, así que `cambiarTipoAyuda`/`registrarAnydeskCode` fallaban con `42501` (permission denied). Se resuelve con la migración mínima `20260625170230_spec15_grant_update_tipo_anydesk.sql` (`grant update (tipo_ayuda, anydesk_code) on public.solicitudes to authenticated`). Las **filas** siguen acotadas por las políticas RLS existentes; el grant solo abre esas dos columnas. Mismo patrón que SPEC 13 con `profiles.subarea`.

### Estado derivado "esperando código" (no se persiste)

La situación "virtual sin código" **solo** puede existir cuando un técnico convierte un caso `presencial → virtual` (un pedido creado virtual ya trae código por SPEC 07g). Se identifica con: `tipo_ayuda = 'virtual' AND anydesk_code IS NULL`.

| `estado` | `tipo_ayuda` | `anydesk_code` | Significado | ¿Tomable en cola? | ¿Modal al trabajador? |
|----------|--------------|----------------|-------------|:---:|:---:|
| `en_espera` | `presencial` | null | Pedido presencial esperando | Sí | No |
| `en_espera` | `virtual` | seteado | Pedido virtual normal esperando | Sí | No |
| `en_espera` | `virtual` | **null** | Convertido a virtual y **liberado**, falta código | **No (apartado)** | **Sí** |
| `en_proceso` | `presencial` | null | Técnico atendiendo presencial | — | No |
| `en_proceso` | `virtual` | seteado | Técnico atendiendo virtual | — | No |
| `en_proceso` | `virtual` | **null** | Técnico convirtió a virtual, espera código | — | **Sí** |

- **Disparo del modal del trabajador:** solicitud activa ∧ `tipo_ayuda = 'virtual'` ∧ `anydesk_code IS NULL` (sirve para `en_espera` y `en_proceso`, así persiste tras "Liberar").
- **Filtro de la cola tomable y del conteo ESPERANDO:** `estado = 'en_espera' AND NOT (tipo_ayuda = 'virtual' AND anydesk_code IS NULL)`.

### Mutaciones nuevas

| Server Action | Archivo | Efecto (UPDATE condicional) |
|---------------|---------|------------------------------|
| `cambiarTipoAyuda(solicitudId, nuevoTipo)` | `app/tecnico/actions.ts` | `SET tipo_ayuda = nuevoTipo` (+ `anydesk_code = null` si pasa a `presencial`) `WHERE id = $1 AND tecnico_id = auth.uid() AND estado = 'en_proceso'` |
| `registrarAnydeskCode(solicitudId, code)` | `app/trabajador/actions.ts` | `SET anydesk_code = $code` `WHERE id = $1 AND trabajador_id = auth.uid() AND tipo_ayuda = 'virtual' AND anydesk_code IS NULL` |

Ambas revisan filas afectadas: 0 filas ⇒ "alguien cambió el estado, recarga" (mismo patrón optimista del resto de la app). El "Dejar para mañana" del técnico **reutiliza `liberarSolicitud`** (no es mutación nueva).

### Horario (constante en código)

```ts
// lib/horario.ts — zona America/Lima (UTC-5, sin DST)
const DIAS_HABILES = [1, 2, 3, 4, 5] // Lun–Vie
const HORA_INICIO = 8 * 60          // 08:00 en minutos
const HORA_FIN    = 14 * 60 + 30    // 14:30 en minutos
// estaEnHorario(fecha): boolean   — lee día/hora "pared" de Lima vía Intl/timeZone
// proximaApertura(fecha): Date    — próximo día hábil a las 08:00 (vie/sáb/dom → lunes)
```

Para no depender de la zona horaria del servidor, las partes (día de semana, hora, minuto) se leen con `Intl.DateTimeFormat`/`toLocaleString` usando `timeZone: 'America/Lima'`.

## Plan de implementación

> Antes de tocar código de Next (Server Actions, RSC→Client, modal), leer la guía relevante en `node_modules/next/dist/docs/` y el skill `next-best-practices` (mandato de `AGENTS.md`: este Next no es el conocido). Cada paso queda commiteable y deja la app corriendo.

1. **Cambio 1 — Card de atención sin nombre + aviso de espera.**
   - `app/trabajador/page.tsx`: quitar la consulta del `username` del técnico asignado; dejar de pasar `tecnicoNombre`.
   - `app/trabajador/panel.tsx`: en `CardResolucion`, reemplazar el párrafo del técnico por el aviso fijo de dos líneas; eliminar la prop `tecnicoNombre` de `Props`, `ContenidoTrabajador`, `PantallaSeguimiento`, `CardResolucion` y del comparador del `memo`.
   - *Verificar:* con un caso `en_proceso`, la card muestra el aviso y **ningún** nombre; `npm run build`/`lint` ok.

2. **`lib/horario.ts` (base del Cambio 3).**
   - Crear el módulo con la ventana Lun–Vie 08:00–14:30 (America/Lima) y `estaEnHorario` / `proximaApertura`.
   - *Verificar* (con fechas fijas): miércoles 10:00 → dentro; miércoles 15:00 → fuera, próxima apertura jueves 08:00; viernes 15:00 y sábado → lunes 08:00.

3. **Aviso de horario en el panel del trabajador (Cambio 3).**
   - `app/trabajador/page.tsx`: calcular `fueraDeHorario` y el texto de `proximaApertura` con la hora del servidor; pasarlos como props.
   - `app/trabajador/panel.tsx`: si `fueraDeHorario`, mostrar el aviso (encima del formulario y en la pantalla de seguimiento). **No desactivar nada.**
   - *Verificar:* simulando fuera de horario, aparece el aviso con el día/hora correctos y el formulario sigue usable.

4. **Server Action `cambiarTipoAyuda` (Cambio 2, backend).**
   - `app/tecnico/actions.ts`: `autorizar(['tecnico'])` → UPDATE condicional (id + `tecnico_id = auth.uid()` + `estado = 'en_proceso'`); al pasar a `presencial`, `anydesk_code = null`. Revisar filas afectadas.
   - *Verificar:* el técnico dueño cambia el tipo; `→ presencial` limpia el código; otro técnico no puede.

5. **Server Action `registrarAnydeskCode` + modal obligatorio del trabajador (Cambio 2).**
   - `app/trabajador/actions.ts`: validación solo-dígitos (reusar `lib/validacion.ts`) + UPDATE condicional.
   - `app/trabajador/panel.tsx`: cuando la solicitud activa cumpla `virtual` ∧ sin código, renderizar un **modal sin botón de cerrar** (solo input + "Enviar") por encima del contenido; tras enviar, `router.refresh()`.
   - *Verificar:* con un caso puesto a `virtual` sin código (por SQL), el modal aparece y **solo** se cierra al enviar un código numérico.

6. **Apartar de la cola los casos virtual-sin-código (Cambio 2).**
   - `app/tecnico/page.tsx`: añadir `AND NOT (tipo_ayuda = 'virtual' AND anydesk_code IS NULL)` a la query de la Cola de Espera **y** al conteo ESPERANDO.
   - *Verificar:* un caso `en_espera` virtual sin código **no** aparece ni se cuenta; al setear el código, reaparece en su posición por antigüedad.

7. **Control de tipo en la card "Solicitud activa" + estado "esperando código" (Cambio 2; expone la conversión).**
   - `app/tecnico/panel.tsx`: control presencial↔virtual que llama `cambiarTipoAyuda` + `router.refresh()`. Si el caso es `virtual` sin código, la card muestra "Esperando código AnyDesk del trabajador" (y conserva "Liberar").
   - *Verificar:* convertir a virtual muestra el aviso de espera; el trabajador (paso 5) recibe el modal en su siguiente refresco; al volver a presencial, el aviso y el modal desaparecen.

8. **Botón "Dejar para mañana" del técnico (Cambio 3).**
   - `app/tecnico/panel.tsx`: botón en la card de solicitud activa que llama a `liberarSolicitud` (existente) + `router.refresh()`, con su propia etiqueta/confirmación.
   - *Verificar:* el caso vuelve a la cola por antigüedad; nada ocurre solo a las 14:30; un técnico puede seguir atendiendo pasada la hora.

9. **Verificación final.** `npm run build` + `npm run lint`; recorrer los tres flujos de punta a punta.

## Criterios de aceptación

**Cambio 1**

- [x] Con un caso `en_proceso`, la card "¿Se ha resuelto el problema?" muestra "Un técnico ya está atendiendo tu caso." + "Tiempo de atención: máximo 20 minutos." y **no** muestra el nombre del técnico.
- [x] Los botones Resuelto / No resuelto siguen funcionando igual.
- [x] El panel del jefe sigue mostrando qué técnico tomó cada caso (sin cambios).
- [x] No quedan tipos/props/variables sin usar por la eliminación de `tecnicoNombre`.

**Cambio 2**

- [x] El técnico que atiende un caso puede cambiar su tipo presencial↔virtual desde la card "Solicitud activa".
- [x] Cambiar a `presencial` limpia `anydesk_code`.
- [x] Al convertir a virtual sin código, el trabajador ve un modal **obligatorio** (sin cerrar) en su siguiente refresco, que solo acepta números y solo se cierra al enviar.
- [x] Mientras es `virtual` sin código, el caso **no** aparece como tomable en la cola ni se cuenta en ESPERANDO.
- [x] El técnico puede "Liberar" un caso a la espera del código y tomar otro; el liberado vuelve a la cola **en su posición por antigüedad, no al final**.
- [x] El modal le sigue apareciendo al trabajador aunque el técnico haya liberado el caso.
- [x] Tras enviar el código, el caso es tomable de nuevo y **cualquier** técnico libre lo retoma con "Atender ahora".

**Cambio 3**

- [x] Fuera de Lun–Vie 08:00–14:30 (Lima), el panel del trabajador muestra el aviso de horario con el próximo día hábil correcto, **sin** desactivar el formulario.
- [x] Una solicitud creada fuera de horario entra a la cola y persiste hasta el día siguiente (no expira).
- [x] A las 14:30 **nada** se cancela ni libera automáticamente; un técnico puede terminar un caso ya tomado.
- [x] El técnico tiene un botón "Dejar para mañana" que devuelve el caso a la cola por antigüedad.

**General**

- [x] No se crearon ni alteraron tablas, columnas ni enums. Única migración: `grant update (tipo_ayuda, anydesk_code)` (privilegios por columna), exigida por el endurecimiento de SPEC 10 (H-29).
- [x] `npm run build` y `npm run lint` pasan sin errores.

## Decisiones

- **Sí:** consolidar los **tres cambios en un solo spec** (a pedido del usuario). Son ajustes acotados que comparten el mismo flujo trabajador↔técnico y no tocan el esquema; separarlos era más ceremonia que valor.
- **Sí:** ocultar el técnico **solo al trabajador**; el jefe lo sigue viendo. Responde a "que no salga solo para el trabajador" sin perder trazabilidad para supervisión.
- **Sí:** "20 minutos" como **texto fijo**, no contador. Es solo presentación; un contador exigiría guardar la marca de toma y lógica de tiempo en cliente, sin beneficio claro.
- **Sí:** tipo de ayuda **editable y bidireccional**, solo por el técnico dueño y solo `en_proceso`. Cubre el caso real (un presencial que se resuelve a distancia) y permite deshacer.
- **Sí:** modal **obligatorio** para el código. El caso ya es virtual; sin código el técnico no se conecta. **Escape:** si el trabajador no lo tiene, el técnico puede revertir a presencial, lo que retira el modal.
- **Sí:** apartar de la cola el caso **virtual-sin-código**. Evita que otro técnico lo tome sin poder conectarse; reaparece intacto al llegar el código.
- **Sí:** "Liberar" conserva la **antigüedad** (FIFO por `created_at`), así nunca cae al final. Reutiliza el mecanismo existente de SPEC 06; "Dejar para mañana" es ese mismo `liberarSolicitud`.
- **Sí:** **sin reserva** — el caso vuelve al pool y lo retoma cualquier técnico con "Atender ahora". Coincide con "el técnico se va con otro" y es más rápido para el trabajador.
- **Sí:** horario **fijo en código** (Lun–Vie 08:00–14:30, America/Lima) y **sin bloquear**: fuera de hora solo se avisa y la cola persiste. Es lo que pediste ("que no se desactive, la cola sigue al día siguiente").
- **Sí:** **nada automático** a las 14:30. Elimina el bug del caso a medio atender en el corte; la decisión queda en manos del técnico.
- **No:** Realtime / acelerar el polling; contador en vivo; reservar el caso a un técnico; horario configurable; feriados; forzar el cierre del turno; cancelar solicitudes al cierre. Cada uno, si se necesita, va en su propio spec.

## Riesgos

| Riesgo | Mitigación |
|--------|------------|
| El modal del trabajador llega en el próximo refresco (hasta ~3 min por el polling), no al instante. | El técnico ve "esperando código" y **no queda bloqueado**: puede liberar y tomar otro caso. Aceptable en el MVP; si molesta, acelerar el polling es un spec aparte. |
| El conteo **ESPERANDO** y la **lista** de la cola podrían desalinearse si solo uno excluye los casos apartados (mostrar "1 esperando" con cola vacía). | El paso 6 aplica el **mismo filtro** a ambos. Criterio de aceptación explícito. |
| `get_posicion_en_cola` (SPEC 05) podría seguir contando un caso apartado, inflando en 1 la posición de otros trabajadores. | Discrepancia **cosmética** y poco frecuente; el caso apartado es el del propio trabajador, que mientras tanto está en el modal. Alinear el RPC queda como mejora opcional posterior. |
| La hora del servidor podría no estar en zona de Lima y desviar el corte de horario. | `lib/horario.ts` lee las partes con `timeZone: 'America/Lima'` (no aritmética de offset manual). |
| La RLS/privilegios de `solicitudes` podrían impedir al trabajador escribir `anydesk_code` o al técnico `tipo_ayuda`. | **Confirmado en implementación:** la RLS *por fila* sí permite, pero SPEC 10 (H-29) acotó el `UPDATE` **por columna** (grants) y esas dos no estaban incluidas → `42501`. Resuelto con la migración mínima `grant update (tipo_ayuda, anydesk_code)` (ver Modelo de datos). Era, en efecto, el único punto que exigió una migración. |

## Lo que **no** está en este spec

- Cambios de esquema o migraciones (salvo el caso de RLS del cuadro de riesgos, si se confirmara).
- Cambios en el panel del jefe.
- Realtime o polling acelerado; contador en vivo del "20 minutos".
- Reserva del caso convertido a un técnico específico.
- Horario configurable, feriados o calendario especial; forzar el cierre del turno del técnico.
- Cancelación automática de solicitudes al cierre del día.

Cada uno de esos puntos, si se incorpora, va en su propio spec.
