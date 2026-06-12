# SPEC 10 — Auditoría y corrección de fallas

> **Estado:** Aprobado
> **Depende de:** SPEC 01–09 (todos los specs implementados — audita el sistema completo)
> **Fecha:** 2026-06-12
> **Objetivo:** Auditar toda la app (login, primer ingreso, recuperación de
> contraseña, paneles de trabajador/técnico/jefe, reportes y cron) para
> detectar y corregir fallas funcionales, de validación de entradas, de
> manejo de errores y de RLS, endureciendo el código sin cambiar la
> funcionalidad visible ni agregar dependencias.

## Scope

**In:**

### Superficie auditada (toda la app)

- **Auth y cuenta:** `/login`, `/primer-ingreso`, `/solicitar-recuperacion`,
  `/actualizar-contrasena`, `app/auth/callback`, `proxy.ts` (protección de
  rutas y redirección por rol).
- **Panel del trabajador:** crear solicitud, posición en cola, cancelar,
  confirmación Resuelto / No resuelto, perfil.
- **Panel del técnico:** cola de espera, "Atender ahora", cambio de estado,
  métricas del día, liberar, confirmación, perfil.
- **Panel del jefe:** KPIs, tabla de solicitudes con acciones contextuales,
  botón masivo, estado de técnicos, reportes (`/jefe/reportes`), perfil.
- **API y cron:** `app/api/cron/reportes`, `app/api/jefe/reportes/actual`.
- **Base de datos:** políticas RLS de todas las tablas y del bucket
  `reportes`, consistencia de estados/transiciones de `solicitudes`.

### Tipos de falla que se detectan Y corrigen

1. **Validación de entradas en Server Actions y Route Handlers:** campos
   obligatorios, formatos (DNI, teléfono, correo), longitudes máximas,
   valores de enum válidos — hoy puede haber acciones que confían en lo que
   llega del cliente.
2. **Manejo de errores:** llamadas a Supabase cuyo `error` se ignora,
   acciones sin feedback al usuario cuando fallan, ausencia de `error.tsx` /
   `not-found.tsx` donde corresponda.
3. **Autorización:** cada Server Action verifica sesión Y rol en el servidor
   (no solo el proxy); RLS revisada política por política contra la matriz
   de permisos de SPEC 02.
4. **Condiciones de carrera:** dos técnicos pulsando "Atender ahora" sobre la
   misma solicitud, doble confirmación simultánea, doble submit de
   formularios (botones sin estado `pending`).
5. **Casos borde funcionales:** cola vacía, técnico sin estado registrado,
   solicitud cancelada mientras se atiende, sesión expirada a mitad de una
   acción, reloj/zona horaria en métricas "de hoy" (`America/Lima`).
6. **Errores de build/lint:** `npm run build` y `npm run lint` quedan en
   verde sin errores.

**Fuera de alcance:**

- Optimización de rendimiento (consultas, polling, bundle) — eso es SPEC 11.
- Framework de tests automatizados (Vitest/Playwright) — si se quiere,
  merece su propio spec.
- Cambios de funcionalidad visible o de UX: la app hace lo mismo que antes,
  solo que sin romperse.
- Dependencias nuevas (la validación se hace con código propio, sin Zod).
- Supabase Realtime (decisión cerrada: se mantiene polling).
- Refactors de arquitectura que no corrijan una falla concreta.

## Modelo de datos

Sin estructuras nuevas. La auditoría puede producir **migraciones
correctivas** sobre lo existente, limitadas a:

- Ajustes de **políticas RLS** que resulten más permisivas o más
  restrictivas de lo que define la matriz de permisos de SPEC 02.
- **Constraints defensivos** que la base aún no tenga y que eviten estados
  inválidos (p. ej. `CHECK` de transiciones, `NOT NULL` faltantes, unicidad
  donde aplique).
