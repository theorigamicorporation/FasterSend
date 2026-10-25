<script setup lang="ts">
import type { FileTreeEntry, FileTreeFolder, FileTreeRow } from '~/utils/fileTree'

const props = defineProps({
  fileMap: { type: Object as PropType<Record<string, FileTreeEntry>>, default: () => ({}) },
  disabled: { type: Boolean, default: false },
  /** Optional virtual root directory name; if given, wraps the tree in a root node to make select-all easy */
  rootLabel: { type: String, default: '' }
})
const selectedKey = defineModel<Record<string, boolean>>('selectedKey', { default: () => ({}) })
const { t } = useI18n()

/** Show the filter input only for trees big enough to need it */
const FILTER_THRESHOLD = 8

const totalFileCount = computed(() => Object.keys(props.fileMap).length)
const selectedFiles = computed(() =>
  Object.keys(selectedKey.value).filter((n) => selectedKey.value[n] && !n.endsWith('/'))
)
const selectedFileCount = computed(() => selectedFiles.value.length)
const totalSize = computed(() =>
  selectedFiles.value.reduce((size, n) => size + (props.fileMap[n]?.size ?? 0), 0)
)

const nodes = computed(() => buildFileTree(props.fileMap, props.rootLabel))
const expanded = ref<Set<string>>(new Set())
watch(
  nodes,
  (val) => {
    expanded.value = fileTreeDefaultExpanded(val, !!props.rootLabel)
  },
  { immediate: true }
)

const query = ref('')
const showFilter = computed(() => totalFileCount.value > FILTER_THRESHOLD)
const filtering = computed(() => showFilter.value && query.value.trim() !== '')
const rows = computed<FileTreeRow[]>(() =>
  fileTreeVisibleRows(nodes.value, expanded.value, filtering.value ? query.value : '')
)

function toggleExpanded(key: string) {
  if (filtering.value) return
  const next = new Set(expanded.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  expanded.value = next
}

function onFolderChange(folder: FileTreeFolder, e: Event) {
  if (props.disabled) return
  selectedKey.value = toggleFileTreeFolder(
    folder,
    selectedKey.value,
    (e.target as HTMLInputElement).checked
  )
}

function onFileChange(key: string, e: Event) {
  if (props.disabled) return
  selectedKey.value = toggleFileTreeFile(
    key,
    selectedKey.value,
    (e.target as HTMLInputElement).checked
  )
}

const indent = (depth: number) => ({ paddingLeft: `${0.5 + depth * 1.25}rem` })
</script>

<template>
  <div class="dark:scheme-dark" :class="disabled && 'opacity-60'">
    <div v-if="showFilter" class="relative mb-2">
      <Icon
        name="solar:magnifer-linear"
        size="16"
        class="fs-muted pointer-events-none absolute top-1/2 left-3 -translate-y-1/2"
      />
      <input
        v-model="query"
        type="search"
        :placeholder="t('label.filterFiles')"
        :aria-label="t('label.filterFiles')"
        :disabled="disabled"
        class="h-9 w-full rounded-xl border border-zinc-200 bg-white pr-3 pl-9 text-sm shadow-sm shadow-zinc-900/[0.03] transition outline-none placeholder:text-zinc-400 focus:border-primary-500 focus:ring-4 focus:ring-primary-500/15 disabled:cursor-not-allowed dark:border-zinc-700 dark:bg-zinc-950 dark:placeholder:text-zinc-500 dark:focus:border-primary-400"
      />
    </div>
    <div
      role="tree"
      aria-multiselectable="true"
      :aria-disabled="disabled || undefined"
      class="max-h-80 overflow-auto rounded-xl border border-zinc-200 bg-white py-1 text-sm dark:border-zinc-800 dark:bg-zinc-950/40"
    >
      <template v-for="row in rows" :key="row.node.key">
        <!-- Folder -->
        <div
          v-if="row.node.kind === 'folder'"
          role="treeitem"
          :aria-level="row.depth + 1"
          :aria-expanded="row.expanded"
          :aria-selected="fileTreeFolderState(row.node, selectedKey) === 'checked'"
          class="flex items-center gap-1.5 py-1 pr-3 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
          :style="indent(row.depth)"
        >
          <button
            type="button"
            class="fs-muted flex size-5 shrink-0 items-center justify-center rounded-md transition hover:bg-zinc-200/70 hover:text-zinc-900 focus-visible:ring-2 focus-visible:ring-primary-500/40 focus-visible:outline-none disabled:opacity-50 dark:hover:bg-zinc-700/70 dark:hover:text-zinc-100"
            :aria-expanded="row.expanded"
            :aria-label="row.node.name"
            :disabled="filtering"
            @click="toggleExpanded(row.node.key)"
          >
            <Icon
              name="solar:alt-arrow-right-linear"
              size="14"
              class="transition-transform"
              :class="row.expanded && 'rotate-90'"
            />
          </button>
          <input
            type="checkbox"
            class="size-4 shrink-0 cursor-pointer accent-primary-600 disabled:cursor-not-allowed"
            :aria-label="row.node.name"
            :checked="fileTreeFolderState(row.node, selectedKey) === 'checked'"
            :indeterminate="fileTreeFolderState(row.node, selectedKey) === 'indeterminate'"
            :disabled="disabled"
            @change="onFolderChange(row.node, $event)"
          />
          <span
            class="flex min-w-0 flex-1 cursor-pointer items-center gap-1.5 select-none"
            @click="toggleExpanded(row.node.key)"
          >
            <Icon
              :name="row.expanded ? 'solar:folder-open-linear' : 'solar:folder-linear'"
              size="16"
              class="shrink-0 text-primary-600 dark:text-primary-400"
            />
            <span class="font-medium break-all">{{ row.node.name }}</span>
          </span>
        </div>
        <!-- File -->
        <div
          v-else
          role="treeitem"
          :aria-level="row.depth + 1"
          :aria-selected="!!selectedKey[row.node.key]"
          class="py-1 pr-3 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
          :style="indent(row.depth)"
        >
          <label
            class="flex items-center gap-1.5"
            :class="disabled ? 'cursor-not-allowed' : 'cursor-pointer'"
          >
            <span class="size-5 shrink-0" aria-hidden="true" />
            <input
              type="checkbox"
              class="size-4 shrink-0 cursor-pointer accent-primary-600 disabled:cursor-not-allowed"
              :checked="!!selectedKey[row.node.key]"
              :disabled="disabled"
              @change="onFileChange(row.node.key, $event)"
            />
            <Icon name="solar:file-linear" size="16" class="fs-muted shrink-0" />
            <span class="min-w-0 flex-1 break-all">{{ row.node.name }}</span>
            <span class="fs-muted shrink-0 text-xs tabular-nums">{{
              humanFileSize(row.node.size)
            }}</span>
          </label>
        </div>
      </template>
      <p v-if="!rows.length" class="fs-muted px-3 py-2 text-center text-sm">—</p>
    </div>
    <p class="fs-muted mt-2 text-right text-xs tabular-nums">
      {{ selectedFileCount }} / {{ totalFileCount }} · {{ humanFileSize(totalSize) }}
    </p>
  </div>
</template>
