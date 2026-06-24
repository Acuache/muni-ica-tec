'use client'

import { useActionState, useState } from 'react'
import { useRouter } from 'next/navigation'
import SelectsUbicacion, {
  type Sede,
  type Area,
  type Subarea,
} from '@/components/selects-ubicacion'
import {
  crearUsuarioIndividual,
  crearUsuariosMasivo,
  type CrearIndividualState,
  type CrearMasivoState,
} from '../actions'
import { PASSWORD_POR_ROL } from '../constantes'

const inputCls =
  'mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-400'

const labelCls = 'block text-sm font-medium text-zinc-700'

const btnPrimary =
  'w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50'

// Los 3 valores fijos de puesto (coinciden con el CHECK de profiles, SPEC 13).
const PUESTOS = ['Jefe de área', 'Secretaria', 'Trabajador']

const ROLES = [
  { value: 'trabajador', label: 'Trabajador' },
  { value: 'tecnico', label: 'Técnico' },
  { value: 'jefe', label: 'Jefe de informática' },
]

type CatalogoProps = { sedes: Sede[]; areas: Area[]; subareas: Subarea[] }

export default function CrearUsuarioFormulario(catalogo: CatalogoProps) {
  const [tab, setTab] = useState<'individual' | 'masivo'>('individual')

  return (
    <div>
      {/* Pestañas */}
      <div className="mb-5 flex gap-1 border-b border-gray-200">
        <TabButton activo={tab === 'individual'} onClick={() => setTab('individual')}>
          Individual
        </TabButton>
        <TabButton activo={tab === 'masivo'} onClick={() => setTab('masivo')}>
          Masivo
        </TabButton>
      </div>

      {tab === 'individual' ? <TabIndividual {...catalogo} /> : <TabMasivo />}
    </div>
  )
}

function TabButton({
  activo,
  onClick,
  children,
}: {
  activo: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'border-b-2 px-4 py-2 text-sm font-medium transition-colors',
        activo
          ? 'border-blue-600 text-blue-600'
          : 'border-transparent text-gray-500 hover:text-gray-700',
      ].join(' ')}
    >
      {children}
    </button>
  )
}

// ─── Pestaña Individual ─────────────────────────────────────────────────────

function TabIndividual({ sedes, areas, subareas }: CatalogoProps) {
  const router = useRouter()
  const [verPasswords, setVerPasswords] = useState(false)
  // Al crear con éxito, se remonta el formulario (key) para limpiarlo.
  const [resetKey, setResetKey] = useState(0)

  // El trabajo posterior al éxito (limpiar el form + refrescar datos) va aquí,
  // en el callback de la acción (contexto de evento), no en un useEffect.
  const [state, action, pending] = useActionState(
    async (prev: CrearIndividualState, formData: FormData): Promise<CrearIndividualState> => {
      const result = await crearUsuarioIndividual(prev, formData)
      if (result?.ok) {
        setVerPasswords(false)
        setResetKey((k) => k + 1)
        router.refresh()
      }
      return result
    },
    undefined,
  )

  return (
    <div className="space-y-4">
      {state?.ok && (
        <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
          Cuenta creada: <strong>{state.email}</strong>. Contraseña asignada:{' '}
          <strong>{state.password}</strong>.
        </div>
      )}
      {state && !state.ok && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{state.error}</p>
      )}

      <form key={resetKey} action={action} className="space-y-5">
        {/* Datos obligatorios */}
        <div className="space-y-4 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
          <div>
            <label htmlFor="email" className={labelCls}>
              Correo
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="off"
              className={inputCls}
              placeholder="correo@muni-ica.gob.pe"
            />
          </div>

          <div>
            <label htmlFor="rol" className={labelCls}>
              Rol
            </label>
            <select id="rol" name="rol" required defaultValue="" className={inputCls}>
              <option value="">Selecciona un rol…</option>
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <button
              type="button"
              onClick={() => setVerPasswords((v) => !v)}
              className="text-sm font-medium text-blue-600 hover:underline"
            >
              {verPasswords ? 'Ocultar contraseñas' : 'Ver contraseñas'}
            </button>
            {verPasswords && (
              <ul className="mt-2 space-y-0.5 rounded-md bg-gray-50 px-3 py-2 text-xs text-gray-600">
                <li>
                  Trabajador: <code className="font-mono">{PASSWORD_POR_ROL.trabajador}</code>
                </li>
                <li>
                  Técnico: <code className="font-mono">{PASSWORD_POR_ROL.tecnico}</code>
                </li>
                <li>
                  Jefe: <code className="font-mono">{PASSWORD_POR_ROL.jefe}</code>
                </li>
              </ul>
            )}
            <p className="mt-1 text-xs text-gray-500">
              La contraseña se asigna automáticamente según el rol; el usuario la cambia en su
              primer ingreso.
            </p>
          </div>
        </div>

        {/* Sección opcional: primer ingreso */}
        <div className="space-y-4 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
          <div>
            <h2 className="text-sm font-semibold text-zinc-800">Primer ingreso (opcional)</h2>
            <p className="mt-0.5 text-xs text-zinc-500">
              Si completas todos los campos, la cuenta no pasará por el primer ingreso. Si dejas
              alguno vacío, el usuario lo completará al entrar.
            </p>
          </div>

          <div>
            <label htmlFor="nombre" className={labelCls}>
              Nombre
            </label>
            <input id="nombre" name="nombre" type="text" className={inputCls} placeholder="Ej. Juan" />
          </div>

          <div>
            <label htmlFor="apellido" className={labelCls}>
              Apellido
            </label>
            <input
              id="apellido"
              name="apellido"
              type="text"
              className={inputCls}
              placeholder="Ej. García"
            />
          </div>

          <div>
            <label htmlFor="telefono" className={labelCls}>
              Teléfono
            </label>
            <input
              id="telefono"
              name="telefono"
              type="tel"
              inputMode="numeric"
              maxLength={15}
              onInput={(e) => {
                e.currentTarget.value = e.currentTarget.value.replace(/\D/g, '')
              }}
              className={inputCls}
              placeholder="987654321"
            />
          </div>

          <SelectsUbicacion sedes={sedes} areas={areas} subareas={subareas} />

          <div>
            <label htmlFor="puesto" className={labelCls}>
              Puesto
            </label>
            <select id="puesto" name="puesto" defaultValue="" className={inputCls}>
              <option value="">Selecciona un puesto…</option>
              {PUESTOS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
        </div>

        <button type="submit" disabled={pending} className={btnPrimary}>
          {pending ? 'Creando…' : 'Crear cuenta'}
        </button>
      </form>
    </div>
  )
}