- Para la condición de carrera de "Atender ahora": la asignación pasa a ser
  **atómica** — un `UPDATE ... WHERE estado = 'en_espera'` condicional (o
  función SQL equivalente), de modo que solo un técnico pueda quedarse con
  la solicitud y el segundo reciba un mensaje de "ya fue tomada".

Cada migración correctiva se guarda como archivo SQL nuevo (no se editan
migraciones ya aplicadas) y queda listada en el reporte de hallazgos.

## Plan de implementación

Cada paso audita un área, corrige lo que encuentre y deja la app funcionando.
Todo hallazgo (corregido o descartado) se anota en `specs/10-hallazgos.md`
a medida que se avanza.

1. **Línea base.** Correr `npm run build` y `npm run lint`, registrar todo
   error/warning existente en `10-hallazgos.md`. Corregir los errores (los
   warnings de rendimiento se delegan a SPEC 11 si son de ese ámbito).
2. **Auth y cuenta.** Auditar y corregir `/login`, `/primer-ingreso`,
   `/solicitar-recuperacion`, `/actualizar-contrasena`, `auth/callback` y
   `proxy.ts`: validación de entradas, mensajes de error al usuario, que
   ninguna ruta protegida sea accesible sin sesión o con rol equivocado.
3. **Server Actions — autorización y validación transversal.** Pasar por
   TODAS las actions (`app/actions/auth.ts`, `app/{trabajador,tecnico,jefe}/
   actions.ts`, `app/jefe/reportes/actions.ts`, actions de login/primer
   ingreso/recuperación): cada una verifica sesión + rol en el servidor y
   valida sus entradas (obligatorios, formato, longitud, enums) antes de
   tocar la base.
4. **Panel del trabajador.** Casos borde: doble submit al crear solicitud,
   cancelar una solicitud ya tomada, confirmar sobre una solicitud ya
   cerrada, posición en cola con cola vacía.
5. **Panel del técnico.** Aplicar la asignación atómica de "Atender ahora"
   (migración + action), técnico sin fila de estado, liberar/confirmar sobre
   una solicitud que ya cambió de estado, métricas "de hoy" con zona horaria
   `America/Lima`.
6. **Panel del jefe.** Acciones contextuales sobre filas cuyo estado cambió
   entre el render y el clic, botón masivo con 0 candidatas, KPIs con
   divisiones por cero (tasa de éxito sin datos), reportes: mes sin datos,
   bucket vacío, `CRON_SECRET` ausente o incorrecto.
7. **RLS.** Revisar cada política de cada tabla y del bucket `reportes`
   contra la matriz de permisos de SPEC 02; corregir con migraciones
   correctivas las que sobren, falten o se desvíen.
8. **Manejo de errores de UI.** Agregar `error.tsx` (y `not-found.tsx` donde
   aplique) en los segmentos que no lo tengan; toda action que falla muestra
   feedback al usuario en vez de fallar en silencio.
9. **Verificación final.** `npm run build` y `npm run lint` en verde;
   recorrido manual del checklist de criterios de aceptación con un usuario
   de cada rol; `10-hallazgos.md` completo con todo lo encontrado, su
   corrección o la razón para descartarlo.

## Criterios de aceptación

- [ ] `npm run build` termina sin errores.
- [ ] `npm run lint` termina sin errores.
- [ ] Toda Server Action y Route Handler verifica sesión y rol en el
      servidor; probar una action con un rol equivocado devuelve error, no
      ejecuta.
- [ ] Enviar a cualquier formulario datos inválidos (campos vacíos, DNI con
      letras, correo malformado, enum inexistente) produce un mensaje de
      error visible y NO escribe en la base.
- [ ] Dos técnicos pulsando "Atender ahora" sobre la misma solicitud: solo
      uno la obtiene; el otro ve un aviso de que ya fue tomada y la cola se
      refresca.
- [ ] Doble clic rápido en cualquier botón de submit no crea registros
      duplicados (botones con estado `pending`).
- [ ] Cancelar/confirmar/marcar una solicitud cuyo estado ya cambió por otra
      vía muestra un error claro y no corrompe el estado.
