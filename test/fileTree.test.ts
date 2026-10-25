import { describe, expect, it } from 'vitest'
import {
  type FileTreeEntry,
  type FileTreeFolder,
  buildFileTree,
  fileTreeDefaultExpanded,
  fileTreeFolderState,
  fileTreeVisibleRows,
  filterFileTree,
  toggleFileTreeFile,
  toggleFileTreeFolder
} from '../app/utils/fileTree'

const entry = (path: string, size = 1): FileTreeEntry => ({ paths: path.split('/'), size })

const fileMap: Record<string, FileTreeEntry> = {
  'b.txt': entry('b.txt', 10),
  'A.txt': entry('A.txt', 5),
  'docs/file10.md': entry('docs/file10.md', 3),
  'docs/file2.md': entry('docs/file2.md', 4),
  'docs/img/logo.png': entry('docs/img/logo.png', 100),
  'src/main.ts': entry('src/main.ts', 7)
}

const names = (nodes: { name: string }[]) => nodes.map((n) => n.name)

describe('buildFileTree', () => {
  it('nests folders from paths and sorts folders first, natural and case-insensitive', () => {
    const tree = buildFileTree(fileMap)
    expect(names(tree)).toEqual(['docs', 'src', 'A.txt', 'b.txt'])
    const docs = tree[0] as FileTreeFolder
    expect(docs.kind).toBe('folder')
    expect(docs.key).toBe('docs/')
    expect(names(docs.children)).toEqual(['img', 'file2.md', 'file10.md'])
    expect(docs.children[0]!.key).toBe('docs/img/')
    expect(docs.children[0]!.depth).toBe(1)
  })

  it('aggregates file keys and size per folder', () => {
    const docs = buildFileTree(fileMap)[0] as FileTreeFolder
    expect(docs.fileKeys.sort()).toEqual(
      ['docs/file10.md', 'docs/file2.md', 'docs/img/logo.png'].sort()
    )
    expect(docs.size).toBe(107)
  })

  it('wraps everything in a virtual root when rootLabel is given', () => {
    const tree = buildFileTree(fileMap, 'Project')
    expect(tree).toHaveLength(1)
    const root = tree[0] as FileTreeFolder
    expect(root.key).toBe('Project/')
    expect(root.depth).toBe(0)
    expect(root.fileKeys).toHaveLength(6)
    expect(root.children[0]!.key).toBe('Project/docs/')
    expect(root.children[0]!.depth).toBe(1)
  })

  it('keeps same-named folders at different levels distinct', () => {
    const tree = buildFileTree({ 'a/x/f': entry('a/x/f'), 'x/g': entry('x/g') })
    const keys = fileTreeVisibleRows(tree, new Set(['a/', 'a/x/', 'x/'])).map((r) => r.node.key)
    expect(keys).toEqual(['a/', 'a/x/', 'a/x/f', 'x/', 'x/g'])
  })
})

describe('selection', () => {
  const docs = buildFileTree(fileMap)[0] as FileTreeFolder

  it('computes tri-state folder state', () => {
    expect(fileTreeFolderState(docs, {})).toBe('unchecked')
    expect(fileTreeFolderState(docs, { 'docs/file2.md': true })).toBe('indeterminate')
    expect(fileTreeFolderState(docs, toggleFileTreeFolder(docs, {}))).toBe('checked')
  })

  it('toggling a folder selects then deselects all descendants, leaving others alone', () => {
    const on = toggleFileTreeFolder(docs, { 'b.txt': true })
    expect(Object.keys(on).sort()).toEqual(
      ['b.txt', 'docs/file10.md', 'docs/file2.md', 'docs/img/logo.png'].sort()
    )
    expect(Object.keys(on).some((k) => k.endsWith('/'))).toBe(false)
    expect(toggleFileTreeFolder(docs, on)).toEqual({ 'b.txt': true })
  })

  it('selects all when a folder is indeterminate', () => {
    const next = toggleFileTreeFolder(docs, { 'docs/file2.md': true })
    expect(fileTreeFolderState(docs, next)).toBe('checked')
  })

  it('toggles a single file without mutating the input', () => {
    const sel = { 'A.txt': true }
    expect(toggleFileTreeFile('b.txt', sel)).toEqual({ 'A.txt': true, 'b.txt': true })
    expect(toggleFileTreeFile('A.txt', sel)).toEqual({})
    expect(sel).toEqual({ 'A.txt': true })
  })
})

describe('expansion and filtering', () => {
  it('expands top-level folders by default, plus the children of a virtual root', () => {
    expect([...fileTreeDefaultExpanded(buildFileTree(fileMap))]).toEqual(['docs/', 'src/'])
    expect([...fileTreeDefaultExpanded(buildFileTree(fileMap, 'P'), true)]).toEqual([
      'P/',
      'P/docs/',
      'P/src/'
    ])
  })

  it('hides children of collapsed folders', () => {
    const tree = buildFileTree(fileMap)
    const rows = fileTreeVisibleRows(tree, fileTreeDefaultExpanded(tree))
    expect(rows.map((r) => r.node.key)).toEqual([
      'docs/',
      'docs/img/',
      'docs/file2.md',
      'docs/file10.md',
      'src/',
      'src/main.ts',
      'A.txt',
      'b.txt'
    ])
    expect(rows[1]!.expanded).toBe(false)
  })

  it('filter shows matching files and their ancestors, expanded', () => {
    const tree = buildFileTree(fileMap)
    const rows = fileTreeVisibleRows(tree, new Set(), 'LOGO')
    expect(rows.map((r) => r.node.key)).toEqual(['docs/', 'docs/img/', 'docs/img/logo.png'])
    expect(rows.every((r) => r.node.kind === 'file' || r.expanded)).toBe(true)
  })

  it('filtered folders only cover the matching files', () => {
    const filtered = filterFileTree(buildFileTree(fileMap), '.md')
    const docs = filtered[0] as FileTreeFolder
    expect(docs.fileKeys.sort()).toEqual(['docs/file10.md', 'docs/file2.md'])
    expect(names(docs.children)).toEqual(['file2.md', 'file10.md'])
    expect(filtered).toHaveLength(1)
  })

  it('empty or whitespace query returns the full tree', () => {
    const tree = buildFileTree(fileMap)
    expect(filterFileTree(tree, '  ')).toBe(tree)
  })
})
