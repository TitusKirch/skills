# issue — Reference

Mechanics for the [SKILL.md](SKILL.md) workflow. One skill, two trackers (GitHub `gh` / Linear MCP), chosen per-repo by config.

## Config

`.tituskirch-skills.json` at the repo root (`$(git rev-parse --show-toplevel)`) is an optional, committed config shared across TitusKirch skills. The `issue.*` section is this skill's. **Resolve it before reading it** — [Reading the config](#reading-the-config) is the single statement of how, including what happens when `jq` is absent. An _absent config file_ is what triggers setup; a missing `jq` is not, and never degrades to GitHub detection. Resolution per setting: **config → native → built-in default**.

```json
{
  "language": "de",
  "issue": {
    "tracker": "github",
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

| Key                                            | Effect                                                                                                                                                       |
| :--------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `issue.tracker`                                | `github` or `linear` — the active tracker (set by setup, never guessed silently)                                                                             |
| `issue.language`                               | title/body language — scalar (a code/name or `match`) or `{ title, body }`; falls back to root `language`                                                    |
| `issue.title.convention`                       | `plain` (default — most trackers) or `conventional` (`type: subject`)                                                                                        |
| `issue.instructions`                           | free-text wording guidance for the title/body — additive, never overrides tracker rules or guardrails                                                        |
| `issue.linear.team`                            | **required to create on Linear** (schema-enforced when `issue.tracker` is `linear`) — a human name/key (e.g. `"ENG"`); resolved to the team id via the cache |
| `issue.linear.{project,priority,defaultState}` | optional Linear defaults (`priority`: none/low/medium/high/urgent)                                                                                           |
| `issue.github.template`                        | optional default issue template                                                                                                                              |
| `issue.labels.exclude`                         | glob patterns (e.g. `stack:*`, `autorelease:*`, `dependencies`) for catalog labels the agent must never apply                                                |

`language` is a shared root key; `issue.*` is this skill's section (`commit.*`/`pr.*` belong to the other skills). `issue.instructions` mirrors `commit.instructions` / `pr.instructions` — additive wording guidance that never overrides the tracker rules, template, or guardrails. On Linear it also reads the cross-skill key `work.labels.repo` to pin a repo-scope tag on create. Full schema: the repo-root `tituskirch-skills.schema.json`.

```bash
# $resolved comes from the resolver — see "Reading the config" in this file.
tracker=$(printf '%s' "$resolved" | jq -er '.issue.tracker // empty' 2>/dev/null) || tracker=
team=$(printf '%s' "$resolved" | jq -er '.issue.linear.team // empty' 2>/dev/null) || team=
instructions=$(printf '%s' "$resolved" | jq -er '.issue.instructions // empty' 2>/dev/null) || instructions=
```

<skills-config>

### Reading the config

The config is `.tituskirch-skills.json` at the **consuming repo's** root — committed, optional, and shared by every TitusKirch skill. Absent means detection and built-in defaults, never an error. Its keys, types and defaults are defined by [`tituskirch-skills.schema.json`](https://raw.githubusercontent.com/TitusKirch/skills/main/tituskirch-skills.schema.json).

**Resolve it before reading it.** A repo may define `profiles` — named overlays for an execution context, so a remote runner can open pull requests where a local session commits directly. [`templates/resolve-config.sh`](templates/resolve-config.sh) prints the resolved config, and every skill ships the same copy, so they all see the same values:

```sh
# Fill in this skill's own directory — the path this file was loaded from, not the
# repo being worked on. It is a blank to fill, not a variable that is already set.
skill=/absolute/path/to/this/skill

