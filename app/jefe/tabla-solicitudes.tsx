'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { toggleConfirmacionJefe, forzarEstado } from './actions'

export type SolicitudTabla = {
  id: string
  created_at: string
  titulo: string
  descripcion: string | null
  estado: string
  confirmacion_trabajador: boolean
  confirmacion_tecnico: boolean
  trabajador_nombre: string
  trabajador_telefono: string | null
  trabajador_email: string | null
  trabajador_lugar: string | null
  trabajador_area: string | null
  trabajador_puesto: string | null
  tecnico_nombre: string | null
  tecnico_email: string | null
}

const ESTADO_OPCIONES = [
  { value: 'todos',          label: 'Todos' },
  { value: 'en_espera',      label: 'En Espera' },
  { value: 'en_proceso',     label: 'En Proceso' },
  { value: 'solucionado',    label: 'Solucionado' },
  { value: 'no_solucionado', label: 'No Solucionado' },
  { value: 'cancelado',      label: 'Cancelado' },
]

const ESTADO_BADGE: Record<string, { label: string; className: string }> = {
  en_espera:      { label: 'En Espera',      className: 'bg-yellow-100 text-yellow-800' },
  en_proceso:     { label: 'En Proceso',     className: 'bg-blue-100 text-blue-800' },
  solucionado:    { label: 'Solucionado',    className: 'bg-green-100 text-green-800' },
  no_solucionado: { label: 'No Solucionado', className: 'bg-red-100 text-red-800' },
  cancelado:      { label: 'Cancelado',      className: 'bg-gray-100 text-gray-600' },
}

function formatFecha(iso: string): string {
  const d = new Date(iso)
  const fecha = d.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: '2-digit' })
  const hora  = d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })
  return `${fecha} ${hora}`
}

