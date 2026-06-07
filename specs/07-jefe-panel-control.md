# SPEC 07 — Jefe: panel de control

> **Estado:** Implementado · **Depende de:** SPEC 02, SPEC 03, SPEC 05, SPEC 06 · **Fecha:** 2026-06-07
> **Objetivo:** Que el jefe vea KPIs del sistema, la cola completa de solicitudes
> y el estado de cada técnico en tiempo real aparente (polling), en modo solo lectura.

## Scope

**In:**

- Layout del panel del jefe: header con icono hamburguesa, título "Panel de
  Control", icono de búsqueda y campana (ambos como placeholder sin
  funcionalidad); barra de navegación inferior con "Inicio" (activo) y "Perfil"
  (placeholder sin funcionalidad).
- Tres tarjetas KPI:
  1. **Esperando ayuda** — `COUNT(*) WHERE estado = 'en_espera'`.
  2. **Solucionados hoy** — `COUNT(*) WHERE estado = 'solucionado' AND
updated_at::date = CURRENT_DATE` + tasa de éxito calculada como
     `solucionados_hoy / (solucionados_hoy + no_solucionados_hoy) × 100 %`
     (si el denominador es 0, mostrar "—").
  3. **No solucionados** — `COUNT(*) WHERE estado = 'no_solucionado' AND
updated_at::date = CURRENT_DATE` + texto fijo "Requieren escalamiento".
- **Cola de Espera**: tabla con columnas Área, Problema (título) y Estado
  (badge "En Espera" / "En Proceso"); muestra todas las solicitudes con estado
  `en_espera` o `en_proceso`, ordenadas por `created_at` ASC.
- **Estado Técnicos**: una card por técnico con avatar circular (iniciales del
  `username`), nombre completo, badge de estado, etiqueta "Xm act." calculada
  desde `ultima_actualizacion`; debajo: icono de ubicación + `ubicacion`; y:
  - Si `estado = 'atendiendo'`: icono de persona + "Ayudando a: [username del
    trabajador]" (obtenido por JOIN solicitudes → profiles).
  - Cualquier otro estado: icono de reloj + "Último ticket: Hace Xm" (calculado
    desde `ultima_actualizacion`).
- Indicador "● En Vivo" junto al título "Estado Técnicos" (visual; el dato
  llega por polling, no por Supabase Realtime).
- Polling cada 3 minutos + botón de refresco manual + etiqueta
  "actualizado hace X" (igual que SPEC 05 y 06).
- Panel de solo lectura: ninguna acción del jefe modifica datos.

**Fuera de alcance (specs posteriores):**

- Historial Reciente con filtros y exportación — SPEC 08.
- Badge de prioridad "Urgente" — no contemplado en el MVP.
- Tendencia "+N desde la última hora" en KPIs — no contemplado en el MVP.
- Notificaciones (campana funcional) — SPEC 09.
- Supabase Realtime verdadero — SPEC 10.
- Pantalla de Perfil del jefe — spec posterior.
- Cualquier acción del jefe sobre solicitudes o técnicos — spec posterior.

## Modelo de datos

Este spec no introduce tablas ni enums nuevos. Usa `solicitudes`, `estado_tecnico`,
`areas` y `profiles` de SPEC 02.

### Consultas principales

| Propósito               | Query                                                                                                                                                                           |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| KPI Esperando           | `SELECT COUNT(*) FROM solicitudes WHERE estado = 'en_espera'`                                                                                                                   |
| KPI Solucionados hoy    | `SELECT COUNT(*) FROM solicitudes WHERE estado = 'solucionado' AND updated_at::date = CURRENT_DATE`                                                                             |
| KPI No solucionados hoy | `SELECT COUNT(*) FROM solicitudes WHERE estado = 'no_solucionado' AND updated_at::date = CURRENT_DATE`                                                                          |
| Cola completa           | `SELECT s.id, s.titulo, a.nombre AS area, s.estado FROM solicitudes s JOIN areas a ON s.area_id = a.id WHERE s.estado IN ('en_espera', 'en_proceso') ORDER BY s.created_at ASC` |
| Técnicos con detalle    | Ver abajo                                                                                                                                                                       |

### Consulta de técnicos

```sql
SELECT
  p.id,
  p.username,
  et.estado,
  et.ubicacion,
  et.ultima_actualizacion,
  sol.trabajador_id,
  pw.username AS trabajador_username
FROM estado_tecnico et
JOIN profiles p   ON et.tecnico_id   = p.id
LEFT JOIN solicitudes sol ON et.a_quien_ayuda = sol.id
LEFT JOIN profiles pw     ON sol.trabajador_id = pw.id
WHERE p.rol = 'tecnico'
ORDER BY p.username ASC
```

> `a_quien_ayuda` en `estado_tecnico` almacena el `id` de la solicitud activa
> (confirmado en SPEC 06). El JOIN con `solicitudes` y luego con `profiles`
> permite obtener el `username` del trabajador que está siendo atendido.

### Cálculo de tasa de éxito (en el cliente)

