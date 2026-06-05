import ActualizarContrasenaForm from './form'

export default async function ActualizarContrasenaPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams

  if (error === 'link_invalido') {
    return (
      <div className="flex min-h-full flex-col items-center justify-center bg-zinc-50 px-4 py-12">
        <div className="w-full max-w-sm text-center">
          <h1 className="mb-4 text-2xl font-semibold tracking-tight text-zinc-900">
            Link inválido o expirado
          </h1>
          <p className="mb-6 text-sm text-zinc-500">
            El link de recuperación ya fue usado o expiró. Solicita uno nuevo.
          </p>
          <a
            href="/solicitar-recuperacion"
            className="text-sm text-zinc-700 underline underline-offset-4 hover:text-zinc-900"
          >
            Solicitar nuevo link
          </a>
        </div>
      </div>
    )
  }

  return <ActualizarContrasenaForm />
}
