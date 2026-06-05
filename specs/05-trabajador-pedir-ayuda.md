# SPEC 05 — Trabajador: pedir y seguir ayuda

> **Estado:** Implementado · **Depende de:** SPEC 02, SPEC 03, SPEC 04 · **Fecha:** 2026-06-05
> **Objetivo:** Que el trabajador pueda crear una solicitud de soporte, seguir
> su estado y posición en la cola, cancelarla y confirmar su resolución.

## Scope

**In:**

- Layout del panel del trabajador: header ("Soporte Municipal" + avatar con
  `username` + menú hamburguesa como placeholder sin funcionalidad) y barra de
  navegación inferior ("Inicio" activo, "Perfil" como placeholder visible).
- Pantalla inicial (sin solicitud activa): formulario "Nueva Solicitud" con
  campos área (dropdown de `areas`), tipo de ayuda (select Presencial/Virtual),
  título (texto) y descripción (textarea); botón "Enviar Solicitud".
- Pantalla de seguimiento (solicitud activa):
  - Card "Estado de Solicitud" con badge de estado y botón "Cancelar ayuda".
  - Card de posición en cola — "Hay N personas esperando antes que tú" —
    visible solo cuando el estado es `en_espera`.
  - Card "¿Se ha resuelto el problema?" con dropdown "¿Quién te ayudó?"
    (pre-seleccionado con el `tecnico_id` asignado, editable) y botones
    "Resuelto" / "No resuelto" — visible solo cuando el estado es `en_proceso`.
- Refresco automático cada 3 minutos + botón de refresco manual; etiqueta
  "actualizado hace X".
- Función RPC de Postgres `get_posicion_en_cola(solicitud_id uuid)` con
  `SECURITY DEFINER` para calcular la posición sin romper el RLS del trabajador.
- Restricción: solo una solicitud activa (`en_espera` o `en_proceso`) por
  trabajador — mientras exista una, el formulario no aparece.

**Fuera de alcance (specs posteriores):**

- Funcionalidad del menú hamburguesa y pantalla de Perfil.
- Vista del técnico (SPEC 06) y panel del jefe (SPEC 07).
- Historial de solicitudes cerradas — SPEC 08.
- Notificaciones push/campana — SPEC 09.
- Tiempo real con Supabase Realtime — SPEC 10.

## Modelo de datos

Este spec no introduce tablas nuevas. Usa las de SPEC 02 y añade un valor
al enum y una función RPC.

### Migración: nuevo valor en `solicitud_estado`

El enum actual (`en_espera`, `en_proceso`, `solucionado`, `no_solucionado`)
no tiene un estado para cancelaciones. Este spec añade:

```sql
alter type solicitud_estado add value 'cancelado';
```

### Función RPC `get_posicion_en_cola`

El RLS del trabajador solo le permite ver sus propias solicitudes, por lo que
no puede contar cuántas hay delante de la suya. Esta función resuelve eso:

```sql
create or replace function get_posicion_en_cola(p_solicitud_id uuid)
returns integer
language sql
security definer
set search_path = public
as $$
  select count(*)::integer
  from solicitudes
  where estado = 'en_espera'
    and created_at < (
      select created_at from solicitudes where id = p_solicitud_id
    );
$$;
```

`SECURITY DEFINER` hace que la función se ejecute con los permisos del
propietario (service role), no del usuario que la llama. Solo devuelve un
entero — no expone filas ajenas.

### Consultas principales

| Propósito                        | Query                                                                                                          |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Solicitud activa del trabajador  | `SELECT * FROM solicitudes WHERE trabajador_id = auth.uid() AND estado IN ('en_espera', 'en_proceso') LIMIT 1` |
| Áreas para el dropdown           | `SELECT id, nombre FROM areas ORDER BY nombre`                                                                 |
| Técnicos para "¿Quién te ayudó?" | `SELECT id, username FROM profiles WHERE rol = 'tecnico' ORDER BY username`                                    |
| Posición en cola                 | `SELECT get_posicion_en_cola(solicitud_id)`                                                                    |

### Transiciones de estado del lado del trabajador

| Acción                  | Estado anterior | Estado nuevo     |
| ----------------------- | --------------- | ---------------- |
| Enviar solicitud        | —               | `en_espera`      |
| Cancelar ayuda          | `en_espera`     | `cancelado`      |
| Confirmar "Resuelto"    | `en_proceso`    | `solucionado`    |
| Confirmar "No resuelto" | `en_proceso`    | `no_solucionado` |

## Plan de implementación

1. **Migración SQL.**
   Crear `supabase/migrations/YYYYMMDDHHMMSS_trabajador_panel.sql` con:
   - `alter type solicitud_estado add value 'cancelado'`.
   - Función `get_posicion_en_cola(p_solicitud_id uuid)` con `SECURITY DEFINER`.
     Verificar: `npx supabase db push` aplica sin errores; el enum y la función
     aparecen en Dashboard.

