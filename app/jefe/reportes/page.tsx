import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ultimosMesesCerrados, mesActualISO, formatMesLabel, formatFechaLima } from '@/lib/reportes/fechas'
import PanelReportes from './panel'
import type { ReporteMes } from './panel'

const SIGNED_URL_TTL_SEG = 60

export default async function JefeReportesPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('primer_ingreso')
    .eq('id', user.id)
    .single()

  if (profile?.primer_ingreso) redirect('/primer-ingreso')

  const admin = createAdminClient()
  const { data: archivos } = await admin.storage.from('reportes').list()
  const existentes = new Set((archivos ?? []).map((archivo) => archivo.name))

  const reportes: ReporteMes[] = await Promise.all(
    ultimosMesesCerrados(3).map(async (mes) => {
      const label = formatMesLabel(mes)
      const nombre = `${mes}.pdf`

      if (!existentes.has(nombre)) {
        return { mes, label, url: null, faltante: true }
      }

      const { data } = await admin.storage.from('reportes').createSignedUrl(nombre, SIGNED_URL_TTL_SEG)
      return { mes, label, url: data?.signedUrl ?? null, faltante: false }
    }),
  )

  return (
    <PanelReportes
      reportes={reportes}
      mesActualLabel={formatMesLabel(mesActualISO())}
      hoyLabel={formatFechaLima(new Date().toISOString())}
    />
  )
}
