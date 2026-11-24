---
name: issue
metadata:
  summary: Creates/updates/searches issues across GitHub (gh), GitLab (glab), Linear (MCP) or local files, tracker chosen by config.
description: Creates, updates, finds and bulk-edits issues on GitHub, GitLab, Linear or local issue files, with the tracker and host chosen per repo by config — drafted from the request and session context, previewed, created only after confirmation. To get one filed issue ready for an agent, use refine-issue; to answer decisions a run already listed, use decide. Use when the user wants to create, open, update or find an issue or ticket, or says things like "open an issue", "create a ticket", "find the issue about X", "Issue erstellen", "Ticket anlegen".
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash(jq:*)
  - Bash(printf:*)
  - Bash(mkdir:*)
  - Bash(git rev-parse:*)
  - Bash(gh issue list:*)
  - Bash(gh issue view:*)
  - Bash(gh search issues:*)
  - Bash(gh label list:*)
  - Bash(gh project list:*)
  - Bash(gh repo view:*)
  - Bash(glab issue list:*)
  - Bash(glab issue view:*)
  - Bash(glab label list:*)
  - Bash(glab repo view:*)
---

# issue

Create, update, and search issues without caring which tracker the repo uses. One skill, four trackers — **GitHub** (via `gh`), **GitLab** (via `glab`), **Linear** (via its MCP server) or **local files** — picked per-repo by a small committed config, which also settles **which host** a forge-native tracker talks to. The skill drafts the issue from your free-text description plus the session context, shows it once, and writes it only after you confirm — or just prints the command when you ask for a plan.

**Opted out?** If the repo config sets `issue` to `false`, this skill is **disabled** for the repo — stop immediately and tell the user the issue skill is turned off in `.tituskirch-skills.json`. An _absent_ `issue` block is **not** disabled (it falls back to detection/defaults). Check `.issue == false` on the resolved config before any action — and before indexing `.issue.tracker`. A missing `jq` or config exits non-zero too, so a pass is not evidence the config was read.

## Workflow

### 1. Load config & cache (guided setup on first run)

