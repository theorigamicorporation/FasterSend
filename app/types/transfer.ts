/**
 * Transfer mode.
 * An empty string means nothing to send has been selected yet.
 */
export type TransferType = '' | 'transFile' | 'transDir' | 'syncDir'

/**
 * Basic user info.
 */
export interface UserInfo {
  nickname: string
  avatarURL: string
}

/**
 * Flat description of a single file.
 */
export interface FlatFileItem {
  paths: string[]
  size: number
  lastModified: number
  file?: File
  isEqual?: boolean
  isUpdate?: boolean
}

/**
 * Flat file tree.
 */
export type FlatFileMap = Record<string, FlatFileItem>

/**
 * File info payload sent to the receiver.
 */
export interface FilesPayload {
  type: TransferType
  fileMap: FlatFileMap
  root: string
}

/**
 * Generic error/warning state.
 */
export interface MessageState {
  code: number
  msg: string
}

/**
 * Sender's current file state.
 */
export interface SenderCurrentFileState {
  name: string
  size: number
  transmittedBytes: number
  lastBytes: number
  speed: number
  startTime: number
}

/**
 * Sender page state.
 */
export interface SenderStatusState {
  isIniting: boolean
  isConnectServer: boolean
  isConnectPeer: boolean
  isWaitingConnect: boolean
  isWaitingConfirm: boolean
  isDone: boolean
  /** The peer connection failed before connecting and no TURN relay was configured or could be obtained */
  relayUnavailable: boolean
  error: MessageState
  warn: MessageState
}

/**
 * Receiver's current file state.
 */
export interface RecipientCurrentFileState {
  name: string
  size: number
  transmittedBytes: number
  lastSize: number
  speed: number
  chunks: ArrayBuffer[]
}

/**
 * Receiver page state.
 */
export interface RecipientStatusState {
  isConnectServer: boolean
  isConnectPeer: boolean
  isPeerConnecting: boolean
  isIniting: boolean
  isWaitingPeerConfirm: boolean
  isLock: boolean
  isReceiving: boolean
  isDone: boolean
  /** The peer connection failed before connecting and no TURN relay was configured or could be obtained */
  relayUnavailable: boolean
  error: MessageState
  warn: MessageState
}

/**
 * Directory sync stage state.
 */
export interface SyncDirState {
  folderName: string
  isWaitingSelectDir: boolean
  isDiffing: boolean
  /** Quick diff mode: compares only size and modified time, no hashing */
  isQuickDiff: boolean
  fileMapAdd: FlatFileMap
  fileMapUpdate: FlatFileMap
  fileMapDelete: FlatFileMap
  addKeys: Record<string, boolean>
  updateKeys: Record<string, boolean>
  deleteKeys: Record<string, boolean>
  waitAddList: string[]
  waitUpdateList: string[]
  waitDeleteList: string[]
}

/**
 * Creates the default error/warning state.
 */
export function createMessageState(): MessageState {
  return {
    code: 0,
    msg: ''
  }
}

/**
 * Creates the default sender file state.
 */
export function createSenderCurrentFileState(): SenderCurrentFileState {
  return {
    name: '',
    size: 0,
    transmittedBytes: 0,
    lastBytes: 0,
    speed: 0,
    startTime: 0
  }
}

/**
 * Creates the default sender state.
 */
export function createSenderStatusState(): SenderStatusState {
  return {
    isIniting: true,
    isConnectServer: false,
    isConnectPeer: false,
    isWaitingConnect: true,
    isWaitingConfirm: true,
    isDone: false,
    relayUnavailable: false,
    error: createMessageState(),
    warn: createMessageState()
  }
}

/**
 * Creates the default receiver file state.
 */
export function createRecipientCurrentFileState(): RecipientCurrentFileState {
  return {
    name: '',
    size: 0,
    transmittedBytes: 0,
    lastSize: 0,
    speed: 0,
    chunks: []
  }
}

/**
 * Creates the default receiver state.
 */
export function createRecipientStatusState(): RecipientStatusState {
  return {
    isConnectServer: false,
    isConnectPeer: false,
    isPeerConnecting: false,
    isIniting: true,
    isWaitingPeerConfirm: true,
    isLock: false,
    isReceiving: false,
    isDone: false,
    relayUnavailable: false,
    error: createMessageState(),
    warn: createMessageState()
  }
}

/**
 * Creates the default directory sync state.
 */
export function createSyncDirState(): SyncDirState {
  return {
    folderName: '',
    isWaitingSelectDir: true,
    isDiffing: true,
    isQuickDiff: false,
    fileMapAdd: {},
    fileMapUpdate: {},
    fileMapDelete: {},
    addKeys: {},
    updateKeys: {},
    deleteKeys: {},
    waitAddList: [],
    waitUpdateList: [],
    waitDeleteList: []
  }
}

/**
 * Shallow-copies the file tree, keeping File references and copying arrays, so the original state isn't mutated before sending.
 */
export function cloneFlatFileMap(fileMap: FlatFileMap): FlatFileMap {
  const result: FlatFileMap = {}
  for (const [key, value] of Object.entries(fileMap)) {
    result[key] = {
      ...value,
      paths: [...value.paths]
    }
  }
  return result
}
