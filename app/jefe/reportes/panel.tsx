'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { generarReporteManual } from './actions'

export type ReporteMes = {
  mes: string
  label: string
  url: string | null
  faltante: boolean
}

type Props = {
  reportes: ReporteMes[]
  mesActualLabel: string
  hoyLabel: string
}

export default function PanelReportes({ reportes, mesActualLabel, hoyLabel }: Props) {
  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-gray-900">Reportes</h1>
        <p className="text-sm text-gray-500">
          Reportes mensuales en PDF con el resumen y el listado de solicitudes
          solucionadas y no solucionadas.
        </p>
      </div>

      {/* Reporte del mes en curso (parcial) */}
      <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-4">
        <div>
          <p className="font-semibold text-gray-900">Reporte de este mes</p>
          <p className="text-sm text-gray-500">
            {mesActualLabel} — datos desde el día 1 hasta hoy ({hoyLabel})
          </p>
        </div>
        <a
          href="/api/jefe/reportes/actual"
          className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
        >
          Descargar
        </a>
      </div>

      {/* Meses cerrados */}
      <div>
        <p className="mb-3 font-semibold text-gray-800">Meses anteriores</p>
        <div className="space-y-3">
          {reportes.map((reporte) => (
            <FilaReporte key={reporte.mes} reporte={reporte} />
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Subcomponentes ────────────────────────────────────────────────────────────

function FilaReporte({ reporte }: { reporte: ReporteMes }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleGenerar() {
    startTransition(async () => {
      const result = await generarReporteManual({ mes: reporte.mes })
      if (result?.error) {
        setError(result.error)
        return
      }
      router.refresh()
    })
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <p className="font-medium text-gray-900">{reporte.label}</p>
        {reporte.faltante ? (
          <button
            type="button"
            onClick={handleGenerar}
            disabled={isPending}
            className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending ? 'Generando…' : 'Generar ahora'}
          </button>
        ) : (
          <a
            href={reporte.url ?? '#'}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50"
          >
            Descargar
          </a>
        )}
      </div>
      {error && (
        <p className="mt-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