- **Config** — resolve `.tituskirch-skills.json` via [`templates/resolve-config.sh`](templates/resolve-config.sh), never by reading the raw file ([REFERENCE.md](REFERENCE.md#reading-the-config) states how, missing `jq` included). The `issue.*` section holds the tracker and rules; the root `grillWith` holds the [interview engine](REFERENCE.md#which-engine--the-root-grillwith-key) — three states, so it is read by **presence**, never as a label-or-off. Resolution per setting: **config → native → built-in default**.
- **No / incomplete config, or `/issue setup`** → run the guided setup (step below). Setup is also where the catalog cache is first filled.
- **Catalog cache** — read `$(git rev-parse --git-common-dir)/tituskirch-skills/issue` (JSON). Reuse when younger than ~3 days **and** the `tracker` is unchanged; refresh when missing, stale, the tracker changed, or the user passes `--refresh`. Label staleness in the plan header (`Catalogs (cached, 2d ago): …`).

Config/cache schema, the full setup flow and everything a run needs whatever its tracker: [REFERENCE.md](REFERENCE.md). The tracker recipes are one file each, and step 2 settles which: [`trackers/github.md`](trackers/github.md), [`trackers/gitlab.md`](trackers/gitlab.md), [`trackers/linear.md`](trackers/linear.md), [`trackers/local.md`](trackers/local.md).

### 2. Determine the tracker

From `issue.tracker` (`github` | `gitlab` | `linear` | `local`). A forge-native tracker also needs its **host**, resolved per repo — config, then the `origin` remote, then whatever the CLI is already authenticated against ([REFERENCE.md](REFERENCE.md#the-forge-and-its-host)); never resolve it once and reuse it across repos. Then check availability: GitHub → `gh repo view --json nameWithOwner`; GitLab → `glab repo view` against the resolved host; Linear → confirm the Linear MCP tools are present and authenticated, on the server connected to the configured workspace (`issue.linear.workspace`, [trackers/linear.md](trackers/linear.md)); `local` → the issue directory (nothing to authenticate). Unavailable/unauthenticated → say so, **naming the host that was tried**, and point to the fix (`glab auth login --hostname …`, authenticate the Linear MCP); don't guess another tracker.

### 3. Detect the action

From the phrasing: **create** (default for a new description), **update** (an issue number / `#N` is named, "edit", "close", "relabel"), or **search/list** ("find", "list", "is there an issue about…"). Before creating, a quick search to avoid an obvious duplicate is good practice.

### 4. Draft the content

**Sharpen a thin request first.** When the free-text description plus session context is **thin or ambiguous**, engage a **grilling** pass _on the skill's own initiative_ — drive the repo's interview engine to resolve the open decisions before they harden into a draft, one question at a time with a recommended answer each. A clear, complete request **skips it**; `--grill` / "grill me first" **forces** it. **Which engine is the root `grillWith` key** — absent means `grilling`, a name means that skill, and `null` / `false` means never grill and draft directly. The named engine must be one a skill may drive: **not installed** degrades to drafting as today rather than failing the run, and one declaring **`disable-model-invocation: true`** (`grill-me` and `batch-grill-me` both do) is a **config error to report**, never silently swapped for another engine. Grilling feeds the draft; it never replaces the single confirmation gate at step 6. Signals, override, the key and its three fallbacks: [REFERENCE.md](REFERENCE.md#sharpening-the-request-grilling).

**The template is chosen first** — it settles part of the body _and_ part of the labels before either is drafted. Then, in order:

- **Template** — `issue.template` forces one; unset, pick by the templates' own `description` (`.yml`) / `about` (`.md`) text. Read on **both trackers**: the tracker decides where an issue is filed, never what shape its body has.
- **Title** — the essence in a few words (aim ≤ ~60 chars), **not** a sentence with trailing clauses; that detail belongs in the body. A template's `title:` prefix is already decided — keep it verbatim. Style from `issue.title.convention` (default **plain**).
- **Body** — a template is the body's **skeleton**: fill its sections, never replace them with a shape of your own. Without one, the [default structure](REFERENCE.md#default-body-structure) applies. Drafted from the description **plus the session context**, in `issue.language` (falling back to the root `language`).
- **Labels / state / team** — a template's `labels:` and `assignees:` are the repo's own declaration; only **add** what they don't cover, from the **cached catalog** and contextually for this issue. Skip anything matching `issue.labels.exclude`. Linear needs a `team`.
- **Priority** — a **native field** on Linear, a **`priority:` label** on GitHub. Neither crosses over; a tracker's own field is not a missing label.

What each of those rests on — how a template is picked and what `blank_issues_enabled: false` binds, the title translation rule, what may never appear in a body, label resolution against the catalog, the repo-scope pin, the Linear priority mapping: [**Drafting — the full rules**](REFERENCE.md#drafting--the-full-rules).

### 5. Bulk & sub-issues

- "Make X issues" / "split this into sub-issues" → draft **all** of them and present as **one** bundled plan.
- Parent/child: Linear via `parentId`; GitHub via the sub-issues API. Mechanics: [`trackers/github.md`](trackers/github.md#sub-issues).
- **A bulk run resumed after a partial failure reads before it writes.** Before retrying, search the tracker for each drafted title (or marker) and skip what already exists — **never create a duplicate**. A write whose outcome is unclear (a timeout, no id returned) is settled by reading, never by writing again.

### 6. Present the plan (always, before any write)

One preview: tracker · action · template · title · body · labels/priority/state/team (and the full list for bulk). Flag anything guessed or missing (no team for Linear, possible duplicate). **The chosen template is part of the preview** — path plus how it was chosen — because it is the drafting decision a human can only correct if they see it before the write. Format: [REFERENCE.md](REFERENCE.md#plan-output).

### 7. Execute — or stop

- **Plan-only triggers** ("nur den Plan", "don't create", "dry run", "just show me", "nicht erstellen") → print the exact `gh` command / MCP call and **stop**.
- **Otherwise** → confirm, then execute (create/update/search). Report the result (issue URL / id). For bulk, execute in order and report each.

<skills-plan>

## Presenting the plan

Whatever this skill puts in front of a human to decide on — a plan, a preview, a candidate list, a
findings report — is read **once, in a terminal**, so **every part of it renders on arrival**.

- **Never fold it behind a control.** A terminal cannot open `<details>`/`<summary>`, a tab or a
  "show more": only the summary line prints, and the human confirms a plan whose body never
  reached them.
- **Shorten instead of hiding.** Show every item that needs a decision, each with a visible id and
  its effect. Group the rest by something the reader already thinks in (kind, verdict, ecosystem)
  with a count and a reason, and name the command that shows them in full.
- **This binds the message, not the files it writes.** A `<details>` block in a README, an issue,
  a pull request or a docs page renders in a browser and is fine there.

</skills-plan>

## Guardrails

- **Plan first, write only after confirmation.** Respect plan-only mode.
- **Grill thin input, not clear input.** A thin or ambiguous request auto-engages a skippable grilling pass before drafting (and `--grill` forces one on any request); a complete request drafts straight through. Grilling only sharpens the draft — it never replaces the one confirmation gate. **The engine is whichever skill `grillWith` names**, `grilling` by default: a missing one degrades to today's behaviour rather than failing, one no skill may drive is **reported rather than substituted**, and `grillWith: null` / `false` means the pass never runs at all.
- **Keep titles/bodies attribution-free** — no `Generated with`/🤖 line, no session/permalink URL, no agent self-naming (Claude, Codex, Copilot, Cursor, or any future assistant). Strip it if the harness injects it.
- **No secrets** in titles/bodies — scan the drafted content and the session context for `.env`, keys, tokens; warn and exclude.
- **Body states intent, not implementation** — describe _what_ is wanted (outcome, context, open questions), not _how_ to build it. Never reverse-engineer the repo's conventions into build steps, and never explore the codebase to pad the body — **unless the user explicitly asks** for an implementation plan.
- **Never file a blank issue where the repo forbids one** — `blank_issues_enabled: false` binds the skill even though the API ignores it.
- **Never send a label or assignee the tracker can't resolve** — including one a template declares. Resolve against the catalog first, report what was skipped, and never create one to make a template fit.
- **Cache never committed** — it lives in the git common dir.
- **Only the requested action** — never close, reassign, or relabel anything you weren't asked to.
- **Tracker is never silently chosen** — first run always asks (see setup).

## Reference

Config/cache schema, the guided setup flow, the tracker-neutral issue-template rules, the default body structure for when none applies, the plan-output format, and worked examples — everything a run needs whatever its tracker: [REFERENCE.md](REFERENCE.md).

**One file per tracker recipe, and a repo reads exactly one.** `issue.tracker` is a single value, so step 2 settles the branch before any recipe is opened: [`trackers/github.md`](trackers/github.md), [`trackers/gitlab.md`](trackers/gitlab.md), [`trackers/linear.md`](trackers/linear.md), [`trackers/local.md`](trackers/local.md) (sub-issue mechanics ride with the GitHub one).
