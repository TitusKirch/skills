---
name: write-readme
metadata:
  summary: Generates project READMEs in the kirchDev house style.
description: Generates project READMEs in the kirchDev house style — centered hero header with emoji + bold tagline, a one-liner code-snippet hook, feature bullets with prescribed section emojis, and standardized closing sections (Versioning, License). Use when the user asks to write, draft, scaffold, or regenerate a README.md for a kirchDev / IT-Dienstleistungen Titus Kirch repository, or when starting a new repo that needs its top-level README. Do not use for editing arbitrary unrelated READMEs.
allowed-tools:
  - Read
  - Write
  - Edit
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
> **Installation / Quick start lead, then Features** — surfacing the install/run command near the top lets a reader reach it in ~30 seconds. Merging Installation + Quick start into a single **Install & run** section is acceptable (and is what `compact-readme` produces from a scaffolded file).

## Style rules

- **Hero** is wrapped in `<div align="center">…</div>`, followed by `---`.
- **Tagline** is one line, bold, em-dashes for emphasis. No period unless it's a full sentence.
- **Hook** uses a real, copy-pasteable snippet — the most representative thing the project does in 1–6 lines. Follow with one sentence ending in "That's it. …" pattern.
- **Feature bullets**: `- **{emoji} Title** — sentence.` Emojis act as scannable column-1 indicators.
- **Tables**: left-aligned (`| :--- |`).
- **Callouts**: use `> [!TIP]`, `> [!IMPORTANT]`, `> [!NOTE]` — never plain blockquotes.
- **Never mirror a file the repo already ships.** A README's job is the shortest path from landing to running — not a second copy of `package.json`'s scripts, a schema's option table, an `.env.example`, or a workflow. Show the handful of values a newcomer needs, then link the file for the rest. A copied table is wrong at the next commit and nothing will tell you; the repo, not the README, is the source of truth.
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

<skills-plan>

## Presenting the plan

Everything this skill puts in front of a human — plan, preview, candidate list, findings report —
is read **once, in a terminal**, and answered there. So **every section of it renders on arrival**,
with no interaction needed to reveal it: prose, lists, tables, fenced code.

**Never fold content behind a control.** `<details>`/`<summary>` is a browser widget, and a
terminal has no way to open it: the summary line prints and everything under it does not. The plan
then arrives as headings with nothing beneath them, and the failure is silent on **both** sides —
the skill believes it reported, and the reader sees no marker saying anything is missing, so a
human confirms a plan whose contents never reached them. What gets folded is whatever ran long,
which is to say the part the decision actually rested on. The same holds for anything else needing
a click: a tab strip, an accordion, a "show more".

**Length is handled by shortening, never by hiding.** This is a fixed rule of the skill, not a
per-run judgement, so it holds however long the list runs. Trim to what the decision needs, group
the rest by something the reader already thinks in (ecosystem, kind, verdict) with a count per
group, or split it across sections. What is left out is left out **visibly**: say how many, why,
and the exact command that shows the rest.

**This binds what the skill presents, not what it writes.** A `<details>` block inside a README, an
issue body, a pull request description or a docs page is rendered by a browser and is entirely
legitimate there. The rule is about the message a human reads to decide — never about the content
of a file.

</skills-plan>

## Guardrails

- **Plan first; write only after confirmation** — the draft and its optional sections are agreed before the file lands (Workflow step 3).
- **Keep the generated README attribution-free** — no agent self-naming, no `Generated with`/🤖 line, no session URL. A README is the project's front door, not a record of who wrote it.
- **No secrets** — the hook is real, copy-pasteable code: scan it for tokens, keys and `.env` values, and show a placeholder rather than a live one.
- **Only the requested action** — this skill owns `README.md`. It never edits the files the README links to, and never commits.

## Reference

- **Open it the moment a hero, a section, a feature bullet or a badge needs its house-style value.** Every one of them is a catalogue lookup, never a choice a run makes for itself — a guessed emoji or an invented badge colour is exactly the drift this skill exists to prevent: [REFERENCE.md](REFERENCE.md).
- **Copy this first and fill it in place** — the canonical section order is already in it: [templates/README.template.md](templates/README.template.md).
