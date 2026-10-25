<script lang="ts" setup>
const isDocPanelShow = useHelpOpen()
const tab = ref<'quick' | 'how' | 'privacy'>('quick')
const curIP = ref('')

const tabs = [
  { id: 'quick', label: 'help.tabQuick', icon: 'solar:play-circle-linear' },
  { id: 'how', label: 'help.tabHow', icon: 'solar:routing-2-linear' },
  { id: 'privacy', label: 'help.tabPrivacy', icon: 'solar:shield-check-linear' }
] as const

const quickSteps = [
  { title: 'help.q1t', desc: 'help.q1d', icon: 'solar:upload-minimalistic-linear' },
  { title: 'help.q2t', desc: 'help.q2d', icon: 'solar:qr-code-linear' },
  { title: 'help.q3t', desc: 'help.q3d', icon: 'solar:user-check-rounded-linear' },
  { title: 'help.q4t', desc: 'help.q4d', icon: 'solar:download-minimalistic-linear' }
]
const tips = ['help.tip1', 'help.tip2', 'help.tip3']

const howItems = [
  { title: 'help.how1t', desc: 'help.how1d', icon: 'solar:routing-2-linear' },
  { title: 'help.how2t', desc: 'help.how2d', icon: 'solar:server-square-linear' },
  { title: 'help.how3t', desc: 'help.how3d', icon: 'solar:refresh-square-broken' },
  { title: 'help.how4t', desc: 'help.how4d', icon: 'solar:diskette-linear' }
]

const privacyItems = [
  { title: 'help.p1t', desc: 'help.p1d', icon: 'solar:user-cross-linear' },
  { title: 'help.p2t', desc: 'help.p2d', icon: 'solar:server-square-linear' },
  { title: 'help.p3t', desc: 'help.p3d', icon: 'solar:lock-keyhole-minimalistic-linear' },
  { title: 'help.p4t', desc: 'help.p4d', icon: 'solar:eye-linear' }
]

watch(isDocPanelShow, (open) => open && (tab.value = 'quick'))

onMounted(() => {
  fetch('/api/getIP', { method: 'post' })
    .then((res) => res.text())
    .then((ip) => (curIP.value = ip))
    .catch(console.warn)
})
</script>

<template>
  <DialogRoot v-model:open="isDocPanelShow">
    <DialogPortal>
      <DialogOverlay class="dialog-overlay fixed inset-0 z-[70] bg-zinc-950/40 backdrop-blur-sm" />
      <DialogContent
        class="dialog-content fixed top-1/2 left-1/2 z-[71] flex max-h-[90vh] w-[calc(100vw-2rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 flex-col rounded-2xl border border-zinc-200 bg-white text-zinc-700 shadow-2xl shadow-zinc-950/20 outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
      >
        <div class="flex shrink-0 items-center justify-between px-6 pt-5 pb-4">
          <DialogTitle class="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            {{ $t('help.title') }}
          </DialogTitle>
          <DialogClose
            class="flex size-8 items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-zinc-900/5 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-white"
            :aria-label="$t('btn.close')"
          >
            <Icon name="material-symbols:close-rounded" size="20" />
          </DialogClose>
        </div>
        <DialogDescription class="sr-only">{{ $t('help.tabQuick') }}</DialogDescription>
        <div class="overflow-y-auto px-6 pb-6">
          <div
            class="sticky top-0 z-10 -mx-1 mb-5 flex gap-1 rounded-xl bg-zinc-100 p-1 dark:bg-zinc-800"
            role="tablist"
          >
            <button
              v-for="item in tabs"
              :key="item.id"
              type="button"
              role="tab"
              :aria-selected="tab === item.id"
              class="flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-medium transition-colors sm:text-sm"
              :class="
                tab === item.id
                  ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-950 dark:text-white'
                  : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white'
              "
              @click="tab = item.id"
            >
              <span class="hidden sm:inline-flex"><Icon :name="item.icon" size="16" /></span
              >{{ $t(item.label) }}
            </button>
          </div>

          <!-- Quick start -->
          <div v-if="tab === 'quick'" role="tabpanel">
            <ol class="space-y-3">
              <li
                v-for="(step, i) in quickSteps"
                :key="step.title"
                class="flex gap-4 rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800"
              >
                <span
                  class="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-600 dark:bg-primary-500/10 dark:text-primary-400"
                >
                  <Icon :name="step.icon" size="20" />
                </span>
                <div>
                  <p class="font-semibold">
                    <span class="fs-muted mr-1 font-mono text-xs">{{ i + 1 }}.</span
                    >{{ $t(step.title) }}
                  </p>
                  <p class="fs-muted mt-1 text-sm">{{ $t(step.desc) }}</p>
                </div>
              </li>
            </ol>
            <div class="mt-5 rounded-2xl bg-zinc-50 p-4 dark:bg-zinc-800/50">
              <p class="flex items-center gap-2 text-sm font-semibold">
                <Icon
                  name="solar:lightbulb-minimalistic-linear"
                  size="18"
                  class="text-amber-500"
                />{{ $t('help.tipsTitle') }}
              </p>
              <ul class="fs-muted mt-2 list-disc space-y-1 pl-6 text-sm">
                <li v-for="tip in tips" :key="tip">{{ $t(tip) }}</li>
              </ul>
            </div>
          </div>

          <!-- How it works / privacy -->
          <div v-else role="tabpanel" class="grid gap-3 sm:grid-cols-2">
            <div
              v-for="item in tab === 'how' ? howItems : privacyItems"
              :key="item.title"
              class="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800"
            >
              <Icon :name="item.icon" size="22" class="text-primary-600 dark:text-primary-400" />
              <p class="mt-3 font-semibold">{{ $t(item.title) }}</p>
              <p class="fs-muted mt-1 text-sm">{{ $t(item.desc) }}</p>
            </div>
            <p v-if="tab === 'privacy'" class="fs-muted text-xs sm:col-span-2">
              {{ $t('help.responsibility') }}
            </p>
          </div>

          <div
            class="mt-6 flex items-center gap-2 border-t border-zinc-200 pt-4 text-xs dark:border-zinc-800"
          >
            <span class="fs-muted"
              >{{ $t('help.ipLabel') }}:
              <span class="fs-kbd text-zinc-700 dark:text-zinc-200">{{ curIP || '…' }}</span></span
            >
          </div>
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>

<style scoped>
.dialog-overlay[data-state='open'] {
  animation: fade-in 200ms ease-out;
}
.dialog-overlay[data-state='closed'] {
  animation: fade-out 150ms ease-in;
}
.dialog-content[data-state='open'] {
  animation: dialog-in 200ms ease-out;
}
.dialog-content[data-state='closed'] {
  animation: dialog-out 150ms ease-in;
}
@keyframes fade-in {
  from {
    opacity: 0;
  }
}
@keyframes fade-out {
  to {
    opacity: 0;
  }
}
@keyframes dialog-in {
  from {
    opacity: 0;
    scale: 0.96;
  }
}
@keyframes dialog-out {
  to {
    opacity: 0;
    scale: 0.96;
  }
}
</style>
