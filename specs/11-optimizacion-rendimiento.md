# SPEC 11 — Optimización de rendimiento y buenas prácticas

> **Estado:** Aprobado
> **Depende de:** SPEC 10 (la app auditada y sin fallas conocidas), SPEC 01–09
> **Fecha:** 2026-06-12
> **Objetivo:** Aplicar las guías de buenas prácticas del repo
> (`next-best-practices` y `supabase-postgres-best-practices`) a toda la app
> para que cargue rápido y se mantenga rápida — consultas con índices
> verificados, polling que pide solo lo necesario, y render/bundle de Next.js
> optimizados — sin cambiar funcionalidad visible ni agregar dependencias.

## Scope

**In:**

### Base de datos / Supabase (guía: `supabase-postgres-best-practices`)

- **Índices verificados con `EXPLAIN`** para todas las consultas recurrentes:
  cola por estado, solicitudes del trabajador, métricas del técnico, KPIs y
  tabla del jefe, estado de técnicos. Crear los índices que falten
  (migración nueva).
- **Consultas que piden solo lo necesario:** reemplazar `select('*')` por
  listas de columnas explícitas; usar `count` con `head: true` donde solo se
  necesita el número (posición en cola, KPIs); paginación real en la tabla
  del jefe si hoy trae todo.
- **Menos viajes a la base por refresco:** consolidar consultas que el
  polling dispara por separado cuando pueden resolverse en una sola (o en
  paralelo con `Promise.all` si son independientes).
- **Políticas RLS eficientes:** funciones repetidas envueltas en
  `(select ...)` para que Postgres las evalúe una vez por consulta y no por
  fila, según la guía.

### Next.js / React (guía: `next-best-practices`)

- **Fronteras RSC correctas:** lo que pueda ser Server Component no lleva
  `"use client"`; los componentes cliente quedan en las hojas (paneles con
  polling), no en layouts.
- **`loading.tsx` / `Suspense`** en los segmentos de los 3 paneles para que
  la navegación pinte algo de inmediato en vez de esperar los datos.
- **Polling sin trabajo de más:** un solo `setInterval` por panel, que se
  pausa cuando la pestaña está oculta (`document.visibilityState`) y no
  re-renderiza si los datos no cambiaron.
- **Bundle:** `jspdf` + `jspdf-autotable` cargados con import dinámico solo
  cuando se genera un PDF (hoy pueden estar entrando al bundle de la página
  de reportes); revisar imports de iconos/librerías que arrastren módulos
  enteros.
- **Fuentes e imágenes** servidas según la convención de Next (`next/font`,
  `next/image`) donde aplique.
- **`npm run build` sin warnings.**

**Fuera de alcance:**

- Corrección de bugs funcionales — eso es SPEC 10 (prerrequisito).
- Supabase Realtime (decisión cerrada: polling se queda).
- Dependencias nuevas (ni librerías de cache, ni React Query, ni similares).
- Cambios de funcionalidad o de diseño visual.
- Cambios de infraestructura (hosting, CDN, upgrade de versiones de
  Next/React/Supabase).
- Métricas de monitoreo en producción (analytics, Web Vitals tracking) —
  candidato a spec futuro.

## Modelo de datos

Sin tablas, columnas ni enums nuevos. Los únicos cambios en la base son:

- **Índices nuevos** que `EXPLAIN` demuestre necesarios para las consultas
  recurrentes (p. ej. sobre `solicitudes(estado)`, `solicitudes(trabajador_id,
  estado)`, `solicitudes(tecnico_asignado_id, estado)`, `solicitudes
  (updated_at)` para reportes y métricas del día). La lista exacta sale del
  análisis, no se crean índices "por si acaso".
- **Reescritura de políticas RLS existentes** (mismo efecto, mejor plan):
  envolver funciones como `auth.uid()` o lookups de rol en `(select ...)`
  para evaluación única por consulta.

Cada cambio se guarda como archivo SQL nuevo de migración (no se editan
migraciones ya aplicadas) y queda documentado en `specs/11-resultados.md`
con el `EXPLAIN` antes/después que lo justifica.

## Plan de implementación

Cada paso deja la app funcionando. Las mediciones (antes/después) se anotan
en `specs/11-resultados.md` a medida que se avanza.

1. **Línea base medible.** Registrar en `11-resultados.md`: salida de
   `npm run build` (tamaños de bundle por ruta, warnings), `EXPLAIN ANALYZE`
   de las consultas recurrentes de los 3 paneles, y cuántas consultas
   dispara cada ciclo de polling por panel.
2. **Índices.** Crear la migración con los índices que la línea base
   demuestre necesarios; verificar con `EXPLAIN ANALYZE` que las consultas
   los usan.
3. **RLS eficiente.** Reescribir las políticas con funciones sin envolver en
   `(select ...)`; verificar con `EXPLAIN` que el plan mejora y con un
   recorrido manual que los permisos no cambiaron.
4. **Consultas de los paneles.** Panel por panel (trabajador → técnico →
   jefe): columnas explícitas en vez de `*`, `count` + `head: true` donde
   solo se necesita el número, consolidar o paralelizar las consultas del
   polling, paginación en la tabla del jefe si trae todo.
5. **Polling eficiente en el cliente.** En los 3 paneles: pausar el
   `setInterval` con la pestaña oculta y reanudar (refrescando) al volver;
   evitar re-render si la respuesta no cambió (comparación antes de
   `setState`); mantener la etiqueta "actualizado hace X" intacta.
