import { NextResponse, type NextRequest } from 'next/server'
import { mesAnteriorISO } from '@/lib/reportes/fechas'
import { generarReporteMensual } from '@/lib/reportes/generar'

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  const authHeader = request.headers.get('authorization')

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const mes = mesAnteriorISO()
  const resultado = await generarReporteMensual(mes)

  if ('error' in resultado) {
    return NextResponse.json({ error: resultado.error, mes }, { status: 500 })
  }

  return NextResponse.json({ ok: true, mes })
}
