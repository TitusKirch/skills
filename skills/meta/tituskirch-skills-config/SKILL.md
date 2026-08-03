---
name: tituskirch-skills-config
metadata:
  summary: Sets up, reconciles, and drift-checks .tituskirch-skills.json, the shared config the other TitusKirch skills read.
description: Creates, reconciles, and drift-checks `.tituskirch-skills.json` — the committed, repo-root config the other TitusKirch skills read to pick forges, trackers, languages, and conventions per repo. Routes by state — guided setup when the config is missing or incomplete, desired-state reconcile against the schema when it exists, and a report-only drift check for config gone stale. Detects repo signals to propose defaults, previews a plan, and writes only after confirmation. Also fires proactively after a skill, scope, branch, or label is renamed or removed in the session, to catch the config drifting. Use when the user wants to set up, configure, onboard, fix, or drift-check the TitusKirch skills config, mentions `.tituskirch-skills.json`, or says things like "configure the skills", "set up the config", "onboard this repo", "check the config", "keep the config in sync", "skills config einrichten", "config reparieren".
allowed-tools:
  - Read
  - Write
  - Edit
  - WebFetch
  - Bash(jq:*)
  - Bash(printf:*)
  - Bash(curl:*)
  - Bash(git remote get-url:*)
  - Bash(git rev-parse:*)
  - Bash(gh auth status:*)
  - Bash(gh label list:*)
  - Bash(gh issue list:*)
  - Bash(gh api:*)
---

# tituskirch-skills-config

`.tituskirch-skills.json` at the repo root is the optional, committed config the other TitusKirch skills read — each setting resolved per repo as **config → native → built-in default**. This skill owns the file's **lifecycle**: create it, grow it, reconcile it. It does **not** own the schema. Every key, type, enum, and default lives once in [`tituskirch-skills.schema.json`](https://raw.githubusercontent.com/TitusKirch/skills/main/tituskirch-skills.schema.json) — the **single source of truth**. Read it to validate and enumerate keys; never restate it here or copy defaults into a repo's config. **Fetch it raw** (`curl` via Bash) — WebFetch only summarizes and drops the exact enums. **Staleness guard** — the `main` URL can be CDN-cached or predate the installed skill, so if the fetched schema lacks a section this skill documents (`commit` / `pr` / `issue` / `release` / `mergeDeps` / `pruneBranches` / `docs` / `work`), your copy is stale; re-fetch cache-busted before telling the user a key or section is unsupported.

## Jobs — pick by state + intent

| State / intent                                                      | Job                      |
| :------------------------------------------------------------------ | :----------------------- |
| No `.tituskirch-skills.json`                                        | **setup**                |
| Config exists, a section absent/incomplete + "add X"                | **setup** (that section) |
| "validate / align / fix / reconcile the config"                     | **reconcile**            |
| "does the config still match the repo?" — after a rename/add/remove | **check** (report-only)  |

Verb shortcuts: `/tituskirch-skills-config setup`, `/tituskirch-skills-config reconcile`, `/tituskirch-skills-config check`. Otherwise infer from state and the request. **Always: plan → confirm → write.**

**Proactive drift check** — some keys point at repo reality (a branch, a template path, a label or team, the skill / package folders behind `commit.scopeVocab`) and go stale silently when the repo changes. When you add, rename, or remove a skill or package, retarget the integration branch, or change a template or lifecycle label in the same session, run **check** yourself and offer to reconcile — don't wait to be asked. Trigger on the structural change, not on ordinary edits.

## Resolution order — keep the config minimal

`config → native → built-in default` means an absent key or section is **defaults, not off**. So write **only** the essentials and the choices the user actually makes; never write a key set to its own default — it is a no-op that only invites drift. Every skill section — `commit`, `pr`, `release`, `mergeDeps`, `pruneBranches`, `issue`, `docs`, `work` — accepts an explicit `false` to **disable** that skill for the repo, distinct from an absent block, which just falls back to defaults. Use `false` when a skill can't or shouldn't run here (e.g. no working forge/tracker); omit when it's simply unconfigured.

## The three jobs

**Setup** — walk the sections; per section propose from detection, ask only the **essentials**, leave everything else an editable key. Two rules decide the shape of the result:

- **Forge & tracker are never auto-selected** — always asked, and only options whose tooling actually works here are offered (`gh auth status` covers the remote's host; the Linear MCP answers). `none` is always on the list.
- **Four keys live at the repo root, not in a section** — `forge`, `forgeHost`, `language`, `verify` — because each is a fact about the repo that several skills need. Put a shared fact in one skill's section and disabling that skill silently withdraws it from the others.

Most repos reduce to one real decision. After detection, name only what is actually non-default and ask about that — don't walk every section aloud. Section-by-section detail: **Setup** in REFERENCE.

**Profiles** — named overlays, each a partial config deep-merged onto the base when selected, for a repo that wants different behaviour depending on who runs it. Never proposed during setup: a fresh repo has no evidence for one. Write one only when the user names the context and what differs in it. The four rules governing what may go in one, and how selection works: **Profiles** in REFERENCE.

**Reconcile & check** — desired-state and idempotent, a `--fix` linter for the config; **check** is the same job in report-only mode. Read the config and the schema fresh, diff against both the schema and the repo, then group the plan into auto-fix, prompt, and report-only. Show plan and diff; write only config keys, and only on confirm. The grouping rules and the issue-template label sweep: **Reconcile & check** in REFERENCE.

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

- **Plan → confirm → write.** Respect plan-only / dry-run.
- **The schema is the single source of truth** — read it to validate and enumerate; never duplicate it into a repo's config or into this skill.
- **Forge/tracker is never guessed or auto-selected** — always asked, with the offered options gated to what actually works here (see Setup).
- **Minimal config** — resolution order means defaults need not be written.
- **Valid before writing** — the result must be valid JSON and validate against the schema. Only ever touch `.tituskirch-skills.json`.
- **Commit via `atomic-commit`**, not from here. **`atomic-commit` is optional** — not installed, commit the config change directly in the repo's own Conventional Commits conventions; a missing helper never leaves a written config uncommitted.

## Reference

- Section-by-section setup, the profile rules, the reconcile sweeps, and the config contract: [REFERENCE.md](REFERENCE.md).
- Every key, type, enum, and default: [`tituskirch-skills.schema.json`](https://raw.githubusercontent.com/TitusKirch/skills/main/tituskirch-skills.schema.json) — the single source of truth.
- Per-section setup detail and forge/tracker recipes stay with each owning skill: `issue`, `pull-request`, `release`, `merge-deps`, `prune-branches`, `work-implement`, `write-docs`.
