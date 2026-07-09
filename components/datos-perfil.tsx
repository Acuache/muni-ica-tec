'use client'

import { useActionState, useState } from 'react'
import { IconEye, IconEyeOff } from '@tabler/icons-react'
import {
  actualizarDatosPerfil,
  cambiarContrasena,
  type PerfilState,
} from '@/app/perfil/actions'
import SelectsUbicacion, {
  type Sede,
  type Area,
  type Subarea,
} from '@/components/selects-ubicacion'
import ModalExito from '@/components/modal-exito'

type Rol = 'jefe' | 'tecnico' | 'trabajador'

const ROL_LABELS: Record<Rol, string> = {
  trabajador: 'Trabajador',
  tecnico: 'Técnico',
  jefe: 'Jefe de informática',
}

// Los 3 valores fijos de puesto (coinciden con el CHECK de profiles, SPEC 13).
const PUESTOS = ['Jefe de área', 'Secretaria', 'Trabajador']

type Props = {
  username: string
  telefono: string | null
  email: string | null
  rol: Rol
  puesto: string | null
  sedes: Sede[]
  areas: Area[]
  subareas: Subarea[]
  defaultSedeId: string
  defaultAreaId: string
  defaultSubareaId: string
}

const inputCls =
  'mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 shadow-sm focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500'

const labelCls = 'block text-sm font-medium text-gray-700'

const botonCls =
  'rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50'

function CampoLectura({ label, valor }: { label: string; valor: string | null }) {
  return (
    <div>
      <dt className="text-xs font-medium text-gray-500">{label}</dt>
      <dd className="mt-0.5 text-sm text-gray-900">{valor || '—'}</dd>
    </div>
  )
}

function ErrorMsg({ state }: { state: PerfilState }) {
  if (state && 'error' in state) {
    return (
      <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{state.error}</p>
    )
  }
  return null
}

/** Input de contraseña con botón de "ojito" para mostrar/ocultar el texto. */
function CampoPassword({
  id,
  label,
  autoComplete,
}: {
  id: string
  label: string
  autoComplete: string
}) {
  const [visible, setVisible] = useState(false)
  return (
    <div>
      <label htmlFor={id} className={labelCls}>
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          name={id}
          type={visible ? 'text' : 'password'}
          autoComplete={autoComplete}
          required
          className={`${inputCls} pr-10`}
          placeholder="••••••••"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          className="absolute inset-y-0 right-0 mt-1 flex items-center px-3 text-gray-400 hover:text-gray-600"
        >
          {visible ? <IconEyeOff size={16} /> : <IconEye size={16} />}
        </button>
      </div>
    </div>
  )
}

