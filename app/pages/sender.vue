<script setup lang="ts">
const { t } = useI18n()
const localePath = useLocalePath()
const senderStore = useSenderTransferStore()
const { peerUserInfo, code, totalTransmittedBytes, totalSpeed, durationTimeStr, curFile, status } =
  storeToRefs(senderStore)
const qrcodeElm = ref()
const formatSize = humanFileSize

useSeoMeta({
  title: t('sender')
})

const confirmUser = senderStore.confirmUser
const copyLink = senderStore.copyLink
const copyCode = senderStore.copyCode

// Summary of the content to send
const transferConfigStore = useTransferConfigStore()
const fileSummary = computed(() => {
  const items = Object.values(transferConfigStore.fileMap)
  const size = items.reduce((sum, f) => sum + f.size, 0)
  const first = items[0]
  const name =
    transferConfigStore.type === 'transFile'
      ? first?.paths.at(-1) || ''
      : first?.paths[0] || t('recipientPage.folder')
  return { count: items.length, size, name, isFile: transferConfigStore.type === 'transFile' }
})
const codeDigits = computed(() => code.value.split(''))
const curPercent = computed(() =>
  curFile.value.size === 0 ? 0 : (curFile.value.transmittedBytes / curFile.value.size) * 100
)
const totalPercent = computed(() =>
  fileSummary.value.size === 0 ? 0 : (totalTransmittedBytes.value / fileSummary.value.size) * 100
)

watch(code, () => {
  if (!code.value) {
    return
  }
  setTimeout(() => {
    senderStore.renderQRCode(qrcodeElm.value)
  }, 1)
})

onMounted(() => {
  senderStore.initialize()
})

onUnmounted(() => {
  senderStore.cleanup()
})
</script>

