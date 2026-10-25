export type ToastSeverity = 'success' | 'info' | 'warn' | 'error'

export interface ToastMessage {
  id: number
  severity: ToastSeverity
  summary: string
  detail?: string
  life?: number
}

let nextId = 0

// Same call shape as the PrimeVue toast service it replaces: toast.add({ severity, summary, life })
export default function useToast() {
  const messages = useState<ToastMessage[]>('toasts', () => [])

  function add(message: Omit<ToastMessage, 'id'>) {
    messages.value = [...messages.value, { ...message, id: ++nextId }]
  }

  function remove(id: number) {
    messages.value = messages.value.filter((m) => m.id !== id)
  }

  return { messages, add, remove }
}