2. **Server Actions (`app/trabajador/actions.ts`).**
   Cuatro acciones con `'use server'`:
   - `crearSolicitud(formData)` — INSERT en `solicitudes`.
   - `cancelarSolicitud(id)` — UPDATE estado → `cancelado`.
   - `confirmarResolucion(id, tecnicoId, resultado)` — UPDATE estado →
     `solucionado` o `no_solucionado`, escribe `tecnico_id`.
     Verificar: cada acción ejecuta la query correcta y el estado cambia en DB.

3. **`app/trabajador/page.tsx` — Server Component con datos iniciales.**
   Consultar en paralelo: `profiles` del usuario (username), solicitud activa
   (`estado IN ('en_espera','en_proceso')`), lista de `areas`.
   Si hay solicitud activa, consultar también `get_posicion_en_cola` y la lista
   de técnicos (`profiles WHERE rol = 'tecnico'`).
   Pasar todos los datos como props al componente cliente `TrabajadorPanel`.
   Verificar: la página carga sin errores; los datos llegan como props.

4. **Layout del panel (`app/trabajador/panel.tsx` — Client Component).**
   Header con título "Soporte Municipal", avatar circular con inicial del
   `username`, menú hamburguesa (ícono, sin funcionalidad). Barra inferior
   con tabs "Inicio" (activo) y "Perfil" (placeholder). Saludo
   "Bienvenido, {username}" encima del contenido.
   Verificar: el layout se muestra correctamente; "Perfil" no hace nada al clic.

5. **Formulario "Nueva Solicitud".**
   Visible solo si no hay solicitud activa. Dropdown de `areas` con las filas
   de la tabla, select Presencial/Virtual, campo título, textarea descripción,
   botón "Enviar Solicitud" que llama a `crearSolicitud`.
   Tras éxito: `router.refresh()` para recargar los datos del servidor.
   Verificar: enviar el formulario crea la solicitud en DB y el panel pasa
   a mostrar la pantalla de seguimiento.

6. **Card "Estado de Solicitud" + botón Cancelar.**
   Visible si hay solicitud activa. Muestra el badge de estado y el botón
   "Cancelar ayuda" (solo activo si estado = `en_espera`). El botón llama a
   `cancelarSolicitud(id)` y hace `router.refresh()`.
   Verificar: cancelar cambia el estado a `cancelado` y el panel vuelve al
   formulario.

7. **Card posición en cola.**
   Visible solo si estado = `en_espera`. Muestra "Hay N personas esperando
   antes que tú" usando el resultado de `get_posicion_en_cola`.
   Verificar: con varias solicitudes en DB, el número refleja correctamente
   las que están delante.

8. **Card "¿Se ha resuelto el problema?".**
   Visible solo si estado = `en_proceso`. Dropdown "¿Quién te ayudó?" con todos
   los técnicos (`profiles WHERE rol = 'tecnico'`), pre-seleccionado con el
   `tecnico_id` de la solicitud si existe. Botones "Resuelto" y "No resuelto"
   que llaman a `confirmarResolucion` y hacen `router.refresh()`.
   Verificar: confirmar "Resuelto" cambia estado a `solucionado`; "No resuelto"
   a `no_solucionado`; en ambos casos el panel vuelve al formulario.

9. **Polling cada 3 minutos + refresco manual + etiqueta "actualizado hace X".**
   En `TrabajadorPanel`: `useEffect` con `setInterval(router.refresh, 180_000)`.
   Pausar el intervalo mientras algún campo del formulario tenga foco; reanudar
   al perder el foco. Botón de refresco manual que llama a `router.refresh()`
   directamente. Estado local `lastRefreshed: Date` actualizado en cada refresh;
   mostrar "actualizado hace X" calculado en tiempo real con otro intervalo de 1 s.
   Verificar: el panel se refresca solo cada 3 minutos; el botón manual
   refresca al instante; la etiqueta muestra el tiempo correctamente.

## Criterios de aceptación

- [ ] Sin solicitud activa, el trabajador ve el formulario "Nueva Solicitud"
      con dropdown de áreas, select de tipo de ayuda, título y descripción.
- [ ] Enviar el formulario con todos los campos rellenos crea una solicitud
      en `en_espera` y muestra la pantalla de seguimiento.
- [ ] Enviar el formulario con algún campo obligatorio vacío muestra un error
      y no crea la solicitud.
- [ ] Con una solicitud activa, el formulario no aparece; aparece la card
      "Estado de Solicitud" con el badge de estado correcto.
- [ ] El botón "Cancelar ayuda" está visible cuando el estado es `en_espera`
      y cambia el estado a `cancelado`; tras cancelar, el panel vuelve al
      formulario.
- [ ] La card de posición en cola ("Hay N personas esperando antes que tú")
      es visible solo cuando el estado es `en_espera` y el número es correcto
      (verificable insertando solicitudes de prueba en DB).
- [ ] La card "¿Se ha resuelto el problema?" es visible solo cuando el estado
      es `en_proceso` y está oculta cuando el estado es `en_espera`.
