---
name: tituskirch-skills-config
summary: Sets up, reconciles, and drift-checks .tituskirch-skills.json, the shared config the other TitusKirch skills read.
description: Creates, reconciles, and drift-checks `.tituskirch-skills.json` — the committed, repo-root config the other TitusKirch skills (atomic-commit, pull-request, issue, release, work-issue, work-queue, write-docs) read to pick backends, languages, and conventions per repo. Routes by state — guided setup when the config is missing or a section is incomplete, desired-state reconcile against the schema when it exists, and a report-only drift check that flags config gone stale against the repo — a renamed skill or scope, a moved branch, a deleted label or template. Detects repo signals (remote host, gh/Linear availability, integration branch, commitlint, project type) to propose defaults, gates backend choices to what actually works, previews a plan, and writes only after confirmation. Also fires proactively after a skill, scope, branch, or label is renamed or removed in the session, to catch the config drifting. Use when the user wants to set up, configure, onboard, fix, or drift-check the TitusKirch skills config, mentions `.tituskirch-skills.json`, or says things like "configure the skills", "set up the config", "onboard this repo", "check the config", "keep the config in sync", "skills config einrichten", "config reparieren".
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - WebFetch
---

# tituskirch-skills-config

`.tituskirch-skills.json` at the repo root is the optional, committed config the other TitusKirch skills read — each setting resolved per repo as **config → native → built-in default**. This skill owns the file's **lifecycle**: create it, grow it, reconcile it. It does **not** own the schema. Every key, type, enum, and default lives once in [`tituskirch-skills.schema.json`](https://raw.githubusercontent.com/TitusKirch/skills/main/tituskirch-skills.schema.json) — the **single source of truth**. Read it to validate and enumerate keys; never restate it here or copy defaults into a repo's config. **Fetch it raw** (`curl` via Bash) — WebFetch only summarizes and drops the exact enums. **Staleness guard** — the `main` URL can be CDN-cached or predate the installed skill, so if the fetched schema lacks a section this skill documents (`commit` / `pr` / `issue` / `release` / `docs` / `work`), your copy is stale; re-fetch cache-busted before telling the user a key or section is unsupported.

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

`config → native → built-in default` means an absent key or section is **defaults, not off**. So write **only** the essentials and the choices the user actually makes; never write a key set to its own default — it is a no-op that only invites drift. `docs`, `issue`, `pr`, and `release` each accept an explicit `false` to **disable** that skill for the repo — distinct from an absent block, which just falls back to defaults. Use `false` when a skill can't or shouldn't run here (e.g. no working backend); omit when it's simply unconfigured.

## Setup — config missing, or a section incomplete

Walk the sections; per section, propose from detection, ask only the **essentials**, and leave everything else an editable key.

**Backend selection is capability-gated** — always ask, never auto-select (not even when only one option works). Offer only backends whose tooling actually works here; show the rest with the reason they're out:

- **`github`** — viable only if the remote host is GitHub (`git remote get-url`) **and** `gh auth status` covers that host. gh signed in to github.com while the remote is GitLab / Gitea / Bitbucket → not viable.
- **`linear`** — viable only if the Linear MCP answers (`whoami` / list teams).
- **`none`** — always offered. Either omit the section (unconfigured — runs only when explicitly invoked) or write `false` to **disable** the skill outright (it refuses even when invoked). Prefer `false` when the repo has no working backend, so an accidental call stops cleanly.

A repo with no working backend (e.g. self-hosted GitLab) just lands on `none` — no special-casing. `pr` is `github`-only in the schema, so it is github, `false`, or omit; when the remote isn't GitHub, name it as a known gap.

- **root `language`** — existing config / repo language → ask → default `en`.
- **`commit`** — usually omit the whole block; `scopes` defaults to `auto`. Add `scopeVocab` / `instructions` only on an explicit preference.
- **`pr`** — github-or-omit (above). Propose `base` when the repo integrates onto a non-default branch (e.g. a `dev` branch exists). `title.convention` is `conventional` when commitlint or a Conventional-Commits history is present, else ask.
- **`issue`** — pick the backend (above). For Linear, list teams and pick `linear.team` (the one required field). Set the languages, `title.convention` (`plain` default), and `labels.exclude` for catalog labels the agent must never auto-apply.
- **`release`** — usually omit: every key defaults, and a repo that promotes `pr.base` onto its default branch with automation already opening the rollup PR needs nothing. Set `promote` to `create` when no automation opens that PR, or `false` when promotion isn't this skill's business; `false` for the whole section when the repo has no release-please setup.
- **`docs`** — `preset` from project type (cli / library / app / infra / ai-tool), or `false` to opt out; language inherits root.
- **`work`** — only when the repo runs the queue. Pick the backend (above); it and `linear.team` fall back to `issue.*`. Set `cap` (default 10), `branch` (`worktree` default), and the lifecycle `labels`.

**Fast-path** — most repos reduce to one real decision (commit auto-detects from commitlint, languages default to `en`, backends resolve to a single viable option or `none`). After detection, name only what is actually non-default and ask those — don't walk every section aloud when just `docs.preset` is open.

Write the file with a leading `$schema` key pointing at the canonical raw URL so editors validate it. Plan → confirm → write.

## Reconcile & check — config exists

Desired-state, idempotent — a `--fix` linter for the config. **check** is the same job in report-only mode — it runs steps 1–2 and reports the drift, but never writes.

1. Read the config fresh **and** the schema (local `tituskirch-skills.schema.json`, else fetch the canonical URL).
2. Diff against the schema **and the repo**, then group the plan:
   - **Auto-fix (mechanical)** — unknown or removed keys, a value off the schema's enum with one unambiguous correction, a `commit.scopeVocab` missing a current skill / package scope, a missing `$schema` pointer, key ordering.
   - **Prompt (value-needing)** — a required value that is absent (`issue.backend` `linear` with no `linear.team`), or a setting the repo can no longer satisfy (a `pr.base`, template, label, team, or `scopeVocab` folder that does not exist).
   - **Report only** — a key written to its own default (suggest dropping it — resolution order makes it a no-op); never auto-remove one that documents deliberate intent.
3. Show the **plan + diff**; on confirm, write **only** config keys. **check** stops here — it never writes.

## Guardrails

- **Plan → confirm → write.** Respect plan-only / dry-run.
- **The schema is the single source of truth** — read it to validate and enumerate; never duplicate it into a repo's config or into this skill.
- **Backend is never guessed or auto-selected** — always asked, with the offered options gated to what actually works here (see Setup).
- **Minimal config** — resolution order means defaults need not be written.
- **Valid before writing** — the result must be valid JSON and validate against the schema. Only ever touch `.tituskirch-skills.json`.
- **Commit via [`atomic-commit`](../atomic-commit/SKILL.md)**, not from here.

## Reference

- Every key, type, enum, and default: [`tituskirch-skills.schema.json`](https://raw.githubusercontent.com/TitusKirch/skills/main/tituskirch-skills.schema.json) — the single source of truth.
- Per-section setup detail and backend recipes stay with each owning skill: [`issue`](../issue/REFERENCE.md), [`pull-request`](../pull-request/REFERENCE.md), [`release`](../release/REFERENCE.md), [`work-issue`](../work-issue/REFERENCE.md), [`write-docs`](../write-docs/REFERENCE.md).
