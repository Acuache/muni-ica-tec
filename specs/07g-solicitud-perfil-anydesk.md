# SPEC 07g — Trabajador: datos de perfil en solicitud y campo AnyDesk

> **Estado:** Aprobado · **Depende de:** SPEC 05 (formulario original), SPEC 06 (cola del técnico), SPEC 07f (lugar/área/puesto en perfil) · **Fecha:** 2026-06-09
> **Objetivo:** Mejorar el formulario "Nueva Solicitud" mostrando los datos
> de perfil del trabajador como solo lectura, marcando descripción como
> opcional, añadiendo campo AnyDesk condicional para ayuda virtual, y
> exponiendo toda esa información en la tarjeta de cola del técnico.

## Scope

**In:**

- Eliminar el dropdown de "Área" (tabla `areas`) del formulario "Nueva Solicitud".
- Mostrar los campos `lugar`, `area` y `puesto` del perfil del trabajador como
  datos de solo lectura en la parte superior del formulario (no editables).
- Añadir label "(Opcional)" al campo descripción — sin cambiar su comportamiento.
- Si el trabajador selecciona tipo de ayuda "Virtual", aparece un campo
  "Código AnyDesk" (obligatorio, solo números, desaparece si vuelve a "Presencial").
- Migración de BD: nueva columna `anydesk_code text` (nullable) en `solicitudes`.
- El Server Action de `crearSolicitud` guarda `anydesk_code` cuando aplica y
  deja de requerir `area_id`.
- La tarjeta de solicitud en la cola del técnico (SPEC 06) muestra:
  lugar, área y puesto del trabajador (vía join con `profiles`) y, si
  `tipo_ayuda = 'virtual'`, el código AnyDesk.

**Fuera de alcance:**

- Convertir lugar, área o puesto en `<select>` — spec posterior de catálogos.
- Edición de lugar, área o puesto desde el panel del trabajador.
- Mostrar el historial de solicitudes con los nuevos campos — SPEC 08.
- Cambios en el panel del jefe de informática.
- Eliminar la columna `area_id` de `solicitudes` — se deja nullable
  y sin poblar; limpiarla requiere una migración destructiva fuera de este scope.

## Modelo de datos

### Migración: nueva columna en `solicitudes`

```sql
alter table solicitudes
  add column anydesk_code text;
```

Nullable en BD. El formulario la hace obligatoria a nivel de aplicación
cuando `tipo_ayuda = 'virtual'`.

### Columnas modificadas/utilizadas

| Tabla         | Columna        | Tipo   | Origen   | Uso en este spec                                              |
| ------------- | -------------- | ------ | -------- | ------------------------------------------------------------- |
| `solicitudes` | `anydesk_code` | `text` | Nueva    | Código AnyDesk; se guarda solo si `tipo_ayuda = 'virtual'`.  |
| `solicitudes` | `area_id`      | `uuid` | SPEC 05  | Se deja nullable; ya no se pobla desde el formulario.         |
| `profiles`    | `lugar`        | `text` | SPEC 07f | Se lee para mostrarlo como solo lectura en el formulario.     |
| `profiles`    | `area`         | `text` | SPEC 07f | Reemplaza al dropdown de `areas`; solo lectura en formulario. |
| `profiles`    | `puesto`       | `text` | SPEC 07f | Se lee para mostrarlo como solo lectura en el formulario.     |

### Consultas principales

| Propósito                              | Query                                                                                    |
| -------------------------------------- | ---------------------------------------------------------------------------------------- |
| Datos de perfil del trabajador         | `SELECT lugar, area, puesto FROM profiles WHERE id = auth.uid()`                         |
| Guardar solicitud con AnyDesk          | `INSERT INTO solicitudes (..., anydesk_code) VALUES (..., $anydesk_code)`                |
| Técnico: perfil del trabajador en cola | `SELECT p.lugar, p.area, p.puesto FROM profiles p WHERE p.id = solicitud.trabajador_id` |

## Plan de implementación

1. **Migración de BD.**
   Ejecutar `alter table solicitudes add column anydesk_code text;` en Supabase
   (Dashboard → SQL Editor o nueva migración en `supabase/migrations/`).
   Verificar: la columna aparece en `solicitudes` sin errores; las filas
   existentes tienen `anydesk_code = null`.

2. **Actualizar `app/trabajador/page.tsx`.**
   Añadir `lugar`, `area` y `puesto` a la consulta de `profiles` del trabajador
   para que lleguen como props al componente cliente.
   Verificar: los datos llegan al componente sin errores de tipo.

