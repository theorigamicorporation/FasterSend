<script setup lang="ts">
withDefaults(defineProps<{ src: string; size?: 'sm' | 'md' | 'lg' }>(), { size: 'md' })

const sizes = { sm: 'size-7', md: 'size-12', lg: 'size-16' }
</script>

<template>
  <img
    :src="src"
    alt=""
    class="shrink-0 rounded-full bg-white object-cover dark:bg-zinc-800"
    :class="sizes[size]"
  />
</template>
