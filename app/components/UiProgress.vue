<script setup lang="ts">
const props = defineProps<{ value: number; done?: boolean }>()
const pct = computed(() => Math.min(100, Math.max(0, Math.round(props.value || 0))))
</script>

<template>
  <div
    class="h-2 w-full overflow-hidden rounded-full bg-zinc-200/80 dark:bg-zinc-800"
    role="progressbar"
    :aria-valuenow="pct"
    aria-valuemin="0"
    aria-valuemax="100"
  >
    <div
      class="h-full rounded-full transition-[width] duration-300 ease-out"
      :class="
        done || pct === 100
          ? 'bg-emerald-500'
          : 'bg-gradient-to-r from-primary-500 to-sky-400 dark:from-primary-400 dark:to-sky-300'
      "
      :style="{ width: `${pct}%` }"
    />
  </div>
</template>
