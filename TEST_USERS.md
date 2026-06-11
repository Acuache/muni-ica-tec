# Usuarios de prueba — Soporte Municipal

Estos usuarios sirven para probar la app localmente. Créalos una sola vez desde
el Dashboard de Supabase (Auth → Users → Add user) o con el Admin SDK.
**Reemplazar credenciales antes de producción.**

---

## Usuarios existentes (creados en SPEC 02)

### Jefe de informática

| Campo      | Valor                  |
| ---------- | ---------------------- |
| Email      | `jefe@muni-ica.gob.pe` |
| Contraseña | `Jefe2026!`            |
| Username   | `jefe_informatica`     |
| Rol        | `jefe`                 |

### Técnico 1

| Campo      | Valor                      |
| ---------- | -------------------------- |
| Email      | `tecnico1@muni-ica.gob.pe` |
| Contraseña | `Tecnico2026!`             |
| Username   | `tecnico_01`               |
| Rol        | `tecnico`                  |

### Técnico 2

| Campo      | Valor                      |
| ---------- | -------------------------- |
| Email      | `tecnico2@muni-ica.gob.pe` |
| Contraseña | `Tecnico2026!`             |
| Username   | `tecnico_02`               |
| Rol        | `tecnico`                  |

---

## Usuario pendiente de crear (necesario para SPEC 04 y 05)

### Trabajador

| Campo      | Valor                           |
| ---------- | ------------------------------- |
| Email      | `trabajador100@muni-ica.gob.pe` |
| Contraseña | `trabajador100`               |
| Username   | `trabajador_01`                 |
| Rol        | `trabajador`                    |

**Cómo crearlo** desde el Dashboard de Supabase:

1. Ir a **Authentication → Users → Add user**.
2. Email: `trabajador1@muni-ica.gob.pe` · Contraseña: `Trabajador2026!`
3. Marcar **Auto Confirm User**.
4. En **User Metadata** pegar:
   ```json
   { "rol": "trabajador", "username": "trabajador_01" }
   ```
5. Guardar. El trigger `handle_new_user` crea la fila en `profiles` automáticamente.

---

## Notas para probar SPEC 04

Para verificar el flujo de **primer ingreso** necesitas un usuario con
`profiles.primer_ingreso = true` (el valor por defecto al crear cualquier usuario).

- Los usuarios recién creados tienen `primer_ingreso = true` por defecto.
- Si ya completaste el formulario con alguno, puedes resetear el flag:

  ```sql
  -- Ejecutar en Supabase Dashboard → SQL Editor
  update profiles set primer_ingreso = true where email = 'trabajador1@muni-ica.gob.pe';
  ```

Para probar la **recuperación de contraseña**, asegúrate de que el proyecto
Supabase tenga configurada la URL de redirección en:
**Authentication → URL Configuration → Redirect URLs**:

```
http://localhost:3000/**
```

---

## Resumen rápido

| Usuario                       | Contraseña        | Panel destino | Primer ingreso al crear |
| ----------------------------- | ----------------- | ------------- | ----------------------- |
| `jefe@muni-ica.gob.pe`        | `Jefe2026!`       | `/jefe`       | `true`                  |
| `tecnico1@muni-ica.gob.pe`    | `Tecnico2026!`    | `/tecnico`    | `true`                  |
| `tecnico2@muni-ica.gob.pe`    | `Tecnico2026!`    | `/tecnico`    | `true`                  |
| `trabajador1@muni-ica.gob.pe` | `Trabajador2026!` | `/trabajador` | `true`                  |
