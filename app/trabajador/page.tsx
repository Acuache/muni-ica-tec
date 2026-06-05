import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import TrabajadorPanel from './panel'

export default async function TrabajadorPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('primer_ingreso, username')
    .eq('id', user.id)
    .single()

  if (profile?.primer_ingreso) redirect('/primer-ingreso')

  const [{ data: areas }, { data: solicitudActiva }] = await Promise.all([
    supabase
      .from('areas')
      .select('id, nombre')
      .order('nombre'),
    supabase
      .from('solicitudes')
      .select('id, area_id, tipo_ayuda, titulo, descripcion, estado, tecnico_id, created_at')
      .eq('trabajador_id', user.id)
      .in('estado', ['en_espera', 'en_proceso'])
      .limit(1)
      .maybeSingle(),
  ])

  let posicionCola = 0
  let tecnicos: { id: string; username: string }[] = []

  if (solicitudActiva) {
    const [{ data: posicion }, { data: tecnicosData }] = await Promise.all([
      supabase.rpc('get_posicion_en_cola', { p_solicitud_id: solicitudActiva.id }),
      supabase
        .from('profiles')
        .select('id, username')
        .eq('rol', 'tecnico')
        .order('username'),
    ])
    posicionCola = posicion ?? 0
    tecnicos = tecnicosData ?? []
  }

  return (
    <TrabajadorPanel
      username={profile?.username ?? ''}
      areas={areas ?? []}
      solicitudActiva={solicitudActiva ?? null}
      posicionCola={posicionCola}
      tecnicos={tecnicos}
    />
  )
}
