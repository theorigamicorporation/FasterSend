<script setup lang="ts">
withDefaults(defineProps<{ size?: number }>(), { size: 40 })
</script>

<template>
  <span
    role="status"
    class="inline-block animate-spin rounded-full border-[3px] border-zinc-200 border-t-primary-600 dark:border-zinc-700 dark:border-t-primary-400"
    :style="{ width: `${size}px`, height: `${size}px` }"
  />
</template>
