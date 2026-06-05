'use client'

import { useActionState } from 'react'
import { actualizarContrasena } from './actions'

export default function ActualizarContrasenaForm() {
  const [state, action, pending] = useActionState(actualizarContrasena, undefined)

  return (
    <div className="flex min-h-full flex-col items-center justify-center bg-zinc-50 px-4 py-12">
      <div className="w-full max-w-sm">
        <h1 className="mb-2 text-center text-2xl font-semibold tracking-tight text-zinc-900">
          Nueva contraseña
        </h1>
        <p className="mb-8 text-center text-sm text-zinc-500">
          Elige una contraseña segura de al menos 8 caracteres.
        </p>

        <form action={action} className="space-y-4">
          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-zinc-700"
            >
              Nueva contraseña
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
              placeholder="••••••••"
            />
          </div>

          <div>
            <label
              htmlFor="confirmacion"
              className="block text-sm font-medium text-zinc-700"
            >
              Confirmar contraseña
            </label>
            <input
              id="confirmacion"
              name="confirmacion"
              type="password"
              autoComplete="new-password"
              required
              className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
              placeholder="••••••••"
            />
          </div>

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
            {pending ? 'Guardando…' : 'Guardar nueva contraseña'}
          </button>
        </form>
      </div>
    </div>
  )
}
