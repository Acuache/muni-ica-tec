'use client'

import { useEffect, useState } from 'react'
import { IconRefresh } from '@tabler/icons-react'

function formatTiempo(ms: number): string {
  const seg = Math.floor(ms / 1000)
  if (seg < 60) return `hace ${seg} seg`
  const min = Math.floor(seg / 60)
  return `hace ${min} min`
}

/**
 * Etiqueta "actualizado hace X" + botón de refresco manual.
 * Aislada en su propio componente para que su tick por segundo NO
 * re-renderice las secciones de datos del panel (SPEC 11, paso 5).
 */
export default function EtiquetaActualizado({
  lastRefreshed,
  onRefresh,
  className = 'mb-4 flex items-center gap-2',
}: {
  lastRefreshed: Date
  onRefresh: () => void
  className?: string
}) {
  const [label, setLabel] = useState('ahora')

  useEffect(() => {
    const tick = () => {
      const diff = Date.now() - lastRefreshed.getTime()
      setLabel(diff < 5000 ? 'ahora' : formatTiempo(diff))
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [lastRefreshed])

  return (
    <div className={className}>
      <span className="text-xs text-gray-400">actualizado {label}</span>
      <button
        type="button"
        onClick={onRefresh}
        aria-label="Refrescar"
        className="rounded p-0.5 text-gray-400 transition-colors hover:text-blue-600"
      >
        <IconRefresh size={14} />
      </button>
    </div>
  )
}
