'use client'

import { useEffect, useRef } from 'react'
import { IconCircleCheckFilled } from '@tabler/icons-react'

type Props = {
  open: boolean
  onClose: () => void
  titulo?: string
  mensaje: string
}

/**
 * Modal de confirmación de éxito. Centrado, cierra con Escape, click fuera o el
 * botón Aceptar. Reutilizable para cualquier acción que termine bien.
 */
export default function ModalExito({
  open,
  onClose,
  titulo = '¡Listo!',
  mensaje,
}: Props) {
  const botonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    botonRef.current?.focus()
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-exito-titulo"
        className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col items-center text-center">
          <IconCircleCheckFilled size={48} className="text-green-500" />
          <h2
            id="modal-exito-titulo"
            className="mt-3 text-base font-semibold text-gray-900"
          >
            {titulo}
          </h2>
          <p className="mt-1 text-sm text-gray-600">{mensaje}</p>
          <button
            ref={botonRef}
            type="button"
            onClick={onClose}
            className="mt-5 w-full rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-700"
          >
            Aceptar
          </button>
        </div>
      </div>
    </div>
  )
}
