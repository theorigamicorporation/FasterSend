<script setup lang="ts">
const { t } = useI18n()
const homeStore = useHomeStore()
const { isModernFileAPISupport, isDirSupport, receiveCode, isFileDraging } = storeToRefs(homeStore)
const fileDragArea = ref()
const codeLength = RECEIVE_CODE_LENGTH

const heroChips = [
  { key: 'hero.chipDirect', icon: 'solar:routing-2-linear' },
  { key: 'hero.chipEncrypted', icon: 'solar:lock-keyhole-minimalistic-linear' },
  { key: 'hero.chipNoStorage', icon: 'solar:server-square-linear' }
]

const steps = [
  { title: 'steps.s1t', desc: 'steps.s1d', icon: 'solar:upload-minimalistic-linear' },
  { title: 'steps.s2t', desc: 'steps.s2d', icon: 'solar:qr-code-linear' },
  { title: 'steps.s3t', desc: 'steps.s3d', icon: 'solar:routing-2-linear' }
]

useSeoMeta({
  title: t('home')
})

const syncDir = homeStore.syncDir
const sendDir = homeStore.sendDir
const sendFile = homeStore.sendFile

watch(isFileDraging, (val) => {
  if (val) {
    fileDragArea.value.style.display = 'flex'
    fileDragArea.value.style.opacity = '1'
  } else {
    fileDragArea.value.style.opacity = '0'
    setTimeout(() => {
      if (fileDragArea.value) {
        fileDragArea.value.style.display = 'none'
      }
    }, 300)
  }
})

function fileDragOver(e: Event) {
  e.preventDefault()
  homeStore.setDragging(true)
}

function fileDrop(e: DragEvent) {
  homeStore.handleDropFile(e).catch(console.warn)
}

watch(receiveCode, () => homeStore.handleReceiveCodeChange(), { flush: 'sync' })

onMounted(() => {
  homeStore.initialize()

  window.ondragenter = (e) => {
    e.preventDefault()
    homeStore.setDragging(true)
  }
  window.ondragleave = (e: DragEvent) => {
    e.preventDefault()
    if (!e.relatedTarget) {
      homeStore.setDragging(false)
    }
  }
  window.ondragover = (e) => {
    e.preventDefault()
  }
  window.ondrop = (e) => {
    e.preventDefault()
    homeStore.setDragging(false)
  }
})
</script>

