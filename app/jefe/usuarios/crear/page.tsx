import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PANEL_POR_ROL, type RolApp } from '@/lib/autorizacion'
import CrearUsuarioFormulario from './formulario'

export default async function JefeUsuariosCrearPage() {
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

  if (profile?.rol !== 'jefe') {
    redirect(PANEL_POR_ROL[profile?.rol as RolApp] ?? '/login')
  }

  // Catálogo para los selects de ubicación: cliente de servidor AUTENTICADO
  // (la sesión del jefe). Con el anónimo, RLS devolvería vacío (SPEC 13).
  const [sedesRes, areasRes, subareasRes] = await Promise.all([
    supabase.from('sedes').select('id, nombre').order('orden'),
    supabase.from('areas').select('id, sede_id, nombre').order('orden'),
    supabase.from('subareas').select('id, area_id, nombre').order('orden'),
  ])

  return (
    <div className="mx-auto w-full max-w-2xl">
      <h1 className="mb-4 text-xl font-bold text-gray-900">Crear usuario</h1>
      <CrearUsuarioFormulario
        sedes={sedesRes.data ?? []}
        areas={areasRes.data ?? []}
        subareas={subareasRes.data ?? []}
      />
    </div>
  )
}
