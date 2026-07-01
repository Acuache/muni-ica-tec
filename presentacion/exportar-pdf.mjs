/**
 * exportar-pdf.mjs — Genera `presentacion.pdf` a partir de `presentacion.html`.
 *
 * Método: captura cada diapositiva con Chromium en modo pantalla (donde los
 * fondos y degradados se renderizan perfectamente) y arma el PDF con jsPDF,
 * una imagen a página completa por diapositiva (apaisado 1440×900). Así el PDF
 * queda idéntico al deck proyectado, sin depender de la paginación de @media print.
 *
 *   node presentacion/construir.mjs   # primero regenera el HTML
 *   node presentacion/exportar-pdf.mjs
 *
 *   node presentacion/construir.mjs trabajador      # variante
 *   node presentacion/exportar-pdf.mjs trabajador
 *
 * Con un argumento <nombre>, lee `presentacion-<nombre>.html` y escribe
 * `presentacion-<nombre>.pdf` (sin argumento mantiene el comportamiento por defecto).
 */
import { chromium } from 'playwright'
import { jsPDF } from 'jspdf'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'
import { writeFileSync, existsSync } from 'node:fs'

const DIR = dirname(fileURLToPath(import.meta.url))
const variante = process.argv[2]?.trim()
const sufijo = variante ? `-${variante}` : ''
const htmlPath = join(DIR, `presentacion${sufijo}.html`)
const htmlUrl = pathToFileURL(htmlPath).href
const pdfPath = join(DIR, `presentacion${sufijo}.pdf`)

if (!existsSync(htmlPath)) {
  console.error(`✗ No existe presentacion${sufijo}.html. Corre primero: node presentacion/construir.mjs ${variante ?? ''}`.trim())
  process.exit(1)
}

const W = 1440, H = 900

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 2 })
await page.goto(htmlUrl, { waitUntil: 'load' })

// Ocultar los controles del deck para las capturas.
await page.addStyleTag({ content: '.nav,.secflag,.hint,.overview{display:none!important}' })

const total = await page.evaluate(() => document.querySelectorAll('.slide').length)

const doc = new jsPDF({ orientation: 'landscape', unit: 'px', format: [W, H] })

for (let n = 1; n <= total; n++) {
  await page.evaluate((i) => { location.hash = '#d' + i }, n)
  await page.waitForTimeout(180)
  const buf = await page.screenshot({ type: 'jpeg', quality: 92, clip: { x: 0, y: 0, width: W, height: H } })
  const dataUrl = 'data:image/jpeg;base64,' + buf.toString('base64')
  if (n > 1) doc.addPage([W, H], 'landscape')
  doc.addImage(dataUrl, 'JPEG', 0, 0, W, H)
  process.stdout.write(`  · diapositiva ${n}/${total}\r`)
}

await browser.close()
const ab = doc.output('arraybuffer')
writeFileSync(pdfPath, Buffer.from(ab))
console.log(`\n✅ presentacion${sufijo}.pdf generado (${total} páginas) en presentacion/presentacion${sufijo}.pdf`)
