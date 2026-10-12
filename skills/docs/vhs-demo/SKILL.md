---
name: vhs-demo
metadata:
  summary: Creates and maintains reproducible README or docs terminal-demo GIFs from VHS tapes.
description: Creates and maintains a scripted, reproducible terminal-demo GIF for a CLI repo from a Charm VHS tape rendered headless via Docker — the .tape is the committed source of truth, the GIF a regenerated artifact. Use when the user wants to add, record, regenerate or tweak a terminal demo GIF for a kirchDev CLI repo (citty/Bun tools like envprism, forgemap), or asks about VHS tapes, demo.gif, README terminal previews, or terminal captures for docs pages. Do not use for editing or optimising arbitrary existing GIFs.
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

VHS normally wants a real TTY (and on macOS, Homebrew + sometimes a screen recorder). The template builds a headless renderer on a digest-pinned Node/Debian base, installs current Chromium/ffmpeg packages and checksum-verified Bun, builds checksum-pinned VHS source with a patched Go toolchain and network dependency, and builds ttyd against current system libraries. It works in WSL/root environments with no Homebrew, no TTY, no OBS. Docker is the only host dependency; supported targets are `linux/amd64` and `linux/arm64`.

## Destination & naming convention

Resolve the intended **README or docs context before scaffolding**. An optional caller such as `write-docs` passes the target page, context, repo-relative output path, subject/ref and any required language variant; honor that target. Without a target, keep the README default.

- **README demo** → paired tape + GIF under `.github/assets/`.
- **Docs demo** → paired tape + GIF under `docs/_assets/`. This is a non-section directory: no numeric prefix, `index.md` or navigation entry.
- **One demo at the selected destination** → `demo.tape` / `demo.gif`; **multiple demos** → descriptive paired base names, e.g. `quickstart.tape` / `quickstart.gif` or `ci.tape` / `ci.gif`. Honor an explicit output name even for the first demo.
- **Shared media** → reuse an existing artifact when README and docs show the same demo; do not create a second copy solely to embed it elsewhere.
- **Language-dependent demos** → explicitly capture and verify variants when needed, e.g. `docs/_assets/de-DE/quickstart.tape` / `quickstart.gif`. Shared language-neutral media is referenced across locale pages. Translate alt text and captions; a translation sweep never produces captures.
- **The Dockerfile stays generic**: `.github/assets/vhs.Dockerfile`, shared by both destinations — never named after a demo.

Consumer-specific tapes and regenerated GIFs belong in the consumer repo, never in the published skill. The paired tape is committed, but only the GIF is published as docs media; tapes, scripts and Dockerfiles are not image outputs.

## Quick start

1. **Resolve the target** and set repo-relative paths once. README default:
   ```bash
   tape=.github/assets/demo.tape
   gif=.github/assets/demo.gif
   ```
   Docs example:
   ```bash
   tape=docs/_assets/quickstart.tape
   gif=docs/_assets/quickstart.gif
   ```
   These variables stay set for render and verification commands below; do not use the default README path after selecting a docs target.
2. **Scaffold** `.github/assets/vhs.Dockerfile` from [`templates/vhs.Dockerfile`](templates/vhs.Dockerfile). Reuse it when already present; keep or drop the Bun layer (see below).
3. **Scaffold** the selected tape from [`templates/demo.tape`](templates/demo.tape), set its `Output` to the exact selected `gif` path, and write the choreography for this CLI. The template's `Output` is the README default and must be replaced for docs, named or localized targets.
4. **Build the CLI** so the tape runs the built artifact, not the sources: run the repo's build (e.g. `pnpm build` / `bun run build`).
5. **Build the image** (once, or after editing the Dockerfile):
   ```bash
   docker build --pull --no-cache -f .github/assets/vhs.Dockerfile -t <repo>-vhs .
   ```
6. **Render** (after every tape change), from the consumer repo root:
   ```bash
   docker run --rm --cap-drop=ALL --security-opt no-new-privileges:true \
     -v "$PWD:/vhs" <repo>-vhs "$tape"
   ```
