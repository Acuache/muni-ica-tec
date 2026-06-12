# SPEC 10 — Reporte de hallazgos

> Registro de la auditoría definida en [10-auditoria-correccion-fallas.md](./10-auditoria-correccion-fallas.md).
> Cada hallazgo indica su área, qué se encontró y cómo se resolvió (o por qué
> se descartó).

## Paso 1 — Línea base (build + lint)

### H-01 · `npm run build` falla: Turbopack no puede descargar Google Fonts — **Corregido**

- **Área:** build / `app/layout.tsx`
- **Hallazgo:** `npm run build` fallaba con `next/font: error: Failed to fetch
  'Geist' from Google Fonts` (ídem `Geist Mono` y `Roboto Slab`). El fetcher
  interno de Turbopack (lado Rust) no logra conectar con
  `fonts.googleapis.com` en este entorno, aunque la máquina sí tiene salida
  HTTP (Node y PowerShell conectan con status 200; la conectividad IPv6 está
  rota y `ping -6` ni siquiera resuelve el host). El build dependía de la red
  externa en cada compilación: frágil por diseño, además de bloqueante aquí.
- **Corrección:** se auto-hospedan las tres fuentes con `next/font/local`.
  Se descargaron los `.woff2` variables (peso 100–900, subset latin) oficiales
  de Google Fonts a `app/fonts/` y `app/layout.tsx` pasó de `next/font/google`
  a `localFont` manteniendo las mismas variables CSS (`--font-serif`,
  `--font-geist-sans`, `--font-geist-mono`). Mismas familias y pesos: sin
  cambio visual. El build ya no hace ninguna petición de red.
  - `app/fonts/geist-latin.woff2` ← `https://fonts.gstatic.com/s/geist/v5/gyByhwUxId8gMEwcGFU.woff2`
  - `app/fonts/geist-mono-latin.woff2` ← `https://fonts.gstatic.com/s/geistmono/v6/or3nQ6H-1_WfwkMZI_qYFrcdmg.woff2`
  - `app/fonts/roboto-slab-latin.woff2` ← `https://fonts.gstatic.com/s/robotoslab/v36/BngMUXZYTXPIvIBgJJSb6ufN5qU.woff2`

### Línea base resultante

- `npm run lint`: **verde**, sin errores ni warnings (antes y después de H-01).
- `npm run build`: **verde** tras H-01. Sin warnings restantes.

## Paso 2 — Auth y cuenta

Se creó `lib/validacion.ts` (validadores compartidos sin dependencias:
email, teléfono, longitudes de texto y de contraseña) que también usarán
las actions de los pasos siguientes.

### H-02 · Open redirect en `app/auth/callback` — **Corregido**

- **Área:** `app/auth/callback/route.ts`
- **Hallazgo:** el parámetro `?next=` se pasaba sin validar a
  `NextResponse.redirect(new URL(next, origin))`. Un link malicioso
  `…/auth/callback?code=X&next=https://evil.com` (o `//evil.com`) redirigía
  al usuario, recién autenticado, a un dominio externo (phishing).
