<script lang="ts" setup>
const isPWA = ref(false)
const appStore = useAppStore()
const { deferredPrompt } = storeToRefs(appStore)

function installPWA() {
  deferredPrompt.value?.prompt()
}

onMounted(() => {
  isPWA.value = isStandalone()
})
</script>

<template>
  <button
    v-if="!isPWA && deferredPrompt"
    type="button"
    class="fixed right-4 bottom-20 z-40 flex size-12 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-700 shadow-lg shadow-zinc-900/10 transition-colors hover:text-zinc-900 sm:right-6 sm:bottom-24 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:text-white"
    aria-label="Install PWA"
    @click="installPWA"
  >
    <Icon name="ic:outline-install-mobile" size="22" />
  </button>
</template>

<style></style>
