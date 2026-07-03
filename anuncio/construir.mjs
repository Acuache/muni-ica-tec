/**
 * construir.mjs — Genera el anuncio autónomo `anuncio-muni-tec.html`.
 *
 * Toma `plantilla.html` (que referencia logos y fuentes por ruta relativa) e
 * incrusta cada recurso local como data-URI base64. El resultado es un único
 * .html portátil que abre en cualquier navegador, sin internet ni el repo.
 *
 *   node anuncio/construir.mjs
 *
 * Después, para el PNG:  node anuncio/exportar-png.mjs
 */
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'
import { readFileSync, writeFileSync } from 'node:fs'

const DIR = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(DIR, '..')

// Recurso relativo (tal como aparece en la plantilla) -> ruta real + mime.
const RECURSOS = [
  { ref: '../app/fonts/roboto-slab-latin.woff2', file: 'app/fonts/roboto-slab-latin.woff2', mime: 'font/woff2' },
  { ref: '../app/fonts/geist-latin.woff2',       file: 'app/fonts/geist-latin.woff2',       mime: 'font/woff2' },
  { ref: '../public/logo/muni-tec-hover.png',    file: 'public/logo/muni-tec-hover.png',    mime: 'image/png' },
  { ref: '../assets/muni-ica.png',               file: 'assets/muni-ica.png',               mime: 'image/png' },
]

let html = readFileSync(join(DIR, 'plantilla.html'), 'utf8')

for (const { ref, file, mime } of RECURSOS) {
  const b64 = readFileSync(join(ROOT, file)).toString('base64')
  const dataUri = `data:${mime};base64,${b64}`
  if (!html.includes(ref)) {
    console.warn(`  ⚠ no se encontró la referencia ${ref} en la plantilla`)
    continue
  }
  html = html.split(ref).join(dataUri)
  process.stdout.write(`  · incrustado ${file} (${Math.round(b64.length / 1024)} KB base64)\n`)
}

const salida = join(DIR, 'anuncio-muni-tec.html')
writeFileSync(salida, html)
console.log(`\n✅ anuncio-muni-tec.html generado (autónomo) en anuncio/anuncio-muni-tec.html`)