<template>
  <div class="mx-auto max-w-xl px-4 py-8 sm:py-14">
    <!-- Error view -->
    <div v-if="status.error.code !== 0" class="fs-card">
      <StatusView
        v-if="status.error.code === -1"
        tone="warning"
        icon="material-symbols-light:account-circle-off-outline-rounded"
        :title="t('hint.toManyPeople')"
      >
        <UiButton :to="localePath('/')" icon="solar:home-2-linear">{{ t('btn.toHome') }}</UiButton>
      </StatusView>
      <StatusView
        v-else
        tone="error"
        icon="solar:sad-square-line-duotone"
        :title="t('hint.serverError')"
        :description="
          status.relayUnavailable ? t('hint.relayUnavailable') : t('hint.closeTheProxy')
        "
      >
        <UiButton :to="localePath('/')" icon="solar:home-2-linear">{{ t('btn.toHome') }}</UiButton>
      </StatusView>
    </div>

    <!-- Loading view -->
    <div v-else-if="status.isIniting" class="flex flex-col items-center gap-4 py-24">
      <UiSpinner />
      <p class="fs-muted text-sm">{{ t('hint.connecting') }}</p>
    </div>

    <!-- Waiting for connection -->
    <div v-else-if="status.isWaitingConnect" class="fs-card overflow-hidden">
      <div class="p-6 text-center sm:p-8">
        <p class="fs-eyebrow">{{ t('senderPage.yourCode') }}</p>
        <div class="mt-4 flex justify-center gap-1.5 sm:gap-2" data-testid="sender-code">
          <span
            v-for="(digit, i) in codeDigits"
            :key="i"
            class="flex h-14 w-10 items-center justify-center rounded-xl border border-zinc-200 bg-zinc-50 font-mono text-3xl font-semibold sm:h-18 sm:w-14 sm:text-4xl dark:border-zinc-700 dark:bg-zinc-950"
            >{{ digit }}</span
          >
        </div>
        <p class="fs-muted mx-auto mt-4 max-w-sm text-sm text-balance">
          {{ t('senderPage.shareHint') }}
        </p>

        <div class="mt-6 flex justify-center">
          <div class="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-zinc-200 dark:ring-zinc-700">
            <canvas ref="qrcodeElm" class="block size-44"></canvas>
          </div>
        </div>

        <div class="mt-6 grid grid-cols-2 gap-3">
          <UiButton variant="secondary" icon="solar:copy-linear" @click="copyCode">{{
            t('senderPage.copyCode')
          }}</UiButton>
          <UiButton variant="secondary" icon="solar:link-minimalistic-2-linear" @click="copyLink">{{
            t('btn.copyLink')
          }}</UiButton>
        </div>
      </div>

      <div
        class="flex items-center gap-3 border-t border-zinc-200 bg-zinc-50/80 px-6 py-4 dark:border-zinc-800 dark:bg-zinc-950/40"
      >
        <span
          class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white text-zinc-600 ring-1 ring-zinc-200 dark:bg-zinc-900 dark:text-zinc-300 dark:ring-zinc-700"
        >
          <Icon
            :name="
              fileSummary.isFile ? 'solar:file-linear' : 'solar:folder-with-files-line-duotone'
            "
            size="20"
          />
        </span>
        <div class="min-w-0 flex-1">
          <p class="truncate text-sm font-medium">{{ fileSummary.name }}</p>
          <p class="fs-muted text-xs">
            {{ t('senderPage.files', fileSummary.count) }} · {{ formatSize(fileSummary.size) }}
          </p>
        </div>
      </div>

      <div
        class="flex items-center justify-between gap-3 border-t border-zinc-200 px-6 py-3 dark:border-zinc-800"
      >
        <p class="flex items-center gap-2 text-sm">
          <span class="relative flex size-2.5">
            <span class="fs-ping absolute inline-flex size-full rounded-full bg-amber-400"></span>
            <span class="relative inline-flex size-2.5 rounded-full bg-amber-500"></span>
          </span>
          {{ t('senderPage.waiting') }}
        </p>
        <UiButton variant="ghost" size="sm" :to="localePath('/')">{{
          t('senderPage.cancel')
        }}</UiButton>
      </div>
    </div>

    <!-- Connected -->
    <template v-else>
      <!-- Business error -->
      <div v-if="status.warn.code !== 0" class="fs-card">
        <StatusView
          tone="warning"
          icon="material-symbols-light:warning-outline-rounded"
          :title="
            status.warn.code === -1 ? t('hint.noSupportDirTrans2') : t('hint.connectInterrupted')
          "
          :description="status.relayUnavailable ? t('hint.relayUnavailable') : undefined"
        >
          <UiButton :to="localePath('/')" icon="solar:home-2-linear">{{
            t('btn.toHome')
          }}</UiButton>
        </StatusView>
      </div>

      <!-- Transfer confirmation -->
      <div v-else-if="status.isWaitingConfirm" class="fs-card p-6 text-center sm:p-8">
        <div class="flex justify-center">
          <UiAvatar
            :src="peerUserInfo.avatarURL"
            size="lg"
            class="ring-4 ring-primary-100 dark:ring-primary-500/20"
          />
        </div>
        <h1 class="mt-5 text-xl font-semibold tracking-tight text-balance">
          {{ t('senderPage.wantsToReceive', { name: peerUserInfo.nickname }) }}
        </h1>
        <p class="fs-muted mt-2 text-sm">
          {{ fileSummary.name }} · {{ t('senderPage.files', fileSummary.count) }} ·
          {{ formatSize(fileSummary.size) }}
        </p>
        <p
          class="mx-auto mt-5 flex max-w-sm items-center justify-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-300"
        >
          <Icon name="solar:shield-warning-linear" size="16" class="shrink-0" />{{
            t('senderPage.approveHint')
          }}
        </p>
        <div class="mt-6 grid grid-cols-2 gap-3">
          <UiButton
            variant="danger"
            size="lg"
            icon="solar:close-circle-linear"
            data-testid="confirm-decline"
            @click="confirmUser(false)"
            >{{ t('senderPage.decline') }}</UiButton
          >
          <UiButton
            size="lg"
            icon="solar:check-circle-linear"
            data-testid="confirm-allow"
            @click="confirmUser(true)"
            >{{ t('senderPage.allow') }}</UiButton
          >
        </div>
      </div>

      <!-- Sending -->
      <div v-else-if="!status.isDone" class="fs-card p-6 sm:p-8">
        <PeerChip
          :nickname="peerUserInfo.nickname"
          :avatar-url="peerUserInfo.avatarURL"
          :label="t('senderPage.sendingTo')"
          :connected="true"
        />

        <div class="mt-7">
          <div class="flex items-baseline justify-between gap-4 text-sm">
            <p class="truncate font-medium">{{ curFile.name }}</p>
            <p class="fs-muted shrink-0 tabular-nums">{{ Math.round(curPercent) }}%</p>
          </div>
          <UiProgress :value="curPercent" class="mt-2" />
          <p class="fs-muted mt-2 flex justify-between text-xs tabular-nums">
            <span>{{ formatSize(curFile.transmittedBytes) }} / {{ formatSize(curFile.size) }}</span>
            <span>{{ formatSize(curFile.speed) }}/s</span>
          </p>
        </div>

        <div v-if="fileSummary.count > 1" class="mt-5">
          <div class="flex items-baseline justify-between text-sm">
            <p class="font-medium">{{ t('label.totalProgress') }}</p>
            <p class="fs-muted tabular-nums">{{ Math.round(totalPercent) }}%</p>
          </div>
          <UiProgress :value="totalPercent" class="mt-2" />
          <p class="fs-muted mt-2 flex justify-between text-xs tabular-nums">
            <span
              >{{ formatSize(totalTransmittedBytes) }} / {{ formatSize(fileSummary.size) }}</span
            >
            <span>{{ durationTimeStr }} · {{ formatSize(totalSpeed) }}/s</span>
          </p>
        </div>

        <p class="fs-muted mt-6 text-center text-xs">{{ t('senderPage.keepOpen') }}</p>
        <div class="mt-4 flex justify-center">
          <UiButton variant="danger" icon="solar:stop-linear" :to="localePath('/')">{{
            t('btn.terminate')
          }}</UiButton>
        </div>
      </div>

      <!-- Send complete -->
      <div v-else class="fs-card">
        <StatusView
          tone="success"
          icon="solar:check-circle-linear"
          :title="t('hint.transCompleted')"
          :description="`${fileSummary.name} · ${formatSize(fileSummary.size)}`"
        >
          <UiButton :to="localePath('/')" icon="solar:upload-minimalistic-linear">{{
            t('senderPage.sendMore')
          }}</UiButton>
        </StatusView>
      </div>
    </template>
  </div>
</template>
