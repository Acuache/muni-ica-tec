'use client'

import Image from 'next/image'
import { useActionState } from 'react'
import { login } from './actions'
import logo from '@/assets/muni-ica.png'

export default function LoginPage() {
  const [state, action, pending] = useActionState(login, undefined)

  return (
    <div className="flex min-h-screen items-center justify-center from-emerald-50 via-background to-amber-50 px-4 py-12">
      <div className="grid w-full max-w-xl overflow-hidden rounded-2xl border border-border bg-card shadow-xl lg:grid-cols-2 lg:max-w-3xl">
        {/* Panel de marca — solo en pantallas grandes */}
        <div className="relative hidden flex-col items-center justify-center gap-5 overflow-hidden bg-[#26a72c] p-10 text-center lg:flex">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.28),transparent_60%)]" />
          <div className="relative flex flex-col items-center gap-4">
            <div className="flex size-30 items-center justify-center rounded-2xl bg-white p-3 shadow-lg">
              <Image
                src={logo}
                alt="Municipalidad Provincial de Ica"
                width={120}
                height={120}
                className="h-full w-full object-contain"
                priority
              />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-white">
                Soporte Municipal
              </h1>
              <p className="mt-1 text-sm text-white/80">
                Municipalidad Provincial de Ica
              </p>
            </div>
            <p className="max-w-xs text-sm text-white/70">
              Gestión de tickets de soporte técnico
            </p>
          </div>
        </div>

        {/* Formulario */}
        <div className="flex flex-col justify-center px-6 py-10 sm:px-10 lg:py-12">
          {/* Encabezado para pantallas pequeñas (sin panel de marca) */}
          <div className="mb-8 flex flex-col items-center gap-3 text-center lg:hidden">
            <div className="flex size-16 items-center justify-center rounded-xl border border-border bg-white p-2 shadow-sm">
              <Image
                src={logo}
                alt="Municipalidad Provincial de Ica"
                width={56}
                height={56}
                className="h-full w-full object-contain"
                priority
              />
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-foreground">
                Soporte Municipal
              </h1>
              <p className="text-sm text-muted-foreground">
                Municipalidad Provincial de Ica
              </p>
            </div>
          </div>

          <div className="hidden lg:block">
            <h2 className="text-xl font-semibold tracking-tight text-foreground">
              Inicia sesión
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Ingresa con tu cuenta para continuar.
            </p>
          </div>

          <form action={action} className="mt-6 space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-foreground"
              >
                Usuario / Correo
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="mt-1.5 block w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder-muted-foreground shadow-sm transition-colors focus:border-ring focus:ring-2 focus:ring-ring/40 focus:outline-none"
                placeholder="correo@muni-ica.gob.pe"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-foreground"
              >
                Contraseña
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="mt-1.5 block w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder-muted-foreground shadow-sm transition-colors focus:border-ring focus:ring-2 focus:ring-ring/40 focus:outline-none"
                placeholder="••••••••"
              />
            </div>

            {state?.error && (
              <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {state.error}
              </p>
            )}

            <button
              type="submit"
              disabled={pending}
              className="flex w-full items-center justify-center rounded-lg bg-[#26a72c] text-white px-4 py-2.5 text-sm font-medium  shadow-sm transition-colors hover:bg-[#26a72c]/80 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pending ? 'Ingresando…' : 'Ingresar'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            <a
              href="/solicitar-recuperacion"
              className="font-medium text-foreground underline underline-offset-4 hover:font-bold"
            >
              ¿Olvidaste tu contraseña?
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
