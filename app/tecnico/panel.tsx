'use client'

import { useCallback, useEffect, useState, useActionState } from 'react'
import { useRouter } from 'next/navigation'
import {
  IconRefresh,
  IconCheck,
  IconBuilding,
  IconDeviceLaptop,
  IconCoffee,
  IconClock,
  IconCircleCheck,
  IconAlertCircle,
} from '@tabler/icons-react'
import { cambiarEstado, atenderAhora, liberarSolicitud } from './actions'
import type { ActionState } from './actions'
import type { TecnicoEstado, SolicitudActiva, SolicitudCola } from './page'

type Props = {
  estadoTecnico: TecnicoEstado
  esperando: number
  finalizadasHoy: number
  solicitudActiva: SolicitudActiva | null
  cola: SolicitudCola[]
}

type EstadoConfig = {
  label: string
  value: string
  Icon: React.ComponentType<{ size?: number; className?: string }>
}

const ESTADO_CONFIG: EstadoConfig[] = [
  { label: 'Disponible', value: 'disponible', Icon: IconCheck },
  { label: 'En Oficina', value: 'en_oficina', Icon: IconBuilding },
  { label: 'Virtual',    value: 'virtual',    Icon: IconDeviceLaptop },
  { label: 'Descanso',   value: 'descanso',   Icon: IconCoffee },
]

const COLISION_MSG = 'Este turno ya fue tomado por otro técnico.'

function formatTiempo(ms: number): string {
  const seg = Math.floor(ms / 1000)
  if (seg < 60) return `hace ${seg} seg`
  const min = Math.floor(seg / 60)
  return `hace ${min} min`
}

function ordinalCola(n: number): string {
  if (n === 1) return '1ero en cola'
  if (n === 2) return '2do en cola'
  if (n === 3) return '3ero en cola'
  return `${n}to en cola`
}

export default function TecnicoPanel({
  estadoTecnico,
  esperando,
  finalizadasHoy,
  solicitudActiva,
  cola,
}: Props) {
  const router = useRouter()
  const [lastRefreshed, setLastRefreshed] = useState<Date>(() => new Date())
  const [tiempoLabel, setTiempoLabel] = useState('ahora')
  const [toast, setToast] = useState<string | null>(null)

  // Polling cada 3 minutos
  useEffect(() => {
    const id = setInterval(() => {
      router.refresh()
      setLastRefreshed(new Date())
    }, 180_000)
    return () => clearInterval(id)
  }, [router])

  // Etiqueta "actualizado hace X"
  useEffect(() => {
    const id = setInterval(() => {
      const diff = Date.now() - lastRefreshed.getTime()
      setTiempoLabel(diff < 5000 ? 'ahora' : formatTiempo(diff))
    }, 1000)
    return () => clearInterval(id)
  }, [lastRefreshed])

  // Auto-ocultar toast tras 4 s
  useEffect(() => {
    if (!toast) return
    const id = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(id)
  }, [toast])

  function handleRefresh() {
    router.refresh()
    setLastRefreshed(new Date())
  }

  const handleColision = useCallback(() => {
    setToast(COLISION_MSG)
    router.refresh()
    setLastRefreshed(new Date())
  }, [router])

  return (
    <>
      {/* Toast de colisión */}
      {toast && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-800">
          <IconAlertCircle size={16} className="shrink-0 text-orange-500" />
          {toast}
        </div>
      )}

      {/* Etiqueta de actualización + botón manual */}
      <div className="mb-4 flex items-center gap-2">
        <span className="text-xs text-gray-400">actualizado {tiempoLabel}</span>
        <button
          type="button"
          onClick={handleRefresh}
          aria-label="Refrescar"
          className="rounded p-0.5 text-gray-400 transition-colors hover:text-blue-600"
        >
          <IconRefresh size={14} />
        </button>
      </div>

      <div className="space-y-4">
        {/* Métricas: ESPERANDO y FINALIZADAS HOY */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                Esperando
              </p>
              <p className="mt-1 text-3xl font-bold text-orange-600">{esperando}</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-100">
              <IconClock size={20} className="text-orange-500" />
            </div>
          </div>
          <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                Finalizadas hoy
              </p>
              <p className="mt-1 text-3xl font-bold text-green-600">{finalizadasHoy}</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
              <IconCircleCheck size={20} className="text-green-500" />
            </div>
          </div>
        </div>

        {/* TU ESTADO ACTUAL */}
        <CardEstadoActual estadoActual={estadoTecnico} />

        {/* Solicitud activa — solo cuando atendiendo */}
        {estadoTecnico === 'atendiendo' && solicitudActiva && (
          <CardSolicitudActiva solicitud={solicitudActiva} />
        )}

        {/* Cola de Espera — oculta en descanso y atendiendo */}
        {estadoTecnico !== 'descanso' && estadoTecnico !== 'atendiendo' && (
          <ColaEspera cola={cola} onColision={handleColision} />
        )}
      </div>
    </>
  )
}

