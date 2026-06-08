'use client'

import { useEffect, useRef, useState, useActionState } from 'react'
import { useRouter } from 'next/navigation'
import {
  IconCirclePlus,
  IconUsersGroup,
  IconCircleCheck,
  IconCircleX,
  IconRefresh,
} from '@tabler/icons-react'
import { crearSolicitud, cancelarSolicitud, confirmarResolucion } from './actions'
import type { ActionState } from './actions'

type Area = { id: string; nombre: string }
type Solicitud = {
  id: string
  area_id: string
  tipo_ayuda: string
  titulo: string
  descripcion: string | null
  estado: string
  tecnico_id: string | null
  created_at: string
}
type Props = {
  areas: Area[]
  solicitudActiva: Solicitud | null
  posicionCola: number
  tecnicoNombre: string | null
}

function formatTiempo(ms: number): string {
  const seg = Math.floor(ms / 1000)
  if (seg < 60) return `hace ${seg} seg`
  const min = Math.floor(seg / 60)
  return `hace ${min} min`
}

export default function TrabajadorPanel({
  areas,
  solicitudActiva,
  posicionCola,
  tecnicoNombre,
}: Props) {
  const router = useRouter()
  const [lastRefreshed, setLastRefreshed] = useState<Date>(() => new Date())
  const [tiempoLabel, setTiempoLabel] = useState('ahora')

  // Polling cada 3 minutos — pausa si hay un campo de formulario con foco
  useEffect(() => {
    const id = setInterval(() => {
      const el = document.activeElement
      const isFormField =
        el instanceof HTMLInputElement ||
        el instanceof HTMLSelectElement ||
        el instanceof HTMLTextAreaElement
      if (!isFormField) {
        router.refresh()
        setLastRefreshed(new Date())
      }
    }, 180_000)
    return () => clearInterval(id)
  }, [router])

  // Actualizar etiqueta "actualizado hace X" cada segundo
  useEffect(() => {
    const id = setInterval(() => {
      const diff = Date.now() - lastRefreshed.getTime()
      setTiempoLabel(diff < 5000 ? 'ahora' : formatTiempo(diff))
    }, 1000)
    return () => clearInterval(id)
  }, [lastRefreshed])

  function handleRefresh() {
    router.refresh()
    setLastRefreshed(new Date())
  }

  return (
    <>
      <h1 className="mb-1 text-xl font-bold text-gray-900">
        Bienvenido, solicita ayuda ahora
      </h1>
      <p className="mb-1 text-sm text-gray-500">
        Reporta cualquier incidencia técnica de manera inmediata.
      </p>

      {/* Etiqueta de actualización + botón manual */}
      <div className="mb-5 flex items-center gap-2">
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

      {solicitudActiva ? (
        <PantallaSeguimiento
          solicitud={solicitudActiva}
          posicionCola={posicionCola}
          tecnicoNombre={tecnicoNombre}
          onRefresh={() => router.refresh()}
        />
      ) : (
        <FormularioNuevaSolicitud areas={areas} />
      )}
    </>
  )
}

function FormularioNuevaSolicitud({ areas }: { areas: Area[] }) {
  const router = useRouter()
  const [state, action, pending] = useActionState<ActionState, FormData>(
    crearSolicitud,
    undefined,
  )
  const wasPendingRef = useRef(false)

  useEffect(() => {
    if (wasPendingRef.current && !pending && state === undefined) {
      router.refresh()
    }
    wasPendingRef.current = pending
  }, [pending, state, router])

  const inputClass =
    'mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500'

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <h2 className="mb-4 flex items-center gap-2 font-semibold text-gray-800">
        <IconCirclePlus size={20} className="text-blue-600" />
        Nueva Solicitud
      </h2>

      <form action={action} className="space-y-4">
        <div>
          <label htmlFor="area_id" className="block text-sm font-medium text-gray-700">
            Área
          </label>
          <select id="area_id" name="area_id" required className={inputClass}>
            <option value="">Ej: Tesorería</option>
            {areas.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nombre}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="tipo_ayuda" className="block text-sm font-medium text-gray-700">
            Tipo de ayuda
          </label>
          <select id="tipo_ayuda" name="tipo_ayuda" required className={inputClass}>
            <option value="">Selecciona…</option>
            <option value="presencial">Presencial</option>
            <option value="virtual">Virtual</option>
          </select>
        </div>

        <div>
          <label htmlFor="titulo" className="block text-sm font-medium text-gray-700">
            Título
          </label>
          <input
            id="titulo"
            name="titulo"
            type="text"
            required
            placeholder="Resumen del problema"
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="descripcion" className="block text-sm font-medium text-gray-700">
            Descripción
          </label>
          <textarea
            id="descripcion"
            name="descripcion"
            rows={4}
            placeholder="Detalles de lo que está ocurriendo..."
            className={inputClass}
          />
        </div>

        {state?.error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            {state.error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? 'Enviando…' : 'Enviar Solicitud'}
        </button>
      </form>
    </div>
  )
}

