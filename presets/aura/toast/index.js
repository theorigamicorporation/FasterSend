export default {
    root: ({ props }) => ({
        class: [
            //Size and Shape
            'w-[calc(100vw-2rem)] sm:w-96 rounded-xl',

            // Positioning
            { '-translate-x-2/4': props.position == 'top-center' || props.position == 'bottom-center' }
        ]
    }),
    message: ({ props }) => ({
        class: [
            'mb-3 rounded-xl w-full',
            'border backdrop-blur-md shadow-lg shadow-zinc-950/10',
            props.message.severity == 'contrast'
                ? 'bg-zinc-900 border-zinc-900 text-white dark:bg-white dark:border-white dark:text-zinc-900'
                : 'bg-white/95 border-zinc-200 text-zinc-900 dark:bg-zinc-900/95 dark:border-zinc-800 dark:text-zinc-100'
        ]
    }),
    messageContent: ({ props }) => ({
        class: [
            'flex p-3',
            {
                'items-start': props.message.summary,
                'items-center': !props.message.summary
            }
        ]
    }),
    messageIcon: ({ props }) => ({
        class: [
            // Sizing and Spacing
            props.message.severity === 'contrast' || props.message.severity === 'secondary' ? 'w-0' : 'w-4.5 h-4.5 mr-1 mt-px',
            'text-lg leading-[normal]',
            {
                'text-sky-500': props.message.severity == 'info',
                'text-emerald-500': props.message.severity == 'success',
                'text-amber-500': props.message.severity == 'warn',
                'text-rose-500': props.message.severity == 'error'
            }
        ]
    }),
    messageText: {
        class: [
            // Font and Text
            'text-sm leading-[normal]',
            'ml-2',
            'flex-1'
        ]
    },
    summary: {
        class: 'font-semibold block'
    },
    detail: ({ props }) => ({
        class: ['block', 'text-sm', props.message.severity === 'contrast' ? 'text-white/80 dark:text-zinc-600' : 'text-zinc-500 dark:text-zinc-400', { 'mt-1': props.message.summary }]
    }),
    closeButton: ({ props }) => ({
        class: [
            // Flexbox
            'flex items-center justify-center',

            // Size
            'w-7 h-7',

            // Spacing and Misc
            'ml-auto  relative',

            // Shape
            'rounded-full',

            // Colors
            'bg-transparent',

            // Transitions
            'transition duration-200 ease-in-out',

            // States
            'text-zinc-400 hover:bg-zinc-900/5 hover:text-zinc-700 dark:hover:bg-white/10 dark:hover:text-zinc-200',
            'focus:outline-hidden focus:outline-offset-0 focus:ring-1',
            {
                'focus:ring-blue-500 dark:focus:ring-blue-400': props.severity == 'info',
                'focus:ring-green-500 dark:focus:ring-green-400': props.severity == 'success',
                'focus:ring-surface-500 dark:focus:ring-surface-400': props.severity == 'secondary',
                'focus:ring-orange-500 dark:focus:ring-orange-400': props.severity == 'warn',
                'focus:ring-red-500 dark:focus:ring-red-4000': props.severity == 'error',
                'focus:ring-surface-0 dark:focus:ring-surface-950': props.severity == 'contrast'
            },

            // Misc
            'overflow-hidden'
        ]
    }),
    transition: {
        enterFromClass: 'opacity-0 translate-y-2/4',
        enterActiveClass: 'transition-[transform,opacity] duration-300',
        leaveFromClass: 'max-h-[1000px]',
        leaveActiveClass: 'transition-[max-height_.45s_cubic-bezier(0,1,0,1),opacity_.3s,margin-bottom_.3s]! overflow-hidden',
        leaveToClass: 'max-h-0 opacity-0 mb-0'
    }
};
