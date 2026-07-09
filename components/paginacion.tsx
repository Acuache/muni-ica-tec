'use client'

// Paginación numerada con elipsis (SPEC 16): ‹ 1 … 4 [5] 6 … 20 ›.
// Presentacional: la navegación la decide el padre vía onPageChange.

const btnBase =
  'rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40'
const btnNormal = `${btnBase} border-gray-300 text-gray-600 hover:bg-gray-50`
// La página actual va disabled (no navega) pero no debe verse atenuada.
const btnActual =
  'rounded-lg border border-blue-600 bg-blue-600 px-2.5 py-1.5 text-xs font-semibold text-white'

// Ventana de páginas: todas si son ≤ 7; si no, primera + última + vecinas de
// la actual, con '…' en los huecos (o el número mismo si el hueco es de 1).
function calcularPaginas(actual: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)

  const inicio = Math.max(2, actual - 1)
  const fin = Math.min(total - 1, actual + 1)
  const paginas: (number | '…')[] = [1]

  if (inicio === 3) paginas.push(2)
  else if (inicio > 3) paginas.push('…')

  for (let i = inicio; i <= fin; i++) paginas.push(i)

  if (fin === total - 2) paginas.push(total - 1)
  else if (fin < total - 2) paginas.push('…')

  paginas.push(total)
  return paginas
}

export default function Paginacion({
  paginaActual,
  totalPaginas,
  onPageChange,
  disabled = false,
}: {
  paginaActual: number
  totalPaginas: number
  onPageChange: (pagina: number) => void
  disabled?: boolean
}) {
  const paginas = calcularPaginas(paginaActual, totalPaginas)

  return (
    <nav aria-label="Paginación" className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => onPageChange(paginaActual - 1)}
        disabled={disabled || paginaActual <= 1}
        aria-label="Página anterior"
        className={btnNormal}
      >
        ‹
      </button>

      {paginas.map((p, i) =>
        p === '…' ? (
          <span key={`elipsis-${i}`} className="px-1 text-xs text-gray-400">
            …
          </span>
        ) : p === paginaActual ? (
          <button key={p} type="button" disabled aria-current="page" className={btnActual}>
            {p}
          </button>
        ) : (
          <button
            key={p}
            type="button"
            onClick={() => onPageChange(p)}
            disabled={disabled}
            className={btnNormal}
          >
            {p}
          </button>
        ),
      )}

      <button
        type="button"
        onClick={() => onPageChange(paginaActual + 1)}
        disabled={disabled || paginaActual >= totalPaginas}
        aria-label="Página siguiente"
        className={btnNormal}
      >
        ›
      </button>
    </nav>
  )
}