function PantallaSeguimiento({
  solicitud,
  posicionCola,
  tecnicoNombre,
  onRefresh,
}: {
  solicitud: Solicitud
  posicionCola: number
  tecnicoNombre: string | null
  onRefresh: () => void
}) {
  return (
    <div className="space-y-4">
      <CardEstado solicitud={solicitud} />
      {solicitud.estado === 'en_espera' && (
        <CardPosicionCola posicion={posicionCola} />
      )}
      {solicitud.estado === 'en_proceso' && (
        <CardResolucion
          solicitudId={solicitud.id}
          tecnicoNombre={tecnicoNombre}
          onRefresh={onRefresh}
        />
      )}
    </div>
  )
}

function CardResolucion({
  solicitudId,
  tecnicoNombre,
  onRefresh,
}: {
  solicitudId: string
  tecnicoNombre: string | null
  onRefresh: () => void
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    confirmarResolucion,
    undefined,
  )
  const wasPendingRef = useRef(false)

  useEffect(() => {
    if (wasPendingRef.current && !pending && state === undefined) {
      onRefresh()
    }
    wasPendingRef.current = pending
  }, [pending, state, onRefresh])

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <p className="font-semibold text-gray-800">¿Se ha resuelto el problema?</p>
      <p className="mt-1 text-xs text-gray-500">
        Por favor, confirma la resolución para cerrar el caso.
      </p>

      <form action={action} className="mt-4 space-y-4">
        <input type="hidden" name="solicitud_id" value={solicitudId} />

        <p className="text-sm text-gray-700">
          El caso fue tomado por el técnico{' '}
          <span className="font-semibold text-gray-900">{tecnicoNombre}</span>
        </p>

        {state?.error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            {state.error}
          </p>
        )}

        <div className="grid grid-cols-2 gap-3">
          <button
            type="submit"
            name="resultado"
            value="solucionado"
            disabled={pending}
            className="flex items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-green-700 disabled:opacity-50"
          >
            <IconCircleCheck size={18} />
            Resuelto
          </button>
          <button
            type="submit"
            name="resultado"
            value="no_solucionado"
            disabled={pending}
            className="flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:opacity-50"
          >
            <IconCircleX size={18} />
            No resuelto
          </button>
        </div>
      </form>
    </div>
  )
}

function CardPosicionCola({ posicion }: { posicion: number }) {
  return (
    <div className="rounded-xl border border-blue-100 bg-blue-50 p-5 text-center">
      <IconUsersGroup size={40} className="mx-auto mb-3 text-blue-500" />
      {posicion === 0 ? (
        <p className="text-sm text-gray-700">
          <span className="font-bold text-blue-700">Eres el primero en la cola.</span>{' '}
          Un técnico te atenderá en unos momentos.
        </p>
      ) : (
        <p className="text-sm text-gray-700">
          Hay{' '}
          <span className="font-bold text-blue-700">
            {posicion} {posicion === 1 ? 'persona' : 'personas'}
          </span>{' '}
          esperando antes que tú
        </p>
      )}
    </div>
  )
}

const ESTADO_BADGE: Record<string, { label: string; class: string }> = {
  en_espera:      { label: 'En espera',     class: 'bg-yellow-100 text-yellow-800' },
  en_proceso:     { label: 'En proceso',    class: 'bg-blue-100 text-blue-800' },
  solucionado:    { label: 'Solucionado',   class: 'bg-green-100 text-green-800' },
  no_solucionado: { label: 'No solucionado',class: 'bg-red-100 text-red-800' },
  cancelado:      { label: 'Cancelado',     class: 'bg-gray-100 text-gray-600' },
}

function CardEstado({ solicitud }: { solicitud: Solicitud }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    cancelarSolicitud,
    undefined,
  )
  const badge = ESTADO_BADGE[solicitud.estado] ?? { label: solicitud.estado, class: 'bg-gray-100 text-gray-600' }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-700">Estado de Solicitud</p>
          <span className={`mt-1 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.class}`}>
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            {badge.label}
          </span>
        </div>
        {solicitud.estado === 'en_espera' && (
          <form action={action}>
            <input type="hidden" name="solicitud_id" value={solicitud.id} />
            <button
              type="submit"
              disabled={pending}
              className="rounded-lg border border-dashed border-gray-400 px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:border-red-400 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pending ? 'Cancelando…' : 'Cancelar ayuda'}
            </button>
          </form>
        )}
      </div>
      {state?.error && (
        <p className="mt-2 text-xs text-red-600">{state.error}</p>
      )}
    </div>
  )
}

