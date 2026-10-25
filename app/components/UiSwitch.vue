<script setup lang="ts">
const model = defineModel<boolean>({ default: false })
defineProps<{ disabled?: boolean }>()
</script>

<template>
  <SwitchRoot
    v-model="model"
    :disabled="disabled"
    class="relative inline-flex h-6 w-10 shrink-0 cursor-pointer items-center rounded-full bg-zinc-300 transition-colors outline-none focus-visible:ring-4 focus-visible:ring-primary-500/20 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary-600 dark:bg-zinc-700 dark:data-[state=checked]:bg-primary-500"
  >
    <SwitchThumb
      class="block size-5 translate-x-0.5 rounded-full bg-white shadow-sm transition-transform data-[state=checked]:translate-x-[1.125rem]"
    />
  </SwitchRoot>
</template>
