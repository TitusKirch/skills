# issue — Reference

Mechanics for the [SKILL.md](SKILL.md) workflow. One skill, two backends (GitHub `gh` / Linear MCP), chosen per-repo by config.

## Config

`.tituskirch-skills.json` at the repo root (`$(git rev-parse --show-toplevel)`) is an optional, committed config shared across TitusKirch skills. The `issue.*` section is this skill's. Read with `jq`; if the file or `jq` is missing, run setup (or warn and fall back to GitHub detection). Resolution per setting: **config → native → built-in default**.

```json
{
  "language": "de",
  "issue": {
    "backend": "github",
    "language": { "title": "en", "body": "de" },
    "title": { "convention": "plain" },
    "linear": {
      "team": "ENG",
      "project": null,
      "priority": null,
      "defaultState": null
    },
    "github": { "template": ".github/ISSUE_TEMPLATE/bug.md" }
  }
}
```

| Key                                            | Effect                                                                                                    |
| :--------------------------------------------- | :-------------------------------------------------------------------------------------------------------- |
| `issue.backend`                                | `github` or `linear` — the active backend (set by setup, never guessed silently)                          |
| `issue.language`                               | title/body language — scalar (`en`/`de`/`match`) or `{ title, body }`; falls back to the root `language`  |
| `issue.title.convention`                       | `plain` (default — most trackers) or `conventional` (`type: subject`)                                     |
| `issue.linear.team`                            | **required to create on Linear** — a human name/key (e.g. `"ENG"`); resolved to the team id via the cache |
| `issue.linear.{project,priority,defaultState}` | optional Linear defaults (`priority`: none/low/medium/high/urgent)                                        |
| `issue.github.template`                        | optional default issue template                                                                           |

`language` is a shared root key; `issue.*` is this skill's section (`commit.*`/`pr.*` belong to the other skills). Full schema: the repo-root `tituskirch-skills.schema.json`.

```bash
config="$(git rev-parse --show-toplevel)/.tituskirch-skills.json"
if [ -f "$config" ] && command -v jq >/dev/null 2>&1; then
  backend=$(jq -er '.issue.backend // empty' "$config" 2>/dev/null) || backend=
  team=$(jq -er '.issue.linear.team // empty' "$config" 2>/dev/null) || team=
fi
```

## Catalog cache

Enumerable backend data, fetched once and reused so the agent can pick labels/state/team contextually.

- **Location** — `$(git rev-parse --git-common-dir)/tituskirch-skills/issue`. Owner-namespaced directory in the common git dir (shared across branches/worktrees, never tracked). Create it before writing (`mkdir -p`). **JSON** — this skill already depends on `jq`, and the catalogs are structured (unlike the flat `conventions` cache the commit/PR skills share).
- **Validity** — reuse when younger than ~3 days **and** `backend` is unchanged. Refetch when missing, stale, the backend changed, or the user passes `--refresh` / `/issue --refresh`.
- **Transparency** — label staleness in the plan header (`Catalogs (cached, 2d ago): …`).

```jsonc
{
  "detected_at": 1718900000,
  "backend": "github",
  "labels": [{ "name": "bug", "description": "…", "color": "d73a4a" }],
  "teams": [{ "id": "…", "name": "Engineering", "key": "ENG" }], // Linear — id resolves issue.linear.team
  "projects": [{ "id": "…", "name": "Platform" }],
  "states": [{ "id": "…", "name": "Todo", "type": "unstarted" }] // Linear workflow states
  // extensible: members, milestones, …
}
```

Purpose: **read the catalog and choose contextually** — labels are deliberately not pinned in the config.

## Setup flow (first run / `/issue setup`)

Triggered when the config is missing/incomplete or the user runs `/issue setup`. Guided through the essentials only; everything else stays an editable config key.

1. **Pick the backend — always ask, never set silently.**
   - GitHub remote present (`gh repo view` succeeds) → ask "GitHub or Linear?", **default GitHub**.
   - No GitHub remote → ask "which backend?", **no default**.
   - Write the answer to `issue.backend`; from then on the config wins and the skill never re-guesses.
