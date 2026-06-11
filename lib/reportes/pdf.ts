import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

export type FilaSolicitud = {
  fecha: string
  trabajador: string
  lugar: string | null
  area: string | null
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

export function construirPdfReporte(
  titulo: string,
  resumen: ResumenMes,
  filas: FilaSolicitud[],
): Uint8Array {
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
    head: [['Fecha', 'Trabajador', 'Lugar', 'Área', 'Puesto', 'Título', 'Técnico', 'Resultado']],
    body: filas.map((fila) => [
      fila.fecha,
      fila.trabajador,
      fila.lugar ?? SIN_DATO,
      fila.area ?? SIN_DATO,
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
