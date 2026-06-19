type Rol = 'jefe' | 'tecnico' | 'trabajador'

const ROL_LABELS: Record<Rol, string> = {
  trabajador: 'Trabajador',
  tecnico: 'Técnico',
  jefe: 'Jefe de informática',
}

type Props = {
  username: string
  telefono: string | null
  email: string | null
  rol: Rol
}

function Campo({ label, valor }: { label: string; valor: string | null }) {
  return (
    <div>
      <dt className="text-xs font-medium text-gray-500">{label}</dt>
      <dd className="mt-0.5 text-sm text-gray-900">{valor || '—'}</dd>
    </div>
  )
}

export default function DatosPerfil({ username, telefono, email, rol }: Props) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <dl className="space-y-4">
        <Campo label="Usuario" valor={username} />
        <Campo label="Teléfono" valor={telefono} />
        <Campo label="Correo" valor={email} />
        <Campo label="Rol" valor={ROL_LABELS[rol]} />
      </dl>
    </div>
  )
}
