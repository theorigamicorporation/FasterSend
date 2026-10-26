<script setup lang="ts">
// OG image needs an absolute URL, built from the runtime site config (NUXT_PUBLIC_SITE_URL)
const siteConfig = useSiteConfig()
const ogImageURL = computed(() =>
  siteConfig.url ? new URL('/og-image.png', siteConfig.url).href : '/og-image.png'
)
const description =
  'Send files and folders straight to another device. No uploads, no accounts, browser to browser over an encrypted connection.'

useSeoMeta({
  ogTitle: 'FasterSend',
  ogType: 'website',
  ogDescription: description,
  ogImage: ogImageURL,
  ogImageWidth: 1200,
  ogImageHeight: 630,
  ogImageType: 'image/png',
  ogImageAlt: 'FasterSend: send files straight to another device',
  twitterCard: 'summary_large_image',
  twitterTitle: 'FasterSend',
  twitterDescription: description,
  twitterImage: ogImageURL,
  twitterImageAlt: 'FasterSend: send files straight to another device'
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
  <AppToaster />
  <div class="flex min-h-screen flex-col">
    <NavBar />
    <main class="flex-1">
      <NuxtPage />
    </main>
    <AppFooter />
  </div>
  <InstallPWA />
  <DocPanel />
</template>
