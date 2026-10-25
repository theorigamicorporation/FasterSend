/**
 * Pure helpers behind FilesTree.vue: build a folder tree from a file map,
 * compute tri-state folder selection, toggle selection and flatten the tree
 * into the rows that are currently visible (respecting expansion and filter).
 *
 * Selection is a Record<fileKey, true>. Folder keys (ending in '/') are never
 * written by these helpers; consumers filter them out anyway.
 */

export interface FileTreeEntry {
  paths: string[]
  size: number
}

export interface FileTreeFile {
  kind: 'file'
  /** The fileMap key */
  key: string
  name: string
  depth: number
  size: number
}

export interface FileTreeFolder {
  kind: 'folder'
  /** Full folder path with trailing '/', unique within the tree */
  key: string
  name: string
  depth: number
  children: FileTreeNode[]
  /** Keys of every file below this folder (any depth) */
  fileKeys: string[]
  size: number
}

export type FileTreeNode = FileTreeFile | FileTreeFolder

export type FolderCheckState = 'checked' | 'indeterminate' | 'unchecked'

export type FileTreeSelection = Record<string, boolean>

export interface FileTreeRow {
  node: FileTreeNode
  depth: number
  /** Only meaningful for folders */
  expanded: boolean
}

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })

export function compareFileTreeNodes(a: FileTreeNode, b: FileTreeNode): number {
  if (a.kind !== b.kind) return a.kind === 'folder' ? -1 : 1
  return collator.compare(a.name, b.name) || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0)
}

interface MutableFolder extends FileTreeFolder {
  folders: Map<string, MutableFolder>
}

function newFolder(key: string, name: string, depth: number): MutableFolder {
  return {
    kind: 'folder',
    key,
    name,
    depth,
    children: [],
    fileKeys: [],
    size: 0,
    folders: new Map()
  }
}

function finalize(folder: MutableFolder): FileTreeFolder {
  const children: FileTreeNode[] = [
    ...[...folder.folders.values()].map(finalize),
    ...folder.children.filter((c) => c.kind === 'file')
  ].sort(compareFileTreeNodes)
  const fileKeys: string[] = []
  let size = 0
  for (const child of children) {
    if (child.kind === 'file') fileKeys.push(child.key)
    else fileKeys.push(...child.fileKeys)
    size += child.size
  }
  return {
    kind: 'folder',
    key: folder.key,
    name: folder.name,
    depth: folder.depth,
    children,
    fileKeys,
    size
  }
}

/**
 * Build the nested tree from a fileMap. Each file's `paths` array holds its
 * folder segments followed by its file name. With `rootLabel`, everything is
 * wrapped in a single virtual root folder.
 */
export function buildFileTree(
  fileMap: Record<string, FileTreeEntry>,
  rootLabel = ''
): FileTreeNode[] {
  const baseDepth = rootLabel ? 1 : 0
  const prefix = rootLabel ? rootLabel + '/' : ''
  const top = newFolder(prefix, rootLabel, 0)

  for (const key of Object.keys(fileMap)) {
    const file = fileMap[key]!
    const paths = file.paths?.length ? file.paths : [key]
    let cur = top
    let folderPath = prefix
    for (let i = 0; i < paths.length - 1; i++) {
      const name = paths[i]!
      folderPath += name + '/'
      let next = cur.folders.get(name)
      if (!next) {
        next = newFolder(folderPath, name, baseDepth + i)
        cur.folders.set(name, next)
      }
      cur = next
    }
    cur.children.push({
      kind: 'file',
      key,
      name: paths[paths.length - 1]!,
      depth: baseDepth + paths.length - 1,
      size: file.size ?? 0
    })
  }

  const root = finalize(top)
  return rootLabel ? [root] : root.children
}

export function fileTreeFolderState(
  folder: FileTreeFolder,
  selected: FileTreeSelection
): FolderCheckState {
  let count = 0
  for (const key of folder.fileKeys) if (selected[key]) count++
  if (count === 0) return 'unchecked'
  return count === folder.fileKeys.length ? 'checked' : 'indeterminate'
}

/**
 * Toggle a folder: selects every file below it unless all are already
 * selected, in which case they are all deselected. `checked` forces a value.
 * Returns a new selection object.
 */
export function toggleFileTreeFolder(
  folder: FileTreeFolder,
  selected: FileTreeSelection,
  checked?: boolean
): FileTreeSelection {
  const select = checked ?? fileTreeFolderState(folder, selected) !== 'checked'
  const next: FileTreeSelection = { ...selected }
  for (const key of folder.fileKeys) {
    if (select) next[key] = true
    else delete next[key]
  }
  return next
}

export function toggleFileTreeFile(
  key: string,
  selected: FileTreeSelection,
  checked?: boolean
): FileTreeSelection {
  const select = checked ?? !selected[key]
  const next: FileTreeSelection = { ...selected }
  if (select) next[key] = true
  else delete next[key]
  return next
}

/** Folder keys expanded by default: top-level folders, plus the children of a single virtual root */
export function fileTreeDefaultExpanded(nodes: FileTreeNode[], hasRoot = false): Set<string> {
  const keys = new Set<string>()
  for (const node of nodes) {
    if (node.kind !== 'folder') continue
    keys.add(node.key)
    if (hasRoot) {
      for (const child of node.children) if (child.kind === 'folder') keys.add(child.key)
    }
  }
  return keys
}

function matches(file: FileTreeFile, query: string): boolean {
  return file.key.toLowerCase().includes(query) || file.name.toLowerCase().includes(query)
}

/**
 * Keep only files matching `query` (case-insensitive substring of the file
 * key or name) plus their ancestor folders. An empty query returns `nodes`.
 * Returned folders carry `fileKeys` limited to the matching files.
 */
export function filterFileTree(nodes: FileTreeNode[], query: string): FileTreeNode[] {
  const q = query.trim().toLowerCase()
  if (!q) return nodes
  const out: FileTreeNode[] = []
  for (const node of nodes) {
    if (node.kind === 'file') {
      if (matches(node, q)) out.push(node)
      continue
    }
    const children = filterFileTree(node.children, q)
    if (!children.length) continue
    // fileKeys/size cover only the matching files, so toggling a filtered folder
    // affects just what is visible
    const fileKeys: string[] = []
    let size = 0
    for (const child of children) {
      if (child.kind === 'file') fileKeys.push(child.key)
      else fileKeys.push(...child.fileKeys)
      size += child.size
    }
    out.push({ ...node, children, fileKeys, size })
  }
  return out
}

/**
 * Flatten the tree into visible rows. With a non-empty filter query only
 * matching files and their ancestors are returned, all expanded.
 */
export function fileTreeVisibleRows(
  nodes: FileTreeNode[],
  expanded: ReadonlySet<string>,
  query = ''
): FileTreeRow[] {
  const filtering = query.trim() !== ''
  const source = filtering ? filterFileTree(nodes, query) : nodes
  const rows: FileTreeRow[] = []
  const walk = (list: FileTreeNode[]) => {
    for (const node of list) {
      const isOpen = node.kind === 'folder' && (filtering || expanded.has(node.key))
      rows.push({ node, depth: node.depth, expanded: isOpen })
      if (node.kind === 'folder' && isOpen) walk(node.children)
    }
  }
  walk(source)
  return rows
}
