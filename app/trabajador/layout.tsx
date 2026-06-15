import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import TrabajadorShell from './shell'

export default async function TrabajadorLayout({
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
    console.error('TrabajadorLayout: lectura de username falló', profileError)
  }

  return (
    <TrabajadorShell username={profile?.username ?? ''}>
      {children}
    </TrabajadorShell>
  )
}
