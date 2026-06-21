---
name: issue
summary: Creates/updates/searches issues across GitHub (gh) or Linear (MCP), backend chosen by config.
description: Manages issues — create, update, search/list, and bulk — across GitHub (gh CLI) or Linear (MCP), with the active backend chosen per-repo by a committed config (.tituskirch-skills.json). On first run a guided setup asks which backend (defaulting to GitHub when a GitHub remote exists), persists the rules, and caches the backend's enumerable catalogs (labels, teams, projects, workflow states) so the agent picks them contextually instead of from static defaults. Drafts title and body from a free-text description plus session context, applies the repo's language and title-style rules, previews once, and creates only after confirmation; supports bulk creation and sub-issues. Switches to plan-only (prints the gh command / MCP call) when asked. Use when the user wants to create, open, update, or find an issue or ticket, mentions GitHub issues or Linear, or says things like "open an issue", "create a ticket", "find the issue about X", "Issue erstellen", "Ticket anlegen".
allowed-tools:
  - Bash
  - Read
  - Grep
  - Glob
---

# issue

Create, update, and search issues without caring which tracker the repo uses. One skill, two backends — **GitHub** (via `gh`) or **Linear** (via its MCP server) — picked per-repo by a small committed config. The skill drafts the issue from your free-text description plus the session context, shows it once, and writes it only after you confirm — or just prints the command when you ask for a plan.

## Workflow

### 1. Load config & cache (guided setup on first run)

- **Config** — read `$(git rev-parse --show-toplevel)/.tituskirch-skills.json` with `jq` (missing file/`jq` → run setup, or warn and fall back to GitHub detection). The `issue.*` section holds the backend and rules. Resolution per setting: **config → native → built-in default**.
- **No / incomplete config, or `/issue setup`** → run the guided setup (step below). Setup is also where the catalog cache is first filled.
- **Catalog cache** — read `$(git rev-parse --git-common-dir)/tituskirch-skills/issue` (JSON). Reuse when younger than ~3 days **and** the `backend` is unchanged; refresh when missing, stale, the backend changed, or the user passes `--refresh`. Label staleness in the plan header (`Catalogs (cached, 2d ago): …`).

Config/cache schema, the full setup flow, and backend recipes: [REFERENCE.md](REFERENCE.md).

### 2. Determine the backend

From `issue.backend` (`github` | `linear`). Then check availability: GitHub → `gh repo view --json nameWithOwner`; Linear → confirm the Linear MCP tools are present and authenticated. Unavailable/unauthenticated → say so and point to the fix (e.g. authenticate the Linear MCP), don't guess the other backend.

### 3. Detect the action

From the phrasing: **create** (default for a new description), **update** (an issue number / `#N` is named, "edit", "close", "relabel"), or **search/list** ("find", "list", "is there an issue about…"). Before creating, a quick search to avoid an obvious duplicate is good practice.

### 4. Draft the content

- **Title** — short, clear, scannable: the essence in a few words (aim ≤ ~60 chars), **not** a full sentence with trailing clauses or parentheticals; that detail belongs in the body. Apply the title style (`issue.title.convention`, default **plain**).
- **Body** — drafted from the free-text description **plus the session context** (what was just discussed/done), in the configured language (`issue.language`, falling back to the root `language`).
- **Labels / state / team** — pick **from the cached catalog**, contextually for this issue, not from static defaults. Linear needs a `team`: resolve `issue.linear.team` (a human name/key) to its id via the cache.

### 5. Bulk & sub-issues

- "Make X issues" / "split this into sub-issues" → draft **all** of them and present as **one** bundled plan.
- Parent/child: Linear via `parentId`; GitHub via the sub-issues API. Mechanics: [REFERENCE.md](REFERENCE.md#sub-issues).

### 6. Present the plan (always, before any write)

One preview: backend · action · title · body · labels/state/team (and the full list for bulk). Flag anything guessed or missing (no team for Linear, possible duplicate). Format: [REFERENCE.md](REFERENCE.md#plan-output).

### 7. Execute — or stop

- **Plan-only triggers** ("nur den plan", "don't create", "dry run", "just show me", "nicht erstellen") → print the exact `gh` command / MCP call and **stop**.
- **Otherwise** → confirm, then execute (create/update/search). Report the result (issue URL / id). For bulk, execute in order and report each.

## Guardrails

- **Plan first, write only after confirmation.** Respect plan-only mode.
- **No AI/agent attribution** in titles or bodies — no `Generated with` / 🤖 lines, no session/permalink URLs, no agent self-identification (Claude, Codex, Copilot, Cursor, or any current or future assistant). Strip it if the environment injects it.
- **No secrets** in titles/bodies — scan the drafted content and the session context for `.env`, keys, tokens; warn and exclude.
- **Cache never committed** — it lives in the git common dir.
- **Only the requested action** — never close, reassign, or relabel anything you weren't asked to.
- **Backend is never silently chosen** — first run always asks (see setup).

## Reference

Config/cache schema, the guided setup flow, GitHub and Linear backend recipes, sub-issue mechanics, the plan-output format, and worked examples: [REFERENCE.md](REFERENCE.md).
