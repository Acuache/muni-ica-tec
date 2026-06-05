import { logout } from '@/app/actions/auth'

export default function JefePage() {
  return (
    <div className="flex min-h-full flex-col items-center justify-center bg-zinc-50 px-4 py-12">
      <div className="w-full max-w-sm text-center">
        <h1 className="mb-2 text-2xl font-semibold text-zinc-900">
          Panel del Jefe de Informática
        </h1>
        <p className="mb-8 text-sm text-zinc-500">
          Aquí irá el contenido del jefe (SPEC 07).
        </p>
        <form action={logout}>
          <button
            type="submit"
            className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
          >
            Cerrar sesión
          </button>
        </form>
      </div>
    </div>
  )
}
