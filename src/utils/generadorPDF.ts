import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { VentaConDetalles } from '../types/database'

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

export async function generarReciboVenta(datos: DatosRecibo) {
  const doc = new jsPDF({ unit: 'mm', format: [80, 250] })

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

  const fechaStr = datos.fecha.replace(/[/\s:]/g, '-')
  const prefijo = datos.tituloDocumento.toLowerCase().includes('credito') ? 'recibo_credito' : 'recibo_venta'
  doc.save(`${prefijo}_${fechaStr}.pdf`)
}

function formatearFechaLarga(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('es-PE', {
    day: '2-digit', month: 'long', year: 'numeric',
  })
}

export function generarReportePeriodoPDF(
  ventas: VentaConDetalles[],
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

  let totalEfectivo = 0
  let totalTransferencia = 0
  let granTotal = 0

  const ventasValidas = ventas.filter(
    (v) => v.total > 0 && v.detalles_venta.length > 0,
  )

  const cuerpo = ventasValidas.map((v) => {
    const det = v.detalles_venta[0]
    const categoria = det?.repuestos.categorias?.nombre ?? '—'
    const marca = det?.repuestos.modelos?.marcas?.nombre ?? '—'
    const modelo = det?.repuestos.modelos?.nombre ?? '—'
    const cantidad = det?.cantidad ?? 0
    const pago = v.metodo_pago ?? '—'
    const fechaReal = v.fecha_cobro ? v.fecha_cobro : v.fecha_hora
    const fecha = new Date(fechaReal).toLocaleDateString('es-PE', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    })

    granTotal += v.total
    if (v.metodo_pago === 'Efectivo') totalEfectivo += v.total
    else if (v.metodo_pago === 'Transferencia') totalTransferencia += v.total

    return [fecha, categoria, marca, modelo, cantidad.toString(), pago, `$ ${v.total.toFixed(2)}`]
  })

  autoTable(doc, {
    startY: 44,
    head: [['FECHA', 'CATEGORÍA', 'MARCA', 'MODELO', 'CANTIDAD', 'PAGO', 'TOTAL']],
    body: cuerpo,
    foot: [
      ['', '', '', '', 'TOTAL EFECTIVO', '', `$ ${totalEfectivo.toFixed(2)}`],
      ['', '', '', '', 'TOTAL TRANSFERENCIAS', '', `$ ${totalTransferencia.toFixed(2)}`],
      ['', '', '', '', 'GRAN TOTAL', '', `$ ${granTotal.toFixed(2)}`],
    ],
    theme: 'grid',
    headStyles: { fillColor: [30, 64, 175], halign: 'center' },
    footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold' },
    styles: { valign: 'middle', fontSize: 9 },
    columnStyles: {
      0: { halign: 'center', cellWidth: 30 },
      1: { cellWidth: 28 },
      2: { cellWidth: 28 },
      3: { cellWidth: 'auto' },
      4: { halign: 'center', cellWidth: 20 },
      5: { halign: 'center', cellWidth: 25 },
      6: { halign: 'right', cellWidth: 30 },
    },
    margin: { left: 10, right: 10 },
  })

  const fechaStr = new Date().toISOString().slice(0, 10)
  doc.save(`reporte_ventas_${fechaInicio}_${fechaFin}_${fechaStr}.pdf`)
}
