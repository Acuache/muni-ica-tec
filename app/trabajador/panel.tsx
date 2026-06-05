'use client'

import { useEffect, useRef, useState, useActionState } from 'react'
import { useRouter } from 'next/navigation'
import {
  IconMenu2,
  IconHome,
  IconUser,
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
type Tecnico = { id: string; username: string }

type Props = {
  username: string
  areas: Area[]
  solicitudActiva: Solicitud | null
  posicionCola: number
  tecnicos: Tecnico[]
}

function formatTiempo(ms: number): string {
  const seg = Math.floor(ms / 1000)
  if (seg < 60) return `hace ${seg} seg`
  const min = Math.floor(seg / 60)
  return `hace ${min} min`
}

export default function TrabajadorPanel({
  username,
  areas,
  solicitudActiva,
  posicionCola,
  tecnicos,
}: Props) {
  const router = useRouter()
  const inicial = username.charAt(0).toUpperCase()
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
    <div className="flex min-h-full flex-col bg-gray-50">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3">
        <button
          type="button"
          aria-label="Menú"
          className="rounded-md p-1 text-gray-500 hover:bg-gray-100"
        >
          <IconMenu2 size={22} />
        </button>
        <span className="text-base font-semibold text-blue-700">
          Soporte Municipal
        </span>
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-sm font-semibold text-white">
          {inicial}
        </div>
      </header>

      {/* Contenido principal */}
      <main className="flex-1 overflow-y-auto px-4 py-6">
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
            tecnicos={tecnicos}
            onRefresh={() => router.refresh()}
          />
        ) : (
          <FormularioNuevaSolicitud areas={areas} />
        )}
      </main>

      {/* Barra de navegación inferior */}
      <nav className="flex border-t border-gray-200 bg-white">
        <button
          type="button"
          className="flex flex-1 flex-col items-center gap-1 py-2 text-blue-600"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600">
            <IconHome size={18} className="text-white" />
          </div>
          <span className="text-xs font-medium">Inicio</span>
        </button>
        <button
          type="button"
          className="flex flex-1 flex-col items-center gap-1 py-2 text-gray-400"
        >
          <IconUser size={22} />
          <span className="text-xs">Perfil</span>
        </button>
      </nav>
    </div>
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
  tecnicos,
  onRefresh,
}: {
  solicitud: Solicitud
  posicionCola: number
  tecnicos: Tecnico[]
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
          tecnicoAsignadoId={solicitud.tecnico_id}
          tecnicos={tecnicos}
          onRefresh={onRefresh}
        />
      )}
    </div>
  )
}

function CardResolucion({
  solicitudId,
  tecnicoAsignadoId,
  tecnicos,
  onRefresh,
}: {
  solicitudId: string
  tecnicoAsignadoId: string | null
  tecnicos: Tecnico[]
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

  const selectClass =
    'mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500'

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <p className="font-semibold text-gray-800">¿Se ha resuelto el problema?</p>
      <p className="mt-1 text-xs text-gray-500">
        Por favor, confirma la resolución para cerrar el caso.
      </p>

      <form action={action} className="mt-4 space-y-4">
        <input type="hidden" name="solicitud_id" value={solicitudId} />

        <div>
          <label htmlFor="tecnico_id" className="block text-sm font-medium text-gray-700">
            ¿Quién te ayudó?
          </label>
          <select
            id="tecnico_id"
            name="tecnico_id"
            required
            defaultValue={tecnicoAsignadoId ?? ''}
            className={selectClass}
          >
            <option value="">— Selecciona un técnico —</option>
            {tecnicos.map((t) => (
              <option key={t.id} value={t.id}>
                {t.username}
              </option>
            ))}
          </select>
        </div>

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
      <p className="text-sm text-gray-700">
        Hay{' '}
        <span className="font-bold text-blue-700">
          {posicion} {posicion === 1 ? 'persona' : 'personas'}
        </span>{' '}
        esperando antes que tú
      </p>
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

