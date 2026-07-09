'use client'

import { memo, useEffect, useState } from 'react'
import type { TecnicoCard } from './page'
import { usePolling } from '@/lib/use-polling'
import EtiquetaActualizado from '@/components/etiqueta-actualizado'

type Props = {
  esperando: number
  solucionadosHoy: number
  noSolucionadosHoy: number
  tecnicos: TecnicoCard[]
}

export default function JefePanel(props: Props) {
  const { lastRefreshed, refresh } = usePolling(180_000)

  return (
    <>
      <EtiquetaActualizado lastRefreshed={lastRefreshed} onRefresh={refresh} />
      <ContenidoJefe {...props} />
    </>
  )
}

// Memoizado: un ciclo de polling con datos idénticos no re-renderiza el
// contenido (SPEC 11, paso 5). Las tarjetas de técnico mantienen su propio
// tick interno "Xs act." aunque el contenido no se re-renderice.
const ContenidoJefe = memo(
  function ContenidoJefe({ esperando, solucionadosHoy, noSolucionadosHoy, tecnicos }: Props) {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-6">
        <KpiCards
          esperando={esperando}
          solucionadosHoy={solucionadosHoy}
          noSolucionadosHoy={noSolucionadosHoy}
        />
        <EstadoTecnicos tecnicos={tecnicos} />
      </div>
    )
  },
  (a, b) =>
    JSON.stringify([a.esperando, a.solucionadosHoy, a.noSolucionadosHoy, a.tecnicos]) ===
    JSON.stringify([b.esperando, b.solucionadosHoy, b.noSolucionadosHoy, b.tecnicos]),
)

// ─── Subcomponentes ────────────────────────────────────────────────────────────

function KpiCards({
  esperando,
  solucionadosHoy,
  noSolucionadosHoy,
}: {
  esperando: number
  solucionadosHoy: number
  noSolucionadosHoy: number
}) {
  const tasa =
    solucionadosHoy + noSolucionadosHoy === 0
      ? '—'
      : `${Math.round((solucionadosHoy / (solucionadosHoy + noSolucionadosHoy)) * 100)}%`

  return (
    <div className="space-y-3">
      {/* Esperando ayuda */}
      <div className="flex items-start justify-between rounded-xl border border-gray-200 bg-white p-4">
        <div>
          <p className="text-sm text-gray-500">Esperando ayuda</p>
          <p className="mt-1 text-4xl font-bold text-gray-900">
            {String(esperando).padStart(2, '0')}
          </p>
        </div>
        <div className="flex h-8 w-8 items-center justify-center rounded-full border border-red-200 text-red-400">
          <span className="text-base leading-none">···</span>
        </div>
      </div>

      {/* Solucionados hoy */}
      <div className="flex items-start justify-between rounded-xl border border-gray-200 bg-white p-4">
        <div>
          <p className="text-sm text-gray-500">Solucionados hoy</p>
          <p className="mt-1 text-4xl font-bold text-gray-900">
            {String(solucionadosHoy).padStart(2, '0')}
          </p>
          <p className="mt-1 text-xs font-medium text-green-600">
            ⊙ {tasa} tasa de éxito
          </p>
        </div>
        <div className="flex h-8 w-8 items-center justify-center rounded-full border border-green-200 text-green-500">
          <span className="text-lg leading-none">✓</span>
        </div>
      </div>

      {/* No solucionados */}
      <div className="flex items-start justify-between rounded-xl border border-gray-200 bg-white p-4">
        <div>
          <p className="text-sm text-gray-500">No solucionados</p>
          <p className="mt-1 text-4xl font-bold text-gray-900">
            {String(noSolucionadosHoy).padStart(2, '0')}
          </p>
          <p className="mt-1 text-xs text-gray-500">Requieren escalamiento</p>
        </div>
        <div className="flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 text-gray-400">
          <span className="text-lg leading-none">✕</span>
        </div>
      </div>
    </div>
  )
}


const AVATAR_COLORS = [
  'bg-teal-500',
  'bg-purple-500',
  'bg-blue-500',
  'bg-orange-500',
  'bg-pink-500',
  'bg-indigo-500',
]

const ESTADO_BADGE: Record<
  TecnicoCard['estado'],
  { label: string; className: string }
> = {
  disponible: { label: 'DISPONIBLE', className: 'bg-green-500 text-white' },
  atendiendo: { label: 'ATENDIENDO', className: 'bg-blue-500 text-white' },
  en_oficina: { label: 'EN OFICINA', className: 'bg-gray-400 text-white' },
  virtual:    { label: 'VIRTUAL',    className: 'bg-gray-400 text-white' },
  descanso:   { label: 'DESCANSO',   className: 'bg-gray-400 text-white' },
}

function EstadoTecnicos({ tecnicos }: { tecnicos: TecnicoCard[] }) {
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="font-semibold text-gray-800">Estado Técnicos</p>
        <span className="flex items-center gap-1 text-xs text-green-600">
          <span className="h-2 w-2 rounded-full bg-green-500" />
          En Vivo
        </span>
      </div>
      <div className="space-y-3">
        {tecnicos.map((t, i) => (
          <TecnicoCardItem key={t.id} tecnico={t} colorIndex={i} />
        ))}
      </div>
    </div>
  )
}

function TecnicoCardItem({
  tecnico,
  colorIndex,
}: {
  tecnico: TecnicoCard
  colorIndex: number
}) {
  const [tiempoAct, setTiempoAct] = useState(() =>
    formatTiempoAct(tecnico.updatedAt),
  )

  useEffect(() => {
    const id = setInterval(() => {
      setTiempoAct(formatTiempoAct(tecnico.updatedAt))
    }, 1000)
    return () => clearInterval(id)
  }, [tecnico.updatedAt])

  const initials = tecnico.username
    .split(/[\s_]/)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .slice(0, 2)
    .join('')

  const colorClass = AVATAR_COLORS[colorIndex % AVATAR_COLORS.length]
  const badge = ESTADO_BADGE[tecnico.estado]

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white ${colorClass}`}
          >
            {initials}
          </div>
          <div>
            <p className="font-semibold text-gray-900">{tecnico.username}</p>
            <span
              className={`mt-0.5 inline-block rounded px-2 py-0.5 text-xs font-semibold ${badge.className}`}
            >
              {badge.label}
            </span>
          </div>
        </div>
        <span className="text-xs text-gray-400">{tiempoAct}</span>
      </div>

      <div className="mt-3 space-y-1 text-xs text-gray-500">
        {tecnico.ubicacion && (
          <p className="flex items-center gap-1">
            <span>📍</span>
            {tecnico.ubicacion}
          </p>
        )}
        {tecnico.estado === 'atendiendo' ? (
          <p className="flex items-center gap-1">
            <span>👤</span>
            Ayudando a:{' '}
            <span className="font-medium text-gray-700">
              {tecnico.trabajadorUsername ?? '—'}
            </span>
          </p>
        ) : (
          <p className="flex items-center gap-1">
            <span>🕐</span>
            Último ticket: {tiempoAct}
          </p>
        )}
      </div>
    </div>
  )
}

function formatTiempoAct(updatedAt: string): string {
  const ms = Date.now() - new Date(updatedAt).getTime()
  const seg = Math.floor(ms / 1000)
  if (seg < 60) return `${seg}s act.`
  const min = Math.floor(seg / 60)
  if (min < 60) return `${min}m act.`
  const horas = Math.floor(min / 60)
  if (horas < 24) return `${horas}h act.`
  return `${Math.floor(horas / 24)}d act.`
}
