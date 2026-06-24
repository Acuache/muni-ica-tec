import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PANEL_POR_ROL, type RolApp } from '@/lib/autorizacion'
import DatosPerfil from '@/components/datos-perfil'
import { cargarUbicacionPerfil } from '@/app/perfil/ubicacion'

export default async function TrabajadorPerfilPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('primer_ingreso, username, telefono, email, rol, sede, area, subarea, puesto')
    .eq('id', user.id)
    .single()

  if (profileError) {
    throw new Error('No se pudo cargar tu perfil. Recarga la página.')
  }

  if (profile?.primer_ingreso) redirect('/primer-ingreso')

  if (profile?.rol !== 'trabajador') {
    redirect(PANEL_POR_ROL[profile?.rol as RolApp] ?? '/login')
  }

  const ubicacion = await cargarUbicacionPerfil(supabase, profile)

  return (
    <>
      <h1 className="mb-4 text-xl font-bold text-gray-900">Mi perfil</h1>
      <DatosPerfil
        username={profile?.username ?? ''}
        telefono={profile?.telefono ?? null}
        email={profile?.email ?? null}
        rol={profile?.rol ?? 'trabajador'}
        puesto={profile?.puesto ?? null}
        sedes={ubicacion.sedes}
        areas={ubicacion.areas}
        subareas={ubicacion.subareas}
        defaultSedeId={ubicacion.defaultSedeId}
        defaultAreaId={ubicacion.defaultAreaId}
        defaultSubareaId={ubicacion.defaultSubareaId}
      />
    </>
  )
}
