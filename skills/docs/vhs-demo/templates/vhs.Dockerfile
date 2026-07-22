# VHS image for rendering the README demo GIF, fully headless.
#
# Build:  docker build -f .github/assets/vhs.Dockerfile -t <repo>-vhs .
# Render: docker run --rm -v "$PWD:/vhs" <repo>-vhs .github/assets/demo.tape
#
# The official VHS image renders without a TTY/Homebrew/OBS — ideal for CI and
# WSL/root environments. It ships ffmpeg + Node, but NOT Bun.
FROM ghcr.io/charmbracelet/vhs

# --- Bun layer: KEEP for Bun CLIs (opentui, bun:ffi, `bun …`), DELETE for Node CLIs ---
RUN apt-get update \
  && apt-get install -y --no-install-recommends curl unzip ca-certificates \
  && rm -rf /var/lib/apt/lists/*

RUN curl -fsSL https://bun.sh/install | bash
ENV PATH="/root/.bun/bin:${PATH}"
# --- end Bun layer ---
