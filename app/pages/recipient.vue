<script setup lang="ts">
const { t } = useI18n()
const localePath = useLocalePath()
const router = useRouter()
const recipientStore = useRecipientTransferStore()
const {
  isModernFileAPISupport,
  peerUserInfo,
  peerFilesInfo,
  selectedKeys,
  totalFileSize,
  totalTransmittedBytes,
  totalSpeed,
  durationTimeStr,
  remainingTimeStr,
  curFile,
  status,
  syncDirStatus
} = storeToRefs(recipientStore)
const formatSize = humanFileSize

useSeoMeta({
  title: t('recipient')
})

const selectSyncDir = recipientStore.selectSyncDir
const doReceive = recipientStore.doReceive
const downloadFile = recipientStore.downloadFile

const curPercent = computed(() =>
  curFile.value.size === 0 ? 0 : (curFile.value.transmittedBytes / curFile.value.size) * 100
)
const totalPercent = computed(() =>
  totalFileSize.value === 0 ? 0 : (totalTransmittedBytes.value / totalFileSize.value) * 100
)
const errorView = computed(() => {
  switch (status.value.error.code) {
    case 404:
      return { icon: 'solar:folder-error-linear', title: t('hint.invalidPickupCode') }
    case 429:
      return {
        icon: 'material-symbols:timer-off-outline-rounded',
        title: t('hint.tooManyAttempts')
      }
    case 403:
      return { icon: 'solar:close-circle-linear', title: t('hint.refusesToTransmit') }
    case -10:
      return { icon: 'material-symbols:timer-off-outline-rounded', title: t('hint.connectTimeout') }
    default:
      return {
        icon: 'solar:sad-square-line-duotone',
        title: t('hint.serverError'),
        description: t('hint.closeTheProxy')
      }
  }
})
const warnTitle = computed(() => {
  switch (status.value.warn.code) {
    case -1:
      return t('hint.noSupportDirTrans')
    case -3:
      return t('hint.hashCheckFail')
    default:
      return t('hint.connectInterrupted')
  }
})

onMounted(() => {
  const query = router.currentRoute.value.query
  const receiveCode = `${query.code || ''}`
  if (recipientStore.redirectHomeIfInvalidCode(receiveCode)) {
    return
  }
  recipientStore.initialize(receiveCode)
})

onUnmounted(() => {
  recipientStore.cleanup()
})
</script>

