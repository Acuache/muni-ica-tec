import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Solo rutas internas: un `next` absoluto ("https://…") o protocol-relative
// ("//evil.com") convertiría este callback en un open redirect.
function destinoSeguro(next: string | null): string {
  if (next && next.startsWith('/') && !next.startsWith('//') && !next.includes('\\')) {
    return next
  }
  return '/login'
}

export async function GET(request: NextRequest) {
  const url = request.nextUrl
  const code = url.searchParams.get('code')
  const next = destinoSeguro(url.searchParams.get('next'))
  const origin = url.origin

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      return NextResponse.redirect(new URL(next, origin))
    }
  }

  // Código inválido, expirado o ya usado.
  return NextResponse.redirect(
    new URL('/actualizar-contrasena?error=link_invalido', origin),
  )
}
