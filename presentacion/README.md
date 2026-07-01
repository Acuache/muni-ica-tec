# Presentación — Soporte Municipal

Material para presentar el proyecto. Todo vive en esta carpeta.

## Qué hay aquí

| Archivo | Para qué sirve |
|---|---|
| **`presentacion.pdf`** | **El entregable completo para enviar/imprimir.** 21 páginas apaisadas, una por diapositiva (los tres roles). |
| **`presentacion.html`** | **El entregable completo para proyectar.** Un solo archivo autónomo (las capturas van incrustadas en base64). Ábrelo con doble clic en cualquier navegador. No necesita internet ni la carpeta `capturas/`. |
| **`presentacion-trabajador.html` / `.pdf`** | **Versión recortada solo para el trabajador** (10 diapositivas): el manual del trabajador + qué pasa mientras un técnico lo atiende. **No** habla del jefe ni de costos/tecnología. Para capacitar al personal. |
| `plantilla.html` | Fuente editable del deck completo (referencia las imágenes de `capturas/`). Edita aquí el texto y vuelve a generar. |
| `plantilla-trabajador.html` | Fuente editable de la versión del trabajador (mismas clases/JS que `plantilla.html`). |
| `construir.mjs` | Generador: toma una plantilla + `capturas/` y produce el `.html` autónomo. Acepta un argumento opcional con el nombre de la variante (ver abajo). |
| `exportar-pdf.mjs` | Convierte un `.html` en su `.pdf` con Chromium. Acepta el mismo argumento opcional de variante. |
| `capturas/` | Capturas de pantalla originales (`.png`) + el logo (`00-logo.png`). |
| `seed-demo.ts` | Crea/borra los datos demo usados para las capturas (cuentas y solicitudes de ejemplo). |

## Cómo presentar

Abre `presentacion.html` y usa:

- **← →** (o barra espaciadora): avanzar / retroceder.
- **I**: índice de diapositivas.
- **F**: pantalla completa.
- También puedes **imprimir a PDF** (Ctrl/Cmd+P): sale una diapositiva por página.

## Cómo editar y regenerar

1. Edita el texto en `plantilla.html` (deck completo) o en `plantilla-trabajador.html`
   (versión del trabajador).
2. (Opcional) Reemplaza o agrega capturas en `capturas/`.
3. Regenera el archivo único y el PDF:

   ```bash
   # Deck completo (plantilla.html → presentacion.html / .pdf)
   node presentacion/construir.mjs                 # actualiza presentacion.html
   node presentacion/exportar-pdf.mjs              # actualiza presentacion.pdf

   # Versión del trabajador (plantilla-trabajador.html → presentacion-trabajador.html / .pdf)
   node presentacion/construir.mjs trabajador      # actualiza presentacion-trabajador.html
   node presentacion/exportar-pdf.mjs trabajador   # actualiza presentacion-trabajador.pdf
   ```

   > El argumento opcional `<nombre>` apunta a `plantilla-<nombre>.html` y genera
   > `presentacion-<nombre>.html` / `.pdf`. Sin argumento se usa el deck completo.

## Datos demo (capturas)

Las capturas se tomaron con cuentas y solicitudes de ejemplo (correos `demo.*`).
Ya fueron **eliminadas** de la base tras tomar las capturas. Si necesitas volver a
generarlas (para recapturar), desde la raíz del repo:

```bash
npx tsx presentacion/seed-demo.ts          # crear datos demo
npx tsx presentacion/seed-demo.ts --clean  # borrarlos
```

> Nota: algunas capturas del panel del jefe muestran datos reales del sistema
> (nombres/correos del personal). Si la presentación es para un público externo,
> considera difuminar esos datos.
