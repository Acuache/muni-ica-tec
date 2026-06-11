import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rangoMesLima, mesActualISO, formatMesLabel } from '@/lib/reportes/fechas'
import { obtenerFilasYResumen } from '@/lib/reportes/generar'
import { construirPdfReporte } from '@/lib/reportes/pdf'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.redirect(new URL('/login', request.url))
  if (user.user_metadata?.rol !== 'jefe') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const mes = mesActualISO()
  const { inicio } = rangoMesLima(mes)
  // Límite superior exclusivo con margen para incluir todo lo actualizado
  // hasta el momento de la solicitud (updated_at no puede ser futuro).
  const fin = new Date(Date.now() + 1000).toISOString()

  const resultado = await obtenerFilasYResumen(inicio, fin)
  if ('error' in resultado) {
    return NextResponse.json({ error: resultado.error }, { status: 500 })
  }

  const pdf = construirPdfReporte(
    `Reporte mensual (parcial) — ${formatMesLabel(mes)}`,
    resultado.resumen,
    resultado.filas,
  )

  return new NextResponse(pdf.slice(), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="reporte-${mes}-parcial.pdf"`,
    },
  })
}
