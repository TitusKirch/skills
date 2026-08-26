---
name: pull-request
metadata:
  summary: Opens a pull request (GitLab, a merge request) from the current branch; forge and host chosen by config.
description: Creates a pull request — on GitLab, a merge request — from the current branch in the repo's own conventions, with an umbrella Conventional-Commits title and a body from the repo's own template. Forge per-repo by config (root `forge`) — GitHub via gh, GitLab via glab — against a host resolved per repo, self-hosted included. Presents the full plan first and creates only after confirmation; plan-only when asked. Updates your own existing PR instead of duplicating, and never touches PRs opened by others or automation. Recognises a branch stacked on another open PR's branch and bases the PR there rather than on the trunk, stopping where the chain cannot be read cleanly. Use when the user wants to open, create, or raise a pull request or merge request, mentions a PR/MR or a conventional PR, or says things like "open a PR", "create a pull request", "PR erstellen", "mach einen PR".
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash(jq:*)
  - Bash(printf:*)
  - Bash(mkdir:*)
  - Bash(date:*)
  - Bash(ls:*)
  - Bash(head:*)
  - Bash(cksum:*)
  - Bash(cut:*)
  - Bash(grep:*)
  - Bash(git rev-parse:*)
  - Bash(git branch --show-current:*)
  - Bash(git merge-base:*)
  - Bash(git log:*)
  - Bash(git diff:*)
  - Bash(gh pr list:*)
  - Bash(gh pr view:*)
  - Bash(gh pr diff:*)
  - Bash(gh repo view:*)
  - Bash(gh api user:*)
  - Bash(glab mr list:*)
  - Bash(glab repo view:*)
  - Bash(glab api user:*)
---

# pull-request

Turn the current branch into a pull request — on GitLab, a **merge request** — that follows the repo's own conventions: an umbrella Conventional-Commits title and a body filled from the repo's own template. Then create it after your confirmation, update your _own_ existing one, or just show the exact command. The forge is chosen by the root `forge` key — **GitHub via `gh`, GitLab via `glab`** — and the host it talks to is resolved per repo, so a self-hosted instance is the ordinary case rather than an exception.

**Opted out?** If the repo config sets `pr` to `false`, this skill is **disabled** for the repo — stop immediately and tell the user the pull-request skill is turned off in `.tituskirch-skills.json`. An _absent_ `pr` block is **not** disabled. Check `.pr == false` on the resolved config before any action. A missing `jq` or config exits non-zero too, so a pass is not evidence the config was read.

## Workflow

### 1. Detect conventions (read the repo — never assume)

