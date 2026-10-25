/**
 * Global UI state store.
 * Holds only UI state shared across pages, avoiding implicit coupling through useState.
 */
export const useAppStore = defineStore('app', () => {
  const isFullScreenLoading = ref(true)
  const deferredPrompt = shallowRef<BeforeInstallPromptEvent | null>(null)

  function setFullScreenLoading(value: boolean) {
    isFullScreenLoading.value = value
  }

  function setDeferredPrompt(event: BeforeInstallPromptEvent | null) {
    deferredPrompt.value = event
  }

  function clearDeferredPrompt() {
    deferredPrompt.value = null
  }

  return {
    isFullScreenLoading,
    deferredPrompt,
    setFullScreenLoading,
    setDeferredPrompt,
    clearDeferredPrompt
  }
})
