import type { FilesPayload, FlatFileMap, TransferType } from '~/types/transfer'
import { cloneFlatFileMap } from '~/types/transfer'

/**
 * Store for the files queued to send.
 * Only holds the selection made before sending; no page display logic.
 */
export const useTransferConfigStore = defineStore('transferConfig', () => {
  const type = ref<TransferType>('')
  const fileMap = ref<FlatFileMap>({})
  const root = ref('')

  const filesInfo = computed<FilesPayload>(() => ({
    type: type.value,
    fileMap: fileMap.value,
    root: root.value
  }))

  function setTransferFiles(nextType: TransferType, nextFileMap: FlatFileMap) {
    type.value = nextType
    fileMap.value = nextFileMap
    root.value = ''
  }

  function clearTransferFiles() {
    type.value = ''
    fileMap.value = {}
    root.value = ''
  }

  /**
   * Builds the final payload sent to the recipient.
   * For directory sync, extracts the root directory name and builds a file tree without it.
   */
  function buildSenderPayload(): FilesPayload {
    const nextFileMap = cloneFlatFileMap(fileMap.value)
    let nextRoot = root.value

    if (type.value === 'syncDir') {
      const [firstKey] = Object.keys(nextFileMap)
      if (firstKey) {
        nextRoot = nextFileMap[firstKey]?.paths[0] || 'Unknown'
      } else {
        nextRoot = 'Unknown'
      }
      return {
        type: type.value,
        root: nextRoot,
        fileMap: fileMapWithoutRoot(nextFileMap)
      }
    }

    return {
      type: type.value,
      root: nextRoot,
      fileMap: nextFileMap
    }
  }

  return {
    type,
    fileMap,
    root,
    filesInfo,
    setTransferFiles,
    clearTransferFiles,
    buildSenderPayload
  }
})