- **Forge and host** — from the root `forge` key (`github` → `gh`, `gitlab` → `glab`; anything else → say it isn't supported and stop) plus the host resolved per repo: `forgeHost`, else the `origin` remote, else whatever the CLI is already authenticated against ([REFERENCE.md](REFERENCE.md#the-forge-and-its-host)). Confirm the repo is reachable — `gh repo view --json nameWithOwner,defaultBranchRef`, or `glab repo view` against the resolved host. If it fails (no remote on that forge, wrong host, or the CLI not authenticated), **stop** with a clear message that names the host it tried.
- **Base ← head** — base = `pr.base` from `.tituskirch-skills.json` if set, else `defaultBranchRef.name`; head = current branch (`git branch --show-current`). Never hardcode `main`/`dev`; show `base ← head` in the plan and let the user override.
- **Stacked branch?** — a branch built on **another open PR's branch** belongs on _that_ branch, not the trunk: based on the trunk, its diff carries the other PR's unmerged commits as if this change had made them, and nothing errors to say so. So before settling the base, refresh `origin/*` (a `git fetch` that asks — it is deliberately not pre-approved — and degrades to the refs on hand when declined), then check whether an open PR's head branch is an **ancestor** of this one; the **nearest** such branch is the base. Where the chain can't be read cleanly — an ambiguous parent, or one rebased out from under this branch — **stop and say so** instead of opening a mis-based PR. A candidate that provably _can't_ be the parent is **skipped, never a refusal**: cross-fork PRs (stacks are same-repo only), a branch still unfetchable, one whose tip is already on the trunk — refusing on those would block a branch stacked on nothing. A base the user named explicitly wins outright and needs no check. Detection, the refusal cases, and why this reads git rather than the stacks preview API: [REFERENCE.md](REFERENCE.md#stacked-branches).
- **Template** — the forge's own convention first: on GitHub `.github/pull_request_template.md`, `.github/PULL_REQUEST_TEMPLATE.md`, `.github/PULL_REQUEST_TEMPLATE/*.md` or a root/`docs/` variant; on GitLab `.gitlab/merge_request_templates/*.md`. Fall back to the other forge's directory only when the current forge's yields nothing — a migrated repo often keeps both. Use the file verbatim as the body skeleton and fill its sections; if none, fall back to Summary / Changes / Related issues.
- **Title convention** — Conventional Commits when the repo uses them. Read it from the **shared convention cache** (`$(git rev-parse --git-common-dir)/tituskirch-skills/conventions`, written by `atomic-commit` or by this skill — same detection, memoized); if the cache is missing/stale, detect it (commitlint config + history) and write the block yourself. Honor the cached `header_max_length` for the title — PR titles are commonly linted too. `pr.title.convention: plain` in `.tituskirch-skills.json` forces a non-Conventional title.
- **Existing PR / MR** — `gh pr list --head <branch> --state open`, or `glab mr list --source-branch <branch>`, and check its author (step 5).
- **Config** — `.tituskirch-skills.json` at the repo root (optional, committed) can set `pr.base`, `pr.title.convention`, `pr.instructions` (free-text wording guidance for title/body), `pr.language` (a per-skill language override), the shared `language`, and the root `forge` / `forgeHost` pair. Resolve it via [`templates/resolve-config.sh`](templates/resolve-config.sh), never by reading the raw file ([REFERENCE.md](REFERENCE.md#reading-the-config) states how, missing `jq` included). Keys: [REFERENCE.md](REFERENCE.md#config).

Detection recipes and the shared cache: [REFERENCE.md](REFERENCE.md#detecting-conventions).

### 2. Gather the branch's content

- Commits since base: `git log <base>..HEAD` (subjects and bodies for the summary).
- Change shape: `git diff --stat <base>...HEAD`.
- Both read the base **step 1 resolved** — on a stacked branch that is the branch below, so the summary and the diff describe this layer alone.
- Linked issues: scan commit messages and the branch name for `#123` / `Closes #…` / `Fixes #…`.
- If the branch isn't pushed (or its upstream is behind), offer to `git push` first — the create call needs the head on the remote either way. Ask before pushing.

### 3. Build the PR

- **Title (umbrella, Conventional)** — one commit → its subject; multiple → a single summarising `type(scope): subject` over the whole branch (dominant type wins; shared scope or none; mark breaking with `!`), within the header limit. Heuristics: [REFERENCE.md](REFERENCE.md#title-derivation-umbrella).
- **Body** — fill the detected template: **Summary** (what + why, from the commits and diff), tick the matching **Type of change**, carry the **Checklist** (pre-tick only what you verified, e.g. `pnpm check` if run). **Closing keywords last:** end the body with one `Closes #N` per issue the branch resolves (gathered from commit `Refs/Closes #N` footers, the branch name, and the session) — each issue needs its own keyword; use `Refs #N` for issues it relates to but doesn't close. Pass it via `--body-file` so multi-line markdown survives the shell.

### 4. Present the plan (always, before creating)

Show: title · `base ← head` · the forge and, when it is not the forge's public one, the **host** · ready/draft · existing-PR status · the rendered body. Where the base is another PR's branch, say so on the `base ← head` line — the human is being told the merge is gated on the PR below. Flag anything missing (unpushed branch, guessed base, no linked issue). Format in [REFERENCE.md](REFERENCE.md#plan-output).

### 5. Create — update your own — or stop

- **Plan-only triggers** ("nur den Plan", "don't create", "dry run", "just show me", "nicht erstellen"): print the exact create/edit command for the resolved forge and stop.
- **No existing one** → after confirmation: `gh pr create --base <base> --head <branch> --title … --body-file …`, or `glab mr create --target-branch <base> --source-branch <branch> --title … --description …`. **Ready by default**; `--draft` only if asked.
- **An open one you opened** (author == `gh api user --jq .login` / `glab api user --jq .username`) → offer to **update its body**: `gh pr edit <n> --body-file …` or `glab mr update <iid> --description …`. Don't change its title, base, or draft state unless asked.
- **One opened by anyone else or by automation** (e.g. a `dev → main` rollup) → **leave it untouched**. Report its number and author, then stop.

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

- **Two forges, one host resolution.** The root `forge` key selects the driver — `github` (`gh`) or `gitlab` (`glab`) — and the host is resolved per repo, never once per session. No remote on that forge, wrong host, or the CLI unavailable → stop, naming the host tried; never fall back to raw `git` plumbing, and never quietly serve a `gitlab` repo the GitHub path because `github` is the default. Any other `forge` value isn't supported — say so and stop.
- **Speak the forge's vocabulary.** On GitLab it is a merge request, a source branch, a target branch and `!42`; on GitHub a pull request, a head, a base and `#42`. The trigger phrases stay bilingual — "open a PR" on a GitLab repo means the MR — but the title, body, plan and report follow the forge the run is pointed at.
- **Keep the title/body attribution-free** — no `Generated with`/🤖 line, no session/permalink URL, no agent self-naming (Claude, Codex, Copilot, Cursor, or any future assistant). Strip it if the harness injects it.
- **Only ever touch your own PR.** Never edit a PR opened by another user or by automation, and never open a duplicate of one that already exists.
- **Never force-push; never merge** unless explicitly asked. Push the head branch only after confirmation.
- **No secrets in the body.** Scan the summary and diff for `.env`, keys, tokens; warn and exclude.
- **Respect the base.** Show the detected `base ← head` and confirm before creating; don't assume `main`/`dev`.
- **Never guess a stacked base — and never refuse over a candidate that was never the parent.** A branch sitting on another open PR's branch takes that branch as its base. Where the chain is genuinely ambiguous or out of sync, **stop**: a mis-based PR fails silently, and a wrong diff costs more to unpick than a run that asked. But a cross-fork, unfetchable or already-merged-into-trunk candidate is **skipped**, because a refusal there stops a branch that is stacked on nothing. **Read stacks, never write them:** this skill does not create, extend, dissolve or reorder a stack, and it never re-targets an existing PR's base — moving a base belongs to the human, or to GitHub: in a confirmed stack when the PR below merges, and outside any stack when the merged branch is deleted. Where neither happens, nothing moves it at all.

## Reference

**Open it at step 1** for the per-forge detection recipes and how the forge and its host are resolved — a self-hosted instance is settled there rather than guessed — and, on **any branch whose base the user did not name**, for the stacked-branch reading: basing a PR wrongly fails silently, so that check runs unasked, and its refusal cases say where it stops rather than picking a base. **At step 3** for the umbrella-title heuristics and the template-filling rules, **at step 4** for the plan's exact shape: [REFERENCE.md](REFERENCE.md).
