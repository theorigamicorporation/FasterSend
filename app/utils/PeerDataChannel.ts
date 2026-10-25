/**
 * PeerDataChannel 配置类
 */
interface PeerDataChannelConfig {
  iceServers?: RTCIceServer[]
  iceTransportPolicy?: RTCIceTransportPolicy
  blockSize?: number
  initializeDataChannel?: boolean
  /** disconnected 状态的容忍时间，超时后尝试 ICE 重启 */
  disconnectGraceMs?: number
  /** ICE 重启后等待恢复的时间，超时仍未连接则视为断开 */
  iceRestartTimeoutMs?: number
}

/**
 * 封装用于点对点数据传输的 WebRTC 数据通道
 */
export class PeerDataChannel {
  private static readonly DEFAULT_BLOCK_SIZE = 32768
  private static readonly DEFAULT_DISCONNECT_GRACE_MS = 10e3
  private static readonly DEFAULT_ICE_RESTART_TIMEOUT_MS = 15e3

  private pc: RTCPeerConnection
  private dc: RTCDataChannel | null = null
  private receiveData: {
    startTime: number
    offset: number
    count: number
    type: string
    chunks: (string | ArrayBuffer)[]
  } = { startTime: 0, offset: 0, count: 0, type: '', chunks: [] }
  private sendPromiseReject: ((reason?: any) => void) | null = null
  private eventQueue: EventQueue<ArrayBuffer | string>
  private blockSize: number
  // 创建数据通道的一方负责发起 offer，也只由它发起 ICE 重启，避免双方同时 offer 冲突
  private isOfferer: boolean
  private disposed = false
  private everConnected = false
  private restartAttempted = false
  private graceTimer: ReturnType<typeof setTimeout> | null = null
  private restartTimer: ReturnType<typeof setTimeout> | null = null
  private disconnectGraceMs: number
  private iceRestartTimeoutMs: number

  public onReceive: (
    data: ArrayBuffer | string,
    info: { size: number; duration: number }
  ) => Promise<void> = async () => {}
  public onSDP: (sdp: RTCSessionDescriptionInit) => void = () => {}
  public onICECandidate: (candidate: RTCIceCandidate) => void = () => {}
  public onError: (e: Error) => void = () => {}
  public onConnected: () => void = () => {}
  public onDispose: () => void = () => {}
  public onOpen: () => void = () => {}

  /**
   * 创建一个新的 PeerDataChannel 实例
   * @param config 配置
   */
  constructor(config: PeerDataChannelConfig = {}) {
    this.blockSize = config.blockSize || PeerDataChannel.DEFAULT_BLOCK_SIZE
    this.eventQueue = new EventQueue(this.onData.bind(this))
    this.isOfferer = !!config.initializeDataChannel
    this.disconnectGraceMs = config.disconnectGraceMs ?? PeerDataChannel.DEFAULT_DISCONNECT_GRACE_MS
    this.iceRestartTimeoutMs =
      config.iceRestartTimeoutMs ?? PeerDataChannel.DEFAULT_ICE_RESTART_TIMEOUT_MS
    const rtcConfig: RTCConfiguration = { iceServers: config.iceServers }
    if (config.iceTransportPolicy) {
      rtcConfig.iceTransportPolicy = config.iceTransportPolicy
    }
    this.pc = new RTCPeerConnection(rtcConfig)

    this.setupPeerConnection()

    if (config.initializeDataChannel) {
      this.initializeDataChannel()
    }
  }

  private setupPeerConnection(): void {
    this.pc.ondatachannel = this.handleDataChannel.bind(this)
    this.pc.onnegotiationneeded = () => this.reNegotiation()
    this.pc.onicecandidate = (e) => e.candidate && this.onICECandidate(e.candidate)
    this.pc.onicecandidateerror = (e) => {
      // console.warn(e)
      // ingore
    }
    this.pc.onconnectionstatechange = this.handleConnectionStateChange.bind(this)
  }

  private handleDataChannel(e: RTCDataChannelEvent): void {
    this.dc = e.channel
    this.setupDataChannel()
  }

  private initializeDataChannel(): void {
    this.dc = this.pc.createDataChannel('dc')
    this.setupDataChannel()
  }

