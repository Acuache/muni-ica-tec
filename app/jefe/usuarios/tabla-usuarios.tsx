'use client'

import { useActionState, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import SelectsUbicacion, {
  type Sede,
  type Area,
  type Subarea,
} from '@/components/selects-ubicacion'
import {
  editarUsuario,
  restablecerPassword,
  desactivarUsuario,
  reactivarUsuario,
  type EditarUsuarioState,
} from './actions'

export type UsuarioFila = {
  id: string
  username: string
  email: string | null
  telefono: string | null
  rol: string
  sede: string | null
  area: string | null
  subarea: string | null
  puesto: string | null
  primer_ingreso: boolean
  activo: boolean
  tieneSolicitudActiva: boolean
}

const ROL_LABELS: Record<string, string> = {
  trabajador: 'Trabajador',
  tecnico: 'Técnico',
  jefe: 'Jefe de informática',
}

const ROLES = [
  { value: 'trabajador', label: 'Trabajador' },
  { value: 'tecnico', label: 'Técnico' },
  { value: 'jefe', label: 'Jefe de informática' },
]

const PUESTOS = ['Jefe de área', 'Secretaria', 'Trabajador']

const inputCls =
  'mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-400'
const labelCls = 'block text-sm font-medium text-zinc-700'
const btnPrimarySm =
  'rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50'
const btnSecondary =
  'rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50'
const btnDanger =
  'rounded-lg bg-red-600 px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50'

function estadoBadge(u: UsuarioFila): { label: string; className: string } {
  if (!u.activo) return { label: 'Desactivado', className: 'bg-gray-100 text-gray-600' }
  if (u.primer_ingreso) {
    return { label: 'Pendiente primer ingreso', className: 'bg-yellow-100 text-yellow-800' }
  }
  return { label: 'Activo', className: 'bg-green-100 text-green-800' }
}

// Agrupa por área preservando el orden de llegada (la página ordena por área).
function agruparPorArea(usuarios: UsuarioFila[]): [string, UsuarioFila[]][] {
  const grupos = new Map<string, UsuarioFila[]>()
  for (const u of usuarios) {
    const clave = u.area ?? 'Sin área'
    const lista = grupos.get(clave)
    if (lista) lista.push(u)
    else grupos.set(clave, [u])
  }
  return [...grupos.entries()]
}

const thBase = 'px-3 py-2 text-left font-semibold text-gray-500 whitespace-nowrap'

type Catalogo = { sedes: Sede[]; areas: Area[]; subareas: Subarea[] }

export default function TablaUsuarios({
  usuarios,
  totalPaginas,
  paginaActual,
  q,
  incluirDesactivados,
  sedes,
  areas,
  subareas,
  sedeSeleccionada,
}: {
  usuarios: UsuarioFila[]
  totalPaginas: number
  paginaActual: number
  q: string
  incluirDesactivados: boolean
  sedes: Sede[]
  areas: Area[]
  subareas: Subarea[]
  sedeSeleccionada: string
}) {
  const router = useRouter()
  const [busqueda, setBusqueda] = useState(q)
  const modoSede = sedeSeleccionada !== ''
  const catalogo: Catalogo = { sedes, areas, subareas }

  // Navega construyendo la URL. Modos excluyentes: sede tiene prioridad; si no,
  // texto. El toggle de desactivados se preserva salvo que se sobrescriba.
  function navegar(opts: { q?: string; sede?: string; page?: number; incluir?: boolean }) {
    const incFinal = opts.incluir !== undefined ? opts.incluir : incluirDesactivados
    const p = new URLSearchParams()

    if (opts.sede) {
      p.set('sede', opts.sede)
    } else if (opts.q) {
      p.set('q', opts.q)
      p.set('page', String(opts.page ?? 1))
    } else {
      p.set('page', String(opts.page ?? 1))
    }

    if (incFinal) p.set('incluirDesactivados', 'true')
    router.push(`?${p.toString()}`)
  }

  function handleBuscar(e: React.FormEvent) {
    e.preventDefault()
    navegar({ q: busqueda.trim(), page: 1 })
  }

  function handleSedeChange(e: React.ChangeEvent<HTMLSelectElement>) {
    navegar({ sede: e.target.value })
  }

  function handleToggle(e: React.ChangeEvent<HTMLInputElement>) {
    // Preservar el modo actual al cambiar el toggle.
    if (modoSede) navegar({ sede: sedeSeleccionada, incluir: e.target.checked })
    else navegar({ q, page: 1, incluir: e.target.checked })
  }

  const grupos = modoSede ? agruparPorArea(usuarios) : []

  return (
    <div>
      {/* Encabezado + controles */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <p className="font-semibold text-gray-800">Usuarios</p>
        <div className="flex flex-wrap items-center gap-3">
          <form onSubmit={handleBuscar} className="flex items-center gap-2">
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por nombre o apellido…"
              className="w-56 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 focus:border-blue-500 focus:outline-none"
            />
            <button
              type="submit"
              className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
            >
              Buscar
            </button>
          </form>

          <select
            value={sedeSeleccionada}
            onChange={handleSedeChange}
            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 focus:border-blue-500 focus:outline-none"
          >
            <option value="">— Filtrar por sede —</option>
            {sedes.map((s) => (
              <option key={s.id} value={s.nombre}>
                {s.nombre}
              </option>
            ))}
          </select>

          <label className="flex items-center gap-1.5 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={incluirDesactivados}
              onChange={handleToggle}
              className="rounded border-gray-300"
            />
            Mostrar desactivados
          </label>
        </div>
      </div>

      {/* Tabla */}
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        {usuarios.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-gray-400">No hay usuarios.</p>
        ) : (
          <table className="w-full min-w-[900px] text-xs">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className={thBase}>Nombre</th>
                <th className={thBase}>Correo</th>
                <th className={thBase}>Teléfono</th>
                <th className={thBase}>Rol</th>
                <th className={thBase}>Sede / Área / Subárea / Puesto</th>
                <th className={thBase}>Estado</th>
                <th className={thBase}>Acciones</th>
              </tr>
            </thead>

            {modoSede ? (
              // Modo sede: una subsección (tbody) por área.
              grupos.map(([area, filas]) => (
                <tbody key={area} className="divide-y divide-gray-100">
                  <tr className="border-t border-gray-100 bg-gray-50">
                    <td colSpan={7} className="px-3 py-1.5 text-xs font-semibold text-gray-600">
                      {area}
                    </td>
                  </tr>
                  {filas.map((u) => (
                    <FilaUsuario key={u.id} usuario={u} catalogo={catalogo} />
                  ))}
                </tbody>
              ))
            ) : (
              <tbody className="divide-y divide-gray-100">
                {usuarios.map((u) => (
                  <FilaUsuario key={u.id} usuario={u} catalogo={catalogo} />
                ))}
              </tbody>
            )}
          </table>
        )}
      </div>

      {/* Paginación: solo en modo texto (en modo sede no se pagina). */}
      {!modoSede && (
        <div className="mt-3 flex items-center justify-between">
          <span className="text-xs text-gray-500">
            Página {paginaActual} de {totalPaginas}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => navegar({ q, page: paginaActual - 1 })}
              disabled={paginaActual <= 1}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Anterior
            </button>
            <button
              type="button"
              onClick={() => navegar({ q, page: paginaActual + 1 })}
              disabled={paginaActual >= totalPaginas}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Siguiente
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Fila individual ──────────────────────────────────────────────────────────

function FilaUsuario({ usuario: u, catalogo }: { usuario: UsuarioFila; catalogo: Catalogo }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [modalEditar, setModalEditar] = useState(false)
  const [modalDesactivar, setModalDesactivar] = useState(false)
  const [modalReactivar, setModalReactivar] = useState(false)
  const [accionError, setAccionError] = useState<string | null>(null)
  const badge = estadoBadge(u)
  const tdBase = 'px-3 py-2 align-top text-gray-700'

  function handleDesactivar() {
    startTransition(async () => {
      const r = await desactivarUsuario({ userId: u.id })
      if (!r.ok) {
        setAccionError(r.error)
        return
      }
      setModalDesactivar(false)
      router.refresh()
    })
  }

  function handleReactivar() {
    startTransition(async () => {
      const r = await reactivarUsuario({ userId: u.id })
      if (!r.ok) {
        setAccionError(r.error)
        return
      }
      setModalReactivar(false)
      router.refresh()
    })
  }

  return (
    <tr className={isPending ? 'opacity-50' : ''}>
      <td className={`${tdBase} font-medium whitespace-nowrap`}>{u.username}</td>
      <td className={tdBase}>{u.email ?? '—'}</td>
      <td className={tdBase}>{u.telefono ?? '—'}</td>
      <td className={`${tdBase} whitespace-nowrap`}>{ROL_LABELS[u.rol] ?? u.rol}</td>
      <td className={tdBase}>
        <span className="block">{u.sede ?? '—'}</span>
        <span className="block text-gray-400">{u.area ?? '—'}</span>
        <span className="block text-gray-400">{u.subarea ?? '—'}</span>
        <span className="block text-gray-400">{u.puesto ?? '—'}</span>
      </td>
      <td className="px-3 py-2 align-top">
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}
        >
          {badge.label}
        </span>
      </td>
      <td className={tdBase}>
        <div className="flex min-w-[110px] flex-col gap-1">
          <button
            type="button"
            disabled={isPending}
            onClick={() => setModalEditar(true)}
            className="rounded border border-gray-300 px-2 py-0.5 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Editar
          </button>
          {u.activo ? (
            <button
              type="button"
              disabled={isPending}
              onClick={() => {
                setAccionError(null)
                setModalDesactivar(true)
              }}
              className="rounded border border-red-400 px-2 py-0.5 text-xs text-red-700 hover:bg-red-50 disabled:opacity-50"
            >
              Desactivar
            </button>
          ) : (
            <button
              type="button"
              disabled={isPending}
              onClick={() => {
                setAccionError(null)
                setModalReactivar(true)
              }}
              className="rounded border border-green-400 px-2 py-0.5 text-xs text-green-700 hover:bg-green-50 disabled:opacity-50"
            >
              Reactivar
            </button>
          )}
        </div>

        {modalEditar && (
          <EditarUsuarioModal
            usuario={u}
            catalogo={catalogo}
            onClose={() => setModalEditar(false)}
          />
        )}

        <ModalConfirmacion
          open={modalDesactivar}
          title="Desactivar cuenta"
          message={
            u.tieneSolicitudActiva
              ? 'Esta cuenta tiene una solicitud activa que se cancelará al desactivarla. La persona no podrá iniciar sesión. ¿Continuar?'
              : 'La persona no podrá iniciar sesión. ¿Desactivar esta cuenta?'
          }
          confirmLabel="Desactivar"
          danger
          pending={isPending}
          error={accionError}
          onConfirm={handleDesactivar}
          onCancel={() => {
            setModalDesactivar(false)
            setAccionError(null)
          }}
        />

        <ModalConfirmacion
          open={modalReactivar}
          title="Reactivar cuenta"
          message="La persona podrá volver a iniciar sesión. ¿Reactivar esta cuenta?"
          confirmLabel="Reactivar"
          pending={isPending}
          error={accionError}
          onConfirm={handleReactivar}
          onCancel={() => {
            setModalReactivar(false)
            setAccionError(null)
          }}
        />
      </td>
    </tr>
  )
}

// ─── Modal de confirmación genérico ─────────────────────────────────────────

function ModalConfirmacion({
  open,
  title,
  message,
  confirmLabel,
  pending,
  error,
  danger,
  onConfirm,
  onCancel,
}: {
  open: boolean
  title: string
  message: string
  confirmLabel: string
  pending: boolean
  error?: string | null
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-lg">
        <p className="font-semibold text-gray-900">{title}</p>
        <p className="mt-2 text-sm text-gray-600">{message}</p>
        {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onCancel} disabled={pending} className={btnSecondary}>
            Volver
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            className={danger ? btnDanger : btnPrimarySm}
          >
            {pending ? 'Procesando…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Modal de edición ───────────────────────────────────────────────────────

function EditarUsuarioModal({
  usuario: u,
  catalogo,
  onClose,
}: {
  usuario: UsuarioFila
  catalogo: Catalogo
  onClose: () => void
}) {
  const router = useRouter()
  const [confirmReset, setConfirmReset] = useState(false)
  const [resetMsg, setResetMsg] = useState<string | null>(null)
  const [resetting, startReset] = useTransition()

  const [state, action, pending] = useActionState(
    async (prev: EditarUsuarioState, formData: FormData): Promise<EditarUsuarioState> => {
      const result = await editarUsuario(prev, formData)
      if (result?.ok) {
        router.refresh()
        onClose()
      }
      return result
    },
    undefined,
  )

  // Prefill: separar username en nombre/apellido y resolver nombres→ids.
  const partes = u.username.trim().split(/\s+/)
  const nombreInicial = partes[0] ?? ''
  const apellidoInicial = partes.slice(1).join(' ')

  const sedeIdInicial = catalogo.sedes.find((s) => s.nombre === u.sede)?.id ?? ''
  const areaIdInicial =
    catalogo.areas.find((a) => a.nombre === u.area && a.sede_id === sedeIdInicial)?.id ?? ''
  const subareaIdInicial =
    catalogo.subareas.find((sa) => sa.nombre === u.subarea && sa.area_id === areaIdInicial)?.id ?? ''

  function handleReset() {
    startReset(async () => {
      const r = await restablecerPassword({ userId: u.id })
      setResetMsg(r.ok ? `Contraseña restablecida a: ${r.password}` : r.error)
      setConfirmReset(false)
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-5 shadow-lg">
        <div className="mb-3 flex items-center justify-between">
          <p className="font-semibold text-gray-900">Editar usuario</p>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>

        <p className="mb-4 text-xs text-gray-500">
          Correo: <span className="font-mono">{u.email ?? '—'}</span> (no editable)
        </p>

        <form action={action} className="space-y-4">
          <input type="hidden" name="id" value={u.id} />

          <div>
            <label htmlFor={`nombre-${u.id}`} className={labelCls}>
              Nombre
            </label>
            <input
              id={`nombre-${u.id}`}
              name="nombre"
              type="text"
              required
              defaultValue={nombreInicial}
              className={inputCls}
            />
          </div>

          <div>
            <label htmlFor={`apellido-${u.id}`} className={labelCls}>
              Apellido
            </label>
            <input
              id={`apellido-${u.id}`}
              name="apellido"
              type="text"
              defaultValue={apellidoInicial}
              className={inputCls}
            />
          </div>

          <div>
            <label htmlFor={`telefono-${u.id}`} className={labelCls}>
              Teléfono
            </label>
            <input
              id={`telefono-${u.id}`}
              name="telefono"
              type="tel"
              defaultValue={u.telefono ?? ''}
              className={inputCls}
            />
          </div>

          <SelectsUbicacion
            sedes={catalogo.sedes}
            areas={catalogo.areas}
            subareas={catalogo.subareas}
            defaultSedeId={sedeIdInicial}
            defaultAreaId={areaIdInicial}
            defaultSubareaId={subareaIdInicial}
          />

          <div>
            <label htmlFor={`puesto-${u.id}`} className={labelCls}>
              Puesto
            </label>
            <select
              id={`puesto-${u.id}`}
              name="puesto"
              defaultValue={u.puesto ?? ''}
              className={inputCls}
            >
              <option value="">Selecciona un puesto…</option>
              {PUESTOS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor={`rol-${u.id}`} className={labelCls}>
              Rol
            </label>
            <select id={`rol-${u.id}`} name="rol" required defaultValue={u.rol} className={inputCls}>
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          {state && !state.ok && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{state.error}</p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} disabled={pending} className={btnSecondary}>
              Cancelar
            </button>
            <button type="submit" disabled={pending} className={btnPrimarySm}>
              {pending ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </form>

        {/* Restablecer contraseña (acción aparte) */}
        <div className="mt-5 border-t border-gray-100 pt-4">
          {!confirmReset ? (
            <button
              type="button"
              onClick={() => {
                setConfirmReset(true)
                setResetMsg(null)
              }}
              className="text-sm font-medium text-blue-600 hover:underline"
            >
              Restablecer contraseña
            </button>
          ) : (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-gray-600">¿Restablecer a la contraseña del rol?</span>
              <button
                type="button"
                onClick={handleReset}
                disabled={resetting}
                className="rounded border border-red-400 px-2 py-0.5 text-xs text-red-700 hover:bg-red-50 disabled:opacity-50"
              >
                {resetting ? 'Restableciendo…' : 'Sí, restablecer'}
              </button>
              <button
                type="button"
                onClick={() => setConfirmReset(false)}
                disabled={resetting}
                className="rounded border border-gray-300 px-2 py-0.5 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancelar
              </button>
            </div>
          )}
          {resetMsg && <p className="mt-2 text-xs text-gray-600">{resetMsg}</p>}
        </div>
      </div>
    </div>
  )
}