// ─── Pestaña Masivo ─────────────────────────────────────────────────────────

function TabMasivo() {
  const router = useRouter()
  const [resetKey, setResetKey] = useState(0)

  const [state, action, pending] = useActionState(
    async (prev: CrearMasivoState, formData: FormData): Promise<CrearMasivoState> => {
      const result = await crearUsuariosMasivo(prev, formData)
      if (result?.ok) {
        setResetKey((k) => k + 1)
        router.refresh()
      }
      return result
    },
    undefined,
  )

  return (
    <div className="space-y-4">
      {state && !state.ok && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{state.error}</p>
      )}
      {state?.ok && (
        <ReporteMasivo
          agregados={state.agregados}
          omitidos={state.omitidos}
          invalidos={state.invalidos}
        />
      )}

      <form key={resetKey} action={action} className="space-y-3">
        <div>
          <label htmlFor="correos" className={labelCls}>
            Correos
          </label>
          <textarea
            id="correos"
            name="correos"
            rows={8}
            className={inputCls}
            placeholder={'correo1@muni-ica.gob.pe\ncorreo2@muni-ica.gob.pe, correo3@muni-ica.gob.pe'}
          />
          <p className="mt-1 text-xs text-gray-500">
            Se crean como <strong>trabajador</strong>. Sepáralos por saltos de línea, comas,
            espacios o punto y coma. Máximo 200 por vez. Se omiten duplicados, inválidos y los que
            ya existan.
          </p>
        </div>

        <button type="submit" disabled={pending} className={btnPrimary}>
          {pending ? 'Creando…' : 'Crear cuentas'}
        </button>
      </form>
    </div>
  )
}

function ReporteMasivo({
  agregados,
  omitidos,
  invalidos,
}: {
  agregados: string[]
  omitidos: string[]
  invalidos: string[]
}) {
  return (
    <div className="space-y-3 rounded-md border border-gray-200 bg-gray-50 p-4 text-sm">
      <p className="font-medium text-gray-800">
        {agregados.length} agregado(s) · {omitidos.length} omitido(s) · {invalidos.length}{' '}
        inválido(s)
      </p>
      {omitidos.length > 0 && <ListaCorreos titulo="Ya existían (omitidos)" correos={omitidos} />}
      {invalidos.length > 0 && <ListaCorreos titulo="Inválidos" correos={invalidos} />}
    </div>
  )
}

function ListaCorreos({ titulo, correos }: { titulo: string; correos: string[] }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">{titulo}</p>
      <ul className="mt-1 space-y-0.5 text-xs text-gray-600">
        {correos.map((c) => (
          <li key={c} className="font-mono">
            {c}
          </li>
        ))}
      </ul>
    </div>
  )
}