  private setupDataChannel(): void {
    if (!this.dc) return
    this.dc.bufferedAmountLowThreshold = 0
    this.dc.onmessage = (e) => this.eventQueue.enqueue(e.data)
    this.dc.onopen = () => this.onOpen()
  }

  /**
   * 连接状态处理：
   * - disconnected 通常是短暂波动（移动网络、Wi-Fi 漫游、TURN 切换），先等待一段时间
   * - failed 或等待超时后尝试一次 ICE 重启，重协商经 onnegotiationneeded -> onSDP 走信令通道
   * - 只有 closed，或重启后仍未恢复，才视为断开
   */
  private handleConnectionStateChange(): void {
    if (this.disposed) {
      return
    }
    const state = this.pc.connectionState
    if (state === 'connected') {
      this.clearRecoveryTimers()
      this.restartAttempted = false
      // 只在首次连接时通知，重连成功不应重复触发确认等业务流程
      if (!this.everConnected) {
        this.everConnected = true
        this.onConnected()
      }
    } else if (state === 'disconnected') {
      if (!this.graceTimer && !this.restartTimer) {
        this.graceTimer = setTimeout(() => {
          this.graceTimer = null
          if (this.pc.connectionState !== 'connected') {
            this.recover()
          }
        }, this.disconnectGraceMs)
      }
    } else if (state === 'failed') {
      if (this.graceTimer) {
        clearTimeout(this.graceTimer)
        this.graceTimer = null
      }
      this.recover()
    } else if (state === 'closed') {
      this.terminate()
    }
  }

  // 尝试一次 ICE 重启，已重启过或重启失败则断开
  private recover(): void {
    if (this.disposed || this.restartTimer) {
      return
    }
    if (this.restartAttempted) {
      this.terminate()
      return
    }
    this.restartAttempted = true
    if (this.isOfferer) {
      try {
        if (typeof this.pc.restartIce === 'function') {
          this.pc.restartIce()
        } else {
          void this.reNegotiation({ iceRestart: true })
        }
      } catch (e) {
        console.error(e)
        this.terminate()
        return
      }
    }
    // 应答方不发起重启，而是等待对方的重启 offer；对方可能晚一个容忍周期才开始重启，因此多等一些
    const timeout = this.isOfferer
      ? this.iceRestartTimeoutMs
      : this.iceRestartTimeoutMs + this.disconnectGraceMs
    this.restartTimer = setTimeout(() => {
      this.restartTimer = null
      if (this.pc.connectionState !== 'connected') {
        this.terminate()
      }
    }, timeout)
  }

  private clearRecoveryTimers(): void {
    if (this.graceTimer) {
      clearTimeout(this.graceTimer)
      this.graceTimer = null
    }
    if (this.restartTimer) {
      clearTimeout(this.restartTimer)
      this.restartTimer = null
    }
  }

  // 终止连接并通知上层
  private terminate(): void {
    if (this.disposed) {
      return
    }
    this.dispose()
    this.onDispose()
  }

  private async onData(data: ArrayBuffer | string): Promise<void> {
    const receiveData = this.receiveData
    if (receiveData.offset === receiveData.count) {
      const dat = JSON.parse(data as string)
      this.receiveData = {
        startTime: Date.now(),
        offset: 0,
        count: dat.count,
        type: dat.type,
        chunks: []
      }
    } else {
      receiveData.chunks.push(data)
      receiveData.offset++
      if (receiveData.offset === receiveData.count) {
        const endTime = Date.now()
        const b = new Blob(receiveData.chunks)
        const result = receiveData.type === 'string' ? await b.text() : await b.arrayBuffer()
        await this.onReceive(result, {
          size: b.size,
          duration: endTime - receiveData.startTime
        })
        receiveData.chunks = []
      }
    }
  }

