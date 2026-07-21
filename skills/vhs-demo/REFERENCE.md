# vhs-demo — reference

Supporting detail for the [`vhs-demo`](SKILL.md) skill: the VHS tape directives you'll actually use, and a worked example from the envprism repo this method was proven on.

## Tape directives cheat-sheet

VHS tapes are line-oriented. The ones that matter for these demos:

### Settings (top of file, before any command)

| Directive           | Purpose                                                               |
| :------------------ | :-------------------------------------------------------------------- |
| `Output <path>`     | Output file. **Relative path only** — absolute paths are rejected.    |
| `Set Width <px>`    | Canvas width. `1920` (Full HD) or `1280` (lighter).                   |
| `Set Height <px>`   | Canvas height. `1080` or `720`.                                       |
| `Set FontSize <n>`  | `20` at 1080p, `16` at 720p.                                          |
| `Set Padding <px>`  | Inner padding around the terminal. `16` is a good default.            |
| `Set Framerate <n>` | Capture fps. **Cap at `24`** at 1080p (default 50 drops frames).      |
| `Set Theme "<id>"`  | Color theme — see list below.                                         |
| `Set TypingSpeed`   | Delay between typed chars, e.g. `55ms`. Lower = faster typing.        |
| `Set LoopOffset`    | Optional: start the GIF loop N% in, so it opens on a populated frame. |

### Actions (the choreography)

| Directive                        | Effect                                                                   |
| :------------------------------- | :----------------------------------------------------------------------- |
| `Type "<text>"`                  | Type a string at `TypingSpeed`.                                          |
| `Enter`                          | Press Return. `Enter 3` presses it 3×.                                   |
| `Sleep <dur>`                    | Hold the current frame, e.g. `Sleep 1.5s`, `Sleep 800ms`.                |
| `Backspace`                      | Delete one char. `Backspace@25ms 40` = 40× at 25ms each (clear a field). |
| `Up` / `Down` / `Left` / `Right` | Arrow keys. `Down@250ms 2` = 2 presses, 250ms apart.                     |
| `Tab`, `Space`, `Escape`         | The obvious keys.                                                        |
| `Ctrl+S`, `Ctrl+C`, etc.         | Modifier chords.                                                         |
| `Hide` … `Show`                  | Everything between is executed but NOT captured. Wrap all setup here.    |

### Timing notes

- `@<dur>` on a repeatable action sets the per-press delay; the trailing number is the repeat count: `Right@250ms 2`.
- The GIF's total duration ≈ sum of the _visible_ `Sleep`s + visible typing time — count only what's actually captured, excluding anything inside a `Hide … Show` block (VHS records nothing there). Verification compares against this.
- End on a `Sleep`, not a quit key — see the pitfalls in SKILL.md.

## Themes

Common readable dark themes that look good in READMEs: `Catppuccin Mocha` (default in the template), `Catppuccin Macchiato`, `Dracula`, `Nord`, `TokyoNight`, `Tomorrow Night`, `OneDark`. Run `docker run --rm <repo>-vhs themes` (or `vhs themes` locally) for the full list. Pick one that matches the repo's brand and keep it consistent across multiple demos in the same repo.

## Worked example — envprism

The method was proven on the [envprism](https://github.com/TitusKirch/envprism) repo (a Bun/citty TUI). Its layout:

```text
.github/assets/
  vhs.Dockerfile   # VHS + Bun layer (envprism uses opentui/bun:ffi)
  demo.tape        # source of truth
  demo.gif         # regenerated artifact, committed
```

README reference (single demo, near the top):

```markdown
![envprism TUI preview](.github/assets/demo.gif)
```

Key choices it demonstrates:

- **Bun layer kept** in the Dockerfile because the CLI is launched with `bun /vhs/dist/bin/envprism.mjs …`.
- **Hidden setup** copies the example fixtures to `/tmp/demo` and launches the TUI inside a `Hide … Show` block, so the repo's working tree stays clean and the setup command never appears on screen.
- **`Set Framerate 24`** — the opentui matrix repaint couldn't hold 50fps at 1080p; capping fixed the "GIF too fast, duration too short" symptom.
- **`Backspace@25ms 40`** before typing a new value into a pre-filled edit popover.
- **No quit key** — the demo ends on `Sleep 1.5s` holding the matrix view; VHS kills the process for a clean final frame instead of filming the shell teardown.
