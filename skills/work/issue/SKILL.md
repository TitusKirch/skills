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

**Sharpen a thin request first (grilling).** Before drafting, weigh how complete the request is. When the free-text description plus session context is **thin or ambiguous** — the scope is a guess, a decision the body would have to state is unresolved, a default-structure section would be filled by inference rather than by what the human said — engage a **grilling** pass _on the skill's own initiative_: invoke the `grilling` skill to interview the human one question at a time, dependency-ordered with a recommended answer each, and resolve those open decisions **before** they harden into a draft. A **clear, complete request skips it** and drafts exactly as today — no interrogation. The pass is **always skippable** (the human may decline or cut it short and let the skill draft from what it has), and an explicit **`--grill`** / "grill me first" **forces** it even on a request that looks complete. Its answers **feed the draft below**; they do **not** replace the single plan-preview-then-confirm gate (step 6), which is unchanged — grilling only feeds it better input. **Target `grilling`, never `grill-me`** — `grilling` is the callable interview engine; `grill-me` sets `disable-model-invocation: true`, so a skill cannot drive it. **If the `grilling` skill is not installed, skip this pass and draft as today** — a missing engine degrades to the status-quo behaviour, it never fails the run. Mechanics — the thin/ambiguous signals, the override and the graceful fallback: [REFERENCE.md](REFERENCE.md#sharpening-the-request-grilling).

The **template is chosen first** — it settles part of the body _and_ part of the labels before either is drafted.

- **Template** (**both trackers**) — the repo's `.github/ISSUE_TEMPLATE/` files state how _this project_ writes issues, which is true whichever tracker receives them, so they are read on **Linear as well as GitHub**: the tracker decides where an issue is filed, never what shape its body has. `issue.template` forces one; unset, **read the repo's templates and pick by their own `description` (`.yml`) / `about` (`.md`)**, the same way labels are picked from the catalog — that text already states when a template applies, so nothing is mapped in the config. **`blank_issues_enabled: false` in `.github/ISSUE_TEMPLATE/config.yml` makes a template mandatory** — the web UI enforces it, no API does, so the skill must: none fits → surface that in the plan instead of filing a blank issue. Mechanics, the `.md`/`.yml` filling rules and what Linear's own server-side templates do (and don't) change: [REFERENCE.md](REFERENCE.md#issue-templates).
- **Title** — short, clear, scannable: the essence in a few words (aim ≤ ~60 chars), **not** a full sentence with trailing clauses or parentheticals; that detail belongs in the body. **A template's `title:` is a prefix, and it is already decided** — keep it verbatim and draft after it. Apply the title style (`issue.title.convention`, default **plain**). **When the title language differs from the discussion, translate** domain terms into the title language instead of carrying them through verbatim (title `en`, discussion in German → `Add CV / resume page`, not `Add Lebenslauf page`); keep a term untranslated only when it is a genuine proper noun or the literal on-disk name — and **confirm when that is ambiguous**.
- **Body** — a chosen template is the body's **skeleton**: fill its sections, never replace them with a shape of your own. **No template — none fits, or the repo ships none — and the skill's own [default structure](REFERENCE.md#default-body-structure) applies on both trackers: `## Problem`, `## Wanted`, `## Open questions`, dropping what is empty** — a starting point to adapt per subject, not a form to fill, and never `pull-request`'s PR fallback, whose `## Changes` describes work already done and has no referent in an issue. Content is drafted from the free-text description **plus the session context** (what was just discussed/done), in the configured language (`issue.language`, falling back to the root `language`); apply any `issue.instructions` wording guidance, which never overrides the rules here. **Altitude — what, not how:** the body states the desired **outcome**, its **context**, and any **open questions** — **not** a prescriptive implementation plan (routes, files, layers, commands) reverse-engineered from the repo's conventions. Description + session context is enough; a feature request needs no codebase spelunking to enrich it. Read the code only for a cheap, specific need (a duplicate check, naming an existing file to reference), never to author build steps — **unless the user explicitly asks** for an implementation proposal. **Content only — no field state in the body:** never write lines like `No milestone`, `Labels: none`, or assignee/status notes. Labels, priority, milestone, project, assignee and state are issue **fields** (set via the create call) and are simply omitted when unset — the plan preview lists them, the body never mentions them.
- **Labels / state / team** — **a template's `labels:` and `assignees:` are already decided**: take them as the repo's own declaration and only **add** what they don't cover — with a template the labels flow out of it, they are not picked and then written. **Resolve every declared name against the catalog before it reaches the write**, though: a template names labels, it does not create them, and `gh` aborts the whole create on one it cannot resolve. Apply what resolves, list what doesn't in the plan, never create a label to satisfy a template. Everything on top comes **from the cached catalog**, contextually for this issue, not from static defaults. **Skip any label matching `issue.labels.exclude`** (glob patterns, `*` wildcard) — there is no built-in denylist; what to exclude is entirely the repo's config. It filters the additions, not what a template declares. Linear needs a `team`: resolve `issue.linear.team` (a human name/key) to its id via the cache. On Linear, also **pin the repo-scope label** `work.labels.repo` (when set to a string) on **every** create — a fixed per-repo tag the `work-implement-queue` skill filters on. It is the one deliberate static default; every other label stays contextual.
- **Priority** — **each tracker expresses it its own way, and neither way crosses over.** On **Linear** it is a native field on the create call: seed it from `issue.linear.priority` and map the word to the number Linear actually takes ([REFERENCE.md](REFERENCE.md#tracker--linear-mcp)); move off that seed only when the request itself asks for a different urgency, never on your own reading of how important the issue looks. On **GitHub** there is no such field — a `priority: …` label is how a repo says it, so it comes from the catalog like any other label. **A `priority:` label group is therefore a GitHub convention** — the ladder `work.priorityLabels` orders the work loop by — and it is **not** reproduced on Linear: don't look for one there, don't create one, and never report its absence among the plan's unresolved items. A tracker's own field is not a missing label.

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