resolved=$(sh "$skill/templates/resolve-config.sh"); status=$?
case $status in
0)  [ -n "$resolved" ] || resolved='{}' ;;   # ran fine; empty means the repo has no config
10) resolved= ;;                           # no jq — read the file yourself, see below
*)  echo "resolve-config failed ($status)" >&2; exit 1 ;;
esac
```

**A failure here is never silent.** Any exit other than `0` or `10` means the resolver could not be found or could not run, and the only wrong response is to carry on with `{}` — that reports the repo's defaults as if they were its settings. Stop and say what failed.

The profile comes from `TITUSKIRCH_SKILLS_PROFILE`, falling back to `ci` when `CI` holds a truthy value, and to no profile otherwise. An unset or unknown name yields the base config unchanged.

**The merge is a rule, not just a command.** Objects merge recursively at any depth, arrays and scalars are replaced rather than concatenated, an explicit `null` sets null rather than deleting a key, and `profiles` is dropped from the result. Any path that resolves the config by other means owes the same semantics.

**`jq` may not be installed.** It ships preinstalled on none of Windows, macOS or Linux, and `gh`'s built-in `--jq` is no substitute — that filters API responses, it cannot read a local file. `resolve-config.sh` exits `10` in that case. Do **not** fall through to defaults: `Read` the file, apply the merge rule above, and carry on with the repo's real values. Nothing else is needed — no Node, no Python.

**Guard every read, resolve into a variable, then use it.** Never let a substitution reach a command flag directly — `jq -r` prints the literal string `null` for a missing key, and an empty value is silently ignored by some tools rather than matching nothing:

```sh
value=$(printf '%s' "$resolved" | jq -er '.section.key // empty' 2>/dev/null) || value=
[ -n "$value" ] || value=<documented default>
```

**Tell "off" apart from "absent".** `// empty` collapses `false` and a missing key into the same empty string, which turns a deliberately disabled mechanic into its default. Where a key may be `false`, resolve it as `select(. != null) | tostring` and test for the string afterwards.

**Snippets are POSIX `sh`.** No `[[ ]]`, no arrays, no `<<<`, and nothing that differs between GNU and BSD coreutils — the shell is whatever the user runs.

</skills-config>

## Catalog cache

Enumerable tracker data, fetched once and reused so the agent can pick labels/state/team contextually.

- **Location** — `$(git rev-parse --git-common-dir)/tituskirch-skills/issue`. Owner-namespaced directory in the common git dir (shared across branches/worktrees, never tracked). Create it before writing (`mkdir -p`). **JSON** — this skill already depends on `jq`, and the catalogs are structured (unlike the flat `conventions` cache the commit/PR skills share).
- **Validity** — reuse when younger than ~3 days **and** `tracker` is unchanged. Refetch when missing, stale, the tracker changed, or the user passes `--refresh` / `/issue --refresh`.
- **Transparency** — label staleness in the plan header (`Catalogs (cached, 2d ago): …`).

```jsonc
{
  "detected_at": 1718900000,
  "tracker": "github",
  "labels": [{ "name": "bug", "description": "…", "color": "d73a4a" }],
  "teams": [{ "id": "…", "name": "Engineering", "key": "ENG" }], // Linear — id resolves issue.linear.team
  "projects": [{ "id": "…", "name": "Platform" }],
  "states": [{ "id": "…", "name": "Todo", "type": "unstarted" }] // Linear workflow states
  // extensible: members, milestones, …
}
```

Purpose: **read the catalog and choose contextually** — labels are deliberately not pinned in the config; the agent only skips whatever `issue.labels.exclude` lists.

## Setup flow (first run / `/issue setup`)

Triggered when the config is missing/incomplete or the user runs `/issue setup`. Guided through the essentials only; everything else stays an editable config key.

1. **Pick the tracker — always ask, never set silently.**
   - GitHub remote present (`gh repo view` succeeds) → ask "GitHub or Linear?", **default GitHub**.
   - No GitHub remote → ask "which tracker?", **no default**.
   - Write the answer to `issue.tracker`; from then on the config wins and the skill never re-guesses.
