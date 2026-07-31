interface ErrorConCodigo {
  message: string
  code?: string
}

const MENSAJE_DUPLICADO =
  '⚠️ Este producto con exactamente las mismas características ya está registrado. Búscalo en la lista para actualizar su stock.'

export function mensajeErrorDuplicado(error: ErrorConCodigo | null | undefined): string {
  const message = error?.message ?? ''
  const code = error?.code
  if (code === '23505' || message.toLowerCase().includes('duplicate key')) {
    return MENSAJE_DUPLICADO
  }
  return message || 'Error desconocido al guardar.'
}
