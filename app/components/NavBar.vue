<script setup lang="ts">
const localePath = useLocalePath()
const { locale, setLocale } = useI18n()
const colorMode = useColorMode()
const isBgBlur = ref(false)
const userStore = useUserStore()
const { userInfo, isConfirmDefault } = storeToRefs(userStore)
const tmpNickname = ref('')
const isProfileOpen = ref(false)
const helpOpen = useHelpOpen()

// Toggle from the theme actually in effect so the icon is right when following the system
function switchColorMode() {
  colorMode.preference = colorMode.value === 'dark' ? 'light' : 'dark'
}

const localeCodes = ['en', 'de', 'fr'] as const

function switchConfirmDefault() {
  userStore.setConfirmDefault(isConfirmDefault.value)
}

watch(isProfileOpen, (open) => {
  if (open) tmpNickname.value = userInfo.value.nickname
})

function editNickname() {
  userStore.setNickname(tmpNickname.value)
  tmpNickname.value = userInfo.value.nickname
  isProfileOpen.value = false
}

function editAvatar() {
  userStore.openAvatarPicker()
}

function clearUserInfo() {
  userStore.resetUserInfo()
  tmpNickname.value = userInfo.value.nickname
}

onMounted(() => {
  const onScroll = () => (isBgBlur.value = getScrollTop() > 8)
  onScroll()
  window.addEventListener('scroll', onScroll, { passive: true })
  userStore.initializeFromStorage()
  tmpNickname.value = userInfo.value.nickname
})
</script>

<template>
  <nav
    class="nav-bar sticky top-0 z-50 border-b transition-colors"
    :class="
      isBgBlur
        ? 'border-zinc-200/80 bg-white/75 backdrop-blur-md dark:border-zinc-800/80 dark:bg-zinc-950/75'
        : 'border-transparent'
    "
  >
    <div class="mx-auto flex h-16 max-w-6xl items-center gap-2 px-4 sm:px-6">
      <NuxtLink
        :to="localePath('/')"
        class="flex items-center gap-2 rounded-lg font-semibold tracking-tight"
      >
        <img src="/favicon.webp" alt="" class="size-8 rounded-lg" />
        <span class="text-[1.05rem]">FasterSend</span>
      </NuxtLink>

      <div class="flex-1"></div>

      <button
        type="button"
        data-testid="help-button"
        class="flex h-9 items-center gap-1.5 rounded-full px-2.5 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-900/5 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-white/10 dark:hover:text-white"
        :aria-label="$t('nav.help')"
        @click="helpOpen = true"
      >
        <Icon name="solar:question-circle-linear" size="18" />
        <span class="hidden sm:inline">{{ $t('nav.help') }}</span>
      </button>

      <!-- Profile -->
      <PopoverRoot v-model:open="isProfileOpen">
        <PopoverTrigger
          class="flex items-center gap-2 rounded-full border border-zinc-200 bg-white/80 py-1 pr-1 pl-1 text-sm transition-colors hover:border-zinc-300 sm:pr-3 dark:border-zinc-800 dark:bg-zinc-900/80 dark:hover:border-zinc-700"
          :aria-label="$t('nav.profile')"
        >
          <UiAvatar :src="userInfo.avatarURL" size="sm" />
          <span class="hidden max-w-36 truncate font-medium sm:block">{{ userInfo.nickname }}</span>
        </PopoverTrigger>
        <PopoverPortal>
          <PopoverContent
            align="end"
            :side-offset="8"
            :collision-padding="16"
            class="popover z-[60] w-72 rounded-2xl border border-zinc-200 bg-white text-zinc-900 shadow-xl shadow-zinc-950/10 outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
          >
            <div class="p-4">
              <div class="flex flex-col items-center gap-3">
                <button
                  type="button"
                  class="group relative rounded-full"
                  :aria-label="$t('nav.profile')"
                  @click="editAvatar"
                >
                  <UiAvatar :src="userInfo.avatarURL" size="lg" />
                  <span
                    class="absolute inset-0 flex items-center justify-center rounded-full bg-black/45 text-white opacity-0 transition-opacity group-hover:opacity-100"
                  >
                    <Icon name="solar:camera-linear" size="22" />
                  </span>
                </button>
                <form class="flex w-full gap-2" @submit.prevent="editNickname">
                  <input
                    v-model="tmpNickname"
                    maxlength="16"
                    :placeholder="$t('label.nickname')"
                    :aria-label="$t('label.nickname')"
                    class="h-10 min-w-0 flex-1 rounded-xl border border-zinc-200 bg-white px-3 text-base sm:text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-zinc-700 dark:bg-zinc-900"
                  />
                  <UiButton
                    type="submit"
                    icon="material-symbols:check-rounded"
                    :aria-label="$t('btn.ok')"
                  />
                </form>
                <UiButton
                  variant="ghost"
                  size="sm"
                  icon="material-symbols:sync-rounded"
                  @click="clearUserInfo"
                >
                  {{ $t('btn.randomize') }}
                </UiButton>
              </div>

              <div class="my-4 h-px bg-zinc-200 dark:bg-zinc-800"></div>

              <label class="flex cursor-pointer items-center justify-between gap-3">
                <span class="text-sm">{{ $t('label.autoConfirmBySender') }}</span>
                <UiSwitch v-model="isConfirmDefault" @update:model-value="switchConfirmDefault" />
              </label>
            </div>
          </PopoverContent>
        </PopoverPortal>
      </PopoverRoot>

      <!-- Language -->
      <div
        class="flex items-center rounded-full border border-zinc-200 bg-white/80 p-0.5 text-xs font-semibold dark:border-zinc-800 dark:bg-zinc-900/80"
        role="group"
        aria-label="Language"
      >
        <button
          v-for="code in localeCodes"
          :key="code"
          type="button"
          class="rounded-full px-2 py-1 uppercase transition-colors sm:px-2.5"
          :class="
            locale === code
              ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900'
              : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white'
          "
          :aria-pressed="locale === code"
          @click="setLocale(code)"
        >
          {{ code }}
        </button>
      </div>

      <!-- Theme -->
      <button
        type="button"
        class="flex size-9 items-center justify-center rounded-full text-zinc-600 transition-colors hover:bg-zinc-900/5 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-white/10 dark:hover:text-white"
        :aria-label="$t('nav.theme')"
        @click="switchColorMode"
      >
        <ClientOnly>
          <Icon v-if="colorMode.value === 'dark'" name="solar:moon-linear" size="18" />
          <Icon v-else name="solar:sun-2-linear" size="18" />
          <template #fallback><span class="size-[18px]" /></template>
        </ClientOnly>
      </button>
    </div>
  </nav>
</template>

<style scoped>
.popover[data-state='open'] {
  animation: popover-in 150ms ease-out;
}
@keyframes popover-in {
  from {
    opacity: 0;
    transform: translateY(-4px) scale(0.98);
  }
}
.nav-bar {
  transition: backdrop-filter 0.5s ease;
}
</style>
