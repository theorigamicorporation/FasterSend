# syntax=docker/dockerfile:1

# node:24-alpine, pinned by digest. Dependabot keeps it current.
ARG NODE_IMAGE=node:24-alpine@sha256:06d7adf3e0ef61a13f1d28682726366f97a15aa1888c934d3ecec86c33918b53

FROM ${NODE_IMAGE} AS builder

ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
WORKDIR /app
RUN corepack enable

COPY package.json yarn.lock .yarnrc.yml ./
COPY .yarn ./.yarn
RUN --mount=type=cache,target=/root/.yarn/berry/cache \
    yarn install --immutable

COPY . .
RUN yarn build

FROM ${NODE_IMAGE}

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000

WORKDIR /app
COPY --from=builder /app/.output /app

USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q -O /dev/null "http://127.0.0.1:${PORT}/" || exit 1

CMD ["node", "server/index.mjs"]
