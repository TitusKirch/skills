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
    "template": ".github/ISSUE_TEMPLATE/bug_report.yml"
  }
}
```

| Key                                            | Effect                                                                                                                                                                                          |
| :--------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `issue.tracker`                                | `github` or `linear` — the active tracker (set by setup, never guessed silently)                                                                                                                |
| `issue.language`                               | title/body language — scalar (a code/name or `match`) or `{ title, body }`; falls back to root `language`                                                                                       |
| `issue.title.convention`                       | `plain` (default — most trackers) or `conventional` (`type: subject`)                                                                                                                           |
| `issue.instructions`                           | free-text wording guidance for the title/body — additive, never overrides tracker rules or guardrails                                                                                           |
| `issue.linear.team`                            | **required to create on Linear** (schema-enforced when `issue.tracker` is `linear`) — a human name/key (e.g. `"ENG"`); resolved to the team id via the cache                                    |
| `issue.linear.{project,priority,defaultState}` | optional Linear defaults (`priority`: none/low/medium/high/urgent)                                                                                                                              |
| `issue.template`                               | forces one issue template on **either tracker** — a repo-relative **path** to the file, not a template name; unset, the skill chooses by reading them (see [Issue templates](#issue-templates)) |
| `issue.labels.exclude`                         | glob patterns (e.g. `stack:*`, `autorelease:*`, `dependencies`) for catalog labels the agent must never apply                                                                                   |

`issue.template` sits at the `issue.*` level, not under `issue.github`, because the templates it points at are read on **both** trackers ([Issue templates](#issue-templates)). `issue.github.template` is the older location and is still read as a fallback when `issue.template` is unset, so an existing config keeps working; it is deprecated, GitHub-only by its nesting, and setup writes the new key.

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
   - **GitHub** — nothing required; the tracker needs no defaults of its own.
5. **Issue template (optional, either tracker)** — the repo may **force** one template via `issue.template`, given as a path under `.github/ISSUE_TEMPLATE/`. Ask only when the repo ships templates, and leave it unset in the normal case: the skill then picks per issue by reading the templates' own descriptions. Not a GitHub question — the same files are used on Linear.
6. **Write the config** and **populate the cache** initially.

## Issue templates

**A template is a repo statement, not a tracker feature.** `.github/ISSUE_TEMPLATE/` says how _this project_ writes issues, and that stays true whichever tracker receives them — so the same files are read on **GitHub and Linear alike**. The tracker decides **where** an issue is filed; it does not decide **what shape** the body has. Nothing extra is needed to make that work: the skill composes the body itself on both trackers, a `.md` template is plain markdown, and only `.yml` forms need turning into headings — work the GitHub path already does. The directory name is a repo convention that GitHub happens to also render; it is not a reason to drop the structure on Linear.

`issue.template` is a **repo-relative path** to the file (`.github/ISSUE_TEMPLATE/bug_report.yml`), not a template name. A path stays a single identifier across both formats and both trackers, which a name cannot be.

**Why a path and not a name — the GitHub mechanics.** The skill reads the file and composes the body itself, then writes it with `--body-file`; **`gh issue create --template` is never used**, so gh's name-based lookup does not constrain the value. Two independent reasons, both verified against `gh` 2.92:

- `--template` is refused outright alongside a body — it errors with "`--template` is not supported when using `--body` or `--body-file`" before doing anything — and this skill always sends the body it drafted.
- `--template` matches only the `name:` of a template that GitHub's GraphQL `repository.issueTemplates` returns, and that field lists **`.md` templates only**. A repo whose templates are all `.yml` forms reports an empty list, so no value of any shape reaches them. This repo is exactly that case.

The two formats are different kinds of file and are filled differently — the same way on either tracker, since the body is composed before it is sent:

| File    | What it is                                                                    | How the body is produced                                                                                                                                                                                                           |
| :------ | :---------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `*.md`  | a body, optionally preceded by `name`/`about`/`labels` frontmatter            | drop the frontmatter, keep the markdown, fill its sections                                                                                                                                                                         |
| `*.yml` | a **form definition** GitHub renders in its web UI — the file is never a body | the API stores whatever markdown it is sent, so reproduce each field's `label` as an `##` heading and answer it; keep `validations.required` fields, and skip `type: markdown` blocks — those are web-UI instructions, not content |

**Choosing one — read the templates, don't map them.** `issue.template` forces a template and ends the choice. With no forced value the skill picks one itself, exactly as it picks labels from the catalog:

