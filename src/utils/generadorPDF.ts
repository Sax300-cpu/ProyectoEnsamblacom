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

export function generarReciboVenta(datos: DatosRecibo) {
  const doc = new jsPDF()

  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text(datos.tituloDocumento, doc.internal.pageSize.width / 2, 22, { align: 'center' })

  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')
  doc.text(`Fecha: ${datos.fecha}`, 14, 36)

  doc.setFont('helvetica', 'bold')
  doc.text(`Cliente: ${datos.nombreCliente}`, 14, 44)

  autoTable(doc, {
    startY: 54,
    head: [['Categoría', 'Marca', 'Modelo', 'Cantidad', 'P. Unitario', 'Subtotal']],
    body: datos.detallesRepuesto.map((item) => [
      item.categoria,
      item.marca,
      item.modelo,
      item.cantidad.toString(),
      `$ ${item.precioUnitario.toFixed(2)}`,
      `$ ${item.subtotal.toFixed(2)}`,
    ]),
    theme: 'striped',
    headStyles: { fillColor: [30, 64, 175] },
    styles: { fontSize: 9 },
    columnStyles: {
      0: { cellWidth: 30 },
      1: { cellWidth: 30 },
      2: { cellWidth: 'auto' },
      3: { halign: 'center', cellWidth: 20 },
      4: { halign: 'right', cellWidth: 28 },
      5: { halign: 'right', cellWidth: 28 },
    },
    margin: { left: 10, right: 10 },
  })

  const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10

  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text(`Total: $ ${datos.total.toFixed(2)}`, doc.internal.pageSize.width - 10, finalY, { align: 'right' })

  doc.setFontSize(8)
  doc.setFont('helvetica', 'italic')
  doc.setTextColor(100)
  doc.text(
    'Una vez salida la mercadería no se aceptan devoluciones. Todo repuesto o pantalla debe ser probado en el momento de la entrega.',
    doc.internal.pageSize.width / 2,
    finalY + 14,
    { align: 'center', maxWidth: doc.internal.pageSize.width - 20 },
  )
  doc.setTextColor(0)

  const fechaStr = datos.fecha.replace(/[/\s:]/g, '-')
  const prefijo = datos.tituloDocumento.toLowerCase().includes('credito') ? 'recibo_credito' : 'recibo_venta'
  doc.save(`${prefijo}_${fechaStr}.pdf`)
}
