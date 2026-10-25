<script setup lang="ts">
// 分享图需要绝对地址，基于运行时站点配置（NUXT_PUBLIC_SITE_URL）生成
const siteConfig = useSiteConfig()
const ogImageURL = computed(() =>
  siteConfig.url ? new URL('/ogImg.webp', siteConfig.url).href : '/ogImg.webp'
)

useSeoMeta({
  ogTitle: 'FasterSend',
  ogType: 'website',
  ogImage: ogImageURL,
  twitterCard: 'summary_large_image',
  twitterTitle: 'FasterSend',
  twitterDescription: 'Fast peer-to-peer file and directory transfers',
  twitterImage: ogImageURL
})

const appStore = useAppStore()

onMounted(() => {
  window.addEventListener('beforeinstallprompt', (event) => {
    appStore.setDeferredPrompt(event as BeforeInstallPromptEvent)
  })
  appStore.setFullScreenLoading(false)
})
</script>

<template>
  <NuxtPwaManifest />
  <NuxtRouteAnnouncer />
  <FullScreenLoader />
  <Toast position="top-right" />
  <NavBar />
  <NuxtPage />
  <AppFooter />
  <ScrollTop />
  <InstallPWA />
  <DocPanel />
</template>
