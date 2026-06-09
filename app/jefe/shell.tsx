'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { IconBell } from '@tabler/icons-react'
import LogoSoporte from '@/components/logo-soporte'
import MenuUsuario from '@/components/menu-usuario'

type Props = {
  username: string
  children: React.ReactNode
}

const NAV_LINKS = [
  { href: '/jefe',            label: 'Panel' },
  { href: '/jefe/solicitudes', label: 'Solicitudes' },
]

export default function JefeShell({ username, children }: Props) {
  const pathname = usePathname()

  return (
    <div className="flex min-h-full flex-col bg-gray-50">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white px-4 py-3">
        <div className="flex w-full items-center justify-between">
          <LogoSoporte href="/jefe" />
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label="Notificaciones"
              className="rounded-md p-1 text-gray-500 hover:bg-gray-100"
            >
              <IconBell size={20} />
            </button>
            <MenuUsuario username={username} perfilHref="/jefe/perfil" />
          </div>
        </div>
      </header>

      {/* Nav strip */}
      <nav className="border-b border-gray-200 bg-white px-4">
        <div className="flex gap-1">
          {NAV_LINKS.map(({ href, label }) => {
            const isActive =
              href === '/jefe'
                ? pathname === '/jefe'
                : pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                className={[
                  'border-b-2 px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700',
                ].join(' ')}
              >
                {label}
              </Link>
            )
          })}
        </div>
      </nav>

      {/* Contenido principal — sin max-w aquí; cada página lo gestiona */}
      <main className="flex-1 overflow-y-auto px-4 py-5">
        {children}
      </main>
    </div>
  )
}
