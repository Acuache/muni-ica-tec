'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { DropdownMenu } from 'radix-ui'
import { IconBell, IconChevronDown } from '@tabler/icons-react'
import LogoSoporte from '@/components/logo-soporte'
import MenuUsuario from '@/components/menu-usuario'

type Props = {
  username: string
  children: React.ReactNode
}

const NAV_LINKS = [
  { href: '/jefe',            label: 'Panel' },
  { href: '/jefe/solicitudes', label: 'Solicitudes' },
  { href: '/jefe/reportes',    label: 'Reportes' },
]

export default function JefeShell({ username, children }: Props) {
  const pathname = usePathname()
  const usuariosActivo = pathname.startsWith('/jefe/usuarios')

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

          {/* Menú desplegable "Usuario" (SPEC 14): Crear / Buscar */}
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button
                type="button"
                className={[
                  'flex items-center gap-1 border-b-2 px-3 py-2 text-sm font-medium transition-colors',
                  usuariosActivo
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700',
                ].join(' ')}
              >
                <span>Usuario</span>
                <IconChevronDown size={16} />
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                align="start"
                sideOffset={4}
                className="min-w-40 rounded-lg border border-gray-200 bg-white p-1 shadow-lg"
              >
                <DropdownMenu.Item asChild>
                  <Link
                    href="/jefe/usuarios/crear"
                    className="block cursor-pointer rounded-md px-3 py-2 text-sm text-gray-700 outline-none hover:bg-gray-100 focus:bg-gray-100"
                  >
                    Crear
                  </Link>
                </DropdownMenu.Item>
                <DropdownMenu.Item asChild>
                  <Link
                    href="/jefe/usuarios/buscar"
                    className="block cursor-pointer rounded-md px-3 py-2 text-sm text-gray-700 outline-none hover:bg-gray-100 focus:bg-gray-100"
                  >
                    Buscar
                  </Link>
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>
      </nav>

      {/* Contenido principal — sin max-w aquí; cada página lo gestiona */}
      <main className="flex-1 overflow-y-auto px-4 py-5">
        {children}
      </main>
    </div>
  )
}
