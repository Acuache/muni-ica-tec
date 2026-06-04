# Borrador de specs — Soporte Municipal (muni-ica-tec)

Este documento **no es un spec**. Es el mapa que explica en cuántos specs conviene
partir la app, qué entra en cada uno y cómo dependen entre sí, para que los escribas
**uno por uno con `/spec`**. Cada bloque de aquí abajo es la materia prima para una
sesión de `/spec`: te da el objetivo en una frase, qué incluir, qué dejar fuera y de
qué specs depende. **No copies estos bloques como si fueran el spec final**: el spec
real lo construye `/spec` contigo, sección por sección.

## Principios que seguimos al partir

- **Un spec = un objetivo en una sola frase.** Si no cabe en una frase, se parte.
- **Cada spec deja el sistema funcionando.** Nada de "media feature".
- **Las dependencias van hacia abajo.** Un spec solo depende de specs anteriores ya
  implementados, nunca de uno posterior.
- **MVP primero, avanzado después.** Decisión tomada: arrancamos con el núcleo
  (Fase 1) y dejamos historial/export y notificaciones para la Fase 2.

## Decisiones ya cerradas (no las reabras al escribir cada spec)

- **Usuarios:** los crea el equipo (no hay auto-registro). Para el trabajador se
  guardan: **DNI, usuario, contraseña, teléfono y correo**.
- **Primer ingreso:** la primera vez que entra, el usuario debe registrar su
  **celular y correo** para poder recuperar la contraseña en el futuro.
- **Tiempo real:** en el MVP **no** usamos Supabase Realtime. Refresco
  manual/polling, pero mostrando **"última actualización hace X"**. Realtime queda
  como spec futuro y opcional.
- **Avanzado (Fase 2):** historial + exportación y notificaciones van en specs
  aparte. Las métricas/escalamiento del jefe sí son parte del núcleo (van en su panel).
- **Plataforma:** Next.js + Supabase. Nada más. (Ver `CLAUDE.md`.)

## Mapa de dependencias

```
Fase 1 — MVP
  01 Cimientos (Next + Supabase)
        └─ 02 Esquema de datos + RLS
              ├─ 03 Auth y enrutado por rol
              │      └─ 04 Primer ingreso + recuperar contraseña
              └─ 05 Trabajador: pedir y seguir ayuda      (usa 02, 03)
                     └─ 06 Técnico: cola y atención        (usa 02, 03, 05)
                            └─ 07 Jefe: panel de control   (usa 02, 03, 05, 06)

Fase 2 — Avanzado
  08 Historial + exportación        (usa 07)
  09 Notificaciones                 (usa 05, 06, 07)
  10 Tiempo real (opcional/futuro)  (usa 06, 07)
```

Orden recomendado para correr `/spec`: **01 → 02 → 03 → 04 → 05 → 06 → 07**, y luego
**08 / 09** cuando el MVP esté en pie. El 10 solo si decides reemplazar el polling.

---

# Fase 1 — MVP

## SPEC 01 — Cimientos: Next.js + Supabase

- **Objetivo (1 frase):** dejar el proyecto conectado a Supabase con clientes de
  servidor y de navegador y las variables de entorno listas.
- **Incluye:** instalar `@supabase/supabase-js` y `@supabase/ssr`; clientes
  server/browser; variables de entorno; verificar la conexión con una consulta trivial.
- **Fuera de alcance:** tablas, login, UI de roles (eso es 02 y 03).
- **Depende de:** nada. Es el cimiento.
- **Pista de criterio de aceptación:** la app levanta y una página de prueba lee algo
  de Supabase sin errores.

## SPEC 02 — Esquema de base de datos + RLS base

- **Objetivo (1 frase):** crear las tablas núcleo y sus políticas RLS para soportar
  usuarios, roles y solicitudes.
- **Incluye (mínimo a modelar):**
  - **Perfil/usuario** con rol (`jefe`, `tecnico`, `trabajador`) y los campos del
    trabajador (DNI, usuario, teléfono, correo). La contraseña la gestiona Supabase Auth.
  - **Solicitud/ticket:** área, tipo de ayuda (`presencial` / `virtual`), título,
    descripción, estado (p. ej. `en_espera`, `en_proceso`, `solucionado`,
    `no_solucionado`), técnico asignado, marcas de tiempo.
  - **Estado del técnico:** `disponible` / `atendiendo` / `en_oficina` / `virtual` /
    `descanso`, ubicación, a quién ayuda, última actualización.
  - **Áreas** (Tesorería, Urbanismo, Rentas, etc.) si las quieres normalizadas.
  - **RLS:** cada rol ve y modifica solo lo que le corresponde.
- **Fuera de alcance:** la UI, los formularios, la lógica de cola. Aquí solo datos.
- **Depende de:** 01.
- **Pista de criterio de aceptación:** las tablas existen, los enums están definidos y
  un usuario de un rol no puede leer datos que no le tocan (RLS probado).

## SPEC 03 — Autenticación y enrutado por rol

- **Objetivo (1 frase):** permitir el login con usuario/contraseña a usuarios creados
  por el equipo y enrutar a cada rol a su panel.
- **Incluye:** pantalla de login; sesión con Supabase Auth; `proxy` (middleware de
  Next 16) que protege rutas; redirección por rol al panel correcto.
- **Fuera de alcance:** auto-registro (no existe), primer ingreso y recuperación
  (eso es 04), el contenido de cada panel (05/06/07).
