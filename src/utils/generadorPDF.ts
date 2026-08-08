import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

interface ItemPDF {
  categoria: string
  marca: string
  modelo: string
  cantidad: number
  precioUnitario: number
  subtotal: number
}

interface DatosRecibo {
  nombreCliente: string
  fecha: string
  detallesRepuesto: ItemPDF[]
  total: number
  tituloDocumento: string
}

const URL_IMAGEN = '/imagenBuena.png'

function cargarImagen(): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = URL_IMAGEN
  })
}

async function dibujarTicket(doc: jsPDF, datos: DatosRecibo) {
  const imagen = await cargarImagen()

  const anchoImg = 60
  const altoImg = 22
  const yImg = 4
  const baseY = imagen ? yImg + altoImg + 5 : 34

  if (imagen) {
    doc.addImage(imagen, 'PNG', (80 - anchoImg) / 2, yImg, anchoImg, altoImg)
  }

  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.text(datos.tituloDocumento, 40, baseY, { align: 'center' })

  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.text(`Fecha: ${datos.fecha}`, 40, baseY + 5, { align: 'center' })

  doc.setFont('helvetica', 'bold')
  doc.text(`Cliente: ${datos.nombreCliente}`, 40, baseY + 10, { align: 'center' })

  autoTable(doc, {
    startY: baseY + 18,
    head: [['CNT', 'CTG', 'ÍTEM', 'P.U.', 'SUBT']],
    body: datos.detallesRepuesto.map((item) => [
      item.cantidad.toString(),
      item.categoria,
      item.modelo,
      `$ ${item.precioUnitario.toFixed(2)}`,
      `$ ${item.subtotal.toFixed(2)}`,
    ]),
    theme: 'plain',
    headStyles: { textColor: [30, 64, 175], fontStyle: 'bold', fontSize: 7 },
    styles: { fontSize: 7, cellPadding: 0.5 },
    columnStyles: {
      0: { halign: 'center', cellWidth: 6 },
      1: { cellWidth: 14 },
      2: { cellWidth: 23 },
      3: { halign: 'right', cellWidth: 11 },
      4: { halign: 'right', cellWidth: 12 },
    },
    margin: { left: 6, right: 6 },
  })

  const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY

  doc.setDrawColor(150)
  doc.setLineDashPattern([1.5, 1.5], 0)
  doc.line(6, finalY + 3, 74, finalY + 3)
  doc.setLineDashPattern([], 0)

  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.text(`Total: $ ${datos.total.toFixed(2)}`, 74, finalY + 12, { align: 'right' })

  doc.setFontSize(6.5)
  doc.setFont('helvetica', 'italic')
  doc.setTextColor(100)
  doc.text(
    'Una vez salida la mercadería no se aceptan devoluciones. Todo repuesto o pantalla debe ser probado en el momento de la entrega.',
    40,
    finalY + 20,
    { align: 'center', maxWidth: 68 },
  )
  doc.setTextColor(0)
}

export async function generarReciboVenta(datos: DatosRecibo) {
  const doc = new jsPDF({ unit: 'mm', format: [80, 250] })

  await dibujarTicket(doc, datos)

  const fechaStr = datos.fecha.replace(/[/\s:]/g, '-')
  const prefijo = datos.tituloDocumento.toLowerCase().includes('credito') ? 'recibo_credito' : 'recibo_venta'
  doc.save(`${prefijo}_${fechaStr}.pdf`)
}

export async function generarTicketCobroLote(datos: DatosRecibo) {
  const doc = new jsPDF({ unit: 'mm', format: [80, 250] })

  await dibujarTicket(doc, datos)

  const fechaStr = datos.fecha.replace(/[/\s:]/g, '-')
  doc.save(`recibo_cobro_lote_${fechaStr}.pdf`)
}

function formatearFechaLarga(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('es-PE', {
    day: '2-digit', month: 'long', year: 'numeric',
  })
}

export interface FilaReporteInput {
  categoria: string
  marca: string
  modelo: string
  cantidad: number
  total: number
  metodoPago: string
  montoEfectivo?: number
  montoTransferencia?: number
}

