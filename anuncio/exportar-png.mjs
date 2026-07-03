/**
 * exportar-png.mjs — Renderiza el anuncio a `anuncio-muni-tec.png` (1080×1080).
 *
 * Usa Chromium (Playwright) con viewport fijo, igual que presentacion/exportar-pdf.mjs.
 * Con deviceScaleFactor 2 el PNG físico sale a 2160×2160 (nítido) manteniendo el
 * diseño lógico de 1080. Renderiza el entregable autónomo si existe; si no, la plantilla.
 *
 *   node anuncio/construir.mjs      # opcional: primero embebe recursos (autónomo)
 *   node anuncio/exportar-png.mjs
 */
import { chromium } from 'playwright'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'
import { existsSync } from 'node:fs'

const DIR = dirname(fileURLToPath(import.meta.url))
const W = 1080, H = 1080

const standalone = join(DIR, 'anuncio-muni-tec.html')
const htmlPath = existsSync(standalone) ? standalone : join(DIR, 'plantilla.html')
const htmlUrl = pathToFileURL(htmlPath).href
const pngPath = join(DIR, 'anuncio-muni-tec.png')

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 2 })
await page.goto(htmlUrl, { waitUntil: 'load' })
await page.evaluate(() => document.fonts.ready)   // esperar a que las fuentes pinten
await page.waitForTimeout(250)

await page.screenshot({ path: pngPath, clip: { x: 0, y: 0, width: W, height: H } })
await browser.close()

console.log(`✅ anuncio-muni-tec.png generado (${W}×${H} @2x = ${W * 2}×${H * 2}) en anuncio/anuncio-muni-tec.png`)
