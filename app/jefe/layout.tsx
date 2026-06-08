import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import JefeShell from './shell'

export default async function JefeLayout({
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
    <JefeShell username={profile?.username ?? ''}>{children}</JefeShell>
  )
}
