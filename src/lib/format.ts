export function formatearDetalles(
  distribuidor: string | undefined | null,
  detalles: Record<string, unknown> | undefined | null,
): string {
  const partes: string[] = []
  if (distribuidor) partes.push(distribuidor)

  if (detalles) {
    Object.entries(detalles).forEach(([key, value]) => {
      if (typeof value === 'string' || typeof value === 'number') {
        partes.push(String(value))
      } else if (typeof value === 'boolean' && value === true) {
        const textoLimpio = key
          .replace(/_/g, ' ')
          .replace(/\b\w/g, (char) => char.toUpperCase())
        partes.push(textoLimpio)
      }
    })
  }
  return partes.join(' - ')
}

export function formatearFechaComprobante(
  fechaString: string | null | undefined,
): string | null {
  if (!fechaString) return null
  const d = new Date(fechaString)
  if (isNaN(d.getTime())) return null
  const dia = d.toLocaleDateString('es-PE', { day: 'numeric' })
  const mes = d.toLocaleDateString('es-PE', { month: 'long' })
  const anio = d.getFullYear()
  const hora = d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })
  return `${dia} de ${mes} de ${anio} a las ${hora}`
}
