import { useEffect, useState } from 'react'

interface ToastItem {
  id: number
  type: 'success' | 'error'
  message: string
}

type Listener = (toasts: ToastItem[]) => void

let toasts: ToastItem[] = []
let nextId = 1
const listeners = new Set<Listener>()

function emit() {
  listeners.forEach((listener) => listener([...toasts]))
}

function notify(type: ToastItem['type'], message: string) {
  const id = nextId++
  toasts = [...toasts, { id, type, message }]
  emit()
  setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== id)
    emit()
  }, 4500)
}

export const toast = {
  success: (message: string) => notify('success', message),
  error: (message: string) => notify('error', message),
}

export function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([])

  useEffect(() => {
    const listener: Listener = (list) => setItems(list)
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }, [])

  return (
    <div className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2 max-w-sm">
      {items.map((t) => (
        <div
          key={t.id}
          className={`rounded-lg shadow-lg px-4 py-3 text-sm font-medium text-white animate-[fadeIn_0.2s_ease-in] ${
            t.type === 'error' ? 'bg-red-600' : 'bg-emerald-600'
          }`}
        >
          {t.message}
        </div>
      ))}
    </div>
  )
}
