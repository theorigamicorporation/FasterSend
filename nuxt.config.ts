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
      { code: 'zh', language: 'zh-CN' }
    ],
    defaultLocale: 'en',
    detectBrowserLanguage: {
      useCookie: true,
      cookieKey: 'i18n_redirected',
      redirectOn: 'root'
    }
  },

  // 站点地址不在构建时写死，部署时通过运行时环境变量 NUXT_PUBLIC_SITE_URL 注入
  site: {
    name: 'FasterSend',
    // 一个基于WebRTC实现点对点快速目录同步和文件传输的工具站
    description:
      'A tool station based on WebRTC to achieve point-to-point fast directory synchronization and file transfer'
    // defaultLocale: 'zh'
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

  // 运行时配置，均可通过 NUXT_* 环境变量在启动时覆盖，无需重新构建镜像
  runtimeConfig: {
    // NUXT_TRUST_PROXY：true 或可信代理跳数，仅在位于反向代理之后时开启
    trustProxy: false,
    // NUXT_MAX_CONNECTIONS_PER_IP
    maxConnectionsPerIp: 32,
    // NUXT_RECEIVE_FAILURES_PER_MINUTE
    receiveFailuresPerMinute: 10,
    public: {
      // NUXT_PUBLIC_ICE_SERVERS：RTCIceServer[] 的 JSON
      iceServers: '',
      // NUXT_PUBLIC_ICE_TRANSPORT_POLICY：all | relay
      iceTransportPolicy: ''
    }
  },

  nitro: {
    experimental: {
      websocket: true
    },
    // 将所有依赖内联打包进 server bundle，
    // 避免外置 node_modules 中传递依赖缺失（Node 24+ ESM 严格解析）
    externals: {
      inline: [/.*/]
    }
  },

  compatibilityDate: '2026-04-13'
})
