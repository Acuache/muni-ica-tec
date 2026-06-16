// Helpers de adjuntos (SPEC 12) — se ejecutan en el navegador.
// Comprimen imágenes a webp con canvas (sin dependencias externas) y
// validan PDFs por tipo y tamaño. No importar desde un Server Component.

/** Tamaño máximo de una imagen ya comprimida a webp. */
export const IMG_MAX_BYTES = 1_000_000 // 1 MB
/** Tamaño máximo de un PDF (≈ 5 páginas con imágenes). */
export const PDF_MAX_BYTES = 3_000_000 // 3 MB
/** Formatos de imagen que el navegador decodifica de forma fiable con canvas. */
export const IMG_INPUT_TYPES = ['image/jpeg', 'image/png', 'image/webp']
/** Calidad de compresión webp. */
export const WEBP_QUALITY = 0.8
/** Lado mayor (px) al que se reescala la imagen antes de comprimir. */
export const WEBP_MAX_LADO = 1920

export type ComprimirResultado =
  | { ok: true; blob: Blob; nombre: string; tamano: number }
  | { ok: false; error: string }

export type ValidarResultado = { ok: true } | { ok: false; error: string }

/** Cambia la extensión del nombre original por `.webp`. */
function nombreWebp(nombre: string): string {
  const base = nombre.replace(/\.[^./\\]+$/, '')
  return `${base || 'imagen'}.webp`
}

/** Dibuja el bitmap en un canvas y lo exporta como Blob webp. */
async function aBlobWebp(
  bitmap: ImageBitmap,
  ancho: number,
  alto: number,
): Promise<Blob | null> {
  if (typeof OffscreenCanvas !== 'undefined') {
    const canvas = new OffscreenCanvas(ancho, alto)
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.drawImage(bitmap, 0, 0, ancho, alto)
    return canvas.convertToBlob({ type: 'image/webp', quality: WEBP_QUALITY })
  }

  const canvas = document.createElement('canvas')
  canvas.width = ancho
  canvas.height = alto
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.drawImage(bitmap, 0, 0, ancho, alto)
  return new Promise((resolve) =>
    canvas.toBlob((b) => resolve(b), 'image/webp', WEBP_QUALITY),
  )
}

/**
 * Comprime una imagen JPG/PNG/WEBP a webp. Reescala al lado mayor ≤ 1920 px
 * y exporta con calidad 0.8. Rechaza si el formato no es decodificable
 * (p. ej. HEIC) o si el resultado supera 1 MB.
 */
export async function comprimirImagenAWebp(
  file: File,
): Promise<ComprimirResultado> {
  if (!IMG_INPUT_TYPES.includes(file.type)) {
    return { ok: false, error: 'Formato no soportado. Usa JPG, PNG o WEBP.' }
  }

  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    return { ok: false, error: 'No se pudo leer la imagen. Formato no soportado.' }
  }

  try {
    const ladoMayor = Math.max(bitmap.width, bitmap.height)
    const escala = ladoMayor > WEBP_MAX_LADO ? WEBP_MAX_LADO / ladoMayor : 1
    const ancho = Math.round(bitmap.width * escala)
    const alto = Math.round(bitmap.height * escala)

    const blob = await aBlobWebp(bitmap, ancho, alto)
    if (!blob) {
      return { ok: false, error: 'No se pudo procesar la imagen en este navegador.' }
    }
    if (blob.size > IMG_MAX_BYTES) {
      return {
        ok: false,
        error:
          'La imagen sigue pesando más de 1 MB tras comprimir. Reduce su tamaño e inténtalo de nuevo.',
      }
    }
    return { ok: true, blob, nombre: nombreWebp(file.name), tamano: blob.size }
  } finally {
    bitmap.close()
  }
}

/** Valida que el archivo sea un PDF de ≤ 3 MB. */
export function validarPdf(file: File): ValidarResultado {
  if (file.type !== 'application/pdf') {
    return { ok: false, error: 'El archivo debe ser un PDF.' }
  }
  if (file.size > PDF_MAX_BYTES) {
    return { ok: false, error: 'El PDF supera el máximo de 3 MB.' }
  }
  return { ok: true }
}
