import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PANEL_POR_ROL, type RolApp } from '@/lib/autorizacion'
import DatosPerfil from '@/components/datos-perfil'

export default async function TecnicoPerfilPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('primer_ingreso, username, telefono, email, rol')
    .eq('id', user.id)
    .single()

  if (profileError) {
    throw new Error('No se pudo cargar tu perfil. Recarga la página.')
  }

  if (profile?.primer_ingreso) redirect('/primer-ingreso')

  if (profile?.rol !== 'tecnico') {
    redirect(PANEL_POR_ROL[profile?.rol as RolApp] ?? '/login')
  }

  return (
    <>
      <h1 className="mb-4 text-xl font-bold text-gray-900">Mi perfil</h1>
      <DatosPerfil
        username={profile?.username ?? ''}
        telefono={profile?.telefono ?? null}
        email={profile?.email ?? null}
        rol={profile?.rol ?? 'tecnico'}
      />
    </>
  )
}
