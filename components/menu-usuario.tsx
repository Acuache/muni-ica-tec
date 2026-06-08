'use client'

import { useState } from 'react'
import Link from 'next/link'
import { DropdownMenu } from 'radix-ui'
import { IconChevronDown } from '@tabler/icons-react'
import CerrarSesionDialog from '@/components/cerrar-sesion-dialog'

type Props = {
  username: string
  perfilHref: string
}

export default function MenuUsuario({ username, perfilHref }: Props) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)

  return (
    <>
      <DropdownMenu.Root open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenu.Trigger asChild>
          <button
            type="button"
            className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100"
          >
            <span>{username}</span>
            <IconChevronDown size={18} />
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="end"
            sideOffset={8}
            className="min-w-40 rounded-lg border border-gray-200 bg-white p-1 shadow-lg"
          >
            <DropdownMenu.Item asChild>
              <Link
                href={perfilHref}
                className="block cursor-pointer rounded-md px-3 py-2 text-sm text-gray-700 outline-none hover:bg-gray-100 focus:bg-gray-100"
              >
                Perfil
              </Link>
            </DropdownMenu.Item>
            <DropdownMenu.Item
              onSelect={(event) => {
                event.preventDefault()
                setMenuOpen(false)
                setTimeout(() => setDialogOpen(true), 0)
              }}
              className="cursor-pointer rounded-md px-3 py-2 text-sm text-gray-700 outline-none hover:bg-gray-100 focus:bg-gray-100"
            >
              Salir sesión
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

      <CerrarSesionDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </>
  )
}
