import { createMD5, type IHasher } from 'hash-wasm'

/**
 * Gets the current browser scroll height
 * @returns scroll height
 */
export function getScrollTop(): number {
  // Guard for SSR, where window/document don't exist
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return 0
  }
  // Different browsers expose the scroll offset differently
  if (typeof window.scrollY !== 'undefined') {
    // Modern browsers
    return window.scrollY
  } else if (document.documentElement && document.documentElement.scrollTop) {
    // IE 6-8
    return document.documentElement.scrollTop
  } else if (document.body && document.body.scrollTop) {
    // Older browsers
    return document.body.scrollTop
  }
  return 0
}

/**
 * Checks whether the browser supports the modern file APIs
 */
export function isModernFileAPIAvailable() {
  const fileHandleSupported = 'FileSystemHandle' in window
  const openFilePickerSupported = 'showOpenFilePicker' in window
  const saveFilePickerSupported = 'showSaveFilePicker' in window
  const directoryPickerSupported = 'showDirectoryPicker' in window

  return (
    fileHandleSupported &&
    openFilePickerSupported &&
    saveFilePickerSupported &&
    directoryPickerSupported
  )
}

/**
 * Checks whether the browser supports directory selection
 * @returns whether directory selection is supported
 */
export function supportsDirectorySelection() {
  var input = document.createElement('input')
  input.type = 'file'
  return 'webkitdirectory' in input || 'directory' in input
}

/**
 * Picks an avatar image
 * @param cb callback
 * @returns
 */
export function selectAvatar(cb: (url: string) => void) {
  if (typeof window === 'undefined') {
    return
  }
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/*'
  input.onchange = () => {
    if (input.files && input.files.length > 0) {
      const file = input.files[0]
      input.onchange = null
      input.remove()
      createImageBitmap(file!)
        .then((img) => {
          // Convert to 256x256 webp to save space
          const oc = new OffscreenCanvas(256, 256)
          const ctx = oc.getContext('2d')
          if (!ctx) {
            throw new Error('Failed to create context')
          }
          ctx.drawImage(img, 0, 0, 256, 256)
          return oc.convertToBlob({ type: 'image/webp', quality: 0.61 })
        })
        .then((blob) => {
          // Then to a data URL for easy storage
          const fr = new FileReader()
          fr.onload = () => {
            cb(fr.result + '')
          }
          fr.readAsDataURL(blob)
        })
        .catch(console.warn)
    } else {
      cb('')
      input.onchange = null
      input.remove()
    }
  }
  input.click()
}

/**
 * Formats a byte count as human-readable text
 *
 * @param bytes number of bytes
 * @param decimals number of decimal places
 *
 * @return formatted string
 */
export function humanFileSize(bytes: number, decimals = 2): string {
  if (!bytes) return '0B'
  var k = 1024
  var dm = decimals || 2
  var sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']
  var i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + (sizes[i] ?? '')
}

export function doDownloadFromHref(href: string, filename: string) {
  const a = document.createElement('a')
  a.style.display = 'none'
  a.href = href
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
}

/**
 * Downloads a Blob as a file
 *
 * @param {Blob} blob
 * @param {string} filename
 */
export function doDownloadFromBlob(blob: Blob | File, filename: string) {
  const objUrl = URL.createObjectURL(blob)
  doDownloadFromHref(objUrl, filename)
  URL.revokeObjectURL(objUrl)
}

export async function copyToClipboard(content: string): Promise<boolean> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return false
  }

  // Clipboard API is only available in secure contexts (https or localhost)
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(content)
      return true
    } catch (error) {
      console.warn(error)
    }
  }

  // Fall back to execCommand on plain http pages
  const textarea = document.createElement('textarea')
  textarea.value = content
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.select()
  try {
    return document.execCommand('copy')
  } catch (error) {
    console.warn(error)
    return false
  } finally {
    textarea.remove()
  }
}

/**
 * Checks whether the page runs in a standalone window (PWA)
 */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') {
    return false
  }
  return window.matchMedia('(display-mode: standalone)').matches
}

/**
 * Reads a value from localStorage; if missing and a default is given, stores and returns the default
 * @param key
 * @param defVal
 * @returns
 */
export function getValFromLocalStorage<T>(key: string, defVal?: T): T | null {
  const val = localStorage.getItem(key)
  if (val) {
    try {
      return JSON.parse(val)
    } catch (e) {}
  }
  if (defVal !== undefined) {
    localStorage.setItem(key, JSON.stringify(defVal))
    return defVal
  }
  return null
}

function bytesToBase64(bytes: Uint8Array) {
  let bin = ''
  for (const b of bytes) {
    bin += String.fromCharCode(b)
  }
  return btoa(bin)
}

/**
 * Incremental MD5 calculator; the digest is a Base64 string (same format as the checksum in the transfer protocol).
 * The wasm instance loads lazily on first use, so nothing is initialized during SSR.
 */
export function createMD5Hasher() {
  let hasher: IHasher | undefined
  let loading: Promise<IHasher> | undefined

  async function get() {
    if (hasher) {
      return hasher
    }
    loading ??= createMD5().then((h) => (hasher = h))
    return loading
  }

  return {
    async reset() {
      ;(await get()).init()
    },
    async update(data: ArrayBuffer) {
      ;(await get()).update(new Uint8Array(data))
    },
    async digest() {
      return bytesToBase64((await get()).digest('binary'))
    }
  }
}

// Computes the MD5 hash of a file or Blob
export async function calcMD5(file: File | Blob) {
  const hasher = createMD5Hasher()

  const sliceSize = 1024 * 1024
  const count = Math.ceil(file.size / sliceSize)
  for (let i = 0; i < count; i++) {
    const ab = await file.slice(i * sliceSize, (i + 1) * sliceSize).arrayBuffer()
    await hasher.update(ab)
  }
  return hasher.digest()
}

/**
 * Formats milliseconds as HH:mm:ss
 * @param {number} milliseconds
 * @returns
 */
export function formatTime(milliseconds: number) {
  const hours = Math.floor(milliseconds / (1000 * 60 * 60))
  const minutes = Math.floor((milliseconds % (1000 * 60 * 60)) / (1000 * 60))
  const seconds = Math.floor((milliseconds % (1000 * 60)) / 1000)

  // Zero-pad minutes and seconds
  const formattedMinutes = minutes.toString().padStart(2, '0')
  const formattedSeconds = seconds.toString().padStart(2, '0')

  return hours === 0
    ? `${formattedMinutes}:${formattedSeconds}`
    : `${hours}:${formattedMinutes}:${formattedSeconds}`
}

/**
 * Converts an error into readable message text, stripping the "Error:" prefix
 */
export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
