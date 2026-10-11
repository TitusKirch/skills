# Headless VHS renderer for Node and Bun CLIs (linux/amd64 and linux/arm64).
# Build:  docker build --pull --no-cache -f .github/assets/vhs.Dockerfile -t <repo>-vhs .
# Render: docker run --rm --cap-drop=ALL --security-opt no-new-privileges:true \
#           -v "$PWD:/vhs" <repo>-vhs .github/assets/demo.tape
# The base digest fixes Node; rebuild to refresh Debian security packages.
ARG GO_IMAGE=golang:1.27.2-trixie@sha256:e58d6f83b3416618d8bcac2b3dde1b7f7e3c4a77d25e88637f8bbae81536c48d
ARG NODE_IMAGE=node:26.11.1-trixie-slim@sha256:193fe51b64e77981119c98c2002c9e32a70e2f006fb4d25068ce0558998917f0

FROM ${GO_IMAGE} AS vhs-build
ARG VHS_VERSION=0.12.1
ARG VHS_COMMIT=24fa2254a9806091e6ee6a980e9f3bcfe0a9ba53
ARG VHS_SOURCE_SHA256=7931e86a186ec3dbeb2fee3b3ad7b900f9f07c347130817b9d3ed21f2cdccf22
# The release binary embeds vulnerable Go/x/net versions. Rebuild the same source
# with the fixed toolchain and a pinned security update, verified by Go's checksum database.
ARG VHS_X_NET_VERSION=v0.60.0
ENV GOTOOLCHAIN=local
WORKDIR /src
RUN set -eu; \
  curl -fsSL "https://github.com/charmbracelet/vhs/archive/${VHS_COMMIT}.tar.gz" -o /tmp/vhs.tar.gz; \
  printf '%s  %s\n' "$VHS_SOURCE_SHA256" /tmp/vhs.tar.gz | sha256sum -c -; \
  tar -xzf /tmp/vhs.tar.gz --strip-components=1 -C /src; \
  go mod edit "-require=golang.org/x/net@${VHS_X_NET_VERSION}"; \
  CGO_ENABLED=0 go build -mod=mod -trimpath \
    -ldflags "-s -w -X main.Version=v${VHS_VERSION} -X main.CommitSHA=${VHS_COMMIT}" \
    -o /out/vhs .

FROM ${NODE_IMAGE} AS ttyd-build
# ttyd 1.7.7: build its immutable source against current Debian shared libraries.
ARG TTYD_COMMIT=40e79c706be14029b391f369bee6613c31667abb
ARG TTYD_SHA256=1f6f53a5021a2cee4af9b975f3dc7a3185bd261c23a84f7b680285f6c1a50341
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
     build-essential ca-certificates cmake curl pkg-config \
     libjson-c-dev libssl-dev libuv1-dev libwebsockets-dev \
  && rm -rf /var/lib/apt/lists/*
RUN set -eu; \
  curl -fsSL "https://github.com/tsl0922/ttyd/archive/${TTYD_COMMIT}.tar.gz" -o /tmp/ttyd.tar.gz; \
  printf '%s  %s\n' "$TTYD_SHA256" /tmp/ttyd.tar.gz | sha256sum -c -; \
  mkdir /tmp/ttyd; \
  tar -xzf /tmp/ttyd.tar.gz --strip-components=1 -C /tmp/ttyd; \
  cmake -S /tmp/ttyd -B /tmp/ttyd/build -DCMAKE_BUILD_TYPE=Release; \
  cmake --build /tmp/ttyd/build --parallel 2; \
  cmake --install /tmp/ttyd/build

FROM ${NODE_IMAGE} AS renderer

ARG TARGETARCH

RUN apt-get update \
  && apt-get upgrade -y \
  && apt-get install -y --no-install-recommends \
     bash ca-certificates chromium curl ffmpeg fonts-dejavu-core \
     fonts-firacode fonts-jetbrains-mono fonts-noto-color-emoji unzip \
     libjson-c5 libuv1t64 libwebsockets19t64 libwebsockets-evlib-uv \
  && rm -rf /var/lib/apt/lists/*

COPY --from=ttyd-build /usr/local/bin/ttyd /usr/local/bin/ttyd
COPY --from=ttyd-build /tmp/ttyd/LICENSE /usr/local/share/doc/ttyd/LICENSE

COPY --from=vhs-build /out/vhs /usr/local/bin/vhs
COPY --from=vhs-build /src/LICENSE /usr/local/share/doc/vhs/LICENSE

# The tape runs an already-built CLI. Package-manager installs belong on the host;
# remove unused npm (and its vulnerable dependency tree) from the renderer.
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx

# --- Bun layer: KEEP for Bun CLIs, DELETE for Node CLIs ---
ARG BUN_VERSION=1.4.2
ARG BUN_SHA256_AMD64=c678040f14fe0440eb839d37cbd0ce4c051a32da72806ac97de6a6aab6bf728f
ARG BUN_SHA256_ARM64=54328bbc2d9c8e0c9f892c544d66c57a83b84139e34909e5ee81758f1ac8fda7

RUN set -eu; \
  case "$TARGETARCH" in \
    amd64) target=bun-linux-x64-baseline; checksum="$BUN_SHA256_AMD64" ;; \
    arm64) target=bun-linux-aarch64; checksum="$BUN_SHA256_ARM64" ;; \
    *) echo "unsupported architecture: $TARGETARCH" >&2; exit 1 ;; \
  esac; \
  curl -fsSL "https://github.com/oven-sh/bun/releases/download/bun-v${BUN_VERSION}/${target}.zip" -o /tmp/bun.zip; \
  printf '%s  %s\n' "$checksum" /tmp/bun.zip | sha256sum -c -; \
  unzip -q /tmp/bun.zip -d /tmp; \
  install "/tmp/${target}/bun" /usr/local/bin/bun; \
  rm -rf "/tmp/${target}" /tmp/bun.zip
# --- end Bun layer ---

# Chromium runs inside Docker; the renderer's local server stays on loopback.
ENV HOME=/tmp XDG_CONFIG_HOME=/tmp/config XDG_CACHE_HOME=/tmp/cache \
    VHS_NO_SANDBOX=true VHS_HOST=127.0.0.1 VHS_PORT=1976
WORKDIR /vhs
ENTRYPOINT ["vhs"]
