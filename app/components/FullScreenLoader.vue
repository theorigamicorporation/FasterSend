<script setup lang="ts">
const appStore = useAppStore()
const { isFullScreenLoading } = storeToRefs(appStore)
const loaderElm = ref()

watch(isFullScreenLoading, (isLoad) => {
  if (isLoad) {
    loaderElm.value.style.display = 'flex'
    setTimeout(() => {
      loaderElm.value.style.opacity = '1'
    }, 1)
  } else {
    loaderElm.value.style.opacity = '0'
    setTimeout(() => {
      loaderElm.value.style.display = 'none'
    }, 500)
  }
})
</script>

<template>
  <div class="loader-wrapper bg-white/60 backdrop-blur-sm dark:bg-zinc-950/60" ref="loaderElm">
    <UiSpinner :size="44" />
  </div>
</template>

<style scoped>
.loader-wrapper {
  display: flex;
  justify-content: center;
  align-items: center;
  position: fixed;
  inset: 0;
  z-index: 100;
  opacity: 1;
  transition: opacity 0.5s ease;
}
</style>
