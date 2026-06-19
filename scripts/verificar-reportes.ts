import { config } from 'dotenv'
config({ path: '.env.local' })

import { strict as assert } from 'node:assert'
import { createAdminClient } from '@/lib/supabase/admin'
import { ultimosMesesCerrados, formatMesLabel } from '@/lib/reportes/fechas'
import { generarReporteMensual } from '@/lib/reportes/generar'

// Verificación end-to-end del sistema de reportes mensuales contra el Supabase
// real, sin dañar los 3 reportes vigentes:
//   PRUEBA 1 — los 3 últimos meses cerrados se guardan en el bucket `reportes`.
//   PRUEBA 2 — al superar 3 reportes, la retención autoelimina el más antiguo.
// El único archivo que añade (un 4º mes más antiguo) lo borra la propia
// retención, así que el estado final vuelve a ser exactamente los 3 esperados.

const RE_REPORTE = /^\d{4}-\d{2}\.pdf$/

async function listarReportes(): Promise<string[]> {
  const admin = createAdminClient()
  const { data, error } = await admin.storage.from('reportes').list()
  if (error) throw new Error(`No se pudo listar el bucket 'reportes': ${error.message}`)
  return (data ?? [])
    .map((a) => a.name)
    .filter((n) => RE_REPORTE.test(n))
    .sort()
}

// Mes anterior a un "YYYY-MM" dado (para construir un 4º mes más antiguo).
function mesAnterior(mesISO: string): string {
  const [anio, mes] = mesISO.split('-').map(Number)
  return mes === 1 ? `${anio - 1}-12` : `${anio}-${String(mes - 1).padStart(2, '0')}`
}

async function main() {
  console.log('🔎 Verificación del sistema de reportes mensuales\n')

  const esperados = [...ultimosMesesCerrados(3)].sort() // ascendente: ["2026-03","2026-04","2026-05"]
  const archivosEsperados = esperados.map((m) => `${m}.pdf`)

  const inicial = await listarReportes()
  console.log('Estado inicial del bucket:', inicial)
  console.log('Meses esperados (últimos 3 cerrados):', esperados, '\n')

  // ── PRUEBA 1: se guardan los 3 últimos meses ──────────────────────────────
  console.log('▶ PRUEBA 1 — Guardado de los 3 últimos meses')
  // Orden ascendente para que la retención no borre nada de más durante el test.
  for (const mes of esperados) {
    const r = await generarReporteMensual(mes)
    if ('error' in r) throw new Error(`Falló la generación de ${mes}: ${r.error}`)
    console.log(`  ✅ Generado y guardado ${mes} (${formatMesLabel(mes)})`)
  }
  const trasGuardado = await listarReportes()
  console.log('  Bucket tras guardado:', trasGuardado)
  assert.deepEqual(
    trasGuardado,
    archivosEsperados,
    `Se esperaba ${JSON.stringify(archivosEsperados)} y hay ${JSON.stringify(trasGuardado)}`,
  )
  console.log('  ✔ PRUEBA 1 OK: los 3 últimos meses están guardados.\n')

  // ── PRUEBA 2: autoeliminado del más antiguo (retención = 3) ───────────────
  console.log('▶ PRUEBA 2 — Autoeliminado del más antiguo al superar 3')
  const mesExtra = mesAnterior(esperados[0]) // un 4º mes, más antiguo que todos
  console.log(`  Generando un 4º reporte más antiguo: ${mesExtra} (${formatMesLabel(mesExtra)})`)
  const rExtra = await generarReporteMensual(mesExtra)
  if ('error' in rExtra) throw new Error(`Falló la generación de ${mesExtra}: ${rExtra.error}`)

  const trasRetencion = await listarReportes()
  console.log('  Bucket tras añadir el 4º mes:', trasRetencion)
  assert.ok(
    !trasRetencion.includes(`${mesExtra}.pdf`),
    `El 4º mes más antiguo (${mesExtra}.pdf) debió autoeliminarse, pero sigue presente.`,
  )
  assert.equal(
    trasRetencion.length,
    3,
    `Debe haber exactamente 3 reportes, hay ${trasRetencion.length}.`,
  )
  assert.deepEqual(
    trasRetencion,
    archivosEsperados,
    `Tras la retención debían quedar ${JSON.stringify(archivosEsperados)}.`,
  )
  console.log('  ✔ PRUEBA 2 OK: el más antiguo se autoeliminó; quedan exactamente 3.\n')

  console.log('✅✅ TODAS LAS PRUEBAS PASARON')
  console.log('Estado final del bucket:', trasRetencion)
}

main().catch((err) => {
  console.error('\n❌ FALLO EN LA VERIFICACIÓN DE REPORTES')
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
