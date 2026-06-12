// Cálculos de fechas para reportes mensuales, fijos a America/Lima
// (UTC-5, sin horario de verano).

const OFFSET_LIMA_MS = 5 * 60 * 60 * 1000

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

function formatMesISO(anio: number, mes: number): string {
  return `${anio}-${String(mes).padStart(2, '0')}`
}

// Año y mes (1-12) actuales según el reloj de pared en America/Lima.
function mesActualLima(): { anio: number; mes: number } {
  const limaWallClock = new Date(Date.now() - OFFSET_LIMA_MS)
  return { anio: limaWallClock.getUTCFullYear(), mes: limaWallClock.getUTCMonth() + 1 }
}

// Rango [inicio, fin) en UTC ISO de un mes calendario "YYYY-MM" en America/Lima.
export function rangoMesLima(mesISO: string): { inicio: string; fin: string } {
  const [anio, mes] = mesISO.split('-').map(Number)
  const inicio = new Date(Date.UTC(anio, mes - 1, 1, 5, 0, 0))
  const fin = new Date(Date.UTC(anio, mes, 1, 5, 0, 0))
  return { inicio: inicio.toISOString(), fin: fin.toISOString() }
}

// "YYYY-MM" del mes recién cerrado (mes anterior al actual, en America/Lima).
export function mesAnteriorISO(): string {
  const { anio, mes } = mesActualLima()
  return mes === 1 ? formatMesISO(anio - 1, 12) : formatMesISO(anio, mes - 1)
}

// "YYYY-MM" del mes en curso, en America/Lima.
export function mesActualISO(): string {
  const { anio, mes } = mesActualLima()
  return formatMesISO(anio, mes)
}

// Últimos n meses cerrados, orden desc, ej. ["2026-05","2026-04","2026-03"].
export function ultimosMesesCerrados(n: number): string[] {
  const { anio, mes } = mesActualLima()
  const meses: string[] = []
  let anioActual = anio
  let mesActual = mes
  for (let i = 0; i < n; i++) {
    mesActual -= 1
    if (mesActual < 1) {
      mesActual = 12
      anioActual -= 1
    }
    meses.push(formatMesISO(anioActual, mesActual))
  }
  return meses
}

// Etiqueta legible de un mes "YYYY-MM", ej. "Mayo 2026".
export function formatMesLabel(mesISO: string): string {
  const [anio, mes] = mesISO.split('-').map(Number)
  return `${MESES[mes - 1]} ${anio}`
}

// Instante UTC (ISO) en que comenzó el día de hoy en America/Lima.
// Para métricas "de hoy": medianoche de Lima, no medianoche UTC.
export function inicioDeHoyLima(): string {
  const limaWallClock = new Date(Date.now() - OFFSET_LIMA_MS)
  limaWallClock.setUTCHours(0, 0, 0, 0)
  return new Date(limaWallClock.getTime() + OFFSET_LIMA_MS).toISOString()
}

// Formatea un timestamp ISO (UTC) como "DD/MM/YYYY" en America/Lima.
export function formatFechaLima(iso: string): string {
  const limaWallClock = new Date(new Date(iso).getTime() - OFFSET_LIMA_MS)
  const dia = String(limaWallClock.getUTCDate()).padStart(2, '0')
  const mes = String(limaWallClock.getUTCMonth() + 1).padStart(2, '0')
  const anio = limaWallClock.getUTCFullYear()
  return `${dia}/${mes}/${anio}`
}
