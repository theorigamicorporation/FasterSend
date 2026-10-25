/**
 * Reads the runtime ICE config (NUXT_PUBLIC_ICE_SERVERS / NUXT_PUBLIC_ICE_TRANSPORT_POLICY)
 */
export function useIceConfig(): {
  iceServers: RTCIceServer[]
  iceTransportPolicy?: RTCIceTransportPolicy
} {
  const config = useRuntimeConfig().public
  return {
    iceServers: parseIceServers(config.iceServers),
    iceTransportPolicy: parseIceTransportPolicy(config.iceTransportPolicy)
  }
}
