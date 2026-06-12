'use client'

import { useEffect } from 'react'
import { IconAlertTriangle } from '@tabler/icons-react'

// Pantalla compartida por los error.tsx de cada segmento. En producción
// Next enmascara el mensaje de los errores de servidor (solo llega el
// digest), así que el texto es genérico y el detalle queda en los logs.
export default function PantallaError({
  error,
  onRetry,
}: {
  error: Error & { digest?: string }
  onRetry: () => void
}) {
  useEffect(() => {
    console.error('PantallaError:', error)
  }, [error])

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 py-12 text-center">
      <IconAlertTriangle size={40} className="mb-3 text-amber-500" />
      <h1 className="text-lg font-semibold text-gray-900">Algo salió mal</h1>
      <p className="mt-1 max-w-sm text-sm text-gray-500">
        No se pudo cargar esta pantalla. Vuelve a intentarlo; si el problema
        continúa, comunícate con el área de informática.
      </p>
      {error.digest && (
        <p className="mt-2 text-xs text-gray-400">Código: {error.digest}</p>
      )}
      <button
        type="button"
        onClick={onRetry}
        className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
      >
        Reintentar
      </button>
    </div>
  )
}
