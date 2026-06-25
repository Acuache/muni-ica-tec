'use client'

import React, { memo, useEffect, useRef, useState, useActionState } from 'react'
import { useRouter } from 'next/navigation'
import {
  IconCirclePlus,
  IconUsersGroup,
  IconCircleCheck,
  IconCircleX,
  IconClock,
} from '@tabler/icons-react'
import {
  crearSolicitud,
  cancelarSolicitud,
  confirmarResolucion,
  registrarAdjuntos,
  registrarAnydeskCode,
} from './actions'
import type { ActionState } from './actions'
import { createClient } from '@/lib/supabase/client'
import type { AdjuntoMeta } from '@/lib/adjuntos/tipos'
import { usePolling } from '@/lib/use-polling'
import EtiquetaActualizado from '@/components/etiqueta-actualizado'
import AdjuntosLista from '@/components/adjuntos-lista'
import type { AdjuntoVista } from '@/lib/adjuntos/tipos'
import AdjuntosSelector, { type StagedAdjunto } from './adjuntos-selector'

type Solicitud = {
  id: string
  tipo_ayuda: string
  titulo: string
  descripcion: string | null
  estado: string
  tecnico_id: string | null
  anydesk_code: string | null
  created_at: string
}
type Props = {
  solicitudActiva: Solicitud | null
  posicionCola: number
  adjuntos: AdjuntoVista[]
  sede: string | null
  area: string | null
  subarea: string | null
  puesto: string | null
  fueraDeHorario: boolean
  proximaAperturaTexto: string | null
}

// No refrescar automáticamente mientras el usuario escribe en un campo.
function sinCampoEnfocado(): boolean {
  const el = document.activeElement
  return !(
    el instanceof HTMLInputElement ||
    el instanceof HTMLSelectElement ||
    el instanceof HTMLTextAreaElement
  )
}

export default function TrabajadorPanel(props: Props) {
  const { lastRefreshed, refresh } = usePolling(180_000, sinCampoEnfocado)

  return (
    <>
      <h1 className="mb-1 text-xl font-bold text-gray-900">
        Bienvenido, solicita ayuda ahora
      </h1>
      <p className="mb-1 text-sm text-gray-500">
        Reporta cualquier incidencia técnica de manera inmediata.
      </p>

      <EtiquetaActualizado
        lastRefreshed={lastRefreshed}
        onRefresh={refresh}
        className="mb-5 flex items-center gap-2"
      />

      <ContenidoTrabajador {...props} onRefresh={refresh} />
    </>
  )
}

// Memoizado: un ciclo de polling con datos idénticos no re-renderiza el
// contenido (SPEC 11, paso 5). onRefresh es estable (useCallback en el hook).
const ContenidoTrabajador = memo(
  function ContenidoTrabajador({
    solicitudActiva,
    posicionCola,
    adjuntos,
    sede,
    area,
    subarea,
    puesto,
    fueraDeHorario,
    proximaAperturaTexto,
    onRefresh,
  }: Props & { onRefresh: () => void }) {
    return (
      <>
        {/* Modal obligatorio: el técnico convirtió el caso a virtual y falta el
            código AnyDesk. Sin botón de cerrar; solo se va al enviar (SPEC 15). */}
        {solicitudActiva &&
          solicitudActiva.tipo_ayuda === 'virtual' &&
          !solicitudActiva.anydesk_code && (
            <ModalAnydesk solicitudId={solicitudActiva.id} />
          )}
        {fueraDeHorario && (
          <AvisoHorario proximaAperturaTexto={proximaAperturaTexto} />
        )}
        {solicitudActiva ? (
          <PantallaSeguimiento
            solicitud={solicitudActiva}
            posicionCola={posicionCola}
            adjuntos={adjuntos}
            onRefresh={onRefresh}
          />
        ) : (
          <FormularioNuevaSolicitud sede={sede} area={area} subarea={subarea} puesto={puesto} />
        )}
      </>
    )
  },
  (a, b) =>
    JSON.stringify([a.solicitudActiva, a.posicionCola, a.adjuntos, a.sede, a.area, a.subarea, a.puesto, a.fueraDeHorario, a.proximaAperturaTexto]) ===
    JSON.stringify([b.solicitudActiva, b.posicionCola, b.adjuntos, b.sede, b.area, b.subarea, b.puesto, b.fueraDeHorario, b.proximaAperturaTexto]),
)