- [ ] Con la base vacía (cola sin solicitudes, sin técnicos activos, mes sin
      datos), los tres paneles y los reportes cargan sin errores ni `NaN`.
- [ ] Cada rol, autenticado con el cliente de navegador, no puede leer ni
      modificar vía Supabase filas que no le corresponden según la matriz de
      SPEC 02 (RLS probada con al menos un intento negativo por tabla).
- [ ] Llamar a `app/api/cron/reportes` sin `CRON_SECRET` o con uno
      incorrecto devuelve 401 y no genera nada.
- [ ] Toda llamada a Supabase en el código revisa su `error` (ninguna queda
      ignorada).
- [ ] Los segmentos `login`, `trabajador`, `tecnico` y `jefe` tienen
      `error.tsx`; un error inesperado muestra esa pantalla en vez de romper
      la app.
- [ ] `specs/10-hallazgos.md` existe y lista cada hallazgo con su corrección
      o la razón para descartarlo.
- [ ] La funcionalidad visible no cambió: los flujos de los 3 roles hacen lo
      mismo que antes de este spec.

## Decisiones tomadas y descartadas

**Tomadas:**

- **Detectar Y corregir en el mismo spec.** La auditoría no es solo un
  informe: cada falla clara se corrige aquí. Solo se documenta sin corregir
  lo que requiera rediseño de una feature (y se anota como candidato a spec
  futuro).
- **Sin framework de tests.** La verificación es `build` + `lint` + checklist
  manual por rol. Un framework de tests (Vitest/Playwright) agrega
  dependencias y es un proyecto en sí mismo; si se quiere, será su propio
  spec.
- **Validación con código propio, sin Zod.** Mantiene la regla de "sin
  dependencias nuevas"; la superficie de formularios es pequeña y no lo
  justifica.
- **Asignación atómica vía UPDATE condicional.** Resuelve la carrera de
  "Atender ahora" en la base, no en el cliente — es la única fuente de
  verdad confiable.
- **Hallazgos en `specs/10-hallazgos.md`.** Deja rastro auditable de qué se
  encontró y qué se hizo, separado del spec (que define el método, no los
  resultados).
- **Fallas primero, rendimiento después (SPEC 11).** No se optimiza código
  que aún tiene bugs.

**Descartadas:**

- **Auditoría solo-informe sin correcciones** — pospone el valor real y
  duplica el trabajo de re-leer el código después.
- **Limitar la auditoría a los 3 paneles** — auth, reportes y cron son
  superficie pequeña pero crítica (es donde viven secretos y permisos);
  entra todo.
- **Migrar a Supabase Realtime para evitar estados desactualizados** —
  decisión cerrada del proyecto: se mantiene polling.
- **Refactor de arquitectura general** — fuera de alcance; solo se toca lo
  que corrige una falla concreta.

## Riesgos identificados

- **Una corrección rompe un flujo que funcionaba.** Es el riesgo principal de
  tocar código en toda la app. Mitigación: cada paso del plan deja la app
  funcionando y se prueba el flujo afectado antes de pasar al siguiente; la
  verificación final recorre los 3 roles completos.
- **Endurecer RLS bloquea una consulta legítima.** Una política que hoy es
  "demasiado permisiva" puede estar sosteniendo una consulta real. Mitigación:
  antes de restringir una política, buscar en el código todas las consultas
  que pasan por esa tabla y verificarlas tras el cambio.
- **La validación nueva rechaza datos viejos válidos.** P. ej. un formato de
  teléfono más estricto que el de filas ya guardadas. Mitigación: validar
  solo entradas nuevas, nunca re-validar datos existentes al leerlos.
- **Alcance que se infla.** Auditar "toda la app" invita a refactorizar de
  paso. Mitigación: la regla del scope — solo se corrige lo que es una falla
  concreta; lo demás se anota en `10-hallazgos.md` como descartado o
  candidato a spec futuro.
