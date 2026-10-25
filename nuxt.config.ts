// https://nuxt.com/docs/api/configuration/nuxt-config
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
export default defineNuxtConfig({
  srcDir: 'app',
  devtools: { enabled: true },
  css: ['@/assets/main.css'],

  imports: {
    dirs: ['stores']
  },

  modules: [
    '@pinia/nuxt',
    '@nuxtjs/color-mode',
    '@nuxtjs/i18n',
    '@nuxtjs/seo',
    '@nuxt/icon',
    '@vite-pwa/nuxt',
    '@primevue/nuxt-module'
  ],

  vite: {
    plugins: [tailwindcss()]
  },

  app: {
    head: {
      charset: 'utf-8',
      viewport: 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=0',
      link: [{ rel: 'icon', href: '/favicon.webp' }]
    }
  },

  i18n: {
    locales: [
      { code: 'en', language: 'en-US' },
      { code: 'de', language: 'de-DE' },
      { code: 'fr', language: 'fr-FR' }
    ],
    defaultLocale: 'en',
    detectBrowserLanguage: {
      useCookie: true,
      cookieKey: 'i18n_redirected',
      redirectOn: 'root'
    }
  },

  // Site URL is not baked in at build time; injected at deploy via NUXT_PUBLIC_SITE_URL
  site: {
    name: 'FasterSend',
    // Peer-to-peer directory sync and file transfer over WebRTC
    description:
      'A tool station based on WebRTC to achieve point-to-point fast directory synchronization and file transfer'
    // defaultLocale: 'zh'
  },

  // Serve every icon from the bundle; never fall back to api.iconify.design
  icon: {
    provider: 'none',
    fallbackToApi: false,
    clientBundle: {
      scan: true
    },
    serverBundle: false
  },

  ogImage: {
    enabled: false
  },

  // Bundled with @nuxtjs/seo v6 and on by default. Skew protection registers its own
  // service worker next to the PWA one and can reload the page mid-transfer.
  skewProtection: false,
  aiReady: false,

  primevue: {
    options: {
      unstyled: true,
      ripple: true
    },
    importPT: { from: path.resolve(__dirname, './presets/aura/') } // Import and apply preset
    // For Windows
    // importPT: { as: 'Aura', from: '~/presets/aura' }
  },

  colorMode: {
    preference: 'system', // default value of $colorMode.preference
    fallback: 'light', // fallback value if not system preference found
    globalName: '__NUXT_COLOR_MODE__',
    componentName: 'ColorScheme',
    classPrefix: '',
    classSuffix: '',
    storageKey: 'nuxt-color-mode'
  },

  pwa: {
    strategies: 'injectManifest',
    srcDir: '../public',
    filename: 'sw.js',
    registerType: 'prompt',

    // workbox: {
    //   runtimeCaching: [
    //     {
    //       urlPattern: /.*/,
    //       handler: 'StaleWhileRevalidate',
    //       options: {
    //         cacheName: 'main'
    //       }
    //     }
    //   ]
    // },

    manifest: {
      name: 'FasterSend',
      short_name: 'FasterSend',
      theme_color: '#ffffff',

      icons: [
        {
          src: '/favicon.webp',
          sizes: '512x512',
          type: 'image/webp',
          purpose: 'any'
        }
      ],

      screenshots: [
        { src: '/ogImg.webp', sizes: '1280x720', type: 'image/webp', form_factor: 'wide' },
        { src: '/mobile.webp', sizes: '990x1370', type: 'image/webp', form_factor: 'narrow' }
      ]
    }
  },

  // Runtime config; all values can be overridden at startup via NUXT_* env vars without rebuilding the image
  runtimeConfig: {
    // NUXT_TRUST_PROXY: true or trusted proxy hop count; enable only behind a reverse proxy
    trustProxy: false,
    // NUXT_MAX_CONNECTIONS_PER_IP
    maxConnectionsPerIp: 32,
    // NUXT_RECEIVE_FAILURES_PER_MINUTE
    receiveFailuresPerMinute: 10,
    public: {
      // NUXT_PUBLIC_ICE_SERVERS: JSON array of RTCIceServer
      iceServers: '',
      // NUXT_PUBLIC_ICE_TRANSPORT_POLICY：all | relay
      iceTransportPolicy: ''
    }
  },

  nitro: {
    experimental: {
      websocket: true
    },
    // Inline all dependencies into the server bundle,
    // avoiding missing transitive deps in external node_modules (Node 24+ strict ESM resolution)
    externals: {
      inline: [/.*/]
    }
  },

  compatibilityDate: '2026-04-13'
})