6. **Fronteras RSC y carga.** Revisar cada segmento: bajar `"use client"` a
   las hojas, agregar `loading.tsx` a los segmentos de los 3 paneles (y
   `Suspense` donde un bloque lento retrasa al resto).
7. **Bundle.** Import dinámico de `jspdf` + `jspdf-autotable` en el flujo de
   reportes; revisar imports de `@tabler/icons-react` y similares; comparar
   tamaños por ruta contra la línea base.
8. **Fuentes e imágenes.** Migrar a `next/font` / `next/image` lo que no lo
   use, según la guía.
9. **Verificación final.** `npm run build` sin warnings; recorrido manual de
   los 3 roles confirmando que todo funciona igual; `11-resultados.md`
   completo con cada medición antes/después.

## Criterios de aceptación

- [ ] `npm run build` termina sin errores ni warnings.
- [ ] `npm run lint` termina sin errores.
- [ ] Toda consulta recurrente de los 3 paneles usa índice (verificado con
      `EXPLAIN ANALYZE`, sin `Seq Scan` sobre `solicitudes` ni
      `technician_status` en las consultas del polling).
- [ ] No queda ningún `select('*')` en el código de la app.
- [ ] Las consultas que solo necesitan un número usan `count` con
      `head: true` (no traen filas).
- [ ] Las políticas RLS con funciones por fila quedaron envueltas en
      `(select ...)` y los permisos efectivos no cambiaron (recorrido por
      rol).
- [ ] El polling de cada panel se pausa con la pestaña oculta y se reanuda
      con datos frescos al volver a ella.
- [ ] Un ciclo de polling no re-renderiza el panel si los datos no
      cambiaron.
- [ ] `jspdf` / `jspdf-autotable` no aparecen en el bundle inicial de
      ninguna ruta (solo se cargan al generar un PDF).
- [ ] Los segmentos de los 3 paneles tienen `loading.tsx` y la navegación
      entre secciones pinta un estado de carga inmediato.
- [ ] `specs/11-resultados.md` existe con la línea base y el después de cada
      medición (bundle por ruta, `EXPLAIN` de consultas, consultas por ciclo
      de polling).
- [ ] La funcionalidad visible no cambió: los flujos de los 3 roles hacen lo
      mismo que antes de este spec.

## Decisiones tomadas y descartadas

**Tomadas:**

- **La vara de medición es el checklist de buenas prácticas, no una métrica
  de latencia.** No hay un objetivo tipo "carga en < 2 s" porque no hay
  medición de producción; en su lugar, criterios verificables localmente
  (EXPLAIN, bundle, warnings) + línea base antes/después en
  `11-resultados.md`.
- **Rendimiento después de fallas (depende de SPEC 10).** No se optimiza
  código con bugs conocidos.
- **Se mantiene el polling, pero eficiente.** Pausa con pestaña oculta y
  menos consultas por ciclo — sin Realtime (decisión cerrada del proyecto).
- **Sin dependencias nuevas.** Nada de React Query/SWR: el patrón de polling
  actual se optimiza con APIs nativas (visibilitychange, comparación de
  datos).
- **Índices solo demostrados por `EXPLAIN`.** Cada índice nuevo nace de una
  consulta real medida; no se indexan columnas "por si acaso" (los índices
  también cuestan en escritura).
- **Resultados en `specs/11-resultados.md`.** Igual que `10-hallazgos.md`:
  el spec define el método, el archivo de resultados guarda la evidencia.

**Descartadas:**

- **Supabase Realtime** — decisión cerrada; además cambiaría la arquitectura
  de los 3 paneles, no es una "optimización".
- **React Query / SWR para cache de cliente** — dependencia nueva y
  reescritura del patrón de datos; el beneficio no justifica el costo en una
  app de esta escala.
- **Vistas materializadas para los KPIs del jefe** — complejidad de refresco
  que no se justifica con el volumen actual; los índices + count head bastan.
- **Medición con Lighthouse como criterio** — útil como referencia informal,
  pero sus números varían por máquina; los criterios de aceptación usan
  señales deterministas (EXPLAIN, bundle, warnings).

## Riesgos identificados

- **Una "optimización" cambia el comportamiento.** P. ej. quitar columnas de
  un `select` que algún componente sí usaba, o una política RLS reescrita
  que ya no cubre un caso. Mitigación: recorrido manual del flujo afectado
  tras cada paso; los permisos se prueban por rol después del paso 3.
- **Pausar el polling deja datos viejos en pantalla.** Si la lógica de
  reanudar falla, el usuario vuelve a la pestaña y ve información obsoleta
  sin saberlo. Mitigación: al volver a la pestaña se refresca de inmediato y
  la etiqueta "actualizado hace X" sigue siendo honesta (usa la hora real
  del último fetch).
- **Optimizar sin medir.** Cambios que "se sienten" más rápidos pero no lo
  son, o que empeoran otra ruta. Mitigación: la línea base del paso 1 es
  obligatoria; ningún paso se da por cerrado sin su antes/después en
  `11-resultados.md`.
- **Índices que penalizan escrituras.** Cada índice acelera lecturas pero
  encarece inserts/updates de `solicitudes`. Mitigación: solo índices
  justificados por `EXPLAIN` de consultas reales del polling.
