# FasterSend

FasterSend is a browser-based tool for sending files and folders directly between two devices over WebRTC. The server only handles signaling: file data goes peer to peer and never passes through it. Folder transfer and folder sync need a browser with the File System Access API and an HTTPS origin.

FasterSend is a hard fork of [FastSend](https://github.com/ShouChenICU/FastSend) by ShouChenICU, maintained by [The Origami Corporation](https://github.com/theorigamicorporation).

> 本项目是 [ShouChenICU/FastSend](https://github.com/ShouChenICU/FastSend) 的硬分叉。中文文档请参阅上游仓库。

## Changes from upstream

- Rebranded to FasterSend. The donation link, mascot avatar, console banner and public transfer counter are removed.
- Self-hostable configuration: the public site URL and other deployment settings come from environment variables instead of being hardcoded.
- Security fixes and hardening of the signaling server.
- Updated dependencies.
- Docker image built for amd64 and arm64, published to GHCR, running as a non-root user.

## Features

- Send single files or whole folders
- Folder sync with add, update and delete selection
- Transfers stay on the local network when both peers are on it
- English and Chinese UI
- Installable as a PWA

## Running with Docker

```bash
docker run -d --name fastersend -p 3000:3000 \
  -e NUXT_PUBLIC_SITE_URL=https://send.example.com \
  ghcr.io/theorigamicorporation/fastersend:latest
```

Or with Docker Compose from a checkout of this repository:

```bash
docker compose up -d
```

The app listens on port 3000. Put it behind a reverse proxy that terminates TLS (Caddy, nginx, Traefik). Browsers only allow folder transfer and sync on HTTPS origins, and the proxy must pass WebSocket upgrades for `/api/connect`.

Image tags:

| Tag            | Source                  |
| -------------- | ----------------------- |
| `latest`       | Latest `v*` release tag |
| `X.Y.Z`, `X.Y` | Release tags            |
| `main`         | Latest commit on `main` |
| `sha-<short>`  | A specific commit       |

## Configuration

All settings are read from environment variables when the server starts, so one image works in every environment.

| Variable | Default | Description |
| --- | --- | --- |
| `NUXT_PUBLIC_SITE_URL` | unset | Public URL of the deployment, e.g. `https://send.example.com`. Used for canonical links and Open Graph image URLs. When unset, the request origin is used. |
| `PORT` | `3000` | Port the server listens on. |
| `HOST` | `0.0.0.0` | Address the server binds to (set in the Docker image). |
| `NUXT_TRUST_PROXY` | `false` | Set to `true` when running behind a reverse proxy so the client IP is taken from `X-Forwarded-For`. Leave it off when the server is exposed directly, since the header can be spoofed. |
| `NUXT_PUBLIC_ICE_SERVERS` | `[{"urls":"stun:stun.l.google.com:19302"}]` | JSON array of [`RTCIceServer`](https://developer.mozilla.org/en-US/docs/Web/API/RTCIceServer) objects (`urls`, optional `username` / `credential`). Add a TURN server so transfers work across restrictive NATs. Invalid JSON falls back to the default. |
| `NUXT_PUBLIC_ICE_TRANSPORT_POLICY` | `all` | `all` or `relay`. `relay` forces traffic through TURN, useful for testing a relay. |
| `NUXT_MAX_CONNECTIONS_PER_IP` | `32` | Maximum concurrent signalling connections per client IP. |
| `NUXT_RECEIVE_FAILURES_PER_MINUTE` | `10` | Failed pickup code lookups allowed per IP per minute before further attempts are refused. |

Example:

```bash
NUXT_PUBLIC_ICE_SERVERS='[{"urls":"stun:turn.example.com:3478"},{"urls":["turn:turn.example.com:3478","turns:turn.example.com:5349"],"username":"user","credential":"secret"}]' \
NUXT_TRUST_PROXY=true \
node .output/server/index.mjs
```

ICE servers are sent to the browser, so any TURN credentials here are visible to every visitor. Use a dedicated TURN user with quotas for this deployment.

## Development

Requires Node.js 24 and Yarn 4 through corepack.

```bash
corepack enable
yarn install
yarn dev        # dev server with hot reload on http://localhost:3000
yarn build      # production build in .output/
node .output/server/index.mjs
```

Build the image locally:

```bash
docker build -t fastersend .
```

## Security

See [SECURITY.md](SECURITY.md) for how to report vulnerabilities.

## License

MIT, see [LICENSE](LICENSE). Original work copyright ShouChenICU, modifications copyright The Origami Corporation.

Based on [FastSend](https://github.com/ShouChenICU/FastSend) by ShouChenICU.
