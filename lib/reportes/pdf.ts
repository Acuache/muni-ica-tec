// jspdf y jspdf-autotable se importan de forma DINÁMICA dentro de
// construirPdfReporte (SPEC 11, paso 7): así solo se cargan al GENERAR un
// PDF, no al cargar el módulo de reportes. Son server-only (no entran al
// bundle de cliente), pero el import dinámico también los saca del grafo
// de servidor de la ruta hasta que se necesitan.

export type FilaSolicitud = {
  fecha: string
  trabajador: string
  sede: string | null
  area: string | null
  subarea: string | null
  puesto: string | null
  titulo: string
  tecnico: string | null
  resultado: 'Solucionado' | 'No solucionado'
}

export type ResumenMes = {
  totalCerradas: number
  totalSolucionadas: number
  totalNoSolucionadas: number
  tasaExito: string // "82 %" o "—" si totalCerradas === 0
}

const SIN_DATO = '—'

export async function construirPdfReporte(
  titulo: string,
  resumen: ResumenMes,
  filas: FilaSolicitud[],
): Promise<Uint8Array> {
  const { jsPDF } = await import('jspdf')
  const { default: autoTable } = await import('jspdf-autotable')

  const doc = new jsPDF({ orientation: 'landscape' })

  doc.setFontSize(16)
  doc.text(titulo, 14, 15)

  doc.setFontSize(11)
  const resumenLineas = [
    `Total de solicitudes cerradas: ${resumen.totalCerradas}`,
    `Solucionadas: ${resumen.totalSolucionadas}`,
    `No solucionadas: ${resumen.totalNoSolucionadas}`,
    `Tasa de éxito: ${resumen.tasaExito}`,
  ]
  resumenLineas.forEach((linea, i) => {
    doc.text(linea, 14, 25 + i * 6)
  })

  autoTable(doc, {
    startY: 25 + resumenLineas.length * 6 + 4,
    head: [['Fecha', 'Trabajador', 'Sede', 'Área', 'Subárea', 'Puesto', 'Título', 'Técnico', 'Resultado']],
    body: filas.map((fila) => [
      fila.fecha,
      fila.trabajador,
      fila.sede ?? SIN_DATO,
      fila.area ?? SIN_DATO,
      fila.subarea ?? SIN_DATO,
      fila.puesto ?? SIN_DATO,
      fila.titulo,
      fila.tecnico ?? SIN_DATO,
      fila.resultado,
    ]),
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [41, 51, 92] },
  })

  return new Uint8Array(doc.output('arraybuffer'))
}
