# Presentación — Soporte Municipal

Material para presentar el proyecto. Todo vive en esta carpeta.

## Qué hay aquí

| Archivo | Para qué sirve |
|---|---|
| **`presentacion.pdf`** | **El entregable para enviar/imprimir.** 21 páginas apaisadas, una por diapositiva. |
| **`presentacion.html`** | **El entregable para proyectar.** Un solo archivo autónomo (las capturas van incrustadas en base64). Ábrelo con doble clic en cualquier navegador. No necesita internet ni la carpeta `capturas/`. |
| `plantilla.html` | Fuente editable del deck (referencia las imágenes de `capturas/`). Edita aquí el texto y vuelve a generar. |
| `construir.mjs` | Generador: toma `plantilla.html` + `capturas/` y produce `presentacion.html`. |
| `exportar-pdf.mjs` | Convierte `presentacion.html` en `presentacion.pdf` con Chromium. |
| `capturas/` | Capturas de pantalla originales (`.png`) + el logo (`00-logo.png`). |
| `seed-demo.ts` | Crea/borra los datos demo usados para las capturas (cuentas y solicitudes de ejemplo). |

## Cómo presentar

Abre `presentacion.html` y usa:

- **← →** (o barra espaciadora): avanzar / retroceder.
- **I**: índice de diapositivas.
- **F**: pantalla completa.
- También puedes **imprimir a PDF** (Ctrl/Cmd+P): sale una diapositiva por página.

## Cómo editar y regenerar

1. Edita el texto en `plantilla.html`.
2. (Opcional) Reemplaza o agrega capturas en `capturas/`.
3. Regenera el archivo único y el PDF:

   ```bash
   node presentacion/construir.mjs     # actualiza presentacion.html
   node presentacion/exportar-pdf.mjs  # actualiza presentacion.pdf
   ```

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