7. **Verify** the selected GIF (dimensions, duration ≈ sum of sleeps, file size, captured content) — see [Verification](#verification). A committed tape establishes reproducibility, not freshness; render against the intended CLI/ref and check the result.
8. **Wire the target page's image reference** and commit the tape, shared Dockerfile and regenerated GIF together. Report the source path, verified output path, subject/ref and reference to the caller. The writing skill owns page inclusion and layout.

## Does the CLI need Bun?

The template includes a **version-pinned Bun layer** for CLIs using `opentui`, `bun:ffi`, or `bun …`. The archive is checked against its pinned SHA-256 before installation; the amd64 build uses Bun's baseline binary. A Bun version change must update both architecture checksums together. No downloaded installer script is executed.

- **Bun CLI** → keep the Bun layer in `templates/vhs.Dockerfile`.
- **Node CLI** (plain citty, run with `node …`) → delete the Bun layer; the image already has Node. npm/npx are removed from the renderer; install dependencies and build the CLI on the host before rendering.

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

- **`Output` path MUST be relative** (e.g. `.github/assets/demo.gif` or `docs/_assets/quickstart.gif`). An absolute path like `/vhs/...` is rejected by the VHS parser.
- **Build the CLI first** — run the repo's build (e.g. `pnpm build` / `bun run build`). The tape launches the built artifact (`dist/…`), not the source.
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
     -of csv=p=0 "$gif"
   ```
2. **Duration ≈ sum of the _visible_ `Sleep`s** (plus visible typing time). Count only actions that are actually captured — exclude anything inside a `Hide … Show` block, since VHS records nothing there, so those sleeps/typing never reach the GIF. If it's meaningfully shorter than that, frames were dropped → lower `Set Framerate` and re-render:
   ```bash
   ffprobe -v error -show_entries format=duration -of csv=p=0 "$gif"
   ```
3. **File size** is reasonable for a page asset (rough target: under ~2–3 MB; lighter profile if not). `ls -lh "$gif"`.
4. **(Optional) Eyeball frames** — sample one frame per second to PNGs and look at them:
   ```bash
   ffmpeg -i "$gif" -vf fps=1 /tmp/demo-frames/f%03d.png
   ```
   Check the first frame (no leftover setup), the final frame (the intended end state), and any edit step.

## Embedding in README or docs

Reference the GIF with a plain image tag near the top of the README (after the hero/badges):

```markdown
![<repo> demo](.github/assets/demo.gif)
```

A docs page at `docs/2.guides/1.quickstart.md` references its selected artifact relative to the authored page:

```markdown
![Quickstart terminal demo](../_assets/quickstart.gif)
```

A localized page at `docs/de-DE/2.guides/1.quickstart.md` references shared media as `../../_assets/quickstart.gif`, or its explicitly captured variant as `../../_assets/de-DE/quickstart.gif`. Translate its alt text/caption. To reuse the README artifact from the default docs page, reference `../../.github/assets/demo.gif`; verify that the selected renderer can publish that location before reporting the rendered-page reference complete. Duxt's automatic docs media bridge publishes `docs/_assets/` image outputs; a shared artifact intended for that bridge should live there, with the README referencing `docs/_assets/quickstart.gif`.

For multiple demos, embed each under the relevant section with its descriptive name. `write-readme` or `write-docs` owns layout — this skill owns the source, artifact, verification and correct reference. Verify the page-relative path exists and the rendered image resolves where a site is involved; absolute page-link rules do not apply to image paths.

## Steady-state loop (after the first run)

Quick start covers the first run; afterwards only the cadence differs:

- **Image** — rebuild after Dockerfile changes and before recording a new demo with `--pull --no-cache`, so the apt layers actually refresh Debian security packages. `--pull` alone does not invalidate cached layers on a digest-pinned base. Keep the Node/Go base digests, source commits, dependency pins, release versions and checksums together when updating; scan the built image with `trivy image <repo>-vhs` or the repo's existing container scanner. A scanner finding is reported separately from a successful render.
- **Every demo change** — run the repo's build (e.g. `pnpm build` / `bun run build`) → re-render → [verify](#verification).
- **Commit** the tape, Dockerfile, and regenerated GIF together — the tape is the source of truth.

## Reference

- **Open it while writing or editing the `.tape`** — when the directive you need is not already in the tape in front of you, when a theme has to be named exactly, or when a first demo needs a worked walkthrough to take its pacing from: [REFERENCE.md](REFERENCE.md).
- **Copy these on the first run, before the quick start assumes they exist**: [`templates/vhs.Dockerfile`](templates/vhs.Dockerfile), [`templates/demo.tape`](templates/demo.tape).
