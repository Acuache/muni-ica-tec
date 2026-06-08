'use client'

import { IconBell } from '@tabler/icons-react'
import LogoSoporte from '@/components/logo-soporte'
import MenuUsuario from '@/components/menu-usuario'

type Props = {
  username: string
  children: React.ReactNode
}

export default function TecnicoShell({ username, children }: Props) {
  return (
    <div className="flex min-h-full flex-col bg-gray-50">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white px-4 py-3">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between">
          <LogoSoporte href="/tecnico" />
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label="Notificaciones"
              className="rounded-md p-1 text-gray-500 hover:bg-gray-100"
            >
              <IconBell size={20} />
            </button>
            <MenuUsuario username={username} perfilHref="/tecnico/perfil" />
          </div>
        </div>
      </header>

      {/* Contenido principal */}
      <main className="flex-1 overflow-y-auto px-4 py-5">
        <div className="mx-auto w-full max-w-3xl">{children}</div>
      </main>
    </div>
  )
}