// Aviso fuera del horario de atención (SPEC 15, Cambio 3). Solo informa: no
// desactiva el formulario ni la cola. El texto del próximo día hábil ya viene
// resuelto desde el servidor (zona de Lima).
function AvisoHorario({
  proximaAperturaTexto,
}: {
  proximaAperturaTexto: string | null
}) {
  return (
    <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4">
      <IconClock size={20} className="mt-0.5 shrink-0 text-amber-600" />
      <div>
        <p className="text-sm font-medium text-amber-900">
          Fuera del horario de atención (Lun–Vie 8:00–14:30).
        </p>
        <p className="mt-0.5 text-sm text-amber-800">
          {proximaAperturaTexto
            ? `Tu solicitud será atendida el ${proximaAperturaTexto} a las 8:00.`
            : 'Tu solicitud será atendida el próximo día hábil a las 8:00.'}
        </p>
      </div>
    </div>
  )
}

// Modal obligatorio para el código AnyDesk (SPEC 15, Cambio 2). No tiene botón
// de cerrar ni cierre por backdrop/Escape: la única salida es enviar un código
// numérico (o que el técnico revierta a presencial, lo que quita el modal en el
// siguiente refresco).
function ModalAnydesk({ solicitudId }: { solicitudId: string }) {
  const router = useRouter()
  const [codigo, setCodigo] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!/^\d+$/.test(codigo)) {
      setError('El código AnyDesk debe contener solo números.')
      return
    }
    setError(null)
    setPending(true)
    try {
      const res = await registrarAnydeskCode(solicitudId, codigo)
      if (res?.error) {
        setError(res.error)
        return
      }
      router.refresh()
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl">
        <h2 className="text-lg font-bold text-gray-900">
          Ingresa tu código AnyDesk
        </h2>
        <p className="mt-1 text-sm text-gray-600">
          El técnico cambió tu atención a{' '}
          <span className="font-medium">virtual</span>. Para que pueda
          conectarse, ingresa tu código AnyDesk (solo números).
        </p>
        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <input
            type="text"
            inputMode="numeric"
            autoFocus
            required
            maxLength={25}
            value={codigo}
            onChange={(e) => {
              setCodigo(e.target.value)
              if (error) setError(null)
            }}
            placeholder="Ej: 123456789"
            className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          {error && <p className="text-xs text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? 'Enviando…' : 'Enviar'}
          </button>
        </form>
      </div>
    </div>
  )
}

