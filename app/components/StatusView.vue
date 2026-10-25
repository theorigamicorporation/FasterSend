<script setup lang="ts">
withDefaults(
  defineProps<{
    tone?: 'neutral' | 'success' | 'warning' | 'error'
    icon?: string
    title: string
    description?: string
  }>(),
  { tone: 'neutral' }
)
</script>

<template>
  <div class="flex flex-col items-center px-6 py-12 text-center">
    <div
      class="mb-5 flex size-16 items-center justify-center rounded-2xl"
      :class="{
        'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300': tone === 'neutral',
        'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400':
          tone === 'success',
        'bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400': tone === 'warning',
        'bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400': tone === 'error'
      }"
    >
      <slot name="icon"><Icon v-if="icon" :name="icon" size="32" /></slot>
    </div>
    <h2 class="text-xl font-semibold tracking-tight text-balance">{{ title }}</h2>
    <p v-if="description" class="fs-muted mt-2 max-w-sm text-sm text-balance">{{ description }}</p>
    <div v-if="$slots.default" class="mt-7 flex flex-wrap items-center justify-center gap-3">
      <slot />
    </div>
  </div>
</template>
