import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import TecnicoShell from './shell'

export default async function TecnicoLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Solo el nombre del header (decorativo): si falla se degrada a vacío.
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('username')
    .eq('id', user.id)
    .single()

  if (profileError) {
    console.error('TecnicoLayout: lectura de username falló', profileError)
  }

  return (
    <TecnicoShell username={profile?.username ?? ''}>
      {children}
    </TecnicoShell>
  )
}
