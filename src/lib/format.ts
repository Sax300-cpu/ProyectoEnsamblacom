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
