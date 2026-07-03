# Anuncio — Lanzamiento de "Muni Tec"

Pieza gráfica (1080×1080) para anunciar la nueva plataforma de soporte técnico de la
Municipalidad Provincial de Ica, creada por la **8.6. Unidad de Tecnologías de Información**.

Construida con el sistema de diseño de la app (crema `#FFFFC8` + negro + dorado `--primary`,
tipografías **Roboto Slab** + **Geist**) y los logos reales del repo.

## Archivos

| Archivo | Qué es |
|---|---|
| `plantilla.html` | **Fuente editable.** Referencia logos y fuentes por ruta relativa. Edita aquí el diseño/textos. |
| `construir.mjs` | Genera `anuncio-muni-tec.html` incrustando fuentes y logos como base64 (entregable autónomo/portátil). |
| `anuncio-muni-tec.html` | Salida autónoma: abre en cualquier navegador, sin internet ni el repo. |
| `exportar-png.mjs` | Renderiza el anuncio a PNG con Chromium (Playwright), 1080×1080 @2x = 2160×2160. |
| `anuncio-muni-tec.png` | **La imagen final** para compartir. |

## Regenerar

```bash
node anuncio/construir.mjs      # (re)genera el HTML autónomo con recursos embebidos
node anuncio/exportar-png.mjs   # (re)genera anuncio-muni-tec.png
```

Si Chromium no está instalado: `npx playwright install chromium`.

## Ajustes rápidos

Todo se edita en `plantilla.html` (luego re-corre los dos comandos):
- Textos: titular `¡Ya está aquí!`, bajada, badge `En marcha · Julio 2026`.
- Para exactamente 1080×1080 (sin @2x), baja `deviceScaleFactor` a `1` en `exportar-png.mjs`.