  /**
   * 发送数据，注意只能串行调用
   * @param data 要发送的数据
   */
  public async sendData(data: ArrayBuffer | string): Promise<void> {
    if (!this.dc) {
      throw new Error('Data channel not initialized')
    }

    return new Promise<void>((resolve, reject) => {
      this.sendPromiseReject = reject
      const dc = this.dc!
      dc.bufferedAmountLowThreshold = 0
      // 字符串先编码为 UTF-8 再按字节分片，避免在 UTF-16 代理对中间切断导致字符损坏；
      // 接收端本来就是把分片拼成 Blob 再 text()，协议保持不变
      const payload = typeof data === 'string' ? new TextEncoder().encode(data) : data
      const count = Math.ceil(payload.byteLength / this.blockSize)
      let offset = 0

      dc.onbufferedamountlow = () => {
        if (count - offset > 16) {
          dc.bufferedAmountLowThreshold = 16 * this.blockSize
        } else {
          dc.bufferedAmountLowThreshold = 0
        }
        for (let i = 0; i < 32; i++) {
          if (offset < count) {
            const chunk = payload.slice(this.blockSize * offset, this.blockSize * (offset + 1))
            dc.send(chunk as ArrayBuffer)
            offset++
            if (offset >= count) {
              resolve()
              break
            }
          }
        }
      }
      dc.send(JSON.stringify({ count, type: typeof data }))
      if (count === 0) {
        resolve()
      }
    })
  }

  /**
   * 重协商 SDP
   */
  private async reNegotiation(options?: RTCOfferOptions): Promise<void> {
    return this.pc
      .createOffer(options)
      .then((offer) => this.pc.setLocalDescription(offer))
      .then(() => (this.pc.localDescription ? this.onSDP(this.pc.localDescription) : undefined))
      .catch((e) => {
        console.error(e)
        this.onError(e instanceof Error ? e : new Error('Unknown error during renegotiation'))
        this.dispose()
      })
  }

  /**
   * 设置远程 SDP
   * @param sdp SDP描述
   */
  public async setRemoteSDP(sdp: RTCSessionDescriptionInit): Promise<void> {
    try {
      await this.pc.setRemoteDescription(sdp)
      if (sdp.type === 'offer') {
        const answer = await this.pc.createAnswer()
        await this.pc.setLocalDescription(answer)
        this.onSDP(answer)
      }
    } catch (e) {
      console.error(e)
      this.onError(e instanceof Error ? e : new Error('Error setting remote SDP'))
      this.dispose()
    }
  }

  /**
   * 添加一个 ICE candidate
   * @param candidate ICE candidate
   */
  public async addICECandidate(candidate: RTCIceCandidateInit): Promise<void> {
    await this.pc.addIceCandidate(candidate)
  }

  /**
   * 检查连接是否断开
   * @returns 如果连接则为 True，否则为 false
   */
  public isConnected(): boolean {
    return this.pc.connectionState === 'connected'
  }

  /**
   * 获取接收缓存的大小
   * @returns 接收缓存的大小
   */
  public getReceivedBufferSize(): number {
    return this.receiveData.chunks.reduce(
      (size, dat) => size + (typeof dat === 'string' ? dat.length : dat.byteLength),
      0
    )
  }

  /**
   * 关闭对等连接并清理资源
   */
  public dispose(): void {
    if (this.disposed) {
      return
    }
    this.disposed = true
    this.clearRecoveryTimers()

    if (this.sendPromiseReject) {
      this.sendPromiseReject()
      this.sendPromiseReject = null
    }

    if (this.dc) {
      this.dc.close()
      this.dc = null
    }

    this.pc.onicecandidate = null
    this.pc.ontrack = null
    this.pc.ondatachannel = null
    this.pc.oniceconnectionstatechange = null
    this.pc.onsignalingstatechange = null
    this.pc.onicegatheringstatechange = null
    this.pc.onnegotiationneeded = null
    this.pc.onconnectionstatechange = null
    this.pc.close()
  }
}

export class EventQueue<T> {
  private tail: Promise<void> = Promise.resolve()
  private handler: (e: T) => Promise<void>

  constructor(handler: (e: T) => Promise<void>) {
    this.handler = handler
  }

  public enqueue(e: T): void {
    // 每次把新任务链到上一个任务后面
    this.tail = this.tail
      .then(() => this.handler(e))
      .catch((error) => {
        console.error('Error processing event:', error)
      })
  }
}
