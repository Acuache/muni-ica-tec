import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12 text-center">
      <p className="text-5xl font-bold text-gray-300">404</p>
      <h1 className="mt-3 text-lg font-semibold text-gray-900">
        Página no encontrada
      </h1>
      <p className="mt-1 max-w-sm text-sm text-gray-500">
        La página que buscas no existe o fue movida.
      </p>
      <Link
        href="/"
        className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
      >
        Ir al inicio
      </Link>
    </div>
  )
}
