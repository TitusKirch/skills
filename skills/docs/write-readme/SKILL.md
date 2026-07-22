---
name: write-readme
summary: Generates project READMEs in the kirchDev house style.
description: Generates project READMEs in the kirchDev house style — centered hero header with emoji + bold tagline, a one-liner code-snippet hook, feature bullets with prescribed section emojis, and standardized closing sections (Versioning, License). Use when the user asks to write, draft, scaffold, or regenerate a README.md for a kirchDev / IT-Dienstleistungen Titus Kirch repository, or when starting a new repo that needs its top-level README. Do not use for editing arbitrary unrelated READMEs.
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
---

# write-readme

## Quick start

1. Ask the user for the **project name**, a **one-sentence tagline**, the **hero emoji** (🛡️ packages, 🏗️ infrastructure, 📚 docs, 🧰 tooling, etc.), and a **representative code snippet** (the "hook").
2. Copy `templates/README.template.md` and fill the placeholders.
3. Add only the sections the project actually needs — but keep them in the canonical order and use the prescribed emoji.
4. Show the draft and ask which optional sections to add/drop before writing the file.

## Canonical structure (always in this order)

| #   | Section            |   Emoji   | When to include                                                      |
| --- | :----------------- | :-------: | :------------------------------------------------------------------- |
| 1   | Hero block         | (project) | Always — `<div align="center">` + `# {emoji} {name}` + bold tagline. |
| 2   | Badges             |     —     | Only for public packages (Packagist / npm / CI / license).           |
| 3   | Hook               |     —     | Always — fenced code block + a single "That's it. …" sentence.       |
| 4   | Installation/Stack |    📦     | Always (label "Installation" for packages, "Stack" for infra/apps).  |
| 5   | Quick start/Setup  |    🚀     | Always (label "Quick start" for packages, "Setup" for infra/apps).   |
| 6   | Features           |    ✨     | Always — bullet list, each bullet `**{emoji} Title** — body.`        |
| 7   | Domain sections    |  varies   | As many as needed; pick emoji from the catalogue in REFERENCE.md.    |
| 8   | Contributing       |    🤝     | If the repo accepts external PRs.                                    |
| 9   | Versioning         |    🛣️     | Always — link to CHANGELOG.md and release-please.                    |
| 10  | License            |    📄     | Always — link to LICENSE + author/org line.                          |

> [!NOTE]
> **Installation / Quick start lead, then Features** — surfacing the install/run command near the top lets a reader reach it in ~30 seconds. Merging Installation + Quick start into a single **Install & run** section is acceptable (and is what [`compact-readme`](../compact-readme/SKILL.md) produces from a scaffolded file).

## Style rules

- **Hero** is wrapped in `<div align="center">…</div>`, followed by `---`.
- **Tagline** is one line, bold, em-dashes for emphasis. No period unless it's a full sentence.
- **Hook** uses a real, copy-pasteable snippet — the most representative thing the project does in 1–6 lines. Follow with one sentence ending in "That's it. …" pattern.
- **Feature bullets**: `- **{emoji} Title** — sentence.` Emojis act as scannable column-1 indicators.
- **Tables**: left-aligned (`| :--- |`).
- **Callouts**: use `> [!TIP]`, `> [!IMPORTANT]`, `> [!NOTE]` — never plain blockquotes.
- **License footer** — copy the closing footer verbatim from [`templates/README.template.md`](templates/README.template.md), the single source for the Versioning/License blocks and the `© …` author line. Never retype the author/license string by hand.

## Workflow

1. **Gather** — name, tagline, hero emoji, hook snippet, public-or-internal, list of needed domain sections.
2. **Draft** — fill `templates/README.template.md`; pick domain-section emojis from [REFERENCE.md](REFERENCE.md).
3. **Review** — present the draft, confirm which optional sections to keep, then write the file.
4. **Gap report** — see below.

## Gap report (mandatory final step)

After writing the README, end the turn with a short report listing anything that wasn't covered by [REFERENCE.md](REFERENCE.md):

- **Sections without a prescribed emoji** — any H2 you had to invent an emoji for because it isn't in the section catalogue.
- **Badges without a palette color** — any badge purpose that didn't fit `primary` / `neutral` / `success` / `laravel` / `php` / `node` / `warning`.
- **Hero-emoji gaps** — if you fell back to 📦 because no project-type matched.

Format:

```text
Gap report — improvements for write-readme:
- Section "{name}" — no catalogue entry; used {emoji} as ad-hoc choice.
- Badge "{purpose}" — no palette token; used color={hex}.
- Hero type "{description}" — no catalogue entry; used {emoji}.
```

If everything was covered, say so: `Gap report: no gaps — every section and badge matched the catalogue.`

**Only report; do not edit REFERENCE.md or this skill yourself.** The user decides whether to fold the gaps back in.

## Reference

- Section emoji catalogue, badge templates and color palette: see [REFERENCE.md](REFERENCE.md).
- Skeleton to copy: [templates/README.template.md](templates/README.template.md).
