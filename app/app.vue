<script setup lang="ts">
// OG image needs an absolute URL, built from the runtime site config (NUXT_PUBLIC_SITE_URL)
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
  <div class="flex min-h-screen flex-col">
    <NavBar />
    <main class="flex-1">
      <NuxtPage />
    </main>
    <AppFooter />
  </div>
  <ScrollTop />
  <InstallPWA />
  <DocPanel />
</template>
