// Esqueleto de carga compartido por los loading.tsx de los paneles
// (SPEC 11, paso 6). Server Component: se pinta de inmediato al navegar,
// mientras el segmento resuelve sus datos en el servidor.
export default function CargandoPanel() {
  return (
    <div className="space-y-4" aria-busy="true" aria-live="polite">
      <span className="sr-only">Cargando…</span>
      <div className="h-6 w-44 animate-pulse rounded bg-gray-200" />
      <div className="h-24 animate-pulse rounded-xl bg-gray-100" />
      <div className="h-24 animate-pulse rounded-xl bg-gray-100" />
      <div className="h-24 animate-pulse rounded-xl bg-gray-100" />
    </div>
  )
}
