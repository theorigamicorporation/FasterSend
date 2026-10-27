/**
 * PeerDataChannel config
 */
interface PeerDataChannelConfig {
  iceServers?: RTCIceServer[]
  iceTransportPolicy?: RTCIceTransportPolicy
  blockSize?: number
  initializeDataChannel?: boolean
  /** Grace period in the disconnected state; after it expires, try an ICE restart */
  disconnectGraceMs?: number
  /** Time to wait for recovery after an ICE restart; if still not connected, treat as disconnected */
  iceRestartTimeoutMs?: number
}

/**
 * Wraps a WebRTC data channel for peer-to-peer transfer
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
  // The side that creates the data channel sends the offer and is the only one to restart ICE, avoiding glare from simultaneous offers
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
   * Creates a new PeerDataChannel instance
   * @param config config
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
   * Connection state handling:
   * - disconnected is usually a brief blip (mobile network, Wi-Fi roaming, TURN switch), so wait a while first
   * - on failed or wait timeout, try one ICE restart; renegotiation goes through onnegotiationneeded -> onSDP over the signalling channel
   * - only closed, or no recovery after the restart, counts as disconnected
   */
  private handleConnectionStateChange(): void {
    if (this.disposed) {
      return
    }
    const state = this.pc.connectionState
    if (state === 'connected') {
      this.clearRecoveryTimers()
      this.restartAttempted = false
      // Notify on first connect only; a successful reconnect must not re-trigger flows like confirmation
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

  // Try one ICE restart; disconnect if already restarted or the restart fails
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
    // The answerer doesn't restart; it waits for the peer's restart offer. The peer may start a full grace period later, so wait longer
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

  // Terminate the connection and notify the caller
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
   * Sends data; must be called serially
   * @param data data to send
   */
  public async sendData(data: ArrayBuffer | string): Promise<void> {
    if (!this.dc) {
      throw new Error('Data channel not initialized')
    }

    return new Promise<void>((resolve, reject) => {
      this.sendPromiseReject = reject
      const dc = this.dc!
      dc.bufferedAmountLowThreshold = 0
      // Strings are encoded to UTF-8 and chunked by bytes, so a UTF-16 surrogate pair is never split and corrupted;
      // the receiver already joins chunks into a Blob and calls text(), so the protocol is unchanged
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
   * Renegotiates SDP
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
   * Sets the remote SDP
   * @param sdp SDP description
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
   * Adds an ICE candidate
   * @param candidate ICE candidate
   */
  public async addICECandidate(candidate: RTCIceCandidateInit): Promise<void> {
    await this.pc.addIceCandidate(candidate)
  }

  /**
   * Swaps in fresh ICE servers, e.g. renewed TURN credentials, without dropping the connection.
   * The other fields must stay unchanged or setConfiguration throws, so start from the current config.
   */
  public setIceServers(iceServers: RTCIceServer[]): void {
    if (this.disposed) {
      return
    }
    try {
      this.pc.setConfiguration({ ...this.pc.getConfiguration(), iceServers })
    } catch (e) {
      console.warn('Could not update ICE servers', e)
    }
  }

  /**
   * Checks whether the connection is down
   * @returns true if connected, otherwise false
   */
  public isConnected(): boolean {
    return this.pc.connectionState === 'connected'
  }

  /**
   * Gets the size of the receive buffer
   * @returns receive buffer size
   */
  public getReceivedBufferSize(): number {
    return this.receiveData.chunks.reduce(
      (size, dat) => size + (typeof dat === 'string' ? dat.length : dat.byteLength),
      0
    )
  }

  /**
   * Closes the peer connection and cleans up resources
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
    // Chain each new task after the previous one
    this.tail = this.tail
      .then(() => this.handler(e))
      .catch((error) => {
        console.error('Error processing event:', error)
      })
  }
}
