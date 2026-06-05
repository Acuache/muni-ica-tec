import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const PANEL: Record<string, string> = {
  trabajador: '/trabajador',
  tecnico: '/tecnico',
  jefe: '/jefe',
}

const PROTECTED = ['/trabajador', '/tecnico', '/jefe', '/primer-ingreso']

export default async function proxy(request: NextRequest) {
  // supabaseResponse must be returned (or its cookies copied) on every path
  // so that @supabase/ssr can refresh the session token when needed.
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const path = request.nextUrl.pathname
  const rol = user?.user_metadata?.rol as string | undefined
  const panel = rol ? PANEL[rol] : undefined

  const isProtected = PROTECTED.some((p) => path.startsWith(p))
  const isPublic = path === '/' || path === '/login'

  // Sin sesión intentando acceder a ruta protegida → /login
  if (!user && isProtected) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Con sesión en /primer-ingreso: si ya completó el primer ingreso → panel del rol
  if (user && panel && path === '/primer-ingreso') {
    const { data: profile } = await supabase
      .from('profiles')
      .select('primer_ingreso')
      .eq('id', user.id)
      .single()

    if (profile && !profile.primer_ingreso) {
      const url = request.nextUrl.clone()
      url.pathname = panel
      return NextResponse.redirect(url)
    }
  }

  // Con sesión en ruta pública → panel del rol
  if (user && panel && isPublic) {
    const url = request.nextUrl.clone()
    url.pathname = panel
    return NextResponse.redirect(url)
  }

  // Con sesión en ruta de otro rol → panel propio
  if (user && panel && isProtected && !path.startsWith(panel)) {
    const url = request.nextUrl.clone()
    url.pathname = panel
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