function FormularioNuevaSolicitud({
  sede,
  area,
  subarea,
  puesto,
}: {
  sede: string | null
  area: string | null
  subarea: string | null
  puesto: string | null
}) {
  const router = useRouter()
  const [supabase] = useState(() => createClient())
  const [tipoAyuda, setTipoAyuda] = useState('')
  const [anydesk, setAnydesk] = useState('')
  const [anyDeskError, setAnyDeskError] = useState('')
  const [staged, setStaged] = useState<StagedAdjunto[]>([])
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Si la solicitud ya se creó pero falló alguna subida, guardamos su id para
  // reintentar solo los archivos sin volver a crearla (SPEC 12).
  const [creadaId, setCreadaId] = useState<string | null>(null)

  function handleTipoAyudaChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value
    setTipoAyuda(val)
    if (val !== 'virtual') {
      setAnydesk('')
      setAnyDeskError('')
    }
  }

  // Envío en dos pasos: crea la solicitud, sube los archivos a Storage y
  // registra sus metadatos; al terminar refresca a la pantalla de seguimiento.
  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (tipoAyuda === 'virtual' && !/^\d+$/.test(anydesk)) {
      setAnyDeskError('El código AnyDesk debe contener solo números.')
      return
    }
    setError(null)
    const formData = new FormData(e.currentTarget)
    setPending(true)
    try {
      let solicitudId = creadaId
      if (!solicitudId) {
        const res = await crearSolicitud(undefined, formData)
        if (!res || 'error' in res) {
          setError(res?.error ?? 'No se pudo crear la solicitud.')
          return
        }
        solicitudId = res.solicitudId
        setCreadaId(solicitudId)
      }

      if (staged.length > 0) {
        const metas: AdjuntoMeta[] = []
        const fallidos: StagedAdjunto[] = []
        for (const s of staged) {
          const ext = s.tipo === 'imagen' ? 'webp' : 'pdf'
          const path = `${solicitudId}/${crypto.randomUUID()}.${ext}`
          const { error: upError } = await supabase.storage
            .from('solicitud-adjuntos')
            .upload(path, s.blob, {
              contentType: s.tipo === 'imagen' ? 'image/webp' : 'application/pdf',
              upsert: false,
            })
          if (upError) {
            fallidos.push(s)
            continue
          }
          metas.push({
            tipo: s.tipo,
            storage_path: path,
            nombre_original: s.nombre,
            tamano_bytes: s.tamano,
          })
        }

        if (metas.length > 0) {
          const reg = await registrarAdjuntos(solicitudId, metas)
          if (reg && 'error' in reg) {
            setError(
              'La solicitud se creó, pero no se pudieron registrar algunos archivos. Toca "Reintentar subida".',
            )
            return
          }
        }

        if (fallidos.length > 0) {
          // Conservar solo los que fallaron para reintentar; liberar el resto.
          staged
            .filter((s) => !fallidos.includes(s))
            .forEach((s) => {
              if (s.previewUrl) URL.revokeObjectURL(s.previewUrl)
            })
          setStaged(fallidos)
          setError(
            `No se pudieron subir ${fallidos.length} archivo(s). Toca "Reintentar subida".`,
          )
          return
        }
      }

      router.refresh()
    } finally {
      setPending(false)
    }
  }

  const inputClass =
    'mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500'

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <h2 className="mb-4 flex items-center gap-2 font-semibold text-gray-800">
        <IconCirclePlus size={20} className="text-blue-600" />
        Nueva Solicitud
      </h2>

      {/* Datos de perfil — solo lectura */}
      <div className="mb-4 rounded-lg border border-gray-100 bg-gray-50 p-3">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-400">
          Tus datos
        </p>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <p className="text-xs text-gray-500">Sede</p>
            <p className="font-medium text-gray-800">{sede || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Área</p>
            <p className="font-medium text-gray-800">{area || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Subárea</p>
            <p className="font-medium text-gray-800">{subarea || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Puesto</p>
            <p className="font-medium text-gray-800">{puesto || '—'}</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="tipo_ayuda" className="block text-sm font-medium text-gray-700">
            Tipo de ayuda
          </label>
          <select
            id="tipo_ayuda"
            name="tipo_ayuda"
            required
            value={tipoAyuda}
            onChange={handleTipoAyudaChange}
            className={inputClass}
          >
            <option value="">Selecciona…</option>
            <option value="presencial">Presencial</option>
            <option value="virtual">Virtual</option>
          </select>
        </div>

        {tipoAyuda === 'virtual' && (
          <div>
            <label htmlFor="anydesk_code" className="block text-sm font-medium text-gray-700">
              Código AnyDesk
            </label>
            <input
              id="anydesk_code"
              name="anydesk_code"
              type="text"
              inputMode="numeric"
              required
              maxLength={25}
              value={anydesk}
              onChange={(e) => {
                setAnydesk(e.target.value)
                if (anyDeskError) setAnyDeskError('')
              }}
              placeholder="Ej: 123456789"
              className={inputClass}
            />
            {anyDeskError && (
              <p className="mt-1 text-xs text-red-600">{anyDeskError}</p>
            )}
          </div>
        )}

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
            Descripción{' '}
            <span className="font-normal text-gray-400">(Opcional)</span>
          </label>
          <textarea
            id="descripcion"
            name="descripcion"
            rows={4}
            placeholder="Detalles de lo que está ocurriendo..."
            className={inputClass}
          />
        </div>

        <AdjuntosSelector staged={staged} setStaged={setStaged} disabled={pending} />

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending
            ? 'Enviando…'
            : creadaId
              ? 'Reintentar subida'
              : 'Enviar Solicitud'}
        </button>
      </form>
    </div>
  )
}

function PantallaSeguimiento({
  solicitud,
  posicionCola,
  adjuntos,
  onRefresh,
}: {
  solicitud: Solicitud
  posicionCola: number
  adjuntos: AdjuntoVista[]
  onRefresh: () => void
}) {
  return (
    <div className="space-y-4">
      <CardEstado solicitud={solicitud} adjuntos={adjuntos} />
      {solicitud.estado === 'en_espera' && (
        <CardPosicionCola posicion={posicionCola} />
      )}
      {solicitud.estado === 'en_proceso' && (
        <CardResolucion solicitudId={solicitud.id} onRefresh={onRefresh} />
      )}
    </div>
  )
}

function CardResolucion({
  solicitudId,
  onRefresh,
}: {
  solicitudId: string
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

      <div className="mt-3 rounded-lg bg-blue-50 px-3 py-2">
        <p className="text-sm font-medium text-blue-900">
          Un técnico ya está atendiendo tu caso.
        </p>
        <p className="text-sm text-blue-800">
          Tiempo de atención: máximo 20 minutos.
        </p>
      </div>

      <form action={action} className="mt-4 space-y-4">
        <input type="hidden" name="solicitud_id" value={solicitudId} />

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

function CardEstado({
  solicitud,
  adjuntos,
}: {
  solicitud: Solicitud
  adjuntos: AdjuntoVista[]
}) {
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
      {adjuntos.length > 0 && (
        <div className="mt-3 border-t border-gray-100 pt-3">
          <AdjuntosLista adjuntos={adjuntos} titulo="Archivos adjuntos" />
        </div>
      )}
    </div>
  )
}

