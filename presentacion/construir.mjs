/**
 * construir.mjs — Genera el archivo único `presentacion.html`.
 *
 * Toma `plantilla.html` (que referencia las imágenes en `capturas/`) y las
 * incrusta como data URIs base64, produciendo un solo .html portátil y offline.
 *
 *   node presentacion/construir.mjs              # presentación principal
 *   node presentacion/construir.mjs trabajador   # variante: plantilla-trabajador.html
 *
 * Con un argumento <nombre>, lee `plantilla-<nombre>.html` y escribe
 * `presentacion-<nombre>.html` (sin argumento mantiene el comportamiento por defecto).
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const DIR = dirname(fileURLToPath(import.meta.url))
const variante = process.argv[2]?.trim()
const sufijo = variante ? `-${variante}` : ''
const plantilla = join(DIR, `plantilla${sufijo}.html`)
const salida = join(DIR, `presentacion${sufijo}.html`)

if (!existsSync(plantilla)) {
  console.error(`✗ No existe la plantilla: plantilla${sufijo}.html`)
  process.exit(1)
}

const EXT_MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', svg: 'image/svg+xml', gif: 'image/gif' }

let html = readFileSync(plantilla, 'utf8')
let incrustadas = 0
let totalBytes = 0
const faltantes = []

html = html.replace(/src="capturas\/([^"]+)"/g, (m, rel) => {
  const ruta = join(DIR, 'capturas', rel)
  if (!existsSync(ruta)) { faltantes.push(rel); return m }
  const ext = rel.split('.').pop().toLowerCase()
  const mime = EXT_MIME[ext] || 'application/octet-stream'
  const buf = readFileSync(ruta)
  totalBytes += buf.length
  incrustadas++
  return `src="data:${mime};base64,${buf.toString('base64')}"`
})

if (faltantes.length) {
  console.error('⚠ Imágenes no encontradas en capturas/:', faltantes.join(', '))
}

writeFileSync(salida, html, 'utf8')
const kb = (n) => (n / 1024).toFixed(0)
console.log(`✅ presentacion${sufijo}.html generado`)
console.log(`   imágenes incrustadas: ${incrustadas} (${kb(totalBytes)} KB en base64)`)
console.log(`   archivo final:        ${kb(Buffer.byteLength(html, 'utf8'))} KB`)
console.log(`   ubicación:            presentacion/presentacion${sufijo}.html`)
