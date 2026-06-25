// Horario de atención de soporte: Lun–Vie 08:00–14:30, zona America/Lima.
// Perú no observa horario de verano (UTC-5 estable), así que el offset es fijo.
//
// Para no depender de la zona horaria del servidor, las partes del "reloj de
// pared" de Lima (día de la semana, hora, minuto) se leen con Intl usando
// timeZone: 'America/Lima'. El único uso del offset fijo (-5) es construir el
// instante de apertura (08:00 Lima = 13:00 UTC).

const DIAS_HABILES = [1, 2, 3, 4, 5] // Lun–Vie (getUTCDay: 0=Dom … 6=Sáb)
const HORA_INICIO = 8 * 60 // 08:00 en minutos desde medianoche
const HORA_FIN = 14 * 60 + 30 // 14:30 en minutos desde medianoche
const OFFSET_LIMA_HORAS = 5 // Lima = UTC-5 (sin DST)

type PartesLima = {
  year: number
  month: number // 1–12
  day: number
  weekday: number // 0=Dom … 6=Sáb
  minutos: number // minutos desde medianoche, hora de Lima
}

// Lee las partes del reloj de pared de Lima para un instante dado.
function partesLima(fecha: Date): PartesLima {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Lima',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  const partes = fmt.formatToParts(fecha)
  const val = (tipo: string) => partes.find((p) => p.type === tipo)?.value ?? '0'
  const year = Number(val('year'))
  const month = Number(val('month'))
  const day = Number(val('day'))
  // hour12:false puede devolver "24" a medianoche en algunos entornos; normalizar.
  const hour = Number(val('hour')) % 24
  const minute = Number(val('minute'))
  // El día de la semana se deriva del calendario (independiente del locale).
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay()
  return { year, month, day, weekday, minutos: hour * 60 + minute }
}

/** ¿El instante `fecha` cae dentro de la ventana de atención de Lima? */
export function estaEnHorario(fecha: Date): boolean {
  const { weekday, minutos } = partesLima(fecha)
  return (
    DIAS_HABILES.includes(weekday) &&
    minutos >= HORA_INICIO &&
    minutos < HORA_FIN
  )
}

/**
 * Próximo instante de apertura (08:00 Lima) a partir de `fecha`:
 * - día hábil antes de las 08:00 → hoy a las 08:00;
 * - en cualquier otro caso → siguiente día hábil a las 08:00 (vie/sáb/dom → lunes).
 */
export function proximaApertura(fecha: Date): Date {
  const { year, month, day, weekday, minutos } = partesLima(fecha)
  // Ancla a mediodía UTC del día calendario de Lima: sumar 24 h nunca cruza un
  // borde de fecha, así getUTCDay/getUTCDate quedan estables al avanzar días.
  let ancla = new Date(Date.UTC(year, month - 1, day, 12, 0, 0))

  const habilHoy = DIAS_HABILES.includes(weekday)
  if (!(habilHoy && minutos < HORA_INICIO)) {
    // No abre hoy (fin de semana, o día hábil ya pasada la apertura): avanzar
    // al siguiente día hábil.
    do {
      ancla = new Date(ancla.getTime() + 24 * 60 * 60 * 1000)
    } while (!DIAS_HABILES.includes(ancla.getUTCDay()))
  }

  // 08:00 Lima = (8 + 5) = 13:00 UTC.
  return new Date(
    Date.UTC(
      ancla.getUTCFullYear(),
      ancla.getUTCMonth(),
      ancla.getUTCDate(),
      8 + OFFSET_LIMA_HORAS,
      0,
      0,
    ),
  )
}