export default function DatosPerfil({
  username,
  telefono,
  email,
  rol,
  puesto,
  sedes,
  areas,
  subareas,
  defaultSedeId,
  defaultAreaId,
  defaultSubareaId,
}: Props) {
  const [datosState, datosAction, datosPending] = useActionState(
    actualizarDatosPerfil,
    undefined,
  )
  const [passState, passAction, passPending] = useActionState(
    cambiarContrasena,
    undefined,
  )

  // Campos editables controlados: así sobreviven al form.reset() automático que
  // React 19 dispara tras cada Action (también en error). Sin esto, un fallo de
  // validación del servidor borraría lo que el usuario escribió.
  const [nombre, setNombre] = useState(username)
  const [tel, setTel] = useState(telefono ?? '')
  const [puestoSel, setPuestoSel] = useState(puesto ?? '')
  const [ubic, setUbic] = useState({
    sedeId: defaultSedeId,
    areaId: defaultAreaId,
    subareaId: defaultSubareaId,
  })

  // Reconocimiento del último éxito: se guarda el objeto de estado ya mostrado
  // en el modal, así el modal se deriva del estado (sin efectos) y se oculta al
  // cerrarlo. Cada éxito devuelve un objeto nuevo, por lo que vuelve a abrirse.
  const [ackDatos, setAckDatos] = useState<PerfilState>(undefined)
  const [ackPass, setAckPass] = useState<PerfilState>(undefined)

  const datosOk = !!datosState && 'ok' in datosState && datosState !== ackDatos
  const passOk = !!passState && 'ok' in passState && passState !== ackPass
  const modalOpen = datosOk || passOk
  const modalMensaje = datosOk
    ? 'Tus datos se actualizaron correctamente.'
    : 'Tu contraseña se actualizó correctamente.'

  function cerrarModal() {
    if (datosOk) setAckDatos(datosState)
    if (passOk) setAckPass(passState)
  }

  // "Guardar cambios" se habilita solo si algún campo difiere del valor guardado
  // (patrón "dirty", derivado en render). Tras guardar, los props se refrescan a
  // los valores nuevos y el botón vuelve a deshabilitarse solo.
  const dirty =
    nombre.trim() !== (username ?? '').trim() ||
    tel.trim() !== (telefono ?? '').trim() ||
    puestoSel !== (puesto ?? '') ||
    ubic.sedeId !== defaultSedeId ||
    ubic.areaId !== defaultAreaId ||
    ubic.subareaId !== defaultSubareaId

  return (
    <div className="space-y-6">
      {/* Datos personales — editables. Correo y rol quedan en solo lectura. */}
      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="mb-4 text-sm font-semibold text-gray-900">Datos personales</h2>

        <form action={datosAction} className="space-y-4">
          <div>
            <label htmlFor="nombre" className={labelCls}>
              Nombre completo
            </label>
            <input
              id="nombre"
              name="nombre"
              type="text"
              autoComplete="name"
              required
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className={inputCls}
              placeholder="Ej. Juan García"
            />
          </div>

          <div>
            <label htmlFor="telefono" className={labelCls}>
              Teléfono
            </label>
            {/* Solo dígitos: se descarta cualquier otro carácter al escribir o pegar. */}
            <input
              id="telefono"
              name="telefono"
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              required
              maxLength={15}
              value={tel}
              onChange={(e) => setTel(e.target.value.replace(/\D/g, ''))}
              className={inputCls}
              placeholder="987654321"
            />
          </div>

          {/* Ubicación: cascada Sede → Área → Subárea (ids del catálogo). */}
          <div className="border-t border-gray-100 pt-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
              Ubicación
            </p>
            <div className="space-y-4">
              <SelectsUbicacion
                sedes={sedes}
                areas={areas}
                subareas={subareas}
                required
                defaultSedeId={defaultSedeId}
                defaultAreaId={defaultAreaId}
                defaultSubareaId={defaultSubareaId}
                onCambio={setUbic}
              />

              <div>
                <label htmlFor="puesto" className={labelCls}>
                  Puesto
                </label>
                <select
                  id="puesto"
                  name="puesto"
                  required
                  value={puestoSel}
                  onChange={(e) => setPuestoSel(e.target.value)}
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
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-4 border-t border-gray-100 pt-4">
            <CampoLectura label="Correo" valor={email} />
            <CampoLectura label="Rol" valor={ROL_LABELS[rol]} />
          </dl>

          <ErrorMsg state={datosState} />

          <div className="flex justify-end">
            <button type="submit" disabled={datosPending || !dirty} className={botonCls}>
              {datosPending ? 'Guardando…' : 'Guardar cambios'}
            </button>
          </div>
        </form>
      </section>

      {/* Cambio de contraseña — sección aparte (pasa por Supabase Auth). */}
      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="mb-1 text-sm font-semibold text-gray-900">Cambiar contraseña</h2>
        <p className="mb-4 text-xs text-gray-500">
          Elige una contraseña de al menos 8 caracteres.
        </p>

        <form action={passAction} className="space-y-4">
          <CampoPassword id="password" label="Nueva contraseña" autoComplete="new-password" />
          <CampoPassword
            id="confirmacion"
            label="Confirmar contraseña"
            autoComplete="new-password"
          />

          <ErrorMsg state={passState} />

          <div className="flex justify-end">
            <button type="submit" disabled={passPending} className={botonCls}>
              {passPending ? 'Actualizando…' : 'Actualizar contraseña'}
            </button>
          </div>
        </form>
      </section>

      <ModalExito open={modalOpen} mensaje={modalMensaje} onClose={cerrarModal} />
    </div>
  )
}
