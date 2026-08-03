interface ConfirmDialogProps {
  abierto: boolean
  titulo?: string
  mensaje: string
  confirmarTexto?: string
  onCancel: () => void
  onConfirm: () => void
}

export function ConfirmDialog({
  abierto,
  titulo,
  mensaje,
  confirmarTexto,
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  if (!abierto) return null

  return (
    <div className="fixed inset-0 z-[90] bg-black/40 flex items-center justify-center">
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-slate-800">
          {titulo ?? 'Confirmar eliminación'}
        </h3>
        <p className="text-sm text-slate-600">{mensaje}</p>
        <div className="flex justify-end gap-3 pt-1">
          <button
            onClick={onCancel}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 transition-colors cursor-pointer"
          >
            {confirmarTexto ?? 'Eliminar'}
          </button>
        </div>
      </div>
    </div>
  )
}