- **Corrección:** `destinoSeguro()` — solo se aceptan rutas internas que
  empiezan con `/` (rechazando `//` y `\`); cualquier otro valor cae a `/login`.

### H-03 · Proxy dejaba pasar sesiones con rol no reconocido — **Corregido**

- **Área:** `proxy.ts`
- **Hallazgo:** con sesión válida pero `user_metadata.rol` ausente o fuera de
  `{trabajador, tecnico, jefe}`, `panel` quedaba `undefined` y ningún bloque
  de redirección aplicaba: la request seguía hacia `/jefe`, `/tecnico`, etc.
  (RLS limitaría los datos, pero la ruta protegida se servía igual).
- **Corrección:** nuevo bloque: sesión sin panel reconocido en ruta protegida
  → redirección a `/login`.

### H-04 · Errores de Supabase ignorados en el flujo de auth — **Corregido**

- **Área:** `proxy.ts`, `app/login/actions.ts`,
  `app/solicitar-recuperacion/actions.ts`, `app/actions/auth.ts`
- **Hallazgo:** cuatro llamadas descartaban `error`:
  1. `proxy.ts` — consulta de `primer_ingreso`: un fallo se confundía con
     "perfil sin completar".
  2. `login` — consulta de `primer_ingreso`: un fallo redirigía al panel
     saltándose el primer ingreso.
  3. `solicitarRecuperacion` — `resetPasswordForEmail`: un fallo (p. ej.
     rate limit) se tragaba en silencio.
  4. `logout` — `signOut` sin revisar.
- **Corrección:** (1) en error se queda en `/primer-ingreso` (fallo seguro,
  sin loop); (2) en error se redirige a `/primer-ingreso`, que reenvía al
  panel si ya estaba completado; (3) y (4) se registran con `console.error`
  sin cambiar la respuesta al usuario (en recuperación, además, no se revela
  si el correo existe).

### H-05 · Validación de entradas incompleta en formularios de auth — **Corregido**

- **Área:** `app/login/actions.ts`, `app/primer-ingreso/actions.ts`,
  `app/solicitar-recuperacion/actions.ts`, `app/actualizar-contrasena/actions.ts`
- **Hallazgo:** las actions solo comprobaban "no vacío". Sin formato de
  correo ni teléfono, sin longitudes máximas, y la nueva contraseña del
  primer ingreso aceptaba 1 carácter (inconsistente con el mínimo de 8 de
  `/actualizar-contrasena`).
- **Corrección:** con `lib/validacion.ts` — formato de email en login,
  primer ingreso y recuperación; formato de teléfono (6–15 dígitos, espacios
  y guiones) y máximo de 120 caracteres por campo de texto en primer ingreso;
  mínimo 8 / máximo 72 para contraseñas nuevas en primer ingreso y
  actualización. SPEC 07f dejó formato/longitud fuera de su alcance; SPEC 10
  los trae explícitamente ("formatos (DNI, teléfono, correo), longitudes").
  El DNI no se valida porque ninguna action lo escribe (solo se muestra).

### H-06 · Tras restablecer contraseña, el usuario nunca llegaba a `/login` — **Corregido**

- **Área:** `app/actualizar-contrasena/actions.ts`
- **Hallazgo:** la action hacía `redirect('/login')` con la sesión de
  recuperación todavía viva, y el proxy rebotaba `/login` → panel del rol.
  SPEC 04 (criterio de aceptación) exige terminar en `/login`. Además no se
  verificaba la sesión antes de `updateUser`.
- **Corrección:** se verifica `getUser()` (sin sesión → mensaje de link
  expirado) y se hace `signOut()` tras actualizar, de modo que el redirect a
  `/login` sí muestre el login.

### H-07 · `/actualizar-contrasena` fuera de `PROTECTED` en el proxy — **Descartado**

- **Área:** `proxy.ts`
- **Razón:** es intencional. La página debe ser alcanzable con la sesión
  temporal de recuperación (que el proxy no distingue de una normal) y sin
  sesión muestra el formulario cuya action falla con mensaje claro
  ("link expirado"). Protegerla rompería el flujo de recuperación.

### Estado tras el paso 2

- `npm run lint` y `npm run build`: **verdes**.

## Paso 3 — Server Actions: autorización y validación transversal

Se creó `lib/autorizacion.ts` con `autorizar(roles)`: verifica sesión activa
y que `profiles.rol` (leído de la base, no de metadata editable por el
cliente) esté en los roles permitidos. Todas las actions de paneles pasan
ahora por él antes de tocar la base.

### H-08 · Actions del jefe ejecutaban con service-role sin verificar rol — **Corregido** (crítico)

- **Área:** `app/jefe/actions.ts`, `app/jefe/reportes/actions.ts`
- **Hallazgo:** `marcarSolucionado`, `marcarTodosSolucionados`,
  `cancelarSolicitudJefe` y `generarReporteManual` solo comprobaban que
  hubiera sesión y luego operaban con el **cliente service-role (salta
  RLS)**. Las Server Actions son endpoints invocables por cualquier cliente
  con el ID de la action: un trabajador o técnico autenticado podía marcar
  solicitudes como solucionadas, cancelarlas o generar reportes.
- **Corrección:** las cuatro pasan por `autorizar(['jefe'])` antes de crear
  el cliente admin, con comentario de advertencia para que la barrera no se
  quite en refactors.

### H-09 · Actions de trabajador y técnico sin verificación de rol explícita — **Corregido**

- **Área:** `app/trabajador/actions.ts`, `app/tecnico/actions.ts`
- **Hallazgo:** las 7 actions verificaban sesión pero no rol. RLS contenía
  el daño (las políticas de `solicitudes` y `technician_status` exigen el
  rol en `profiles`), pero el spec exige la doble barrera servidor + base, y
  sin ella los errores llegaban como fallos genéricos de RLS en lugar de un
  mensaje claro de permiso.
- **Corrección:** `autorizar(['trabajador'])` / `autorizar(['tecnico'])` en
  todas.

### H-10 · IDs y entradas de actions sin validar formato/longitud — **Corregido**

- **Área:** todas las actions de paneles
- **Hallazgo:** `solicitud_id` se pasaba crudo a Postgres (un valor no-UUID
  producía un error SQL de sintaxis en vez de una validación); `titulo` y
  `descripcion` no tenían longitud máxima; `tipo_ayuda` se comprobaba solo
  como "no vacío" (cualquier string llegaba al enum de la base); el código
  AnyDesk aceptaba dígitos ilimitados.
- **Corrección:** en `lib/validacion.ts` se añadieron `esUuidValido` y
  `esAnydeskValido` (1–15 dígitos) y `MAX_TEXTO_LARGO` (2000). Ahora:
  `solicitud_id` se valida como UUID en las 8 actions que lo reciben;
  `tipo_ayuda` se valida contra el enum (`presencial`/`virtual`); `titulo`
  máx. 120 y `descripcion` máx. 2000. `cambiarEstado` ya validaba su enum y
  `generarReporteManual` ya validaba `mes` contra la lista blanca de meses.

### H-11 · `profiles_update_own` permite cambiar el propio `rol` — **Pendiente (se corrige en Paso 7)** (crítico)

- **Área:** RLS de `profiles`
- **Hallazgo:** la política `profiles_update_own` no restringe columnas: un
  usuario autenticado puede hacer `update profiles set rol = 'jefe' where id
  = auth.uid()` con el cliente de navegador y escalar privilegios (todas las
  políticas RLS y `autorizar()` leen ese campo). Relacionado: el proxy
  enruta por `user_metadata.rol`, también modificable por el propio usuario
  vía `auth.updateUser()` — el enrutado es solo conveniencia, pero la
  autorización real ahora lee `profiles.rol`, por eso esa columna debe ser
  inmutable.
- **Plan:** migración correctiva en el Paso 7 (privilegios por columna:
  revocar UPDATE genérico y conceder solo las columnas editables del
  perfil).

### Estado tras el paso 3

- `npm run lint` y `npm run build`: **verdes**.
- Los Route Handlers (`app/api/...`) se auditan en el Paso 6 junto con
  reportes y cron.

## Paso 4 — Panel del trabajador

### H-12 · Nada impedía dos solicitudes activas del mismo trabajador — **Corregido**

- **Área:** `app/trabajador/actions.ts`, base de datos
- **Hallazgo:** `crearSolicitud` no comprobaba si ya existía una solicitud
  activa. La UI oculta el formulario cuando hay una, pero un doble submit
  desde dos pestañas (o una invocación directa de la action) creaba
  duplicados que el panel ni muestra (solo enseña la primera).
- **Corrección:** migración
  `20260612000001_spec10_solicitud_activa_unica.sql` — índice único parcial
  sobre `solicitudes (trabajador_id) where estado in ('en_espera',
  'en_proceso')`, con saneamiento previo de duplicados (conserva la que está
  en proceso o la más reciente, cancela el resto). La action traduce el
  error `23505` en "Ya tienes una solicitud activa". **Pendiente de aplicar
  en Supabase** (se aplica junto con las migraciones del Paso 7).

### H-13 · Cancelar/confirmar sobre una solicitud que cambió de estado fallaba en silencio — **Corregido**

- **Área:** `app/trabajador/actions.ts`
- **Hallazgo:** `cancelarSolicitud` y `confirmarResolucion` condicionan el
  UPDATE al estado esperado (correcto, no corrompen), pero sin `.select()`
  no distinguían "0 filas afectadas" de éxito: cancelar una solicitud ya
  tomada por un técnico, o confirmar una ya cerrada, redirigía como si
  hubiera funcionado, sin avisar al usuario. Además, en la rama
  "solucionado" el `.single()` previo ignoraba su error (un fallo de red se
  confundía con "sin confirmación del técnico").
- **Corrección:** los tres UPDATE llevan `.select('id')` y 0 filas devuelve
  un error claro ("La solicitud ya no está en espera…" / "Esta solicitud ya
  fue cerrada o cambió de estado…"). La lectura previa pasó a
  `.maybeSingle()` con su error verificado y "no encontrada" devuelve el
  mismo mensaje de estado cambiado.

### H-14 · Errores de consulta ignorados en las páginas del trabajador — **Corregido**

- **Área:** `app/trabajador/page.tsx`, `app/trabajador/perfil/page.tsx`
- **Hallazgo:** todas las consultas descartaban `error`. La más grave: si la
  consulta de la solicitud activa fallaba, el panel mostraba el formulario
  de nueva solicitud aunque hubiera una activa. El perfil renderizaba campos
  vacíos ante un fallo.
- **Corrección:** las consultas principales (perfil, solicitud activa)
  lanzan `Error` con mensaje claro (lo capturará el `error.tsx` del Paso 8);
  las secundarias (posición en cola, nombre del técnico) se degradan a
  valores neutros (0 / sin nombre) registrando el fallo en consola, para no
  tumbar el panel por un dato decorativo.

### H-15 · Doble clic en los botones del panel del trabajador — **Descartado (ya cubierto)**

- **Área:** `app/trabajador/panel.tsx`
- **Razón:** los tres formularios (crear, cancelar, confirmar) ya usan
  `useActionState` y deshabilitan el botón con `pending`. Con H-12 además
  la base rechaza el duplicado en el peor caso (dos pestañas).

### Estado tras el paso 4

- `npm run lint` y `npm run build`: **verdes**.
- Cola vacía: cubierta — `get_posicion_en_cola` devuelve 0 y la UI muestra
  "Eres el primero en la cola" (rama existente verificada).
- Migración H-12 **aplicada en Supabase** vía `supabase db push` (se reparó
  antes el historial de migraciones remoto, que no existía porque las
  migraciones 01–09 se aplicaron por SQL Editor). Nota de entorno: la
  conexión directa `db.<ref>.supabase.co` es solo-IPv6 y esta red no tiene
  IPv6; `SUPABASE_DB_URL` en `.env.local` quedó apuntando al Session Pooler
  (IPv4).

## Paso 5 — Panel del técnico

### H-16 · `updated_at` de `solicitudes` nunca se actualizaba — **Corregido**

- **Área:** base de datos, métricas
- **Hallazgo:** no había trigger de `updated_at` y ninguna action lo seteaba
  al cambiar el estado de una solicitud: la columna quedaba congelada en el
  valor del INSERT. Consecuencia directa: la métrica "FINALIZADAS HOY"
  (filtra `updated_at >= hoy`) solo contaba solicitudes *creadas* hoy — una
  solicitud de ayer solucionada hoy no aparecía.
- **Corrección:** migración `20260612000002_spec10_tecnico_correcciones.sql`
  — función `set_updated_at()` + triggers `before update` en `solicitudes`
  y `technician_status`. Vale para cliente RLS y service-role por igual; se
  retiraron los `updated_at` manuales de las actions.

### H-17 · Técnico sin fila en `technician_status` quedaba sin recuperación — **Corregido**

- **Área:** `app/tecnico/actions.ts`, `app/tecnico/page.tsx`, RLS
- **Hallazgo:** sin fila de estado, `cambiarEstado` hacía un UPDATE sobre 0
  filas y redirigía como si hubiera funcionado (el estado nunca cambiaba), y
  no existía política INSERT que permitiera crearla.
- **Corrección:** política `technician_status_insert_own` (solo su propia
  fila, solo rol técnico) en la migración; `cambiarEstado` detecta la fila
  ausente y la crea con el estado pedido; el panel asume `disponible` si no
  hay fila (con el error de consulta ya verificado, antes se confundían
  fallo y ausencia).

### H-18 · "Atender ahora" no era atómico de extremo a extremo — **Corregido**

- **Área:** `app/tecnico/actions.ts`, base de datos
- **Hallazgo:** el UPDATE condicional first-write-wins ya existía (la
  carrera entre dos técnicos estaba resuelta), pero el cambio de
  `technician_status` a "atendiendo" iba en una segunda llamada: un fallo
  intermedio dejaba la solicitud asignada con el técnico aún "disponible".
- **Corrección:** RPC `atender_solicitud(uuid)` (SECURITY INVOKER, RLS
  aplica dentro) que hace ambos updates en una transacción y devuelve
  `false` si otro técnico llegó primero; la action ahora la invoca y
  conserva los mismos mensajes ("Este turno ya fue tomado por otro
  técnico.").

### H-19 · `liberarSolicitud` podía reabrir una solicitud cerrada — **Corregido**

- **Área:** `app/tecnico/actions.ts`
- **Hallazgo:** el UPDATE de liberar no condicionaba por estado: liberar una
  solicitud ya `solucionado` (p. ej. cerrada por el jefe entre el render y
  el clic) la devolvía a `en_espera` — corrupción de datos real.
- **Corrección:** se añadió `.eq('estado', 'en_proceso')` + `.select('id')`
  con error claro en 0 filas, igual que en `confirmarResolucionTecnico`.

### H-20 · Técnico atascado en estado "atendiendo" huérfano — **Corregido**

- **Área:** `app/tecnico/actions.ts`
- **Hallazgo:** si la solicitud que atendía cambiaba de estado por otra vía,
  el técnico quedaba "atendiendo" para siempre: sin tarjeta con botones en
  el panel y con `cambiarEstado` bloqueado por la regla "no cambiar mientras
  atiendes".
- **Corrección:** doble vía de autocuración: (a) `confirmarResolucionTecnico`
  y `liberarSolicitud` restablecen el estado a `disponible` cuando detectan
  0 filas (helper `liberarEstadoHuerfano`); (b) `cambiarEstado` solo bloquea
  si existe de verdad una solicitud `en_proceso` a su nombre.

### H-21 · Métricas "de hoy" calculadas con medianoche UTC — **Corregido**

- **Área:** `app/tecnico/page.tsx`, `lib/reportes/fechas.ts`
- **Hallazgo:** "FINALIZADAS HOY" usaba `setUTCHours(0,0,0,0)`: entre las
  19:00 y las 24:00 de Lima (00:00–05:00 UTC) el "día" cambiaba 5 horas
  antes que el reloj real de la municipalidad.
- **Corrección:** nuevo helper `inicioDeHoyLima()` en `lib/reportes/fechas.ts`
  (medianoche de America/Lima, UTC-5 fijo) usado por el panel.

### H-22 · Errores de consulta ignorados en las páginas del técnico — **Corregido**

- **Área:** `app/tecnico/page.tsx`, `app/tecnico/perfil/page.tsx`
- **Corrección:** mismo criterio que el trabajador — consultas principales
  (perfil, estado, solicitud activa, cola) lanzan error con mensaje claro;
  los conteos KPI se degradan a 0 registrando el fallo en consola.

### Estado tras el paso 5

- `npm run lint` y `npm run build`: **verdes**.
- Migración `20260612000002` **aplicada en Supabase**.

## Paso 6 — Panel del jefe, reportes y cron

### H-23 · Páginas y API del jefe confiaban en `user_metadata.rol` — **Corregido** (crítico)

- **Área:** `app/jefe/reportes/page.tsx`, `app/api/jefe/reportes/actual/route.ts`,
  y por extensión las 8 páginas de paneles
- **Hallazgo:** el proxy enruta por `user_metadata.rol`, que el propio
  usuario puede editar vía `auth.updateUser()`. `/jefe/reportes` no
  verificaba rol y opera el bucket con el cliente **service-role**;
  `/api/jefe/reportes/actual` verificaba el rol… contra el metadata
  falsificable. Un trabajador podía autopromoverse en metadata, entrar a
  `/jefe/reportes` y descargar/generar reportes.
- **Corrección:** las 8 páginas de paneles (trabajador, técnico, jefe ×
  panel/perfil/solicitudes/reportes) verifican ahora `profiles.rol` desde la
  base aprovechando la consulta de `primer_ingreso` que ya hacían (cero
  queries extra); rol equivocado → redirect a su panel real
  (`PANEL_POR_ROL` en `lib/autorizacion.ts`). El route handler de reportes
  consulta `profiles.rol`. El metadata queda solo como enrutado de
  conveniencia en el proxy.

### H-24 · `?page=abc` rompía la tabla del jefe — **Corregido**

- **Área:** `app/jefe/solicitudes/page.tsx`
- **Hallazgo:** `parseInt('abc')` → `NaN` → `range(NaN, NaN)` → error de
  PostgREST que además se ignoraba (tabla vacía sin explicación). El filtro
  `?estado=` tampoco validaba contra el enum: un valor inventado producía un
  error SQL silencioso.
- **Corrección:** `page` no numérico cae a 1; `estado` se valida contra la
  lista blanca de estados y un valor inválido equivale a "todos".

### H-25 · Acciones del jefe sobre filas cuyo estado cambió — **Corregido**

- **Área:** `app/jefe/actions.ts`
- **Hallazgo:** `cancelarSolicitudJefe` afectaba 0 filas en silencio si la
  solicitud ya no estaba en espera; `marcarSolucionado` leía con `.single()`
  sin revisar error y su UPDATE final no estaba condicionado al estado
  (ventana de carrera entre la lectura y la escritura); el botón masivo con
  0 candidatas cerraba el modal como si hubiera hecho algo.
- **Corrección:** los tres UPDATE llevan condición de estado +
  `.select('id')` y 0 filas devuelve aviso claro ("La solicitud ya cambió de
  estado…", "No había solicitudes pendientes de marcar…").

### H-26 · KPIs del jefe: zona horaria y errores ignorados — **Corregido**

- **Área:** `app/jefe/page.tsx`
- **Hallazgo:** "hoy" en UTC (mismo problema que H-21) y todas las consultas
  sin revisar `error`.
- **Corrección:** `inicioDeHoyLima()`; estado de técnicos lanza error con
  mensaje claro, conteos KPI se degradan a 0 con log. La tasa de éxito ya
  manejaba la división por cero (muestra "—" sin datos) — verificado, sin
  cambio.

### H-27 · Reportes: errores de Storage ignorados — **Corregido**

- **Área:** `app/jefe/reportes/page.tsx`
- **Hallazgo:** el `list()` del bucket y `createSignedUrl` descartaban sus
  errores: un fallo de Storage se confundía con "no hay reportes" (ofreciendo
  regenerar un PDF que sí existe).
- **Corrección:** `list()` con error lanza; `createSignedUrl` con error se
  registra y la fila queda sin link. Mes sin datos y bucket vacío ya estaban
  cubiertos (fila "faltante" con botón "Generar ahora"; el PDF de un mes sin
  cierres se genera con totales 0 y tasa "—").

### H-28 · `CRON_SECRET` comparado sin tiempo constante — **Corregido**

- **Área:** `app/api/cron/reportes/route.ts`
- **Hallazgo:** la verificación con `!==` permite, en teoría, inferir el
  secreto por timing. El contrato principal ya se cumplía (sin secreto
  configurado o header incorrecto → 401 sin generar nada).
- **Corrección:** comparación con `crypto.timingSafeEqual` (mismo
  comportamiento externo).

### Estado tras el paso 6

- `npm run lint` y `npm run build`: **verdes**.

## Paso 7 — RLS contra la matriz de SPEC 02

Revisión política por política. Las políticas de **filas** coincidían con la
matriz; el hueco sistemático estaba en las **columnas** (RLS no limita qué
columnas toca un UPDATE). Migración correctiva:
`20260612000003_spec10_rls_correcciones.sql` (**aplicada en Supabase**).

| Tabla | Matriz SPEC 02 | Hallazgo | Resultado |
|---|---|---|---|
| `areas` | solo SELECT autenticados | conforme | ✓ sin cambio |
| `profiles` | UPDATE solo el propio usuario | **H-11**: cualquier columna, incluido `rol` | ✗ corregido |
| `solicitudes` | filas por rol correctas | **H-29**: columnas sin acotar | ✗ corregido |
| `technician_status` | UPDATE propio; INSERT service_role | columnas sin acotar; INSERT propio añadido en H-17 | ✗ corregido / desviación documentada |
| bucket `reportes` | privado | sin políticas en `storage.objects` → solo service_role y URLs firmadas | ✓ sin cambio |

### H-11 · `profiles.rol` auto-editable — **Corregido** (cierre del pendiente del Paso 3)

- **Corrección:** privilegios por columna — `REVOKE UPDATE` genérico y
  `GRANT UPDATE (username, telefono, email, lugar, area, puesto,
  primer_ingreso)`. `rol`, `dni`, `id` y `created_at` quedan inmutables para
  el usuario. Probado: `update profiles set rol='jefe'` con sesión de
  técnico → `permission denied`.

### H-29 · Columnas de `solicitudes` y `technician_status` sin acotar — **Corregido**

- **Hallazgo:** la política de filas dejaba que un trabajador seteara
  `confirmacion_tecnico = true` o `tecnico_id` en sus propias solicitudes
  (auto-cerrarse el ticket falseando la doble confirmación), y que un
  técnico editara `titulo`/`descripcion` o reasignara el `tecnico_id` de su
  fila de estado.
- **Corrección:** `GRANT UPDATE` solo de `estado, tecnico_id,
  confirmacion_trabajador, confirmacion_tecnico` en `solicitudes` y de
  `estado, ubicacion, atendiendo_solicitud_id` en `technician_status`.
  Se verificó previamente que TODAS las queries del código caen dentro de
  los grants (greps de `.update({...})`); además `profiles` ganó el trigger
  de `updated_at` que le faltaba.
- **Nota:** un trabajador aún puede, vía API, poner su propia solicitud en
  estados que la UI no ofrece (p. ej. `solucionado` directo con
  `confirmacion_trabajador`); un `CHECK` de transiciones por trigger se
  evaluó y se **descartó** por complejidad frente al riesgo (solo afecta a
  sus propias filas y a sus propias métricas). Anotado como candidato a
  spec futuro si se quiere blindar.

### H-30 · RPCs ejecutables por `anon` — **Corregido**

- **Hallazgo:** Postgres concede `EXECUTE` a PUBLIC por defecto:
  `get_posicion_en_cola` (SECURITY DEFINER) era invocable sin sesión y
  filtraba el tamaño de la cola.
- **Corrección:** `REVOKE ... FROM public, anon` + `GRANT` a
  `authenticated, service_role` para ambas RPC.

### Pruebas negativas ejecutadas (criterio de aceptación)

Batería real contra el proyecto Supabase con el cliente `anon` y sesión del
técnico de prueba — 10/10 PASS:

- anon: no ejecuta `get_posicion_en_cola`; no lee `solicitudes`.
- técnico: no cambia su `rol` (permission denied, verificado que sigue
  `tecnico`); no inserta en `areas` ni en `solicitudes`; no edita `titulo`;
  no toca la fila de estado de otro técnico (0 filas por RLS); no reasigna
  `tecnico_id`.
- controles positivos: SÍ actualiza su propia fila de estado y su propio
  `telefono` (columnas concedidas) — los flujos legítimos siguen vivos.

### Estado tras el paso 7

- Migración `20260612000003` **aplicada en Supabase**; sin cambios de código
  TypeScript en este paso (lint/build siguen verdes del paso 6).

## Paso 8 — Manejo de errores de UI

### H-31 · Ningún segmento tenía `error.tsx` ni `not-found.tsx` propio — **Corregido**

- **Área:** `app/`
- **Hallazgo:** un error no controlado en cualquier Server Component (incluidos
  los `throw` añadidos en los pasos 4–6) mostraba la pantalla de error
  genérica de Next en inglés, sin botón de recuperación. El 404 también era
  el genérico.
- **Corrección:** componente compartido `components/pantalla-error.tsx`
  (cliente, registra el error en consola, muestra mensaje genérico en
  español + `digest` + botón "Reintentar" con `unstable_retry()` — la API de
  recuperación de esta versión de Next, que re-fetchea y re-renderiza el
  segmento). Boundaries delgados en: `app/error.tsx` (raíz: cubre primer
  ingreso, recuperación y raíz), `app/login/error.tsx`,
  `app/trabajador/error.tsx`, `app/tecnico/error.tsx`, `app/jefe/error.tsx`
  (estos tres renderizan dentro de su layout, conservando el header).
  `app/not-found.tsx` con 404 en español y link al inicio. Nota: en
  producción Next enmascara el mensaje de los errores de servidor (solo
  expone `digest`), por eso la pantalla no depende de `error.message`.

### Feedback de actions — verificado, sin hallazgos nuevos

Las cuatro superficies ya muestran el error de toda action que falla:
formularios de auth (`state.error` inline), panel del trabajador (inline en
los 3 formularios), panel del técnico (toast para la colisión de "Atender
ahora" + inline en el resto), jefe (mensajes en filas y modales, reportes
inline). Los casos que antes fallaban EN SILENCIO eran los de "0 filas
afectadas", corregidos en H-13/H-25.

### Estado tras el paso 8

- `npm run lint` y `npm run build`: **verdes**.
