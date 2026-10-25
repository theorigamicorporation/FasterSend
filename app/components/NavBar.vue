<script setup lang="ts">
const localePath = useLocalePath()
const { locale, setLocale } = useI18n()
const colorMode = useColorMode()
const isBgBlur = ref(false)
const userStore = useUserStore()
const { userInfo, isConfirmDefault } = storeToRefs(userStore)
const tmpNickname = ref('')
const userInfoPopover = ref()

// 暗色模式切换
// 按实际生效的主题切换，跟随系统时也能正确显示图标
function switchColorMode() {
  colorMode.preference = colorMode.value === 'dark' ? 'light' : 'dark'
}

const localeCodes = ['en', 'de', 'fr'] as const

// 是否开启发送方自动确认
function switchConfirmDefault() {
  userStore.setConfirmDefault(isConfirmDefault.value)
}

// 展示昵称编辑弹框
function showNicknameEditor(event: Event) {
  tmpNickname.value = userInfo.value.nickname
  userInfoPopover.value.toggle(event)
}

// 编辑昵称
function editNickname() {
  userStore.setNickname(tmpNickname.value)
  tmpNickname.value = userInfo.value.nickname
  userInfoPopover.value.hide()
}

// 编辑头像
function editAvatar() {
  userStore.openAvatarPicker()
}

// 重置用户信息
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

      <!-- 用户资料 -->
      <button
        type="button"
        class="flex items-center gap-2 rounded-full border border-zinc-200 bg-white/80 py-1 pr-1 pl-1 text-sm transition-colors hover:border-zinc-300 sm:pr-3 dark:border-zinc-800 dark:bg-zinc-900/80 dark:hover:border-zinc-700"
        :aria-label="$t('nav.profile')"
        @click="showNicknameEditor"
      >
        <Avatar :image="userInfo.avatarURL" shape="circle" class="size-7!" />
        <span class="hidden max-w-36 truncate font-medium sm:block">{{ userInfo.nickname }}</span>
      </button>

      <!-- 语言 -->
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

      <!-- 主题 -->
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

    <!-- 用户信息弹出框 -->
    <Popover ref="userInfoPopover">
      <div class="w-72 p-4">
        <div class="flex flex-col items-center gap-3">
          <button
            type="button"
            class="group relative rounded-full"
            :aria-label="$t('nav.profile')"
            @click="editAvatar"
          >
            <Avatar :image="userInfo.avatarURL" shape="circle" size="xlarge" />
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
              class="h-10 min-w-0 flex-1 rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-zinc-700 dark:bg-zinc-900"
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
          <ToggleSwitch v-model="isConfirmDefault" @change="switchConfirmDefault" />
        </label>
      </div>
    </Popover>
  </nav>
</template>

<style scoped>
.nav-bar {
  transition: backdrop-filter 0.5s ease;
}
</style>
