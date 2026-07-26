# <repo> README demo — rendered with VHS (https://github.com/charmbracelet/vhs)
#
# Regenerate (no local install needed, Docker only):
#   docker build -f .github/assets/vhs.Dockerfile -t <repo>-vhs .
#   docker run --rm -v "$PWD:/vhs" <repo>-vhs .github/assets/demo.tape
#
# The tape is the source of truth — edit the choreography below, re-run, commit
# the new GIF. Never hand-edit the GIF.

# Output MUST be a relative path — VHS rejects absolute paths like /vhs/...
Output .github/assets/demo.gif

Set FontSize 20
Set Width 1920
Set Height 1080
Set Padding 16
# 1080p repaints can't sustain VHS's default 50fps capture, which drops frames
# and speeds up playback — cap the capture rate to something the TUI can hold.
# If the rendered duration runs short of the sum of Sleeps, lower this further.
Set Framerate 24
Set Theme "Catppuccin Mocha"
Set TypingSpeed 55ms

# --- setup (hidden): launch the BUILT artifact; work on a throwaway copy of
#     fixtures so any saves don't dirty the repo. Build first (e.g. `pnpm build` / `bun run build`). ---
Hide
Type "cp -r /vhs/examples /tmp/demo && bun /vhs/dist/bin/<repo>.mjs <subcommand> /tmp/demo"
Enter
Sleep 2.5s
Show

# --- the UI is up: let the first frame land ---
Sleep 1.8s

# --- choreograph the demo here ---
# Example: navigate, edit a field, save.
#
# Down@250ms 2
# Right@250ms 2
# Sleep 700ms
# Type "e"
# Sleep 800ms
# # Edit fields are pre-filled with the current value — clear before typing.
# # Backspace on an empty field is a no-op, so over-counting is safe.
# Backspace@25ms 40
# Sleep 300ms
# Type "https://example.com"
# Sleep 900ms
# Enter
# Sleep 1s
# Ctrl+S
# Sleep 1.4s

# --- end on the frame you want; do NOT press a quit key (that films the shell
#     teardown). VHS kills the process at tape end → clean final frame. ---
Sleep 1.5s