1. Enumerate `.github/ISSUE_TEMPLATE/*.md` and `*.yml`, skipping `config.yml`.
2. Read each one's own selection rule — `name` + `description` (`.yml` forms), `name` + `about` (`.md` frontmatter). That text states **when the template applies**; it is structurally the same job a skill's `description` does when Claude picks between skills.
3. Match the drafted intent against it and take the best fit. No fit → fall back to the [default body structure](#default-body-structure), unless blank issues are disabled (below).

A `"bug" → "🐛 Bug report"` table in the config would be a **second copy** of what the templates already say, drifting the moment one is renamed. There is deliberately no such key: force one template, or none.

**`blank_issues_enabled: false` is binding — on both trackers.** `.github/ISSUE_TEMPLATE/config.yml` is the chooser's own config, not a template — never treat it as one — but it **is** read:

- `blank_issues_enabled: false` — the repo refuses template-less issues. GitHub's web UI enforces that; **no API does**, so the skill must, and it is the repo talking rather than GitHub, so it binds on Linear too. A template is then mandatory: pick one, and if none fits, say so in the plan and let the human choose rather than filing a blank issue.
- `blank_issues_enabled: true`, or the file absent — a template-less body is fine when nothing fits.
- `contact_links` are external destinations, not templates — never select one.

**With a template, labels reverse direction.** Without one the skill picks labels from the catalog and then writes a body. With one, the template's `labels:` are **already decided** — the repo's own declaration, taken as-is — and the skill only **adds** what they don't already cover. `issue.labels.exclude` governs those additions; it does not strip what the template itself declares. They stay fields on the create call either way, never body text. **On Linear, match them against the team's label catalog first**: labels are team-scoped there, so a name a template declares may not exist. Apply the ones that resolve, and **name the ones that don't in the plan** — never create a Linear label to satisfy a template.

**The preview is the safety net.** Name the chosen template in the [plan](#plan-output) beside title, body and labels, with how it was chosen (forced by config / matched on its description). The match need not be perfect automatically — it needs to be **visible before the write**, so a human can redirect it.

## Default body structure

No template fits, or the repo ships none — the body still has a shape, and it is **this skill's own**, on either tracker. It is the [altitude rule](SKILL.md#4-draft-the-content) written down as sections: **outcome, context, open questions**.

| Section             | What goes in it                                                                              | When it is omitted                                                  |
| :------------------ | :------------------------------------------------------------------------------------------- | :------------------------------------------------------------------ |
| `## Problem`        | the context — what is wrong, missing or awkward today, and why that matters                  | never; it is why the issue exists                                   |
| `## Wanted`         | the outcome — the desired end state, stated as _what_, not routes, files, layers or commands | when the problem statement already _is_ the ask (a pure question)   |
| `## Open questions` | the decisions genuinely still open, one per bullet                                           | whenever there are none — an empty section is worse than no section |

**A starting point, not a form.** Rename a heading when the subject reads better under a different one (`## Goal`, `## The bug`, `## The rule`), and add sections the subject actually calls for — `## Evidence`, `## Sources`, `## Proposal`, `## Not in scope`, `## Rejected alternatives`. Drop what has no content instead of filling it with `N/A` or `none`. The failure mode is a rigid skeleton that pads every issue to the same length; the structure exists so nothing has to be invented from scratch, not so every issue comes out identical.

**A `## Not in scope` / `## Rejected alternatives` section is a boundary, not an implementation plan** — it names what the issue deliberately does _not_ ask for, which is still an outcome statement. It does not license the build steps the altitude rule rules out.

The rest of the body rules apply unchanged: the configured language, `issue.instructions` wording guidance, no field state in prose ([Plan output](#plan-output)), no attribution, no secrets.

**Not a way around a mandatory template.** Where `blank_issues_enabled: false` binds, this structure is not the escape hatch — a template is still required, and "none fits" goes in the plan for a human to settle.

**It is not `pull-request`'s fallback, and never borrows it.** That skill's `## Summary` / `## Changes` / `## Related issues` describes work already done; an issue describes work wanted, so `## Changes` has no referent yet and reads as a plan the issue is not allowed to contain. Two skills, two documents, two defaults — this one is stated here in full so nothing has to be fetched from the other.

## Tracker — GitHub (`gh`)

- **Availability** — `gh repo view --json nameWithOwner` (fails → not a GitHub repo or `gh` not authenticated).
- **Create** — `gh issue create --title <t> --body-file <f> [--label <l>] [--assignee <a>] [--milestone <m>] [--project <p>]`.
- **Update** — `gh issue edit <n> [--title …] [--body-file …] [--add-label …] [--milestone …]`; close with `gh issue close <n>`.
- **Search/list** — `gh issue list --search <q> --state <s>` or `gh search issues <q>`.
- **Catalogs** — `gh label list --json name,description,color`; milestones/projects via `gh api` / `gh project list`.
- **Issue templates** — detect `.github/ISSUE_TEMPLATE/*.md` **and** `*.yml` (forms) and fill them per [Issue templates](#issue-templates), which is tracker-neutral — nothing in it is GitHub-only except the `--template` note.

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
- **Repo templates apply here too** — the repo's `.github/ISSUE_TEMPLATE/` files are read on Linear exactly as on GitHub ([Issue templates](#issue-templates)); that directory is a repo convention, not a GitHub feature, and the tracker does not get to change the body's shape. Nothing is filed template-less on Linear that would have used a template on GitHub.
- **Linear's own server-side templates are not reached** — deliberately. The MCP exposes none: there is no listing tool, and `save_issue` (the only create path) takes no template parameter, so no code path can request one. Reproducing that structure over Linear's GraphQL API was considered and rejected — a new API surface for something the repo already states in a file both trackers can read.
- **A team's default template does not overwrite what the API sends.** A Linear default template is a **composer pre-fill**: it puts the template's text into the description field _before_ the issue is submitted — that is how Linear's docs describe it for the in-app composer and for the Slack integration ("that template's text will appear in the description field"). An API-created issue arrives with `description` already set and no composer in the path, so there is nothing to pre-fill and the repo template's body is what is stored. A default template can still apply team-level **properties** (status, labels, priority) server-side; that is a fields effect, not a body one, and it does not collide with the template body. If a stored body ever does come back altered, the repo template is authoritative — report the discrepancy instead of re-drafting to match Linear.
- **Sub-issues** — set `parentId` on the child create call. Catalogs (teams/projects/labels/states) → cache.

> **`allowed-tools` note.** This skill declares `Bash, Read, Grep, Glob` only — no MCP entry. `allowed-tools` accepts exact names only (no wildcards) and does **not** restrict which tools are callable; it only pre-approves the listed ones. The Linear MCP tools therefore remain fully callable, governed by the user's permission settings (they may prompt). Because the server name varies, it cannot be listed reliably anyway — omitting it is correct.

## Plan output

Present this before any write:

```text
issue plan
  tracker : github
  action  : create
  catalogs: cached, 2d ago
  template: .github/ISSUE_TEMPLATE/bug_report.yml   (matched: "A skill isn't working as expected")
  title   : Login fails on expired session
  labels  : bug, triage           (from template)
          + area:auth             (from catalog)
  body ▼
    ## Summary
    …
Run: gh issue create --title "Login fails on expired session" --label bug,triage,area:auth --body-file <tmp>
```

**Fields, not prose** — labels, milestone, project, assignee and state live in the plan header and are applied via flags / MCP params; never write them into the body, and omit any that are unset (no `No milestone` / `Labels: none` lines).

**Show the template line on both trackers** — the path plus how it was chosen (`forced by config` / `matched: "<description>"` / `none — no template fits`). It is the one drafting decision a human can only correct if they see it, and the repo's templates are read on Linear too, so the line is never tracker-conditional. Omit it only where the repo ships no templates at all.

For bulk, list each drafted issue (and parent/child links) under one plan. For plan-only mode, follow the plan with the exact command(s) / MCP call(s) and stop.

## Worked examples

- **Create (GitHub)** — "open an issue for the expired-session bug we just found." Tracker `github`; action create; draft title+body from the session; pick `bug` + `area:auth` from the cached labels; preview; on confirm `gh issue create …`; report the URL.
- **Bulk sub-issues (Linear)** — "split this epic into 3 sub-issues." Tracker `linear`; resolve `team` `ENG` → id; draft parent + 3 children; one bundled preview; on confirm create the parent, then each child with `parentId`; report the ids.
- **Search before create** — "is there already a ticket about flaky CI?" Action search; `gh issue list --search "flaky CI"` (or Linear `list_issues`); report matches; offer to create only if none fit.
