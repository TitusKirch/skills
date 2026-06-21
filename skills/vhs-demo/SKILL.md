---
name: vhs-demo
summary: Creates & maintains a reproducible terminal-demo GIF from a VHS tape.
description: Creates and maintains a scripted, reproducible terminal-demo GIF for a CLI repo using a Charm VHS tape rendered headless via Docker. The `.tape` is the source of truth committed to git; the GIF is regenerated from it and never hand-edited. Use when the user wants to add, record, regenerate or tweak a terminal demo GIF for a kirchDev CLI repo (citty/Bun tools like envprism, forgemap), or asks about VHS tapes, demo.gif, or README terminal previews. Do not use for editing or optimising arbitrary existing GIFs.
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
---

# vhs-demo

Generate a terminal-demo GIF from a [Charm VHS](https://github.com/charmbracelet/vhs) tape, rendered headless in Docker. The tape is committed; the GIF is a build artifact regenerated from it.

> [!IMPORTANT]
> **The tape is the source of truth.** Always edit the `.tape` and re-render. Never hand-edit, re-time, or recompress the GIF — it cannot be reproduced and the next render will overwrite it.

## Why Docker

VHS normally wants a real TTY (and on macOS, Homebrew + sometimes a screen recorder). The official `ghcr.io/charmbracelet/vhs` image renders fully headless, so it works in WSL/root environments with no Homebrew, no TTY, no OBS. Everything below assumes Docker is the only host dependency.

## Naming convention (enforce exactly)

- **Single demo in the repo** → files are `demo.tape` and `demo.gif` in `.github/assets/`. The README references exactly that one `.github/assets/demo.gif`.
- **Multiple demos** → one descriptive name per demo, and the tape + its GIF **always share the base name**: `quickstart.tape`/`quickstart.gif`, `ci.tape`/`ci.gif`, etc.
- **The Dockerfile stays generic**: always `.github/assets/vhs.Dockerfile` — never name it after a demo.

## Quick start

1. **Scaffold** `.github/assets/vhs.Dockerfile` from [`templates/vhs.Dockerfile`](templates/vhs.Dockerfile). Keep or drop the Bun layer (see below).
2. **Scaffold** the tape (`demo.tape` or `<name>.tape`) from [`templates/demo.tape`](templates/demo.tape) and write the choreography for this CLI.
3. **Build the CLI** so the tape runs the built artifact, not the sources: `pnpm build`.
4. **Build the image** (once, or after editing the Dockerfile):
   ```bash
   docker build -f .github/assets/vhs.Dockerfile -t <repo>-vhs .
   ```
5. **Render** (after every tape change):
   ```bash
   docker run --rm -v "$PWD:/vhs" <repo>-vhs .github/assets/demo.tape
   ```
6. **Verify** the GIF (dimensions, duration ≈ sum of sleeps, file size) — see [Verification](#verification).
7. **Wire the README** reference and commit the tape, the Dockerfile, and the regenerated GIF together.

## Does the CLI need Bun?

The official VHS image has **no Bun**. If the CLI is a Bun tool (uses `opentui`, `bun:ffi`, or is started with `bun …`), the render will fail with "bun: command not found". Fix = the derived image in the template that installs Bun (`curl | bash` from bun.sh, with `/root/.bun/bin` on `PATH`).

- **Bun CLI** → keep the Bun layer in `templates/vhs.Dockerfile`.
- **Node CLI** (plain citty, run with `node …`) → delete the Bun layer; the base image already has Node.

## Resolution & render quality

Defaults baked into the tape template:

| Setting         | Default (Full HD) | Lighter alternative |
| :-------------- | :---------------- | :------------------ |
| `Set Width`     | `1920`            | `1280`              |
| `Set Height`    | `1080`            | `720`               |
| `Set FontSize`  | `20`              | `16`                |
| `Set Padding`   | `16`              | `16`                |
| `Set Framerate` | `24`              | `24`                |

> [!IMPORTANT]
> **Cap the framerate.** At 1080p a busy TUI usually can't repaint fast enough to sustain VHS's default **50fps** capture. VHS then drops frames, the GIF plays too fast / janky, and the measured duration is _shorter_ than the sum of your `Sleep`s. `Set Framerate 24` caps the capture rate to something the TUI can actually hold. If verification still shows the duration running short, lower the framerate further (20, then 16) and re-render.

Use the lighter 1280×720 @ FontSize 16 profile when the GIF needs to be smaller/cheaper to load and Full HD detail isn't essential.

## Pitfalls — do's & don'ts

- **`Output` path MUST be relative** (e.g. `.github/assets/demo.gif`). An absolute path like `/vhs/...` is rejected by the VHS parser.
- **Build the CLI first** (`pnpm build`). The tape launches the built artifact (`dist/…`), not the source.
- **Bun CLIs need the Bun image layer** — see above.
- **Work on a throwaway copy of fixtures** if the demo edits/writes files. Copy them to `/tmp` inside the hidden `Hide … Show` block so the working tree stays clean (e.g. `cp -r /vhs/examples /tmp/demo`).
- **Clear pre-filled edit fields before typing.** Popovers/inputs seeded with the current value need emptying first: `Backspace@25ms 40`. Backspace on an empty field is a no-op, so over-counting is safe.
- **Don't end the demo with a quit key.** Quitting makes VHS film the shell teardown (scrollback, the setup command reappearing). Instead end on a `Sleep` holding the frame you want — VHS kills the process at tape end, giving a clean final frame.
- **Hide setup commands.** Wrap `cp`, the CLI launch, and any other plumbing in a `Hide … Show` block so only the demo itself is captured.

## Verification

After each render, confirm the GIF actually matches the tape. Requires `ffprobe`/`ffmpeg` (run them on the host, or via the image: `docker run --rm -v "$PWD:/vhs" --entrypoint ffprobe <repo>-vhs …`).

1. **Dimensions** match the tape's `Set Width`/`Set Height`:
   ```bash
   ffprobe -v error -select_streams v:0 -show_entries stream=width,height \
     -of csv=p=0 .github/assets/demo.gif
   ```
2. **Duration ≈ sum of all `Sleep`s** in the tape (plus typing time). If it's meaningfully shorter, frames were dropped → lower `Set Framerate` and re-render:
   ```bash
   ffprobe -v error -show_entries format=duration -of csv=p=0 .github/assets/demo.gif
   ```
3. **File size** is reasonable for a README asset (rough target: under ~2–3 MB; lighter profile if not). `ls -lh .github/assets/demo.gif`.
4. **(Optional) Eyeball frames** — sample one frame per second to PNGs and look at them:
   ```bash
   ffmpeg -i .github/assets/demo.gif -vf fps=1 /tmp/demo-frames/f%03d.png
   ```
   Check the first frame (no leftover setup), the final frame (the intended end state), and any edit step.

## README wiring

Reference the GIF with a plain image tag near the top of the README (after the hero/badges):

```markdown
![<repo> demo](.github/assets/demo.gif)
```

For multiple demos, embed each under the relevant section with its descriptive name. If the README is being (re)written, the [`write-readme`](../write-readme/SKILL.md) skill owns layout — this skill only owns the asset and its reference.

## Workflow summary

1. **Once / on Dockerfile change** — `docker build -f .github/assets/vhs.Dockerfile -t <repo>-vhs .`
2. **On every demo change** — `pnpm build` → `docker run --rm -v "$PWD:/vhs" <repo>-vhs .github/assets/<name>.tape`
3. **Verify** — dimensions, duration ≈ sleep-sum, file size, optional frame sampling.
4. **README** — confirm/set the `.github/assets/<name>.gif` reference.
5. **Commit** — tape + Dockerfile + regenerated GIF together; the tape is the source of truth.

## Reference

- Tape directives, theme list and a worked envprism walkthrough: [REFERENCE.md](REFERENCE.md).
- Templates to copy: [`templates/vhs.Dockerfile`](templates/vhs.Dockerfile), [`templates/demo.tape`](templates/demo.tape).
