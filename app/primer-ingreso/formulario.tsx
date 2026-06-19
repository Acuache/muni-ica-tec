'use client'

import { useActionState, useState } from 'react'
import { IconEye, IconEyeOff } from '@tabler/icons-react'
import { completarPrimerIngreso } from './actions'
import SelectsUbicacion, {
  type Sede,
  type Area,
  type Subarea,
} from '@/components/selects-ubicacion'

const inputCls =
  'mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-400'

const labelCls = 'block text-sm font-medium text-zinc-700'

// Los 3 valores fijos de puesto. Coinciden con el CHECK de profiles y con la
// validación del Server Action (SPEC 13).
const PUESTOS = ['Jefe de área', 'Secretaria', 'Trabajador']

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-400">
        {title}
      </h2>
      <div className="space-y-4 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
        {children}
      </div>
    </section>
  )
}

export default function FormularioPrimerIngreso({
  sedes,
  areas,
  subareas,
}: {
  sedes: Sede[]
  areas: Area[]
  subareas: Subarea[]
}) {
  const [state, action, pending] = useActionState(completarPrimerIngreso, undefined)
  const [mantenerPassword, setMantenerPassword] = useState(true)
  const [mostrarPassword, setMostrarPassword] = useState(false)

  return (
    <div className="flex min-h-full flex-col items-center justify-center bg-zinc-50 px-4 py-12">
      <div className="w-full max-w-lg">
        <h1 className="mb-2 text-center text-2xl font-semibold tracking-tight text-zinc-900">
          Bienvenido
        </h1>
        <p className="mb-8 text-center text-sm text-zinc-500">
          Completa tu información antes de continuar.
        </p>

        <form action={action} className="space-y-6">
          {/* Sección 1 — Datos del lugar (cascade Sede → Área → Subárea + Puesto) */}
          <Section title="Datos del lugar">
            <SelectsUbicacion
              sedes={sedes}
              areas={areas}
              subareas={subareas}
              required
            />

            <div>
              <label htmlFor="puesto" className={labelCls}>
                Puesto
              </label>
              <select
                id="puesto"
                name="puesto"
                required
                defaultValue=""
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
          </Section>

          {/* Sección 2 — Datos del usuario */}
          <Section title="Datos del usuario">
            <div>
              <label htmlFor="nombre" className={labelCls}>
                Nombre
              </label>
              <input
                id="nombre"
                name="nombre"
                type="text"
                autoComplete="given-name"
                className={inputCls}
                placeholder="Ej. Juan"
              />
            </div>
            <div>
              <label htmlFor="apellido" className={labelCls}>
                Apellido
              </label>
              <input
                id="apellido"
                name="apellido"
                type="text"
                autoComplete="family-name"
                className={inputCls}
                placeholder="Ej. García"
              />
            </div>
          </Section>

          {/* Sección 3 — Datos de la cuenta */}
          <Section title="Datos de la cuenta">
            <div>
              <label htmlFor="telefono" className={labelCls}>
                Teléfono
              </label>
              <input
                id="telefono"
                name="telefono"
                type="tel"
                autoComplete="tel"
                className={inputCls}
                placeholder="987 654 321"
              />
            </div>

            <div>
              <label htmlFor="email" className={labelCls}>
                Escribe el correo que te fue entregado por el área de informática.
                Si no coincide, comunícate con el área de informática para su revisión.
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                className={inputCls}
                placeholder="correo@muni-ica.gob.pe"
              />
            </div>

            <div>
              <div className="flex items-center justify-between">
                <span className={labelCls}>Contraseña</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={mantenerPassword}
                  onClick={() => {
                    setMantenerPassword((v) => !v)
                    setMostrarPassword(false)
                  }}
                  className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:ring-offset-2 ${
                    mantenerPassword ? 'bg-zinc-900' : 'bg-zinc-300'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                      mantenerPassword ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
              <p className="mt-1 text-xs text-zinc-500">
                {mantenerPassword
                  ? 'Mantener mi contraseña actual'
                  : 'Quiero establecer una nueva contraseña'}
              </p>

              <input
                type="hidden"
                name="mantenerPassword"
                value={mantenerPassword ? 'true' : 'false'}
              />

              {!mantenerPassword && (
                <div className="relative mt-3">
                  <input
                    id="nuevaPassword"
                    name="nuevaPassword"
                    type={mostrarPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    className={`${inputCls} pr-10`}
                    placeholder="Nueva contraseña"
                  />
                  <button
                    type="button"
                    onClick={() => setMostrarPassword((v) => !v)}
                    aria-label={mostrarPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    className="absolute inset-y-0 right-0 mt-1 flex items-center px-3 text-zinc-400 hover:text-zinc-600"
                  >
                    {mostrarPassword ? <IconEyeOff size={16} /> : <IconEye size={16} />}
                  </button>
                </div>
              )}
            </div>
          </Section>

          {state?.error && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">
              {state.error}
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? 'Guardando…' : 'Confirmar y continuar'}
          </button>
        </form>
      </div>
    </div>
  )
}