// ─── Subcomponentes ────────────────────────────────────────────────────────────

function CardEstadoActual({ estadoActual }: { estadoActual: TecnicoEstado }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    cambiarEstado,
    undefined,
  )
  const isAtendiendo = estadoActual === 'atendiendo'

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
        Tu estado actual
      </p>
      <form action={action}>
        <div className="grid grid-cols-2 gap-2">
          {ESTADO_CONFIG.map(({ label, value, Icon }) => {
            const isActive = estadoActual === value
            return (
              <button
                key={value}
                type="submit"
                name="estado"
                value={value}
                disabled={isAtendiendo || pending}
                className={[
                  'flex flex-col items-center gap-1.5 rounded-xl border py-3 text-sm font-medium transition-colors',
                  isActive
                    ? 'border-green-500 bg-green-500 text-white'
                    : 'border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100',
                  isAtendiendo || pending ? 'cursor-not-allowed opacity-60' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                <Icon
                  size={22}
                  className={isActive ? 'text-white' : 'text-gray-500'}
                />
                {label}
              </button>
            )
          })}
        </div>
      </form>
      {state?.error && (
        <p className="mt-2 text-xs text-red-600">{state.error}</p>
      )}
      {isAtendiendo && (
        <p className="mt-2 text-center text-xs text-gray-400">
          Termina tu atención actual para cambiar de estado.
        </p>
      )}
    </div>
  )
}

function CardSolicitudActiva({ solicitud }: { solicitud: SolicitudActiva }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    liberarSolicitud,
    undefined,
  )

  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-blue-600">
        Atendiendo ahora
      </p>
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
        {solicitud.area}
      </p>
      <p className="mt-0.5 font-semibold text-gray-900">{solicitud.titulo}</p>
      <p className="mt-1 text-xs text-gray-500">
        Trabajador:{' '}
        <span className="font-medium text-gray-700">{solicitud.trabajador}</span>
      </p>
      <form action={action} className="mt-3">
        <input type="hidden" name="solicitud_id" value={solicitud.id} />
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg border border-dashed border-gray-400 px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:border-red-400 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? 'Liberando…' : 'Liberar'}
        </button>
      </form>
      {state?.error && (
        <p className="mt-2 text-xs text-red-600">{state.error}</p>
      )}
    </div>
  )
}

function ColaEspera({
  cola,
  onColision,
}: {
  cola: SolicitudCola[]
  onColision: () => void
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="font-semibold text-gray-800">Cola de Espera</p>
        <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
          {cola.length} en cola
        </span>
      </div>
      {cola.length === 0 ? (
        <p className="py-4 text-center text-sm text-gray-400">
          No hay solicitudes en espera.
        </p>
      ) : (
        <div className="space-y-3">
          {cola.map((s, i) => (
            <ItemCola
              key={s.id}
              solicitud={s}
              posicion={i + 1}
              onColision={onColision}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function ItemCola({
  solicitud,
  posicion,
  onColision,
}: {
  solicitud: SolicitudCola
  posicion: number
  onColision: () => void
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    atenderAhora,
    undefined,
  )

  useEffect(() => {
    if (state?.error === COLISION_MSG) {
      onColision()
    }
  }, [state, onColision])

  return (
    <div className="rounded-lg border border-gray-200 p-3">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          {solicitud.area}
        </span>
        <span className="rounded-full bg-blue-600 px-2 py-0.5 text-xs font-medium text-white">
          {ordinalCola(posicion)}
        </span>
      </div>
      <p className="mb-3 text-sm font-semibold text-gray-900">{solicitud.titulo}</p>
      <form action={action}>
        <input type="hidden" name="solicitud_id" value={solicitud.id} />
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg border border-blue-600 px-4 py-2 text-sm font-semibold text-blue-600 transition-colors hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? 'Tomando turno…' : 'Atender ahora'}
        </button>
      </form>
      {state?.error && state.error !== COLISION_MSG && (
        <p className="mt-2 text-xs text-red-600">{state.error}</p>
      )}
    </div>
  )
}
