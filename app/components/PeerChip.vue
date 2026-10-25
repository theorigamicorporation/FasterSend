<script setup lang="ts">
defineProps<{ nickname: string; avatarUrl: string; connected?: boolean; label?: string }>()
</script>

<template>
  <div class="flex items-center gap-3">
    <div class="relative">
      <UiAvatar :src="avatarUrl" class="ring-2 ring-white dark:ring-zinc-900" />
      <span
        v-if="connected !== undefined"
        class="absolute -right-0.5 -bottom-0.5 size-3.5 rounded-full ring-2 ring-white dark:ring-zinc-900"
        :class="connected ? 'bg-emerald-500' : 'bg-rose-500'"
      />
    </div>
    <div class="min-w-0">
      <p v-if="label" class="fs-muted text-xs">{{ label }}</p>
      <p class="truncate font-medium">{{ nickname }}</p>
    </div>
  </div>
</template>