3. **Actualizar el formulario "Nueva Solicitud".**
   En el componente cliente (`panel.tsx` o equivalente):
   - Eliminar el dropdown de "Área" de la tabla `areas`.
   - Añadir una sección de solo lectura encima del formulario que muestre
     Lugar, Área y Puesto del perfil (texto plano, no inputs).
   - Añadir label "(Opcional)" al campo descripción; mantener su comportamiento.
   - Añadir estado local `tipoAyuda`; cuando su valor es `'virtual'`, renderizar
     el campo "Código AnyDesk" (input tipo `text`, obligatorio a nivel de form).
   - Validación del campo AnyDesk en cliente: solo dígitos (`/^\d+$/`), máximo
     25 caracteres; si no se cumple, mostrar error genérico sin mencionar el límite.
   - Al volver a "Presencial", ocultar el campo y limpiar su valor.
   Verificar: los datos de perfil se muestran correctamente; el campo AnyDesk
   aparece y desaparece según el tipo de ayuda; la validación impide enviar
   letras o campo vacío en modo virtual.

4. **Actualizar `app/trabajador/actions.ts` → `crearSolicitud`.**
   - Eliminar `area_id` del INSERT.
   - Añadir `anydesk_code` al INSERT: se incluye con su valor si
     `tipo_ayuda = 'virtual'`, se pasa `null` si es `'presencial'`.
   - Validación en el Server Action: si `tipo_ayuda = 'virtual'` y
     `anydesk_code` está vacío o contiene caracteres no numéricos, devolver error.
   Verificar: solicitud presencial → `anydesk_code` es `null` en DB; solicitud
   virtual con código → `anydesk_code` guardado correctamente; solicitud virtual
   sin código → error devuelto al formulario.

5. **Actualizar la tarjeta de solicitud en la cola del técnico.**
   En el componente de cola (`app/tecnico/`), al cargar las solicitudes en espera,
   hacer join con `profiles` para traer `lugar`, `area` y `puesto` del trabajador.
   En cada tarjeta de solicitud mostrar:
   - Lugar, Área y Puesto del trabajador.
   - Si `anydesk_code` no es null: etiqueta "Código AnyDesk: {código}".
   Verificar: una solicitud presencial no muestra el código AnyDesk; una virtual
   sí lo muestra; los datos de perfil aparecen en todas las tarjetas.

6. **Verificación final.**
   `npm run build` y `npm run lint` sin errores. Confirmar flujo completo:
   trabajador crea solicitud virtual → técnico ve tarjeta con lugar, área,
   puesto y código AnyDesk.

## Criterios de aceptación

- [x] El formulario "Nueva Solicitud" no muestra el dropdown de "Área".
- [x] Encima del formulario aparecen los datos Lugar, Área y Puesto del perfil
      del trabajador como texto de solo lectura (no editables).
- [x] El campo descripción tiene el label "(Opcional)" y sigue siendo opcional.
- [x] Al seleccionar tipo de ayuda "Virtual" aparece el campo "Código AnyDesk".
- [x] El campo "Código AnyDesk" desaparece y se limpia al volver a "Presencial".
- [x] El formulario no se puede enviar en modo "Virtual" sin código AnyDesk.
- [x] El campo AnyDesk rechaza cualquier carácter no numérico con un mensaje
      de error que no menciona el límite de caracteres.
- [x] Una solicitud presencial se guarda con `anydesk_code = null` en DB.
- [x] Una solicitud virtual se guarda con el código AnyDesk en `solicitudes.anydesk_code`.
- [x] La tarjeta de solicitud en la cola del técnico muestra Lugar, Área y Puesto
      del trabajador en todas las solicitudes.
- [x] La tarjeta del técnico muestra "Código AnyDesk: {código}" solo cuando
      `tipo_ayuda = 'virtual'`.
- [x] `npm run build` y `npm run lint` pasan sin errores.

## Decisiones

- **Sí:** eliminar el dropdown de `areas` y reemplazarlo con el `area` del
  perfil (solo lectura). El trabajador ya declaró su área en el primer ingreso;
  pedirla de nuevo era redundante y abría la posibilidad de inconsistencias.

- **Sí:** nueva columna `anydesk_code text` en `solicitudes`. Es un dato de
  la solicitud, no del perfil; guardarlo en la tabla correcta permite que el
  técnico lo lea directamente sin joins extra al perfil.

- **Sí:** información del perfil (lugar, área, puesto) expuesta en la tarjeta
  de la cola del técnico sin clic adicional. El técnico necesita ese contexto
  antes de decidir si atiende; ocultarlo detrás de un clic añade fricción.

- **Sí:** AnyDesk obligatorio cuando tipo de ayuda es "Virtual". Sin el código
  el técnico no puede conectarse; el campo vacío haría inútil la solicitud.

- **Sí:** validación solo-numérica con máximo 25 caracteres en AnyDesk, sin
  exponer el límite al trabajador. El mensaje genérico es suficiente para guiar
  al usuario sin revelar restricciones internas.

- **No:** eliminar la columna `area_id` de `solicitudes`. Requiere una migración
  destructiva (`alter table ... drop column`) que puede afectar consultas o
  vistas existentes; se deja nullable y sin poblar hasta un spec de limpieza.

- **No:** mostrar AnyDesk en el panel del jefe de informática en este spec.
  El jefe ya ve las solicitudes; los campos nuevos llegarán solos cuando se
  actualice el historial en un spec posterior.