```ts
const tasa =
  solucionadosHoy + noSolucionadosHoy === 0
    ? "—"
    : `${Math.round((solucionadosHoy / (solucionadosHoy + noSolucionadosHoy)) * 100)} %`;
```

## Plan de implementación

1. **`app/jefe/page.tsx` — Server Component con datos iniciales.**
   Consultar en paralelo con `Promise.all`: KPI esperando, KPI solucionados hoy,
   KPI no solucionados hoy, cola completa (`en_espera` + `en_proceso`), lista de
   técnicos con detalle (JOIN descrito en el modelo de datos).
   Pasar todos los datos como props al componente cliente `JefePanel`.
   Verificar: la página carga sin errores; todos los datos llegan como props.

2. **Layout del panel (`app/jefe/panel.tsx` — Client Component).**
   Header con icono hamburguesa (sin funcionalidad), título "Panel de Control",
   icono de búsqueda (sin funcionalidad) y campana (sin funcionalidad). Barra
   inferior con "Inicio" (activo) y "Perfil" (placeholder sin funcionalidad).
   Verificar: el layout se muestra correctamente en mobile.

3. **Tres tarjetas KPI.**
   - "Esperando ayuda": número grande + icono de puntos suspensivos en rojo.
   - "Solucionados hoy": número + tasa de éxito calculada en cliente con el
     helper `calcularTasa(solucionados, noSolucionados)`.
   - "No solucionados": número + texto fijo "Requieren escalamiento".
     Verificar: los tres números coinciden con los conteos reales en DB.

4. **Tabla "Cola de Espera".**
   Columnas: Área, Problema (título), Estado (badge). Badge "En Espera" en gris
   azulado, "En Proceso" en azul, igual que el mockup. Ordenada por `created_at`
   ASC. Sin paginación en el MVP — se muestra la lista completa.
   Verificar: la tabla refleja exactamente las solicitudes `en_espera` y
   `en_proceso` en DB, en orden correcto.

5. **Bloque "Estado Técnicos".**
   Título + indicador "● En Vivo" (punto verde + texto, sin lógica especial).
   Una card por técnico con:
   - Avatar circular con las dos iniciales del `username` en color fijo por
     técnico (puede ser una paleta de colores asignada por índice).
   - Nombre (`username`), badge de estado (ATENDIENDO en azul, DISPONIBLE en
     verde, EN OFICINA / VIRTUAL / DESCANSO en gris).
   - Etiqueta "Xm act." en la esquina superior derecha, calculada desde
     `ultima_actualizacion` en tiempo real con un `setInterval` de 1 s.
   - Icono de ubicación + texto de `ubicacion`.
   - Si `estado = 'atendiendo'`: icono de persona + "Ayudando a:
     {trabajador_username}".
   - Cualquier otro estado: icono de reloj + "Último ticket: Hace Xm" calculado
     desde `ultima_actualizacion`.
     Verificar: las cards muestran datos correctos; el tiempo "Xm act." avanza
     cada segundo; si un técnico pasa a `atendiendo`, el dato aparece tras el
     siguiente refresco.

6. **Polling cada 3 minutos + refresco manual + etiqueta "actualizado hace X".**
   Mismo esquema que SPEC 05 y 06: `useEffect` con `setInterval(router.refresh,
180_000)`; botón de refresco manual; estado local `lastRefreshed: Date`
   actualizado en cada refresh; etiqueta calculada cada segundo.
   Verificar: el panel se refresca solo cada 3 minutos; el botón manual refresca
   al instante; la etiqueta muestra el tiempo correctamente.

## Criterios de aceptación

- [ ] El panel carga sin errores para un usuario con rol `jefe`.
- [ ] El header muestra el icono hamburguesa, el título "Panel de Control",
      el icono de búsqueda y la campana; los tres íconos sin funcionalidad.
- [ ] La barra inferior muestra "Inicio" (activo) y "Perfil" (placeholder sin
      funcionalidad).
- [ ] La tarjeta "Esperando ayuda" muestra el total de solicitudes `en_espera`.
- [ ] La tarjeta "Solucionados hoy" muestra el total de solicitudes `solucionado`
      cuya `updated_at` sea hoy.
- [ ] La tasa de éxito se calcula como solucionados_hoy /
      (solucionados_hoy + no_solucionados_hoy) × 100 %; si el denominador es 0,
      muestra "—".
- [ ] La tarjeta "No solucionados" muestra el total de solicitudes
      `no_solucionado` cuya `updated_at` sea hoy, con el texto "Requieren
      escalamiento" debajo.
- [ ] La tabla "Cola de Espera" muestra todas las solicitudes con estado
      `en_espera` o `en_proceso`, ordenadas por `created_at` ASC.
- [ ] Cada fila de la cola muestra área, título y badge de estado ("En Espera"
      o "En Proceso").
- [ ] El bloque "Estado Técnicos" muestra una card por cada técnico registrado.
- [ ] Cada card muestra avatar con iniciales, nombre, badge de estado y etiqueta
      "Xm act." calculada desde `ultima_actualizacion`.
- [ ] Cada card muestra el campo `ubicacion` del técnico.
- [ ] Si el técnico está `atendiendo`, la card muestra "Ayudando a:
      {username del trabajador}".