- [ ] El dropdown "¿Quién te ayudó?" muestra todos los técnicos; si la
      solicitud tiene `tecnico_id` asignado, viene pre-seleccionado.
- [ ] "Resuelto" cambia el estado a `solucionado` y guarda el `tecnico_id`
      seleccionado; el panel vuelve al formulario.
- [ ] "No resuelto" cambia el estado a `no_solucionado` y guarda el
      `tecnico_id` seleccionado; el panel vuelve al formulario.
- [ ] La etiqueta "actualizado hace X" se actualiza cada segundo.
- [ ] El panel se refresca automáticamente cada 3 minutos.
- [ ] El botón de refresco manual actualiza los datos al instante.
- [ ] El header muestra "Soporte Municipal", el avatar con la inicial del
      `username` y el menú hamburguesa (sin funcionalidad).
- [ ] La barra inferior muestra "Inicio" (activo) y "Perfil" (placeholder
      sin funcionalidad).
- [ ] `npm run build` y `npm run lint` pasan sin errores.

## Decisiones

- **Sí:** dropdown para "Área" en lugar de texto libre. Evita errores de
  escritura y mantiene consistencia con la tabla `areas` normalizada del
  SPEC 02.

- **Sí:** función RPC `get_posicion_en_cola` con `SECURITY DEFINER`. Permite
  contar solicitudes ajenas sin romper el RLS del trabajador ni exponer la
  `service_role` key en el código de la app.

- **Sí:** añadir `cancelado` al enum `solicitud_estado`. La cancelación es
  un resultado distinto a "no solucionado" y merece su propio estado para
  distinguirlos en métricas y en el panel del jefe.

- **Sí:** solo una solicitud activa por trabajador. Simplifica la UI y el
  flujo; múltiples solicitudes simultáneas se pueden añadir en un spec
  posterior si surge la necesidad.

- **Sí:** bloque "¿Se ha resuelto?" visible solo en `en_proceso`. Pedir
  confirmación en `en_espera` no tiene sentido porque ningún técnico ha
  intervenido aún.

- **Sí:** dropdown "¿Quién te ayudó?" pre-seleccionado con el `tecnico_id`
  asignado pero editable. Cubre el caso real de que un técnico diferente al
  asignado sea quien efectivamente ayudó.

- **Sí:** polling cada 3 minutos + refresco manual vía `router.refresh()`.
  Es suficiente para el MVP sin la complejidad de Supabase Realtime; el
  trabajador puede forzar el refresco si necesita ver el estado más rápido.

- **Sí:** layout (header + nav) incluido en este spec. Es la primera pantalla
  real del trabajador; tenerlo aquí da contexto visual para SPEC 06 y 07.

- **No:** pantalla de Perfil. No hay campos de perfil definidos más allá de
  lo que SPEC 04 ya cubre; se añade en un spec de edición de perfil posterior.

- **No:** historial de solicitudes cerradas. Va en SPEC 08 junto con la
  exportación y los filtros del jefe.

## Riesgos

| Riesgo                                                                                                                                                                                              | Mitigación                                                                                                                                                                                                           |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `alter type solicitud_estado add value 'cancelado'` no puede ejecutarse dentro de una transacción en Postgres; `supabase db push` puede fallar si envuelve la migración en un bloque transaccional. | Escribir el `ALTER TYPE` en una migración separada de los demás DDL, o añadir `-- no transaction` al inicio del archivo si la versión de Supabase CLI lo soporta. Verificar en un push de prueba antes de continuar. |
| `router.refresh()` en el polling borra el estado local del formulario si el trabajador lo estaba llenando en ese momento.                                                                           | En `TrabajadorPanel`, pausar el intervalo mientras algún campo del formulario tenga foco (`document.activeElement` dentro del form); reanudar al perder el foco.                                                     |
| El dropdown "¿Quién te ayudó?" puede quedar sin pre-selección si la solicitud llega a `en_proceso` sin `tecnico_id` asignado (bug en SPEC 06).                                                      | Mostrar la opción vacía "— Selecciona un técnico —" y marcar el campo como requerido antes de confirmar la resolución.                                                                                               |
| Los valores del enum no se pueden eliminar en Postgres una vez añadidos; si `cancelado` necesita renombrarse en el futuro, requiere una migración compleja.                                         | Documentado como decisión cerrada; el nombre `cancelado` es suficientemente claro para el dominio.                                                                                                                   |

## Lo que **no** está en este spec

- Pantalla de Perfil y funcionalidad del menú hamburguesa — spec posterior.
- Historial de solicitudes cerradas y exportación — SPEC 08.
- Vista del técnico (cola y atención) — SPEC 06.
- Panel del jefe (KPIs, supervisión) — SPEC 07.
- Notificaciones push/campana — SPEC 09.
- Tiempo real con Supabase Realtime — SPEC 10.
- Múltiples solicitudes activas simultáneas — no contemplado en el MVP.
- Edición de una solicitud ya enviada — el trabajador solo puede cancelarla.

Cada uno de esos puntos, si se incorpora, va en su propio spec.
