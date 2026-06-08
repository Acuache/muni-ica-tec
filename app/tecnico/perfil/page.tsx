import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import DatosPerfil from '@/components/datos-perfil'

export default async function TecnicoPerfilPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('primer_ingreso, username, dni, telefono, email, rol')
    .eq('id', user.id)
    .single()

  if (profile?.primer_ingreso) redirect('/primer-ingreso')

  return (
    <>
      <h1 className="mb-4 text-xl font-bold text-gray-900">Mi perfil</h1>
      <DatosPerfil
        username={profile?.username ?? ''}
        dni={profile?.dni ?? null}
        telefono={profile?.telefono ?? null}
        email={profile?.email ?? null}
        rol={profile?.rol ?? 'tecnico'}
      />
    </>
  )
}