- [ ] Si el técnico no está `atendiendo`, la card muestra "Último ticket:
      Hace Xm" calculado desde `ultima_actualizacion`.
- [ ] La etiqueta "Xm act." de cada card se actualiza cada segundo sin recargar.
- [ ] El indicador "● En Vivo" aparece junto al título "Estado Técnicos".
- [ ] Ninguna acción del jefe modifica datos en DB (panel solo lectura).
- [ ] La etiqueta "actualizado hace X" del panel se actualiza cada segundo.
- [ ] El panel se refresca automáticamente cada 3 minutos.
- [ ] El botón de refresco manual actualiza los datos al instante.
- [ ] `npm run build` y `npm run lint` pasan sin errores.

## Decisiones

- **No:** badge de prioridad "Urgente". Requeriría un campo nuevo en el esquema
  (`prioridad` o similar) y lógica de asignación; no está definido en el dominio
  actual. Se puede añadir en un spec posterior si el equipo lo necesita.

- **No:** tendencia "+N desde la última hora" en el KPI "Esperando ayuda".
  Requeriría guardar snapshots históricos del conteo o consultas de ventana
  temporal; añade complejidad sin valor demostrado en el MVP.

- **No:** Historial Reciente con filtros y exportación. Va en SPEC 08 con su
  propia lógica de filtrado y generación de CSV.

- **No:** acciones del jefe sobre solicitudes o técnicos. El jefe en este spec
  es observador; cualquier intervención directa (reasignar, forzar estado) va en
  un spec posterior cuando el equipo valide que es necesario.

- **Sí:** cola muestra `en_espera` y `en_proceso`. El jefe necesita ver el
  estado completo del trabajo en curso, no solo lo que está pendiente.

- **Sí:** tasa de éxito calculada solo con datos del día actual. Métricas
  históricas van en SPEC 08; mantener el KPI simple y acotado al día en curso.

- **Sí:** "● En Vivo" como etiqueta visual junto a "Estado Técnicos", aunque
  el dato llegue por polling. Es la denominación del mockup y comunica al jefe
  que la sección se refresca sola; el mecanismo interno (polling vs. realtime)
  no le importa al usuario final.

- **Sí:** "Último ticket: Hace Xm" derivado de `ultima_actualizacion` en
  `estado_tecnico`. Es el campo más cercano disponible sin consultas adicionales;
  se actualiza cada vez que el técnico cambia de estado o termina una atención.

- **Sí:** avatar con iniciales por índice de color en lugar de foto de perfil.
  No hay gestión de avatares en el MVP; las iniciales con color fijo por técnico
  dan identidad visual sin infraestructura adicional.

## Riesgos

| Riesgo                                                                                                                                                                                                                                                                      | Mitigación                                                                                                                                                                                                                                          |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| El RLS de SPEC 02 puede no permitir al jefe leer todas las filas de `solicitudes`, `estado_tecnico` o `profiles` de otros roles. Si las políticas son muy restrictivas, las queries de KPIs y la cola devolverán conteos incorrectos o vacíos.                              | Antes de implementar el paso 1, verificar en Dashboard → Authentication → Policies que el rol `jefe` tiene política `FOR SELECT` sin filtro de `auth.uid()` en esas tres tablas. Si falta, añadir la política en una migración dentro de este spec. |
| El campo `a_quien_ayuda` en `estado_tecnico` puede contener un `solicitud_id` inválido (solicitud ya cerrada o liberada) si el trigger de SPEC 06 no lo limpió correctamente. El LEFT JOIN devolvería `trabajador_username = null` y la card mostraría "Ayudando a:" vacío. | Manejar `null` en el cliente: si `trabajador_username` es null y `estado = 'atendiendo'`, mostrar "Ayudando a: —" en lugar de vacío. Investigar la causa raíz en SPEC 06 si ocurre.                                                                 |
| La consulta de técnicos hace tres JOINs (`estado_tecnico → profiles → solicitudes → profiles`). Con muchos técnicos o solicitudes puede ser lenta.                                                                                                                          | En el MVP el volumen es bajo (< 20 técnicos). Si en producción se nota latencia, añadir índice sobre `solicitudes.tecnico_id` y `estado_tecnico.tecnico_id`.                                                                                        |
| El `setInterval` de 1 segundo para las etiquetas "Xm act." y "actualizado hace X" puede acumular renders si el componente se desmonta y el intervalo no se limpia.                                                                                                          | En el `useEffect` que define el intervalo, retornar siempre la función de limpieza: `return () => clearInterval(id)`.                                                                                                                               |

## Lo que **no** está en este spec

- Historial Reciente con filtros y exportación — SPEC 08.
- Notificaciones (campana funcional) — SPEC 09.
- Supabase Realtime verdadero — SPEC 10.
- Badge de prioridad "Urgente" — no contemplado en el MVP.
- Tendencia "+N desde la última hora" en KPIs — no contemplado en el MVP.
- Acciones del jefe sobre solicitudes o técnicos — spec posterior.
- Pantalla de Perfil del jefe — spec posterior.

Cada uno de esos puntos, si se incorpora, va en su propio spec.
