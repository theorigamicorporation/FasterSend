import { useIceIssuer } from '../utils/services'

/**
 * Exchanges a signalling ticket for short-lived TURN credentials.
 * Tickets are only issued to paired peers over /api/connect and die with the WebSocket.
 */
export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'no-store')
  const body = await readBody<{ ticket?: unknown }>(event).catch(() => null)
  const result = await useIceIssuer().handle(body?.ticket)
  setResponseStatus(event, result.status)
  return result.body
})
