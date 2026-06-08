'use client'

import LogoSoporte from '@/components/logo-soporte'
import MenuUsuario from '@/components/menu-usuario'

type Props = {
  username: string
  children: React.ReactNode
}

export default function TrabajadorShell({ username, children }: Props) {
  return (
    <div className="flex min-h-full flex-col bg-gray-50">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white px-4 py-3">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between">
          <LogoSoporte href="/trabajador" />
          <MenuUsuario username={username} perfilHref="/trabajador/perfil" />
        </div>
      </header>

      {/* Contenido principal */}
      <main className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto w-full max-w-3xl">{children}</div>
      </main>
    </div>
  )
}