<template>
  <div class="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-14">
    <!-- Error view -->
    <div v-if="status.error.code !== 0" class="fs-card mx-auto max-w-xl">
      <StatusView
        tone="error"
        :icon="errorView.icon"
        :title="errorView.title"
        :description="errorView.description"
      >
        <UiButton :to="localePath('/')" icon="solar:home-2-linear">{{ t('btn.toHome') }}</UiButton>
      </StatusView>
    </div>

    <!-- Loading view -->
    <div v-else-if="status.isIniting" class="flex flex-col items-center gap-4 py-24">
      <UiSpinner />
      <p class="fs-muted text-sm">{{ t('hint.connecting') }}</p>
    </div>

    <!-- Waiting for sender confirmation -->
    <div v-else-if="status.isWaitingPeerConfirm" class="fs-card mx-auto max-w-xl">
      <StatusView
        :title="t('recipientPage.waitingApproval')"
        :description="t('recipientPage.waitingApprovalHint')"
      >
        <template #icon><UiSpinner :size="30" /></template>
      </StatusView>
    </div>

    <!-- Connected view -->
    <div v-else class="grid items-start gap-5 md:grid-cols-5">
      <!-- Sender and files -->
      <div class="fs-card p-5 sm:p-6 md:col-span-3">
        <PeerChip
          :nickname="peerUserInfo.nickname"
          :avatar-url="peerUserInfo.avatarURL"
          :label="t('recipientPage.from')"
          :connected="status.isConnectPeer"
        />

        <div class="mt-6">
          <!-- Single file -->
          <div
            v-if="peerFilesInfo.type === 'transFile'"
            class="flex items-center gap-4 rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800"
          >
            <span
              class="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-600 dark:bg-primary-500/10 dark:text-primary-400"
            >
              <Icon name="solar:file-linear" size="24" />
            </span>
            <div class="min-w-0">
              <p class="truncate font-medium">{{ curFile.name }}</p>
              <p class="fs-muted text-sm">{{ formatSize(curFile.size) }}</p>
            </div>
          </div>
          <!-- Directory -->
          <FilesTree
            v-else-if="peerFilesInfo.type === 'transDir'"
            :file-map="peerFilesInfo.fileMap"
            :disabled="status.isLock"
            v-model:selected-key="selectedKeys"
          />
          <!-- Sync directory -->
          <div v-else-if="peerFilesInfo.type === 'syncDir'">
            <!-- Pick the directory to sync -->
            <div v-if="syncDirStatus.isWaitingSelectDir">
              <div
                class="flex items-center gap-4 rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800"
              >
                <span
                  class="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-600 dark:bg-primary-500/10 dark:text-primary-400"
                >
                  <Icon name="solar:folder-with-files-line-duotone" size="24" />
                </span>
                <p class="truncate font-medium">{{ syncDirStatus.folderName }}</p>
              </div>
              <p class="fs-muted mt-4 text-sm">{{ t('hint.pleaseSelectDirToReceiveSync') }}</p>
              <label class="mt-3 flex cursor-pointer items-center gap-3">
                <ToggleSwitch v-model="syncDirStatus.isQuickDiff" />
                <span class="text-sm">{{ t('hint.quickDiffMode') }}</span>
              </label>
              <UiButton
                block
                variant="secondary"
                class="mt-4"
                icon="solar:folder-with-files-line-duotone"
                @click="selectSyncDir"
                >{{ t('btn.selectDir') }}</UiButton
              >
            </div>
            <!-- Compare directory structures -->
            <div v-else-if="syncDirStatus.isDiffing" class="flex flex-col items-center py-10">
              <UiSpinner />
              <p class="fs-muted mt-4 text-sm">{{ t('hint.inCompStructure') }}</p>
            </div>
            <!-- Pick files to add, update or delete -->
            <div v-else class="space-y-5">
              <div>
                <p class="mb-2 text-sm font-medium">{{ t('hint.pleaseSelectAdd') }}</p>
                <FilesTree
                  :file-map="syncDirStatus.fileMapAdd"
                  :disabled="status.isLock"
                  :root-label="syncDirStatus.folderName"
                  v-model:selected-key="syncDirStatus.addKeys"
                />
              </div>
              <div>
                <p class="mb-2 text-sm font-medium">{{ t('hint.pleaseSelectUpdate') }}</p>
                <FilesTree
                  :file-map="syncDirStatus.fileMapUpdate"
                  :disabled="status.isLock"
                  :root-label="syncDirStatus.folderName"
                  v-model:selected-key="syncDirStatus.updateKeys"
                />
              </div>
              <div>
                <p class="mb-2 text-sm font-medium">{{ t('hint.pleaseSelectDelete') }}</p>
                <FilesTree
                  :file-map="syncDirStatus.fileMapDelete"
                  :disabled="status.isLock"
                  :root-label="syncDirStatus.folderName"
                  v-model:selected-key="syncDirStatus.deleteKeys"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Progress and actions -->
      <div class="fs-card p-5 sm:p-6 md:col-span-2">
        <!-- Business error -->
        <StatusView
          v-if="status.warn.code !== 0"
          tone="warning"
          icon="material-symbols-light:warning-outline-rounded"
          :title="warnTitle"
          class="py-6!"
        >
          <UiButton :to="localePath('/')" icon="solar:home-2-linear">{{
            t('btn.toHome')
          }}</UiButton>
        </StatusView>

        <!-- Transfer complete -->
        <template v-else-if="status.isDone">
          <StatusView
            tone="success"
            icon="solar:check-circle-linear"
            :title="t('hint.transCompleted')"
            :description="`${formatSize(totalFileSize)} · ${durationTimeStr}`"
            class="py-6!"
          />
          <div class="space-y-3">
            <UiButton
              v-if="!isModernFileAPISupport"
              block
              size="lg"
              icon="solar:download-minimalistic-linear"
              @click="downloadFile"
              >{{ t('btn.download') }}</UiButton
            >
            <UiButton
              block
              :variant="isModernFileAPISupport ? 'primary' : 'secondary'"
              icon="solar:home-2-linear"
              :to="localePath('/')"
              >{{ t('recipientPage.receiveMore') }}</UiButton
            >
          </div>
        </template>

        <!-- Progress -->
        <template v-else>
          <p class="fs-eyebrow">
            {{ status.isReceiving ? t('hint.inTransit') : t('recipientPage.ready') }}
          </p>

          <div class="mt-4">
            <div class="flex items-baseline justify-between gap-4 text-sm">
              <p class="truncate font-medium">{{ curFile.name || t('recipientPage.current') }}</p>
              <p class="fs-muted shrink-0 tabular-nums">{{ Math.round(curPercent) }}%</p>
            </div>
            <UiProgress :value="curPercent" class="mt-2" />
            <p class="fs-muted mt-2 flex justify-between text-xs tabular-nums">
              <span
                >{{ formatSize(curFile.transmittedBytes) }} / {{ formatSize(curFile.size) }}</span
              >
              <span>{{ formatSize(curFile.speed) }}/s</span>
            </p>
          </div>

          <div class="mt-5">
            <div class="flex items-baseline justify-between text-sm">
              <p class="font-medium">{{ t('label.totalProgress') }}</p>
              <p class="fs-muted tabular-nums">{{ Math.round(totalPercent) }}%</p>
            </div>
            <UiProgress :value="totalPercent" class="mt-2" />
            <p class="fs-muted mt-2 flex justify-between text-xs tabular-nums">
              <span>{{ durationTimeStr }} / {{ remainingTimeStr }}</span>
              <span>{{ formatSize(totalTransmittedBytes) }} / {{ formatSize(totalFileSize) }}</span>
            </p>
          </div>

          <div class="mt-7">
            <UiButton
              v-if="!status.isLock"
              block
              size="lg"
              icon="solar:download-minimalistic-linear"
              data-testid="receive-button"
              :disabled="
                !status.isConnectPeer ||
                status.isReceiving ||
                (peerFilesInfo.type === 'syncDir' && syncDirStatus.isDiffing)
              "
              @click="doReceive"
              >{{ t('btn.receive') }}</UiButton
            >
            <UiButton
              v-if="status.isReceiving"
              block
              variant="danger"
              icon="solar:stop-linear"
              :to="localePath('/')"
              >{{ t('btn.terminate') }}</UiButton
            >
          </div>
        </template>
      </div>
    </div>
  </div>
</template>
