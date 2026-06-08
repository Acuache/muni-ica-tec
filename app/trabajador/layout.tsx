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

  const { data: profile } = await supabase
    .from('profiles')
    .select('username')
    .eq('id', user.id)
    .single()

  return (
    <TrabajadorShell username={profile?.username ?? ''}>
      {children}
    </TrabajadorShell>
  )
}