2. **Language rules** — title and body (any language, or `match`).
3. **Title convention** — `plain` (default) or `conventional`.
4. **Tracker defaults (only what's needed):**
   - **Linear** — check the MCP is authenticated **first** (if not, send the user to authenticate, then continue). List teams from the catalog and have the user **pick `team`** (the one required field). `project`/`priority`/`defaultState` stay optional config keys — not asked here.
   - **GitHub** — optionally a default issue template.
5. **Write the config** and **populate the cache** initially.

## Tracker — GitHub (`gh`)

- **Availability** — `gh repo view --json nameWithOwner` (fails → not a GitHub repo or `gh` not authenticated).
- **Create** — `gh issue create --title <t> --body-file <f> [--label <l>] [--assignee <a>] [--milestone <m>] [--project <p>]`.
- **Update** — `gh issue edit <n> [--title …] [--body-file …] [--add-label …] [--milestone …]`; close with `gh issue close <n>`.
- **Search/list** — `gh issue list --search <q> --state <s>` or `gh search issues <q>`.
- **Catalogs** — `gh label list --json name,description,color`; milestones/projects via `gh api` / `gh project list`.
- **Issue templates** — detect `.github/ISSUE_TEMPLATE/*.md` **and** `*.yml` (forms); fill them like `pull-request` fills PR templates.

### Sub-issues

GitHub's sub-issues are a REST feature, not first-class in `gh` yet — create the children as normal issues, then link each via `gh api`. `sub_issue_id` is the child's **database id** (integer), **not** its issue number: fetch it with `gh api repos/{owner}/{repo}/issues/{n} --jq .id`, and pass it typed with `-F` (not `-f`, which sends a string).

```bash
# add a child to a parent
gh api --method POST repos/{owner}/{repo}/issues/{parent}/sub_issues -F sub_issue_id=<child_db_id>

# list a parent's sub-issues
gh api repos/{owner}/{repo}/issues/{parent}/sub_issues

# remove one (note the singular path segment: sub_issue)
gh api --method DELETE repos/{owner}/{repo}/issues/{parent}/sub_issue -F sub_issue_id=<child_db_id>
```

Add `-F replace_parent=true` to reparent a child that already has a parent. Reprioritize with `PATCH .../issues/{parent}/sub_issues/priority` (`sub_issue_id` + `after_id`/`before_id`).

## Tracker — Linear (MCP)

The Linear MCP server's registered name varies per setup (`mcp__claude_ai_Linear__*`, `mcp__linear__*`, …). Reference the tools generically and discover them at runtime — do **not** hardcode the server name.

- **Auth/availability** — confirm the Linear MCP tools are present and authenticated. If not authenticated, call the server's `authenticate` tool / point the user to it, then continue.
- **Tools (generic names)** — `list_teams`, `list_projects`, `list_issue_labels`, `list_issue_statuses`, `create_issue`, `update_issue`, search/`list_issues`.
- **Team is required** to create — resolve `issue.linear.team` (name/key) to its id via the cached `teams`.
- **Repo-scope label** — when `work.labels.repo` is a string, apply it on **every** create (alongside the contextual labels) so [`work-implement-queue`](../work-implement-queue/SKILL.md) can scope this repo's issues on a shared Linear team; GitHub needs none (repo-local).
- **No repo templates** — unlike GitHub, Linear has no in-repo issue templates (`issue.github.template` is GitHub-only). Linear's templates live server-side per team; if the MCP exposes them, offer one, otherwise **draft a clean default body** from the description + session context (the same fallback `pull-request` uses for a missing PR template).
- **Sub-issues** — set `parentId` on the child create call. Catalogs (teams/projects/labels/states) → cache.

> **`allowed-tools` note.** This skill declares `Bash, Read, Grep, Glob` only — no MCP entry. `allowed-tools` accepts exact names only (no wildcards) and does **not** restrict which tools are callable; it only pre-approves the listed ones. The Linear MCP tools therefore remain fully callable, governed by the user's permission settings (they may prompt). Because the server name varies, it cannot be listed reliably anyway — omitting it is correct.

## Plan output

Present this before any write:

```text
issue plan
  tracker : github
  action  : create
  catalogs: cached, 2d ago
  title   : Login fails on expired session
  labels  : bug, area:auth        (from catalog)
  body ▼
    ## Summary
    …
Run: gh issue create --title "Login fails on expired session" --label bug,area:auth --body-file <tmp>
```

**Fields, not prose** — labels, milestone, project, assignee and state live in the plan header and are applied via flags / MCP params; never write them into the body, and omit any that are unset (no `No milestone` / `Labels: none` lines).

For bulk, list each drafted issue (and parent/child links) under one plan. For plan-only mode, follow the plan with the exact command(s) / MCP call(s) and stop.

## Worked examples

- **Create (GitHub)** — "open an issue for the expired-session bug we just found." Tracker `github`; action create; draft title+body from the session; pick `bug` + `area:auth` from the cached labels; preview; on confirm `gh issue create …`; report the URL.
- **Bulk sub-issues (Linear)** — "split this epic into 3 sub-issues." Tracker `linear`; resolve `team` `ENG` → id; draft parent + 3 children; one bundled preview; on confirm create the parent, then each child with `parentId`; report the ids.
- **Search before create** — "is there already a ticket about flaky CI?" Action search; `gh issue list --search "flaky CI"` (or Linear `list_issues`); report matches; offer to create only if none fit.
