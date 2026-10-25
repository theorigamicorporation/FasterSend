export default {
  root: {
    class: [
      // Shape
      'rounded-2xl shadow-xl shadow-zinc-950/10',

      // Position
      'absolute left-0 top-0 mt-2',
      'z-40 transform origin-center',

      // Color
      'bg-white dark:bg-zinc-900',
      'text-zinc-800 dark:text-zinc-100',

      // Before: Arrow
      'before:absolute before:w-0 before:-top-3 before:h-0 before:border-transparent before:border-solid before:ml-[10px] before:border-x-10 before:border-b-10 before:border-t-0 before:border-b-zinc-200 dark:before:border-b-zinc-800',
      'after:absolute after:w-0 after:top-[-0.54rem] after:left-[4px] after:h-0 after:border-transparent after:border-solid after:ml-[8px] after:border-x-8 after:border-b-8 after:border-t-0 after:border-b-white dark:after:border-b-zinc-900'
    ]
  },
  content: {
    class: ['p-0 items-center flex', 'rounded-2xl', 'border border-zinc-200 dark:border-zinc-800']
  },
  transition: {
    enterFromClass: 'opacity-0 scale-y-[0.8]',
    enterActiveClass: 'transition-[transform,opacity] duration-120 ease-out',
    leaveActiveClass: 'transition-opacity duration-100 ease-linear',
    leaveToClass: 'opacity-0'
  }
}