function agruparParaReporte(datos: FilaReporteInput[]): FilaReporteInput[] {
  const mapa = new Map<string, FilaReporteInput>()
  for (const fila of datos) {
    const llave = `${fila.categoria}||${fila.marca}||${fila.modelo}||${fila.metodoPago}`
    const existente = mapa.get(llave)
    if (existente) {
      existente.cantidad += fila.cantidad
      existente.total += fila.total
      existente.montoEfectivo = (existente.montoEfectivo ?? 0) + (fila.montoEfectivo ?? 0)
      existente.montoTransferencia =
        (existente.montoTransferencia ?? 0) + (fila.montoTransferencia ?? 0)
    } else {
      mapa.set(llave, { ...fila })
    }
  }
  return Array.from(mapa.values())
}

export function generarReportePeriodoPDF(
  datos: FilaReporteInput[],
  fechaInicio: string,
  fechaFin: string,
) {
  const doc = new jsPDF()

  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text('REPORTE DE VENTAS', doc.internal.pageSize.width / 2, 22, {
    align: 'center',
  })

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(
    `Periodo: ${formatearFechaLarga(fechaInicio)} al ${formatearFechaLarga(fechaFin)}`,
    doc.internal.pageSize.width / 2,
    30,
    { align: 'center' },
  )

  doc.setFontSize(9)
  doc.setTextColor(100)
  doc.text(
    `Generado: ${new Date().toLocaleDateString('es-PE', {
      year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })}`,
    doc.internal.pageSize.width / 2,
    36,
    { align: 'center' },
  )
  doc.setTextColor(0)

  const agrupadas = agruparParaReporte(datos).sort((a, b) => {
    const catA = (a.categoria ?? '').toLowerCase()
    const catB = (b.categoria ?? '').toLowerCase()
    if ((catA === 'pantallas') !== (catB === 'pantallas')) {
      return catA === 'pantallas' ? -1 : 1
    }
    return (
      catA.localeCompare(catB, 'es', { sensitivity: 'base' }) ||
      (a.marca ?? '').localeCompare(b.marca ?? '', 'es', { sensitivity: 'base' }) ||
      (a.modelo ?? '').localeCompare(b.modelo ?? '', 'es', { sensitivity: 'base' })
    )
  })

  let totalEfectivo = 0
  let totalTransferencia = 0
  let granTotal = 0

  for (const fila of agrupadas) {
    granTotal += fila.total
    totalEfectivo += fila.montoEfectivo ?? 0
    totalTransferencia += fila.montoTransferencia ?? 0
  }

  const cuerpo = agrupadas.map((fila) => [
    fila.categoria,
    fila.marca,
    fila.modelo,
    fila.cantidad.toString(),
    fila.metodoPago,
    `$ ${fila.total.toFixed(2)}`,
  ])

  autoTable(doc, {
    startY: 44,
    head: [['CATEGORÍA', 'MARCA', 'MODELO', 'CANTIDAD', 'PAGO', 'TOTAL']],
    body: cuerpo,
    foot: [
      ['', '', '', '', 'TOTAL EFECTIVO', `$ ${totalEfectivo.toFixed(2)}`],
      ['', '', '', '', 'TOTAL TRANSFERENCIAS', `$ ${totalTransferencia.toFixed(2)}`],
      ['', '', '', '', 'GRAN TOTAL', `$ ${granTotal.toFixed(2)}`],
    ],
    theme: 'grid',
    headStyles: { fillColor: [30, 64, 175], halign: 'center' },
    footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold' },
    styles: { valign: 'middle', fontSize: 9 },
    columnStyles: {
      0: { cellWidth: 28 },
      1: { cellWidth: 28 },
      2: { cellWidth: 'auto' },
      3: { halign: 'center', cellWidth: 20 },
      4: { halign: 'center', cellWidth: 25 },
      5: { halign: 'right', cellWidth: 30 },
    },
    margin: { left: 10, right: 10 },
  })

  const fechaStr = new Date().toISOString().slice(0, 10)
  doc.save(`reporte_ventas_${fechaInicio}_${fechaFin}_${fechaStr}.pdf`)
}
