import { createClient } from '@supabase/supabase-js'

// Server-side only — uses service_role key to bypass RLS.
// Never import this from client components.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}