2. **Language rules** — title and body (`en` / `de` / `match`).
3. **Title convention** — `plain` (default) or `conventional`.
4. **Backend defaults (only what's needed):**
   - **Linear** — check the MCP is authenticated **first** (if not, send the user to authenticate, then continue). List teams from the catalog and have the user **pick `team`** (the one required field). `project`/`priority`/`defaultState` stay optional config keys — not asked here.
   - **GitHub** — optionally a default issue template.
5. **Write the config** and **populate the cache** initially.

## Backend — GitHub (`gh`)

- **Availability** — `gh repo view --json nameWithOwner` (fails → not a GitHub repo or `gh` not authenticated).
- **Create** — `gh issue create --title <t> --body-file <f> [--label <l>] [--assignee <a>] [--milestone <m>] [--project <p>]`.
- **Update** — `gh issue edit <n> [--title …] [--body-file …] [--add-label …] [--milestone …]`; close with `gh issue close <n>`.
- **Search/list** — `gh issue list --search <q> --state <s>` or `gh search issues <q>`.
- **Catalogs** — `gh label list --json name,description,color`; milestones/projects via `gh api` / `gh project list`.
- **Issue templates** — detect `.github/ISSUE_TEMPLATE/*.md` **and** `*.yml` (forms); fill them like `gh-pull-request` fills PR templates.

### Sub-issues

GitHub's sub-issues are a REST feature, not yet first-class in `gh`. Create the children as normal issues, then link each via the API:

```bash
gh api -X POST repos/{owner}/{repo}/issues/{parent}/sub_issues -f sub_issue_id=<child_issue_id>
```

`<child_issue_id>` is the issue's **node/database id** (from `gh api repos/{owner}/{repo}/issues/{n} --jq .id`), not its number. Verify the endpoint against the current GitHub REST docs at build/run time — it is comparatively new.

## Backend — Linear (MCP)

The Linear MCP server's registered name varies per setup (`mcp__claude_ai_Linear__*`, `mcp__linear__*`, …). Reference the tools generically and discover them at runtime — do **not** hardcode the server name.

- **Auth/availability** — confirm the Linear MCP tools are present and authenticated. If not authenticated, call the server's `authenticate` tool / point the user to it, then continue.
- **Tools (generic names)** — `list_teams`, `list_projects`, `list_issue_labels`, `list_issue_statuses`, `create_issue`, `update_issue`, search/`list_issues`.
- **Team is required** to create — resolve `issue.linear.team` (name/key) to its id via the cached `teams`.
- **Sub-issues** — set `parentId` on the child create call. Catalogs (teams/projects/labels/states) → cache.

> **`allowed-tools` note.** This skill declares `Bash, Read, Grep, Glob` only — no MCP entry. `allowed-tools` accepts exact names only (no wildcards) and does **not** restrict which tools are callable; it only pre-approves the listed ones. The Linear MCP tools therefore remain fully callable, governed by the user's permission settings (they may prompt). Because the server name varies, it cannot be listed reliably anyway — omitting it is correct.

## Plan output

Present this before any write:

```text
issue plan
  backend : github
  action  : create
  catalogs: cached, 2d ago
  title   : Login fails on expired session
  labels  : bug, area:auth        (from catalog)
  body ▼
    ## Summary
    …
Run: gh issue create --title "Login fails on expired session" --label bug,area:auth --body-file <tmp>
```

For bulk, list each drafted issue (and parent/child links) under one plan. For plan-only mode, follow the plan with the exact command(s) / MCP call(s) and stop.

## Worked examples

- **Create (GitHub)** — "open an issue for the expired-session bug we just found." Backend `github`; action create; draft title+body from the session; pick `bug` + `area:auth` from the cached labels; preview; on confirm `gh issue create …`; report the URL.
- **Bulk sub-issues (Linear)** — "split this epic into 3 sub-issues." Backend `linear`; resolve `team` `ENG` → id; draft parent + 3 children; one bundled preview; on confirm create the parent, then each child with `parentId`; report the ids.
- **Search before create** — "is there already a ticket about flaky CI?" Action search; `gh issue list --search "flaky CI"` (or Linear `list_issues`); report matches; offer to create only if none fit.
