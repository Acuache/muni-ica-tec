'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { IconHome, IconUser } from '@tabler/icons-react'
import CerrarSesionDialog from '@/components/cerrar-sesion-dialog'

type Props = {
  username: string
  children: React.ReactNode
}

function NavTab({
  href,
  label,
  Icon,
  active,
}: {
  href: string
  label: string
  Icon: React.ComponentType<{ size?: number; className?: string }>
  active: boolean
}) {
  return (
    <Link
      href={href}
      className={`flex flex-1 flex-col items-center gap-1 py-2 ${active ? 'text-blue-600' : 'text-gray-400'}`}
    >
      {active ? (
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600">
          <Icon size={18} className="text-white" />
        </div>
      ) : (
        <Icon size={22} />
      )}
      <span className={`text-xs ${active ? 'font-medium' : ''}`}>{label}</span>
    </Link>
  )
}

export default function TecnicoShell({ username, children }: Props) {
  const pathname = usePathname()
  const inicial = username.charAt(0).toUpperCase()
  const enPerfil = pathname === '/tecnico/perfil'

  return (
    <div className="flex min-h-full flex-col bg-gray-50">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3">
        <CerrarSesionDialog />
        <span className="text-base font-semibold text-blue-700">
          Soporte Municipal
        </span>
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-sm font-semibold text-white">
          {inicial}
        </div>
      </header>

      {/* Contenido principal */}
      <main className="flex-1 overflow-y-auto px-4 py-5">{children}</main>

      {/* Barra de navegación inferior */}
      <nav className="flex border-t border-gray-200 bg-white">
        <NavTab href="/tecnico" label="Inicio" Icon={IconHome} active={!enPerfil} />
        <NavTab href="/tecnico/perfil" label="Perfil" Icon={IconUser} active={enPerfil} />
      </nav>
    </div>
  )
}
