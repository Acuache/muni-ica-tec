'use client'

import { useActionState } from 'react'
import { solicitarRecuperacion } from './actions'

export default function SolicitarRecuperacionPage() {
  const [state, action, pending] = useActionState(solicitarRecuperacion, undefined)

  if (state && 'success' in state) {
    return (
      <div className="flex min-h-full flex-col items-center justify-center bg-zinc-50 px-4 py-12">
        <div className="w-full max-w-sm text-center">
          <h1 className="mb-4 text-2xl font-semibold tracking-tight text-zinc-900">
            Revisa tu correo
          </h1>
          <p className="mb-6 text-sm text-zinc-500">
            Si el correo existe, recibirás un link en breve para restablecer
            tu contraseña.
          </p>
          <a
            href="/login"
            className="text-sm text-zinc-700 underline underline-offset-4 hover:text-zinc-900"
          >
            Volver al login
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-full flex-col items-center justify-center bg-zinc-50 px-4 py-12">
      <div className="w-full max-w-sm">
        <h1 className="mb-2 text-center text-2xl font-semibold tracking-tight text-zinc-900">
          Recuperar contraseña
        </h1>
        <p className="mb-8 text-center text-sm text-zinc-500">
          Escribe tu correo y te enviaremos un link para restablecer tu
          contraseña.
        </p>

        <form action={action} className="space-y-4">
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-zinc-700"
            >
              Correo
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
              placeholder="correo@muni-ica.gob.pe"
            />
          </div>

          {state && 'error' in state && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">
              {state.error}
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? 'Enviando…' : 'Enviar link de recuperación'}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-zinc-500">
          <a
            href="/login"
            className="text-zinc-700 underline underline-offset-4 hover:text-zinc-900"
          >
            Volver al login
          </a>
        </p>
      </div>
    </div>
  )
}