- **Depende de:** 01, 02.
- **Pista de criterio de aceptación:** un trabajador, un técnico y un jefe inician
  sesión y aterrizan cada uno en su panel; una ruta ajena a su rol queda bloqueada.

## SPEC 04 — Primer ingreso + recuperación de contraseña

- **Objetivo (1 frase):** forzar al usuario a registrar celular y correo en su primer
  login y permitirle recuperar la contraseña después.
- **Incluye:** detección de "primer ingreso"; formulario obligatorio de celular +
  correo; flujo de recuperación de contraseña vía correo (Supabase Auth).
- **Fuera de alcance:** edición general del perfil más allá de estos campos.
- **Depende de:** 03.
- **Pista de criterio de aceptación:** un usuario nuevo no puede usar la app sin
  completar celular y correo; y puede solicitar el reinicio de contraseña por correo.
- **Nota:** si prefieres menos specs, 03 y 04 podrían fusionarse. Recomendación:
  mantenerlos separados; el primer ingreso tiene su propia lógica y vale aislarla.

## SPEC 05 — Trabajador: pedir y seguir ayuda

- **Objetivo (1 frase):** que el trabajador cree una solicitud, vea su posición en la
  cola, la cancele y confirme la resolución.
- **Incluye:** formulario "Nueva Solicitud" (área, tipo de ayuda, título,
  descripción); pantalla de estado ("En espera", "Hay N personas esperando antes que
  tú"); botón cancelar; bloque "¿Se ha resuelto?" con "¿quién te ayudó?" y
  Resuelto / No resuelto.
- **Fuera de alcance:** cómo el técnico atiende (06) y cómo el jefe supervisa (07).
- **Depende de:** 02, 03 (y 04 para el flujo completo de cuenta).
- **Pista de criterio de aceptación:** una solicitud creada aparece en estado "en
  espera"; el trabajador puede cancelarla; y al confirmar Resuelto/No resuelto, la
  solicitud cierra con ese resultado.

## SPEC 06 — Técnico: cola y atención

- **Objetivo (1 frase):** que el técnico vea la cola, atienda solicitudes, cambie su
  estado y vea sus métricas del día.
- **Incluye:** lista de "Cola de Espera" con "Atender ahora"; selector de estado
  (Disponible / En Oficina / Virtual / Descanso); tarjetas "Esperando" y "Finalizadas
  hoy".
- **Fuera de alcance:** la vista global del jefe (07) y notificaciones (09).
- **Depende de:** 02, 03, 05 (tiene que haber solicitudes que atender).
- **Pista de criterio de aceptación:** al pulsar "Atender ahora" la solicitud pasa a
  "en proceso" y queda asignada a ese técnico; el cambio de estado del técnico se
  refleja y persiste.

## SPEC 07 — Jefe: panel de control

- **Objetivo (1 frase):** que el jefe vea KPIs, la cola completa y el estado de los
  técnicos con indicador de "última actualización hace X".
- **Incluye:** tarjetas KPI (esperando ayuda, solucionados hoy + tasa de éxito, no
  solucionados / requieren escalamiento); tabla de cola completa; bloque "Estado
  Técnicos" (quién atiende, dónde, a quién); refresco por polling con la etiqueta
  "actualizado hace X / En Vivo".
- **Fuera de alcance:** historial filtrable y exportación (08); notificaciones (09);
  realtime verdadero (10).
- **Depende de:** 02, 03, 05, 06.
- **Pista de criterio de aceptación:** los KPIs reflejan los datos reales; la cola y el
  estado de técnicos se refrescan solos y muestran hace cuánto se actualizaron.

---

# Fase 2 — Avanzado (después del MVP)

## SPEC 08 — Historial y exportación

- **Objetivo (1 frase):** dar al jefe un historial filtrable y exportable de las
  solicitudes atendidas.
- **Incluye:** tabla "Historial Reciente" (fecha, área, técnico, resultado); filtros;
  exportación (CSV como base).
- **Depende de:** 07.

## SPEC 09 — Notificaciones

- **Objetivo (1 frase):** avisar a cada rol de los eventos que le importan mediante la
  campana de la barra superior.
- **Incluye:** campana con contador; eventos como nueva solicitud (técnico/jefe),
  asignación (trabajador), resolución (jefe).
- **Depende de:** 05, 06, 07.

## SPEC 10 — Tiempo real (opcional / futuro)

- **Objetivo (1 frase):** reemplazar el polling por suscripciones de Supabase Realtime.
- **Incluye:** cola, estado de técnicos y KPIs en vivo sin recargar.
- **Depende de:** 06, 07.
- **Nota:** solo si el polling del MVP se queda corto. No es necesario para entregar.

---

## Cómo usar este borrador

1. Empieza por el **SPEC 01** y corre `/spec` describiéndolo en una frase.
2. `/spec` te hará preguntas y construirá el archivo en `specs/01-...md` (estado `Borrador`).
3. Revísalo tú, cámbialo a `Aprobado` a mano, y corre `/spec-impl 01-...`.
4. Cuando 01 esté implementado, pasa al 02, y así sucesivamente respetando el mapa de
   dependencias de arriba.

> Mantén este `spec-draft.md` actualizado: si al escribir un spec descubres que una
> pieza merece su propio spec, anótala aquí antes de que se cuele "de paso" en otro.
