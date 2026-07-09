import { createClient } from '@supabase/supabase-js'

// Server-side only — uses service_role key to bypass RLS.
// Never import this from client components.
// Guarda en runtime en vez del paquete `server-only`: los scripts de Node
// (scripts/verificar-reportes.ts) también importan este módulo y ese paquete
// lanza error fuera del contexto react-server.
if (typeof window !== 'undefined') {
  throw new Error(
    'lib/supabase/admin.ts es solo de servidor: no importarlo desde componentes cliente.',
  )
}

export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}