export default function TablaSolicitudes({
  solicitudes,
  totalPaginas,
  paginaActual,
  estadoFiltro,
}: {
  solicitudes: SolicitudTabla[]
  totalPaginas: number
  paginaActual: number
  estadoFiltro: string | null
}) {
  const router = useRouter()

  function buildParams(page: number, estado: string | null) {
    const p = new URLSearchParams()
    if (estado) p.set('estado', estado)
    p.set('page', page.toString())
    return `?${p.toString()}`
  }

  function handleFiltroChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value
    router.push(buildParams(1, val === 'todos' ? null : val))
  }

  return (
    <div>
      {/* Encabezado + filtro */}
      <div className="mb-3 flex items-center justify-between">
        <p className="font-semibold text-gray-800">Solicitudes</p>
        <select
          value={estadoFiltro ?? 'todos'}
          onChange={handleFiltroChange}
          className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 focus:border-blue-500 focus:outline-none"
        >
          {ESTADO_OPCIONES.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* Tabla */}
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        {solicitudes.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-gray-400">
            No hay solicitudes.
          </p>
        ) : (
          <table className="w-full min-w-[1100px] text-xs">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-3 py-2 text-left font-semibold text-gray-500 whitespace-nowrap">Fecha</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-500 whitespace-nowrap">Trabajador</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-500 whitespace-nowrap">Teléfono</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-500 whitespace-nowrap">Correo</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-500 whitespace-nowrap">Lugar / Área / Puesto</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-500">Título</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-500">Descripción</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-500 whitespace-nowrap">Técnico</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-500 whitespace-nowrap">Correo técnico</th>
                <th className="px-3 py-2 text-center font-semibold text-gray-500 whitespace-nowrap">Conf. Trab.</th>
                <th className="px-3 py-2 text-center font-semibold text-gray-500 whitespace-nowrap">Conf. Téc.</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-500">Estado</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-500">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {solicitudes.map((s) => (
                <FilaTabla key={s.id} solicitud={s} />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Paginación */}
      <div className="mt-3 flex items-center justify-between">
        <span className="text-xs text-gray-500">
          Página {paginaActual} de {totalPaginas}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => router.push(buildParams(paginaActual - 1, estadoFiltro))}
            disabled={paginaActual <= 1}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Anterior
          </button>
          <button
            type="button"
            onClick={() => router.push(buildParams(paginaActual + 1, estadoFiltro))}
            disabled={paginaActual >= totalPaginas}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Siguiente
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Fila individual ──────────────────────────────────────────────────────────

function FilaTabla({ solicitud: s }: { solicitud: SolicitudTabla }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const badge = ESTADO_BADGE[s.estado] ?? { label: s.estado, className: 'bg-gray-100 text-gray-600' }

  function handleToggle(campo: 'trabajador' | 'tecnico', valorActual: boolean) {
    const fd = new FormData()
    fd.set('solicitud_id', s.id)
    fd.set('campo', campo)
    fd.set('valor', (!valorActual).toString())
    startTransition(async () => {
      await toggleConfirmacionJefe(undefined, fd)
      router.refresh()
    })
  }

  function handleForzar(estado: 'solucionado' | 'no_solucionado') {
    const fd = new FormData()
    fd.set('solicitud_id', s.id)
    fd.set('estado', estado)
    startTransition(async () => {
      await forzarEstado(undefined, fd)
      router.refresh()
    })
  }

  const tdBase = 'px-3 py-2 align-top text-gray-700'

  return (
    <tr className={isPending ? 'opacity-50' : ''}>
      <td className={`${tdBase} whitespace-nowrap`}>{formatFecha(s.created_at)}</td>
      <td className={`${tdBase} font-medium whitespace-nowrap`}>{s.trabajador_nombre}</td>
      <td className={tdBase}>{s.trabajador_telefono ?? '—'}</td>
      <td className={tdBase}>{s.trabajador_email ?? '—'}</td>
      <td className={tdBase}>
        <span className="block">{s.trabajador_lugar ?? '—'}</span>
        <span className="block text-gray-400">{s.trabajador_area ?? '—'}</span>
        <span className="block text-gray-400">{s.trabajador_puesto ?? '—'}</span>
      </td>
      <td className={tdBase}>{s.titulo}</td>
      <td className={`${tdBase} max-w-[160px]`}>
        <span className="line-clamp-2">{s.descripcion ?? '—'}</span>
      </td>
      <td className={`${tdBase} whitespace-nowrap`}>{s.tecnico_nombre ?? '—'}</td>
      <td className={tdBase}>{s.tecnico_email ?? '—'}</td>

      {/* Confirmación trabajador */}
      <td className="px-3 py-2 text-center align-top">
        {s.confirmacion_trabajador
          ? <span className="text-green-600 font-bold">✓</span>
          : <span className="text-gray-300 font-bold">✗</span>
        }
      </td>

      {/* Confirmación técnico */}
      <td className="px-3 py-2 text-center align-top">
        {s.confirmacion_tecnico
          ? <span className="text-green-600 font-bold">✓</span>
          : <span className="text-gray-300 font-bold">✗</span>
        }
      </td>

      {/* Estado badge */}
      <td className="px-3 py-2 align-top">
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}>
          {badge.label}
        </span>
      </td>

      {/* Acciones */}
      <td className="px-3 py-2 align-top">
        <div className="flex flex-col gap-1 min-w-[160px]">
          <div className="flex gap-1">
            <button
              type="button"
              disabled={isPending}
              onClick={() => handleToggle('trabajador', s.confirmacion_trabajador)}
              className="rounded border border-gray-300 px-2 py-0.5 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-50"
            >
              Trab. {s.confirmacion_trabajador ? '✓→✗' : '✗→✓'}
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => handleToggle('tecnico', s.confirmacion_tecnico)}
              className="rounded border border-gray-300 px-2 py-0.5 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-50"
            >
              Téc. {s.confirmacion_tecnico ? '✓→✗' : '✗→✓'}
            </button>
          </div>
          <div className="flex gap-1">
            <button
              type="button"
              disabled={isPending}
              onClick={() => handleForzar('solucionado')}
              className="rounded border border-green-400 px-2 py-0.5 text-xs text-green-700 hover:bg-green-50 disabled:opacity-50"
            >
              Forzar ✓
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => handleForzar('no_solucionado')}
              className="rounded border border-red-400 px-2 py-0.5 text-xs text-red-700 hover:bg-red-50 disabled:opacity-50"
            >
              Forzar ✗
            </button>
          </div>
        </div>
      </td>
    </tr>
  )
}
