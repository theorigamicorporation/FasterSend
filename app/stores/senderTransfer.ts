import { toCanvas } from 'qrcode'
import { hasRelayServer, IceSession } from '~/utils/iceConfig'
import { PeerDataChannel } from '~/utils/PeerDataChannel'
import {
  createSenderCurrentFileState,
  createSenderStatusState,
  type FlatFileMap,
  type SenderCurrentFileState,
  type SenderStatusState,
  type UserInfo
} from '~/types/transfer'

/**
 * Sender business store.
 * Holds all send-flow state, connection control and file sending; pages only bind and display.
 */
export const useSenderTransferStore = defineStore('senderTransfer', () => {
  const { t } = useI18n()
  const localePath = useLocalePath()
  const router = useRouter()
  const toast = useToast()

  const appStore = useAppStore()
  const userStore = useUserStore()
  const iceConfig = useIceConfig()
  const transferConfigStore = useTransferConfigStore()

  const peerUserInfo = ref<UserInfo>({ nickname: 'unknown', avatarURL: '' })
  const code = ref('')
  const totalTransmittedBytes = ref(0)
  const startTime = ref(0)
  const totalSpeed = ref(0)
  const durationTimeStr = ref('0:00:00')
  const curFile = ref<SenderCurrentFileState>(createSenderCurrentFileState())
  const status = ref<SenderStatusState>(createSenderStatusState())

  let calcSpeedJobId: ReturnType<typeof setInterval> | undefined
  let ws: WebSocket | null = null
  let pdc: PeerDataChannel | null = null
  let iceSession: IceSession | null = null
  // The recipient may send its offer before our ICE servers are resolved; hold it until the peer connection exists
  let pendingSignals: { type: string; data: any }[] = []
  let peerEverConnected = false
  // A peer connection was attempted with STUN only, so a failure is likely a missing relay
  let attemptedWithoutRelay = false
  const hasher = createMD5Hasher()
  // With syncDir, payload keys have the root stripped; map them back to the original file items
  let payloadFileMap: FlatFileMap = {}

  const shareLink = computed(() => {
    if (!import.meta.client || !code.value) {
      return ''
    }
    return `${location.origin}${localePath('/recipient')}?code=${code.value}`
  })

  function resetState() {
    dispose()
    peerUserInfo.value = { nickname: 'unknown', avatarURL: '' }
    code.value = ''
    totalTransmittedBytes.value = 0
    startTime.value = 0
    totalSpeed.value = 0
    durationTimeStr.value = '0:00:00'
    curFile.value = createSenderCurrentFileState()
    status.value = createSenderStatusState()
    payloadFileMap = {}
    attemptedWithoutRelay = false
  }

  function dispose() {
    if (calcSpeedJobId) {
      clearInterval(calcSpeedJobId)
      calcSpeedJobId = undefined
    }
    ws?.close()
    ws = null
    pdc?.dispose()
    pdc = null
    iceSession?.dispose()
    iceSession = null
    pendingSignals = []
  }

  function calcSpeedFn() {
    if (!startTime.value) {
      return
    }
    totalSpeed.value =
      totalTransmittedBytes.value / ((new Date().getTime() - startTime.value) / 1e3)
    durationTimeStr.value = formatTime(new Date().getTime() - startTime.value)
  }

  async function confirmUser(isTrust: boolean) {
    if (!isTrust) {
      await pdc?.sendData(JSON.stringify({ type: 'err', data: 403 }))
      await router.replace(localePath('/'))
      return
    }

    status.value.isWaitingConfirm = false
    await pdc?.sendData(JSON.stringify({ type: 'user', data: userStore.userInfo }))

    const payload = transferConfigStore.buildSenderPayload()

    // With syncDir, payload keys have the root stripped; build a map from stripped keys to original file items
    if (transferConfigStore.type === 'syncDir') {
      payloadFileMap = {}
      const originalFileMap: FlatFileMap = transferConfigStore.fileMap
      for (const payloadKey of Object.keys(payload.fileMap)) {
        for (const [origKey, origItem] of Object.entries(originalFileMap)) {
          if (origKey.replace(/.*?\//, '') === payloadKey) {
            payloadFileMap[payloadKey] = origItem
            break
          }
        }
      }
    } else {
      payloadFileMap = transferConfigStore.fileMap
    }

    await pdc?.sendData(JSON.stringify({ type: 'files', data: payload }))
  }

  async function handleObjData(obj: any) {
    if (obj.type === 'user') {
      peerUserInfo.value = obj.data
      status.value.isWaitingConnect = false
      if (userStore.isConfirmDefault) {
        await confirmUser(true)
      }
      return
    }

    if (obj.type === 'reqFile') {
      await hasher.reset()
      const fileDetail = payloadFileMap[obj.data]
      const file = fileDetail?.file
      const name = `${fileDetail?.paths[fileDetail?.paths?.length - 1] || ''}`

      if (!file) {
        await pdc?.sendData(JSON.stringify({ type: 'err', data: 404 }))
        return
      }

      curFile.value = {
        name,
        size: file.size,
        transmittedBytes: 0,
        lastBytes: 0,
        speed: 0,
        startTime: new Date().getTime()
      }

      const sliceSize = 1024 * 1024
      const count = Math.ceil(file.size / sliceSize)
      for (let index = 0; index < count; index++) {
        const ab = await file.slice(index * sliceSize, (index + 1) * sliceSize).arrayBuffer()
        if (ab.byteLength === 0) {
          continue
        }

        await hasher.update(ab)
        await pdc?.sendData(ab)

        curFile.value.lastBytes = curFile.value.transmittedBytes
        curFile.value.transmittedBytes += ab.byteLength
        totalTransmittedBytes.value += ab.byteLength

        const nowTime = new Date().getTime()
        const elapsed = nowTime - curFile.value.startTime
        // Avoid division by zero when the time delta is zero
        if (elapsed > 0) {
          curFile.value.speed = (curFile.value.speed + ab.byteLength / (elapsed / 1e3)) / 2
        }
        curFile.value.startTime = nowTime
      }

      await pdc?.sendData(JSON.stringify({ type: 'fileDone', data: await hasher.digest() }))
      return
    }

    if (obj.type === 'calcFileHash') {
      await hasher.reset()
      const fileDetail = payloadFileMap[obj.data]
      const file = fileDetail?.file
      if (!file) {
        await pdc?.sendData(JSON.stringify({ type: 'err', data: 404 }))
        return
      }
      const hash = await calcMD5(file)
      await pdc?.sendData(JSON.stringify({ type: 'fileHash', data: hash }))
      return
    }

    if (obj.type === 'done') {
      status.value.isDone = true
      dispose()
      toast.add({
        severity: 'success',
        summary: t('hint.transCompleted'),
        life: 5e3
      })
      return
    }

    if (obj.type === 'err' && obj.data) {
      status.value.warn.code = obj.data
    }
  }

  /**
   * Resolves ICE servers once the recipient has paired, then creates the peer connection.
   * The ticket is exchanged for short-lived TURN credentials; without one the public ICE config is used.
   */
  async function startPDC(iceTicket: unknown) {
    const session = new IceSession(
      typeof iceTicket === 'string' ? iceTicket : undefined,
      iceConfig.iceServers
    )
    iceSession = session
    const { iceServers, ttl } = await session.resolve()
    // Disposed or restarted while waiting for credentials
    if (iceSession !== session || !ws) {
      session.dispose()
      return
    }
    initPDC(iceServers)
    if (ttl) {
      session.keepFresh(ttl, (servers) => pdc?.setIceServers(servers))
    }
    // Replay synchronously so the offer and candidates reach the peer connection in arrival order
    const queued = pendingSignals
    pendingSignals = []
    for (const signal of queued) {
      handleSignal(signal).catch((e) => console.warn(e))
    }
  }

  async function handleSignal(signal: { type: string; data: any }) {
    if (!pdc) {
      pendingSignals.push(signal)
      return
    }
    if (signal.type === 'sdp') {
      await pdc.setRemoteSDP(signal.data)
    } else {
      await pdc.addICECandidate(signal.data)
    }
  }

  function initPDC(iceServers: RTCIceServer[]) {
    const relayAvailable = hasRelayServer(iceServers)
    attemptedWithoutRelay = !relayAvailable
    peerEverConnected = false
    pdc = new PeerDataChannel({ ...iceConfig, iceServers })
    pdc.onSDP = (sdp) => ws?.send(JSON.stringify({ type: 'sdp', data: sdp }))
    pdc.onICECandidate = (candidate) =>
      ws?.send(JSON.stringify({ type: 'candidate', data: candidate }))
    pdc.onDispose = () => {
      status.value.isConnectPeer = false
      dispose()
      if (!peerEverConnected && !relayAvailable) {
        status.value.relayUnavailable = true
        toast.add({ severity: 'error', summary: t('hint.relayUnavailable'), life: 10e3 })
      } else {
        toast.add({ severity: 'warn', summary: t('hint.disconnected'), life: 5e3 })
      }
      if (!status.value.isDone && status.value.warn.code === 0) {
        status.value.warn.code = -10
      }
    }
    pdc.onError = (err) => {
      console.error(err)
      status.value.isConnectPeer = false
      dispose()
    }
    pdc.onConnected = () => {
      peerEverConnected = true
      status.value.isConnectPeer = true
      status.value.isWaitingConfirm = true
    }
    pdc.onReceive = async (data) => {
      if (typeof data === 'string') {
        await handleObjData(JSON.parse(data))
      }
    }
  }

  async function copyText(text: string) {
    if (!text) {
      return
    }
    const ok = await copyToClipboard(text)
    toast.add({
      severity: ok ? 'success' : 'warn',
      summary: ok ? t('btn.copied') : t('hint.copyFailed'),
      life: 3e3
    })
  }

  const copyLink = () => copyText(shareLink.value)
  const copyCode = () => copyText(code.value)

  async function renderQRCode(canvas: HTMLCanvasElement | null) {
    if (!canvas || !shareLink.value) {
      return
    }
    await toCanvas(canvas, shareLink.value, { scale: 5 })
  }

  function initialize() {
    resetState()
    appStore.setFullScreenLoading(false)

    if (!transferConfigStore.type) {
      router.replace(localePath('/'))
      return
    }

    if (Object.keys(transferConfigStore.fileMap).length === 0) {
      toast.add({ severity: 'warn', summary: t('hint.dirIsEmpty'), life: 5e3 })
      router.replace(localePath('/'))
      return
    }

    try {
      ws = new WebSocket(location.origin.replace('http', 'ws') + '/api/connect')
    } catch (error) {
      console.error(error)
      status.value.error.code = -5
      status.value.error.msg = `${error}`
      return
    }

    ws.onopen = () => {
      status.value.isConnectServer = true
      startTime.value = Date.now()
      calcSpeedJobId = setInterval(calcSpeedFn, 1e3)
      ws?.send(JSON.stringify({ type: 'send' }))
    }
    ws.onmessage = async (event) => {
      const data = JSON.parse(event.data)
      if (data.type === 'code') {
        code.value = data.code
        status.value.isIniting = false
        return
      }
      if (data.type === 'paired') {
        // A recipient used the code; only now are TURN credentials worth minting
        if (!pdc && !iceSession) {
          await startPDC(data.iceTicket)
        }
        return
      }
      if (data.type === 'sdp' || data.type === 'candidate') {
        await handleSignal(data)
        return
      }
      if (data.type === 'err') {
        status.value.error.code = data.data
        status.value.isWaitingConnect = false
        toast.add({ severity: 'error', summary: data.msg, life: 5e3 })
        console.warn(data.msg)
      }
    }
    ws.onclose = () => {
      status.value.isConnectServer = false
      if (status.value.isIniting) {
        status.value.error.code = -5
        status.value.error.msg = 'Connect sign server error'
        toast.add({
          severity: 'error',
          summary: t('hint.serverError'),
          life: 5e3
        })
      } else if (status.value.isWaitingConnect) {
        status.value.error.code = -10
        status.value.error.msg = 'Timeout'
        status.value.relayUnavailable = attemptedWithoutRelay
      }
    }
    ws.onerror = (error) => {
      console.error(error)
      status.value.isConnectServer = false
    }
  }

  function cleanup() {
    dispose()
  }

  return {
    peerUserInfo,
    code,
    totalTransmittedBytes,
    startTime,
    totalSpeed,
    durationTimeStr,
    curFile,
    status,
    shareLink,
    initialize,
    cleanup,
    confirmUser,
    copyLink,
    copyCode,
    renderQRCode
  }
})
