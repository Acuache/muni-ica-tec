'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function logout() {
  const supabase = await createClient()
  // Aunque signOut falle (p. ej. sesión ya expirada), se redirige igual:
  // el proxy bloqueará cualquier ruta protegida si la sesión sigue viva.
  const { error } = await supabase.auth.signOut()
  if (error) {
    console.error('logout: signOut falló', error)
  }
  redirect('/login')
}
