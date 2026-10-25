export default {
  root: ({ state }) => ({
    class: [
      // Shape
      'rounded-2xl',
      'shadow-2xl shadow-zinc-950/20',
      'border border-zinc-200 dark:border-zinc-800',

      // Size
      'max-h-[90vh]',
      'm-0',

      // Color
      'bg-white dark:bg-zinc-900',

      // Transitions
      'transform',
      'scale-100',

      // Maximized State
      {
        'transition-none': state.maximized,
        'transform-none': state.maximized,
        'w-screen!': state.maximized,
        'h-screen!': state.maximized,
        'max-h-full!': state.maximized,
        'top-0!': state.maximized,
        'left-0!': state.maximized
      }
    ]
  }),
  header: {
    class: [
      // Flexbox and Alignment
      'flex items-center justify-between',
      'shrink-0',

      // Spacing
      'px-6 pt-5 pb-4',

      // Shape
      'rounded-t-2xl',

      // Colors
      'text-zinc-900 dark:text-zinc-50'
    ]
  },
  title: {
    class: ['font-semibold text-lg tracking-tight leading-[normal]']
  },
  headerActions: {
    class: ['flex items-center']
  },
  content: ({ state, instance }) => ({
    class: [
      // Spacing
      'px-6',
      'pb-6',
      'pt-0',

      // Shape
      {
        grow: state.maximized,
        'rounded-b-2xl': !instance.$slots.footer
      },

      // Colors
      'text-zinc-700 dark:text-zinc-200',

      // Misc
      'overflow-y-auto'
    ]
  }),
  footer: {
    class: [
      // Flexbox and Alignment
      'flex items-center justify-end',
      'shrink-0',
      'text-right',
      'gap-2',

      // Spacing
      'px-6',
      'pb-6',

      // Shape
      'border-t-0',
      'rounded-b-lg',

      // Colors
      'bg-surface-0 dark:bg-surface-900',
      'text-surface-700 dark:text-surface-0/80',
      'border border-t-0 border-b-0',
      'border-surface-200 dark:border-surface-700'
    ]
  },
  mask: ({ props }) => ({
    class: [
      // Transitions
      'transition-all',
      'duration-300',
      { 'p-5': !props.position == 'full' },

      // Background and Effects
      { 'has-[.mask-active]:bg-transparent bg-zinc-950/40 backdrop-blur-sm': props.modal }
    ]
  }),
  transition: ({ props }) => {
    return props.position === 'top'
      ? {
          enterFromClass:
            'opacity-0 scale-75 translate-x-0 -translate-y-full translate-z-0 mask-active',
          enterActiveClass: 'transition-all duration-200 ease-out',
          leaveActiveClass: 'transition-all duration-200 ease-out',
          leaveToClass:
            'opacity-0 scale-75 translate-x-0 -translate-y-full translate-z-0 mask-active'
        }
      : props.position === 'bottom'
        ? {
            enterFromClass: 'opacity-0 scale-75 translate-y-full mask-active',
            enterActiveClass: 'transition-all duration-200 ease-out',
            leaveActiveClass: 'transition-all duration-200 ease-out',
            leaveToClass:
              'opacity-0 scale-75 translate-x-0 translate-y-full translate-z-0 mask-active'
          }
        : props.position === 'left' ||
            props.position === 'topleft' ||
            props.position === 'bottomleft'
          ? {
              enterFromClass:
                'opacity-0 scale-75 -translate-x-full translate-y-0 translate-z-0 mask-active',
              enterActiveClass: 'transition-all duration-200 ease-out',
              leaveActiveClass: 'transition-all duration-200 ease-out',
              leaveToClass:
                'opacity-0 scale-75  -translate-x-full translate-y-0 translate-z-0 mask-active'
            }
          : props.position === 'right' ||
              props.position === 'topright' ||
              props.position === 'bottomright'
            ? {
                enterFromClass:
                  'opacity-0 scale-75 translate-x-full translate-y-0 translate-z-0 mask-active',
                enterActiveClass: 'transition-all duration-200 ease-out',
                leaveActiveClass: 'transition-all duration-200 ease-out',
                leaveToClass:
                  'opacity-0 scale-75 translate-x-full translate-y-0 translate-z-0 mask-active'
              }
            : {
                enterFromClass: 'opacity-0 scale-75 mask-active',
                enterActiveClass: 'transition-all duration-200 ease-out',
                leaveActiveClass: 'transition-all duration-200 ease-out',
                leaveToClass: 'opacity-0 scale-75 mask-active'
              }
  }
}
