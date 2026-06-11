import { config } from 'dotenv'
config({ path: '.env.local' })

import { ultimosMesesCerrados, formatMesLabel } from '@/lib/reportes/fechas'
import { generarReporteMensual } from '@/lib/reportes/generar'

async function main() {
  // Orden ascendente (más antiguo primero) para que la retención no borre
  // nada de más durante el backfill.
  const meses = ultimosMesesCerrados(3).reverse()

  for (const mes of meses) {
    const resultado = await generarReporteMensual(mes)
    if ('error' in resultado) {
      console.error(`❌ ${mes} (${formatMesLabel(mes)}):`, resultado.error)
    } else {
      console.log(`✅ ${mes} (${formatMesLabel(mes)}) generado`)
    }
  }
}

main()
