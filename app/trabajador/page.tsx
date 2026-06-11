import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import TrabajadorPanel from './panel'

export default async function TrabajadorPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('primer_ingreso, lugar, area, puesto')
    .eq('id', user.id)
    .single()

  if (profile?.primer_ingreso) redirect('/primer-ingreso')

  const { data: solicitudActiva } = await supabase
    .from('solicitudes')
    .select('id, area_id, tipo_ayuda, titulo, descripcion, estado, tecnico_id, created_at')
    .eq('trabajador_id', user.id)
    .or('estado.eq.en_espera,and(estado.eq.en_proceso,confirmacion_trabajador.eq.false)')
    .limit(1)
    .maybeSingle()

  let posicionCola = 0
  let tecnicoNombre: string | null = null

  if (solicitudActiva) {
    const tecnicoQuery = solicitudActiva.tecnico_id
      ? supabase
          .from('profiles')
          .select('username')
          .eq('id', solicitudActiva.tecnico_id)
          .single()
      : null

    const [{ data: posicion }, tecnicoResult] = await Promise.all([
      supabase.rpc('get_posicion_en_cola', { p_solicitud_id: solicitudActiva.id }),
      tecnicoQuery,
    ])
    posicionCola = posicion ?? 0
    tecnicoNombre = tecnicoResult?.data?.username ?? null
  }

  return (
    <TrabajadorPanel
      solicitudActiva={solicitudActiva ?? null}
      posicionCola={posicionCola}
      tecnicoNombre={tecnicoNombre}
      lugar={profile?.lugar ?? null}
      area={profile?.area ?? null}
      puesto={profile?.puesto ?? null}
    />
  )
}
