import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { PANEL_POR_ROL, type RolApp } from '@/lib/autorizacion'
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

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('primer_ingreso, rol')
    .eq('id', user.id)
    .single()

  if (profileError) {
    throw new Error('No se pudo cargar tu perfil. Recarga la página.')
  }

  if (profile?.primer_ingreso) redirect('/primer-ingreso')

  // Esta página usa el cliente service-role para el bucket: el rol real
  // (de la base, no de metadata) es la única barrera. No quitarla.
  if (profile?.rol !== 'jefe') {
    redirect(PANEL_POR_ROL[profile?.rol as RolApp] ?? '/login')
  }

  const admin = createAdminClient()
  const { data: archivos, error: archivosError } = await admin.storage.from('reportes').list()

  if (archivosError) {
    throw new Error('No se pudieron cargar los reportes. Recarga la página.')
  }

  const existentes = new Set((archivos ?? []).map((archivo) => archivo.name))

  const reportes: ReporteMes[] = await Promise.all(
    ultimosMesesCerrados(3).map(async (mes) => {
      const label = formatMesLabel(mes)
      const nombre = `${mes}.pdf`

      if (!existentes.has(nombre)) {
        return { mes, label, url: null, faltante: true }
      }

      const { data, error: signedError } = await admin.storage
        .from('reportes')
        .createSignedUrl(nombre, SIGNED_URL_TTL_SEG)

      // Si no se pudo firmar la URL se muestra la fila sin link utilizable.
      if (signedError) {
        console.error(`JefeReportesPage: createSignedUrl falló para ${nombre}`, signedError)
      }

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
