---
name: issue
summary: Creates/updates/searches issues across GitHub (gh) or Linear (MCP), tracker chosen by config.
description: Manages issues — create, update, search/list, and bulk — across GitHub (gh CLI) or Linear (MCP), with the active tracker chosen per-repo by a committed config (.tituskirch-skills.json). Drafts title and body from a free-text description plus session context, previews once, and creates only after confirmation; switches to plan-only when asked. Use when the user wants to create, open, update, or find an issue or ticket, mentions GitHub issues or Linear, or says things like "open an issue", "create a ticket", "find the issue about X", "Issue erstellen", "Ticket anlegen".
allowed-tools:
  - Bash
  - Read
  - Grep
  - Glob
---

# issue

Create, update, and search issues without caring which tracker the repo uses. One skill, two trackers — **GitHub** (via `gh`) or **Linear** (via its MCP server) — picked per-repo by a small committed config. The skill drafts the issue from your free-text description plus the session context, shows it once, and writes it only after you confirm — or just prints the command when you ask for a plan.

**Opted out?** If the repo config sets `issue` to `false`, this skill is **disabled** for the repo — stop immediately and tell the user the issue skill is turned off in `.tituskirch-skills.json`. An _absent_ `issue` block is **not** disabled (it falls back to detection/defaults). Check `jq -e '.issue == false'` before any action — and before indexing `.issue.tracker`. A missing `jq` or config exits non-zero too, so a pass is not evidence the config was read.

## Workflow

### 1. Load config & cache (guided setup on first run)

- **Config** — read `$(git rev-parse --show-toplevel)/.tituskirch-skills.json` with `jq` (missing file/`jq` → run setup, or warn and fall back to GitHub detection). The `issue.*` section holds the tracker and rules. Resolution per setting: **config → native → built-in default**.
- **No / incomplete config, or `/issue setup`** → run the guided setup (step below). Setup is also where the catalog cache is first filled.
- **Catalog cache** — read `$(git rev-parse --git-common-dir)/tituskirch-skills/issue` (JSON). Reuse when younger than ~3 days **and** the `tracker` is unchanged; refresh when missing, stale, the tracker changed, or the user passes `--refresh`. Label staleness in the plan header (`Catalogs (cached, 2d ago): …`).

Config/cache schema, the full setup flow, and tracker recipes: [REFERENCE.md](REFERENCE.md).

### 2. Determine the tracker

From `issue.tracker` (`github` | `linear`). Then check availability: GitHub → `gh repo view --json nameWithOwner`; Linear → confirm the Linear MCP tools are present and authenticated. Unavailable/unauthenticated → say so and point to the fix (e.g. authenticate the Linear MCP), don't guess the other tracker.

### 3. Detect the action

From the phrasing: **create** (default for a new description), **update** (an issue number / `#N` is named, "edit", "close", "relabel"), or **search/list** ("find", "list", "is there an issue about…"). Before creating, a quick search to avoid an obvious duplicate is good practice.

### 4. Draft the content

- **Title** — short, clear, scannable: the essence in a few words (aim ≤ ~60 chars), **not** a full sentence with trailing clauses or parentheticals; that detail belongs in the body. Apply the title style (`issue.title.convention`, default **plain**). **When the title language differs from the discussion, translate** domain terms into the title language instead of carrying them through verbatim (title `en`, discussion in German → `Add CV / resume page`, not `Add Lebenslauf page`); keep a term untranslated only when it is a genuine proper noun or the literal on-disk name — and **confirm when that is ambiguous**.
- **Body** — drafted from the free-text description **plus the session context** (what was just discussed/done), in the configured language (`issue.language`, falling back to the root `language`); apply any `issue.instructions` wording guidance, which never overrides the rules here. **Altitude — what, not how:** the body states the desired **outcome**, its **context**, and any **open questions** — **not** a prescriptive implementation plan (routes, files, layers, commands) reverse-engineered from the repo's conventions. Description + session context is enough; a feature request needs no codebase spelunking to enrich it. Read the code only for a cheap, specific need (a duplicate check, naming an existing file to reference), never to author build steps — **unless the user explicitly asks** for an implementation proposal. **Content only — no field state in the body:** never write lines like `No milestone`, `Labels: none`, or assignee/status notes. Labels, milestone, project, assignee and state are issue **fields** (set via the create call) and are simply omitted when unset — the plan preview lists them, the body never mentions them.
- **Labels / state / team** — pick **from the cached catalog**, contextually for this issue, not from static defaults. **Skip any label matching `issue.labels.exclude`** (glob patterns, `*` wildcard) — there is no built-in denylist; what to exclude is entirely the repo's config. Linear needs a `team`: resolve `issue.linear.team` (a human name/key) to its id via the cache. On Linear, also **pin the repo-scope label** `work.labels.repo` (when set to a string) on **every** create — a fixed per-repo tag the [`work-implement-queue`](../work-implement-queue/SKILL.md) skill filters on. It is the one deliberate static default; every other label stays contextual.

### 5. Bulk & sub-issues

- "Make X issues" / "split this into sub-issues" → draft **all** of them and present as **one** bundled plan.
- Parent/child: Linear via `parentId`; GitHub via the sub-issues API. Mechanics: [REFERENCE.md](REFERENCE.md#sub-issues).

### 6. Present the plan (always, before any write)

One preview: tracker · action · title · body · labels/state/team (and the full list for bulk). Flag anything guessed or missing (no team for Linear, possible duplicate). Format: [REFERENCE.md](REFERENCE.md#plan-output).

### 7. Execute — or stop

- **Plan-only triggers** ("nur den plan", "don't create", "dry run", "just show me", "nicht erstellen") → print the exact `gh` command / MCP call and **stop**.
- **Otherwise** → confirm, then execute (create/update/search). Report the result (issue URL / id). For bulk, execute in order and report each.

## Guardrails

- **Plan first, write only after confirmation.** Respect plan-only mode.
- **Keep titles/bodies attribution-free** — no `Generated with`/🤖 line, no session/permalink URL, no agent self-naming (Claude, Codex, Copilot, Cursor, or any future assistant). Strip it if the harness injects it.
- **No secrets** in titles/bodies — scan the drafted content and the session context for `.env`, keys, tokens; warn and exclude.
- **Body states intent, not implementation** — describe _what_ is wanted (outcome, context, open questions), not _how_ to build it. Never reverse-engineer the repo's conventions into build steps, and never explore the codebase to pad the body — **unless the user explicitly asks** for an implementation plan.
- **Cache never committed** — it lives in the git common dir.
- **Only the requested action** — never close, reassign, or relabel anything you weren't asked to.
- **Tracker is never silently chosen** — first run always asks (see setup).

## Reference

Config/cache schema, the guided setup flow, GitHub and Linear tracker recipes, sub-issue mechanics, the plan-output format, and worked examples: [REFERENCE.md](REFERENCE.md).
