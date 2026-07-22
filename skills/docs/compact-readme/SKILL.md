---
name: compact-readme
summary: Slims down an existing overstuffed README without losing information.
description: Compacts an existing, overstuffed README so the landing view reaches the install/run command in ~30 seconds without losing any information — detail moves into <details> blocks, sections merge, duplication is deduped, and the kirchDev house style is preserved. The complement to write-readme (which scaffolds a new README from scratch). Use when a README is too long/dense/repetitive and the user wants it tightened, condensed, decluttered, or made scannable. Do not use to create a new README.
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
---

# compact-readme

Take an existing README that has grown into a wall of text and tables, and tighten the landing view so a reader reaches the install/run command in ~30 seconds — while preserving every fact by relocating (never deleting) detail into `<details>` blocks and merged paragraphs.

> [!IMPORTANT]
> **This is the complement to [`write-readme`](../write-readme/SKILL.md).** `write-readme` = scaffold a new README from scratch in the kirchDev house style. `compact-readme` = slim down an _existing_ one. If there is no README yet, stop and use `write-readme` instead.

> [!IMPORTANT]
> **Never delete content.** Everything you cut from the visible view must land somewhere — folded into a `<details>` block or merged into an existing paragraph. The goal is fewer _visible_ lines, not less information.

## Goal & rule of thumb

- The un-collapsed (visible, outside `<details>`) line count should roughly **halve**, with zero information loss.
- Reference detail stays in the file, just collapsed or consolidated.
- Reference: the envprism README went from ~194 → ~98 visible lines by folding the feature list + config tables into `<details>`, merging Install+Quickstart, and deduping the tagline / runtime note / "round-trip preserving" claim. See [REFERENCE.md](REFERENCE.md) for the worked before/after.

## Step 1 — Diagnose (measure before you cut)

1. **Read the whole README** and count total lines (`wc -l README.md`).
2. **Attribute the bulk** — which sections eat the most lines? Usual culprits: long feature bullet walls and big Configuration/Options tables.
3. **Spot redundancy**, e.g.:
   - the tagline restated in hero + hook + a later sentence,
   - a runtime/requirement note ("needs Bun, `npx` won't work") repeated across hero, install, and a callout,
   - a repeated core claim ("round-trip preserving", "zero-config") stated in several places,
   - **a block that mirrors a file the repo ships** — every config option out of a schema, every script out of `package.json`, every env var out of `.env.example`. This one is not merely long: it is duplicated state, so it is already wrong somewhere or will be at the next commit.
4. **Check the house style** is intact (centered hero, section emojis, Versioning/License closers) — preserve whatever is already correct.

Present the diagnosis (line count, biggest sections, redundancies found) and the planned cuts **before** editing — see [Interaction](#interaction).

## Step 2 — Transform

Apply these, in roughly this priority:

1. **Feature list → ~8–10 real highlights + a `<details>` superset.** Trim the visible list to genuine highlights. Move implementation detail (regexes, internal parser rules, full theme/color-key lists, every single keybinding) out of the highlights. Put the **complete, categorized** list into `<details><summary>Full feature list</summary>…</details>` as a superset — nothing is lost.
2. **Configuration/options → teaser + minimal example + `<details>`.** Keep a short teaser sentence and one minimal config example visible; collapse all option tables and theme/color keys into `<details><summary>All configuration options</summary>…</details>`. Keep everything in **one file** — do not spin out to `docs/` unless the user explicitly asks.
3. **Merge Install + Quick start** into one "Install & run" section. State the runtime requirement **exactly once**, as a `> [!IMPORTANT]` callout in that block, including the concrete gotcha (e.g. "`npx` won't work").
4. **Dedupe repeated claims** — pick the single best spot for each restated tagline / requirement / core claim and remove the echoes.
5. **A block mirroring a file → the values that matter + a link.** Where a table was transcribed from a schema, `package.json` or `.env.example`, `<details>` is the wrong tool: collapsing a copy keeps its drift and merely hides it. Keep the two or three values a newcomer actually sets, then point at the file that owns the rest. **Nothing is lost** — the content was never the README's to hold; it is going back to the one place that cannot go stale. Name the file in the plan so the move is visible.
6. **Reduce bold density.** If every bullet is fully `**bold**`, nothing stands out. Bold only ~the first phrase of each bullet.
7. **Tighten prose** — e.g. a Why/Problem section from 3 paragraphs to 2 — but keep the author's voice; do not flatten it into generic AI slop.

## Step 3 — Target structure (order)

```text
Hero (logo, tagline, badges, optional demo GIF)
Hook (1 code line + ~2 sentences)
🤔 Why (problem → solution, tight)
📦 Install & run (merged; requirement callout ×1)
✨ Features (~10 highlights + <details> full list)
[optional] 🧪 CI / scripting (short standalone block, if it deserves one)
⚙️ Configuration (teaser + example + <details> tables)
🤝 Contributing
🛣️ Versioning
📄 License
```

Use the prescribed section emojis from the [`write-readme` REFERENCE](../write-readme/REFERENCE.md#section-emoji-catalogue).

## Guardrails

- **Never delete content** — relocate into `<details>`, merge into a paragraph, or (only for a block copied out of a file the repo ships) replace it with a link to that file. Content leaves the README only when something else in the repo already holds it.
- **Preserve the house style strictly** — centered hero in `<div align="center">`, section emojis, Versioning/License at the end. For kirchDev repos, treat [`write-readme`](../write-readme/SKILL.md) as the style source of truth.
- **Leave these untouched**: badges, links, the demo GIF, and the license/author line.
- **Factual accuracy** — never rewrite or invent defaults, flags, or option values. Copy tables **verbatim**; only move them.
- **Formatter check** — if the repo has an oxfmt/Prettier config, confirm `README.md` is excluded from the formatter (kirchDev excludes it in `lint-staged.config.js`, because oxfmt reflows the centered hero and `<details>` markup). If it is **not** excluded, run the formatter after editing so you don't leave a diff CI will reject.
- **Report visible-line delta** after the rebuild: before vs after (outside `<details>`), plus a short "what moved where" list.

## When not to / when to ease off

- **Don't create new READMEs** — that's `write-readme`.
- **If the README is already lean**, don't force structural surgery. Just smooth redundancy and bold density, and say so in the report.

## Interaction

Before writing, show the **diagnosis + planned cuts**, then ask:

1. **Aggressiveness** — light / medium / aggressive.
2. **Full feature list** — collapse into `<details>` _(recommended default)_ / drop entirely / move to `docs/` (only offer `docs/` when the repo isn't docs-disabled — skip it if `.tituskirch-skills.json` sets `docs: false`).

Then apply, and end with the before/after visible-line count and the "what moved where" summary.

## Reference

- Transformation playbook, `<details>` patterns, and the envprism before/after: [REFERENCE.md](REFERENCE.md).
- House-style source of truth (emojis, badges, closers): [`write-readme`](../write-readme/SKILL.md) and its [REFERENCE.md](../write-readme/REFERENCE.md).
