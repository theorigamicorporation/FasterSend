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
function switchColorMode() {
  if (colorMode.preference === 'light') {
    colorMode.preference = 'dark'
  } else {
    colorMode.preference = 'light'
  }
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
  window.addEventListener('scroll', () => {
    isBgBlur.value = getScrollTop() > 64
  })
  userStore.initializeFromStorage()
  tmpNickname.value = userInfo.value.nickname
})
</script>

<template>
  <nav
    class="flex flex-row items-center py-3 px-4 md:py-4 md:px-[10vw] sticky left-0 right-0 top-0 z-50 nav-bar"
    :class="{ 'backdrop-blur-sm': isBgBlur }"
  >
    <NuxtLink :to="localePath('/')">
      <div class="tracking-wider">
        <img src="/favicon.webp" class="inline-block size-[32px] mr-1" />FasterSend
      </div>
    </NuxtLink>

    <div class="flex-1"></div>

    <div class="contents text-sm">
      <Avatar
        :image="userInfo.avatarURL"
        shape="circle"
        class="shadow-sm cursor-pointer"
        @click="showNicknameEditor"
      />
      <p class="ml-2 truncate shrink-1000 hidden md:block">
        {{ userInfo.nickname }}
      </p>
    </div>

    <!-- 用户信息弹出框 -->
    <Popover ref="userInfoPopover">
      <div class="relative p-3 m-2">
        <div class="absolute top-0 right-0 z-10">
          <Button
            severity="secondary"
            text
            @click="clearUserInfo"
            size="small"
            class="py-3"
            aria-label="Language"
          >
            <Icon name="material-symbols:sync-rounded" class="text-rose-500 dark:text-rose-600" />
          </Button>
        </div>

        <div class="relative flex flex-col items-center gap-4">
          <Avatar
            :image="userInfo.avatarURL"
            shape="circle"
            class="shadow-md cursor-pointer"
            size="xlarge"
            @click="editAvatar"
          />
          <InputGroup>
            <InputText
              severity="contrast"
              size="small"
              :placeholder="$t('label.nickname')"
              v-model:model-value="tmpNickname"
              @keydown.enter="editNickname"
            />
            <Button severity="contrast" size="small" class="m-0" @click="editNickname"
              ><Icon name="material-symbols:check-rounded"
            /></Button>
          </InputGroup>
        </div>

        <Divider />

        <div class="flex flex-row items-center justify-between">
          <p class="text-sm">{{ $t('label.autoConfirmBySender') }}</p>
          <ToggleSwitch v-model="isConfirmDefault" @change="switchConfirmDefault" />
        </div>
      </div>
    </Popover>

    <div class="contents">
      <div class="flex items-center text-xs font-medium" role="group" aria-label="Language">
        <template v-for="(code, i) in localeCodes" :key="code">
          <span v-if="i > 0" class="text-black/30 dark:text-white/30">/</span>
          <button
            type="button"
            class="px-1.5 py-3 uppercase cursor-pointer transition-colors"
            :class="
              locale === code
                ? 'text-black dark:text-white'
                : 'text-black/45 hover:text-black/80 dark:text-white/45 dark:hover:text-white/80'
            "
            :aria-pressed="locale === code"
            @click="setLocale(code)"
          >
            {{ code }}
          </button>
        </template>
      </div>

      <Button
        severity="secondary"
        text
        @click="switchColorMode"
        size="small"
        class="py-3"
        aria-label="Dark"
      >
        <Icon
          name="solar:moon-linear"
          class="text-yellow-500/90"
          v-if="colorMode.preference === 'dark'"
        />
        <Icon name="solar:sun-broken" class="text-black" v-else />
      </Button>
    </div>
  </nav>
</template>

<style scoped>
.nav-bar {
  transition: backdrop-filter 0.5s ease;
}
</style>