<template>
  <div class="mx-auto max-w-6xl px-4 sm:px-6">
    <!-- 全屏拖放区域 -->
    <div
      ref="fileDragArea"
      @dragover="fileDragOver"
      @drop="fileDrop"
      class="file-drag-area fixed inset-3 z-[60] flex-col items-center justify-center rounded-3xl border-2 border-dashed border-primary-500 bg-white/80 text-primary-700 backdrop-blur-md dark:bg-zinc-950/80 dark:text-primary-300"
    >
      <Icon name="solar:upload-minimalistic-linear" size="56" />
      <p class="mt-4 text-lg font-medium">{{ $t('label.dragHereToSendFile') }}</p>
    </div>

    <!-- 标题 -->
    <section class="pt-10 pb-10 text-center sm:pt-16 sm:pb-14">
      <span
        class="inline-flex items-center gap-2 rounded-full border border-primary-200 bg-primary-50/80 px-3 py-1 text-xs font-medium text-primary-700 dark:border-primary-500/30 dark:bg-primary-500/10 dark:text-primary-300"
      >
        <span class="relative flex size-2">
          <span
            class="fs-ping absolute inline-flex size-full rounded-full bg-primary-500/60"
          ></span>
          <span class="relative inline-flex size-2 rounded-full bg-primary-500"></span>
        </span>
        {{ $t('hero.badge') }}
      </span>
      <h1
        class="mx-auto mt-5 max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-6xl"
      >
        {{ $t('hero.title') }}
      </h1>
      <p class="fs-muted mx-auto mt-5 max-w-2xl text-base text-balance sm:text-lg">
        {{ $t('hero.subtitle') }}
      </p>
      <ul class="mt-7 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm">
        <li
          v-for="chip in heroChips"
          :key="chip.key"
          class="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-300"
        >
          <Icon :name="chip.icon" class="text-primary-600 dark:text-primary-400" size="18" />
          {{ $t(chip.key) }}
        </li>
      </ul>
    </section>

    <!-- 发送 / 接收 -->
    <section class="grid gap-5 md:grid-cols-2">
      <div class="fs-card flex flex-col p-5 sm:p-7">
        <div class="flex items-center gap-3">
          <span
            class="flex size-10 items-center justify-center rounded-xl bg-primary-50 text-primary-600 dark:bg-primary-500/10 dark:text-primary-400"
            ><Icon name="solar:card-send-linear" size="22"
          /></span>
          <div>
            <h2 class="text-lg font-semibold tracking-tight">{{ $t('send.title') }}</h2>
            <p class="fs-muted text-sm">{{ $t('send.desc') }}</p>
          </div>
        </div>

        <button
          type="button"
          data-testid="send-file"
          class="group mt-6 flex flex-1 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-zinc-200 px-6 py-10 text-center transition-colors hover:border-primary-400 hover:bg-primary-50/50 focus-visible:border-primary-500 focus-visible:outline-none dark:border-zinc-700 dark:hover:border-primary-500/60 dark:hover:bg-primary-500/5"
          @click="sendFile"
        >
          <span
            class="flex size-14 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-600 transition-colors group-hover:bg-primary-100 group-hover:text-primary-700 dark:bg-zinc-800 dark:text-zinc-300 dark:group-hover:bg-primary-500/15 dark:group-hover:text-primary-300"
          >
            <Icon name="solar:upload-minimalistic-linear" size="28" />
          </span>
          <span class="mt-4 font-semibold">{{ $t('btn.sendFile') }}</span>
          <span class="fs-muted mt-1 text-sm">{{ $t('send.drop') }}</span>
        </button>

        <div class="mt-4 grid gap-3 sm:grid-cols-2 md:grid-cols-1 xl:grid-cols-2">
          <UiButton
            variant="secondary"
            icon="solar:folder-with-files-line-duotone"
            data-testid="send-dir"
            :disabled="!isDirSupport"
            @click="sendDir"
            >{{ $t('btn.sendDir') }}</UiButton
          >
          <UiButton
            variant="secondary"
            icon="solar:refresh-square-broken"
            data-testid="sync-dir"
            :disabled="!isModernFileAPISupport"
            @click="syncDir"
            >{{ $t('btn.syncDir') }}</UiButton
          >
        </div>
        <p
          v-show="!isModernFileAPISupport"
          class="mt-4 flex gap-2 rounded-xl bg-amber-50 px-3 py-2.5 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-300"
        >
          <Icon name="solar:info-circle-linear" size="16" class="mt-px shrink-0" />
          <span>{{ $t('hint.noModernFileAPIWarn') }}</span>
        </p>
      </div>

      <div class="fs-card flex flex-col p-5 sm:p-7">
        <div class="flex items-center gap-3">
          <span
            class="flex size-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400"
            ><Icon name="solar:card-recive-linear" size="22"
          /></span>
          <div>
            <h2 class="text-lg font-semibold tracking-tight">{{ $t('receive.title') }}</h2>
            <p class="fs-muted text-sm">{{ $t('receive.desc') }}</p>
          </div>
        </div>

        <div class="flex flex-1 flex-col items-center justify-center py-10">
          <InputOtp
            integerOnly
            :length="codeLength"
            v-model="receiveCode"
            class="gap-2 sm:gap-3"
            data-testid="receive-code"
          >
            <template #default="{ attrs, events, index }">
              <input
                :autofocus="index === 1"
                type="text"
                inputmode="numeric"
                autocomplete="one-time-code"
                :aria-label="`${$t('label.receiveCode')} ${index}`"
                v-bind="attrs"
                v-on="events"
                class="no-arrows h-14 w-11 rounded-xl border border-zinc-200 bg-white text-center font-mono text-2xl font-semibold shadow-sm shadow-zinc-900/[0.03] transition outline-none focus:border-primary-500 focus:ring-4 focus:ring-primary-500/15 sm:h-16 sm:w-13 sm:text-3xl dark:border-zinc-700 dark:bg-zinc-950 dark:focus:border-primary-400"
              />
            </template>
          </InputOtp>
          <p class="fs-muted mt-6 flex items-center gap-2 text-center text-sm">
            <Icon name="solar:qr-code-linear" size="18" class="shrink-0" />{{ $t('receive.scan') }}
          </p>
        </div>
      </div>
    </section>

    <!-- 使用步骤 -->
    <section class="py-16 sm:py-20">
      <h2 class="fs-eyebrow text-center">{{ $t('steps.title') }}</h2>
      <ol class="mt-8 grid gap-4 sm:grid-cols-3">
        <li v-for="(step, i) in steps" :key="step.title" class="fs-card relative p-5">
          <div class="flex items-center gap-3">
            <span
              class="flex size-8 items-center justify-center rounded-full bg-zinc-900 text-sm font-semibold text-white dark:bg-white dark:text-zinc-900"
              >{{ i + 1 }}</span
            >
            <Icon :name="step.icon" size="22" class="text-primary-600 dark:text-primary-400" />
          </div>
          <h3 class="mt-4 font-semibold">{{ $t(step.title) }}</h3>
          <p class="fs-muted mt-1 text-sm">{{ $t(step.desc) }}</p>
        </li>
      </ol>
    </section>
  </div>
</template>

<style>
.file-drag-area {
  display: none;
  opacity: 0;
  transition-property: opacity;
  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  transition-duration: 300ms;
}
</style>
