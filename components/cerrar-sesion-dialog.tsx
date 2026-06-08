'use client'

import { AlertDialog } from 'radix-ui'
import { logout } from '@/app/actions/auth'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export default function CerrarSesionDialog({ open, onOpenChange }: Props) {
  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 bg-black/40" />
        <AlertDialog.Content className="fixed top-1/2 left-1/2 w-[90vw] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white p-5 shadow-lg">
          <AlertDialog.Title className="text-base font-semibold text-gray-900">
            ¿Seguro que quieres cerrar sesión?
          </AlertDialog.Title>
          <AlertDialog.Description className="mt-1 text-sm text-gray-500">
            Tendrás que volver a iniciar sesión para acceder a tu panel.
          </AlertDialog.Description>
          <div className="mt-5 flex justify-end gap-3">
            <AlertDialog.Cancel asChild>
              <button
                type="button"
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100"
              >
                Cancelar
              </button>
            </AlertDialog.Cancel>
            <form action={logout}>
              <button
                type="submit"
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700"
              >
                Cerrar sesión
              </button>
            </form>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  )
}
