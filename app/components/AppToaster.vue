<script setup lang="ts">
import type { ToastSeverity } from '~/composables/useToast'

const { messages, remove } = useToast()

const icons: Record<ToastSeverity, string> = {
  success: 'solar:check-circle-bold',
  info: 'solar:info-circle-bold',
  warn: 'solar:danger-triangle-bold',
  error: 'solar:close-circle-bold'
}
const iconColors: Record<ToastSeverity, string> = {
  success: 'text-emerald-500',
  info: 'text-sky-500',
  warn: 'text-amber-500',
  error: 'text-rose-500'
}
</script>

<template>
  <ToastProvider swipe-direction="right">
    <ToastRoot
      v-for="msg in messages"
      :key="msg.id"
      :duration="msg.life ?? 5000"
      :type="msg.severity === 'error' ? 'foreground' : 'background'"
      class="toast flex items-start gap-3 rounded-xl border border-zinc-200 bg-white/95 p-3 shadow-lg shadow-zinc-950/10 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-900/95"
      @update:open="(open) => !open && remove(msg.id)"
    >
      <Icon
        :name="icons[msg.severity]"
        size="20"
        class="mt-px shrink-0"
        :class="iconColors[msg.severity]"
      />
      <div class="min-w-0 flex-1 text-sm">
        <ToastTitle class="font-semibold break-words">{{ msg.summary }}</ToastTitle>
        <ToastDescription v-if="msg.detail" class="fs-muted mt-1 break-words">
          {{ msg.detail }}
        </ToastDescription>
      </div>
      <ToastClose
        class="-m-1 flex size-7 shrink-0 items-center justify-center rounded-full text-zinc-400 transition-colors hover:bg-zinc-900/5 hover:text-zinc-700 dark:hover:bg-white/10 dark:hover:text-zinc-200"
        :aria-label="$t('btn.close')"
      >
        <Icon name="material-symbols:close-rounded" size="18" />
      </ToastClose>
    </ToastRoot>
    <ToastViewport
      class="fixed top-0 right-0 z-[100] flex w-full flex-col gap-3 p-4 outline-none sm:top-4 sm:right-4 sm:w-96 sm:p-0"
    />
  </ToastProvider>
</template>

<style scoped>
.toast[data-state='open'] {
  animation: toast-in 200ms ease-out;
}
.toast[data-state='closed'] {
  animation: toast-out 150ms ease-in forwards;
}
.toast[data-swipe='move'] {
  translate: var(--reka-toast-swipe-move-x) 0;
}
.toast[data-swipe='end'] {
  animation: toast-swipe-out 150ms ease-out forwards;
}
@keyframes toast-in {
  from {
    opacity: 0;
    translate: 1rem 0;
  }
}
@keyframes toast-out {
  to {
    opacity: 0;
  }
}
@keyframes toast-swipe-out {
  from {
    translate: var(--reka-toast-swipe-end-x) 0;
  }
  to {
    translate: 100% 0;
  }
}
</style>
