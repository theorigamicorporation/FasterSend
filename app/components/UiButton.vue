<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
    size?: 'sm' | 'md' | 'lg'
    icon?: string
    to?: string
    block?: boolean
    disabled?: boolean
    type?: 'button' | 'submit'
  }>(),
  { variant: 'primary', size: 'md', block: false, disabled: false, type: 'button' }
)

const classes = computed(() => [
  'inline-flex items-center justify-center gap-2 rounded-xl font-medium whitespace-nowrap select-none',
  'transition-[background-color,border-color,color,box-shadow,transform] duration-150',
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500',
  'active:scale-[0.98] disabled:pointer-events-none disabled:opacity-45',
  {
    'h-8 px-3 text-sm': props.size === 'sm',
    'h-10 px-4 text-sm': props.size === 'md',
    'h-12 px-5 text-base': props.size === 'lg',
    'w-full': props.block,
    'bg-primary-600 text-white shadow-sm shadow-primary-600/25 hover:bg-primary-700 dark:bg-primary-500 dark:hover:bg-primary-400 dark:shadow-none':
      props.variant === 'primary',
    'border border-zinc-200 bg-white text-zinc-800 shadow-sm shadow-zinc-900/[0.03] hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:border-zinc-600 dark:hover:bg-zinc-800':
      props.variant === 'secondary',
    'text-zinc-600 hover:bg-zinc-900/5 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-white/10 dark:hover:text-white':
      props.variant === 'ghost',
    'border border-rose-200 bg-white text-rose-600 hover:bg-rose-50 dark:border-rose-500/30 dark:bg-transparent dark:text-rose-400 dark:hover:bg-rose-500/10':
      props.variant === 'danger'
  }
])
</script>

<template>
  <NuxtLink v-if="to && !disabled" :to="to" :class="classes">
    <Icon v-if="icon" :name="icon" class="size-[1.15em] shrink-0" />
    <slot />
  </NuxtLink>
  <button v-else :type="type" :disabled="disabled" :class="classes">
    <Icon v-if="icon" :name="icon" class="size-[1.15em] shrink-0" />
    <slot />
  </button>
</template>
