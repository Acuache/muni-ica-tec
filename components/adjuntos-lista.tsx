'use client'

import { useState } from 'react'
import { IconPhoto, IconFileTypePdf, IconDownload } from '@tabler/icons-react'
import { descargarAdjunto } from '@/app/adjuntos/actions'
import { formatTamano, type AdjuntoVista } from '@/lib/adjuntos/tipos'

/**
 * Lista de adjuntos con descarga vía URL firmada (SPEC 12). Reutilizada por
 * el trabajador (seguimiento), el técnico (solicitud activa) y el jefe (tabla).
 * Solo muestra nombre + tamaño; no previsualiza.
 */
export default function AdjuntosLista({
  adjuntos,
  titulo,
}: {
  adjuntos: AdjuntoVista[]
  titulo?: string
}) {
  const [cargando, setCargando] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function descargar(id: string) {
    setError(null)
    setCargando(id)
    try {
      const res = await descargarAdjunto(id)
      if ('error' in res) {
        setError(res.error)
        return
      }
      window.open(res.url, '_blank', 'noopener,noreferrer')
    } finally {
      setCargando(null)
    }
  }

  if (adjuntos.length === 0) return null

  return (
    <div>
      {titulo && (
        <p className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-400">
          {titulo}
        </p>
      )}
      <ul className="space-y-1.5">
        {adjuntos.map((a) => (
          <li
            key={a.id}
            className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5"
          >
            {a.tipo === 'imagen' ? (
              <IconPhoto size={16} className="shrink-0 text-blue-600" />
            ) : (
              <IconFileTypePdf size={16} className="shrink-0 text-red-600" />
            )}
            <span className="min-w-0 flex-1 truncate text-xs text-gray-800">
              {a.nombre_original}
            </span>
            <span className="shrink-0 text-[11px] text-gray-400">
              {formatTamano(a.tamano_bytes)}
            </span>
            <button
              type="button"
              onClick={() => descargar(a.id)}
              disabled={cargando === a.id}
              aria-label={`Descargar ${a.nombre_original}`}
              className="inline-flex shrink-0 items-center gap-1 rounded border border-gray-300 px-2 py-0.5 text-[11px] font-medium text-gray-600 transition-colors hover:border-blue-400 hover:text-blue-600 disabled:opacity-50"
            >
              <IconDownload size={14} />
              {cargando === a.id ? '…' : 'Descargar'}
            </button>
          </li>
        ))}
      </ul>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  )
}
