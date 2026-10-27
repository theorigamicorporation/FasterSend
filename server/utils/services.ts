import { parseTrustProxy } from './clientIP'
import { SignallingHub } from './signalling'
import { IceIssuer, parseTurnConfig } from './turn'

// Do not log IPs, only connection id and events
export function log(level: 'info' | 'warn' | 'error', msg: string) {
  const line = `${new Date().toISOString()} ${level}: ${msg}`
  if (level === 'info') console.log(line)
  else if (level === 'warn') console.warn(line)
  else console.error(line)
}

const positive = (v: unknown, d: number) => (Number(v) > 0 ? Number(v) : d)

// One hub and one issuer per server process; the ICE route checks tickets against the same hub the WebSocket uses
let hub: SignallingHub | null = null
let issuer: IceIssuer | null = null
let trustProxyHops = 0

function init() {
  const config = useRuntimeConfig()
  trustProxyHops = parseTrustProxy(config.trustProxy)
  const turn = parseTurnConfig(config)
  hub = new SignallingHub({
    maxConnectionsPerIp: positive(config.maxConnectionsPerIp, 32),
    receiveFailuresPerMinute: positive(config.receiveFailuresPerMinute, 10),
    issueIceTickets: turn !== null,
    onPaired: (sender, receiver) => log('info', `paired: #${sender} -> #${receiver}`),
    onReject: (id, reason) => log('warn', `rejected: #${id} ${reason}`)
  })
  const h = hub
  issuer = new IceIssuer({
    config: turn,
    isActiveTicket: (ticket) => h.isActiveTicket(ticket),
    mintsPerMinute: positive(config.turnMintsPerMinute, 60),
    onMintError: (err) => log('error', `turn credentials: ${err.message}`)
  })
  log(
    'info',
    turn ? `turn credentials: enabled, ttl ${turn.ttlSeconds}s` : 'turn credentials: disabled'
  )
}

export function useSignallingHub(): SignallingHub {
  if (!hub) init()
  return hub!
}

export function useIceIssuer(): IceIssuer {
  if (!issuer) init()
  return issuer!
}

export function useTrustProxyHops(): number {
  if (!hub) init()
  return trustProxyHops
}
