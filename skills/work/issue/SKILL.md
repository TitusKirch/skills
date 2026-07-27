---
name: issue
metadata:
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

**Opted out?** If the repo config sets `issue` to `false`, this skill is **disabled** for the repo — stop immediately and tell the user the issue skill is turned off in `.tituskirch-skills.json`. An _absent_ `issue` block is **not** disabled (it falls back to detection/defaults). Check `.issue == false` on the resolved config before any action — and before indexing `.issue.tracker`. A missing `jq` or config exits non-zero too, so a pass is not evidence the config was read.

## Workflow

### 1. Load config & cache (guided setup on first run)

- **Config** — resolve `.tituskirch-skills.json` via [`templates/resolve-config.sh`](templates/resolve-config.sh), never by reading the raw file ([REFERENCE.md](REFERENCE.md#reading-the-config) states how, missing `jq` included). The `issue.*` section holds the tracker and rules. Resolution per setting: **config → native → built-in default**.
- **No / incomplete config, or `/issue setup`** → run the guided setup (step below). Setup is also where the catalog cache is first filled.
- **Catalog cache** — read `$(git rev-parse --git-common-dir)/tituskirch-skills/issue` (JSON). Reuse when younger than ~3 days **and** the `tracker` is unchanged; refresh when missing, stale, the tracker changed, or the user passes `--refresh`. Label staleness in the plan header (`Catalogs (cached, 2d ago): …`).

Config/cache schema, the full setup flow, and tracker recipes: [REFERENCE.md](REFERENCE.md).

### 2. Determine the tracker

From `issue.tracker` (`github` | `linear`). Then check availability: GitHub → `gh repo view --json nameWithOwner`; Linear → confirm the Linear MCP tools are present and authenticated. Unavailable/unauthenticated → say so and point to the fix (e.g. authenticate the Linear MCP), don't guess the other tracker.

### 3. Detect the action

From the phrasing: **create** (default for a new description), **update** (an issue number / `#N` is named, "edit", "close", "relabel"), or **search/list** ("find", "list", "is there an issue about…"). Before creating, a quick search to avoid an obvious duplicate is good practice.

### 4. Draft the content

**Sharpen a thin request first.** When the free-text description plus session context is **thin or ambiguous**, engage a **grilling** pass _on the skill's own initiative_ — invoke the `grilling` skill to resolve the open decisions before they harden into a draft, one question at a time with a recommended answer each. A clear, complete request **skips it**; `--grill` / "grill me first" **forces** it; a missing `grilling` skill degrades to drafting as today rather than failing the run. **Target `grilling`, never `grill-me`** — the latter sets `disable-model-invocation: true`, so a skill cannot drive it. Grilling feeds the draft; it never replaces the single confirmation gate at step 6. Signals, override and fallback: [REFERENCE.md](REFERENCE.md#sharpening-the-request-grilling).

**The template is chosen first** — it settles part of the body _and_ part of the labels before either is drafted. Then, in order:

- **Template** — `issue.template` forces one; unset, pick by the templates' own `description` (`.yml`) / `about` (`.md`) text. Read on **both trackers**: the tracker decides where an issue is filed, never what shape its body has.
- **Title** — the essence in a few words (aim ≤ ~60 chars), **not** a sentence with trailing clauses; that detail belongs in the body. A template's `title:` prefix is already decided — keep it verbatim. Style from `issue.title.convention` (default **plain**).
- **Body** — a template is the body's **skeleton**: fill its sections, never replace them with a shape of your own. Without one, the [default structure](REFERENCE.md#default-body-structure) applies. Drafted from the description **plus the session context**, in `issue.language` (falling back to the root `language`).
- **Labels / state / team** — a template's `labels:` and `assignees:` are the repo's own declaration; only **add** what they don't cover, from the **cached catalog** and contextually for this issue. Skip anything matching `issue.labels.exclude`. Linear needs a `team`.
- **Priority** — a **native field** on Linear, a **`priority:` label** on GitHub. Neither crosses over; a tracker's own field is not a missing label.

What each of those rests on — how a template is picked and what `blank_issues_enabled: false` binds, the title translation rule, what may never appear in a body, label resolution against the catalog, the repo-scope pin, the Linear priority mapping: [**Drafting — the full rules**](REFERENCE.md#drafting--the-full-rules).

### 5. Bulk & sub-issues

- "Make X issues" / "split this into sub-issues" → draft **all** of them and present as **one** bundled plan.
- Parent/child: Linear via `parentId`; GitHub via the sub-issues API. Mechanics: [REFERENCE.md](REFERENCE.md#sub-issues).

### 6. Present the plan (always, before any write)

One preview: tracker · action · template · title · body · labels/priority/state/team (and the full list for bulk). Flag anything guessed or missing (no team for Linear, possible duplicate). **The chosen template is part of the preview** — path plus how it was chosen — because it is the drafting decision a human can only correct if they see it before the write. Format: [REFERENCE.md](REFERENCE.md#plan-output).

### 7. Execute — or stop

- **Plan-only triggers** ("nur den Plan", "don't create", "dry run", "just show me", "nicht erstellen") → print the exact `gh` command / MCP call and **stop**.
- **Otherwise** → confirm, then execute (create/update/search). Report the result (issue URL / id). For bulk, execute in order and report each.

## Guardrails

- **Plan first, write only after confirmation.** Respect plan-only mode.
- **Grill thin input, not clear input.** A thin or ambiguous request auto-engages a skippable `grilling` pass before drafting (and `--grill` forces one on any request); a complete request drafts straight through. Grilling only sharpens the draft — it never replaces the one confirmation gate, and a missing `grilling` skill degrades to today's behaviour rather than failing.
- **Keep titles/bodies attribution-free** — no `Generated with`/🤖 line, no session/permalink URL, no agent self-naming (Claude, Codex, Copilot, Cursor, or any future assistant). Strip it if the harness injects it.
- **No secrets** in titles/bodies — scan the drafted content and the session context for `.env`, keys, tokens; warn and exclude.
- **Body states intent, not implementation** — describe _what_ is wanted (outcome, context, open questions), not _how_ to build it. Never reverse-engineer the repo's conventions into build steps, and never explore the codebase to pad the body — **unless the user explicitly asks** for an implementation plan.
- **Never file a blank issue where the repo forbids one** — `blank_issues_enabled: false` binds the skill even though the API ignores it.
- **Never send a label or assignee the tracker can't resolve** — including one a template declares. Resolve against the catalog first, report what was skipped, and never create one to make a template fit.
- **Cache never committed** — it lives in the git common dir.
- **Only the requested action** — never close, reassign, or relabel anything you weren't asked to.
- **Tracker is never silently chosen** — first run always asks (see setup).

## Reference

Config/cache schema, the guided setup flow, the tracker-neutral issue-template rules, the default body structure for when none applies, GitHub and Linear tracker recipes, sub-issue mechanics, the plan-output format, and worked examples: [REFERENCE.md](REFERENCE.md).
