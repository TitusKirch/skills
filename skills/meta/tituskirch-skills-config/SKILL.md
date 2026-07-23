---
name: tituskirch-skills-config
summary: Sets up, reconciles, and drift-checks .tituskirch-skills.json, the shared config the other TitusKirch skills read.
description: Creates, reconciles, and drift-checks `.tituskirch-skills.json` — the committed, repo-root config the other TitusKirch skills (atomic-commit, pull-request, issue, release, merge-deps, work-implement, work-implement-queue, write-docs) read to pick forges, trackers, languages, and conventions per repo. Routes by state — guided setup when the config is missing or a section is incomplete, desired-state reconcile against the schema when it exists, and a report-only drift check that flags config gone stale against the repo — a renamed skill or scope, a moved branch, a deleted label or template, a label an issue template names but the tracker doesn't have. Detects repo signals (remote host, gh/Linear availability, integration branch, commitlint, project type) to propose defaults, gates forge/tracker choices to what actually works, previews a plan, and writes only after confirmation. Also fires proactively after a skill, scope, branch, or label is renamed or removed in the session, to catch the config drifting. Use when the user wants to set up, configure, onboard, fix, or drift-check the TitusKirch skills config, mentions `.tituskirch-skills.json`, or says things like "configure the skills", "set up the config", "onboard this repo", "check the config", "keep the config in sync", "skills config einrichten", "config reparieren".
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - WebFetch
---

# tituskirch-skills-config

`.tituskirch-skills.json` at the repo root is the optional, committed config the other TitusKirch skills read — each setting resolved per repo as **config → native → built-in default**. This skill owns the file's **lifecycle**: create it, grow it, reconcile it. It does **not** own the schema. Every key, type, enum, and default lives once in [`tituskirch-skills.schema.json`](https://raw.githubusercontent.com/TitusKirch/skills/main/tituskirch-skills.schema.json) — the **single source of truth**. Read it to validate and enumerate keys; never restate it here or copy defaults into a repo's config. **Fetch it raw** (`curl` via Bash) — WebFetch only summarizes and drops the exact enums. **Staleness guard** — the `main` URL can be CDN-cached or predate the installed skill, so if the fetched schema lacks a section this skill documents (`commit` / `pr` / `issue` / `release` / `mergeDeps` / `docs` / `work`), your copy is stale; re-fetch cache-busted before telling the user a key or section is unsupported.

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

`config → native → built-in default` means an absent key or section is **defaults, not off**. So write **only** the essentials and the choices the user actually makes; never write a key set to its own default — it is a no-op that only invites drift. Every skill section — `commit`, `pr`, `release`, `mergeDeps`, `issue`, `docs`, `work` — accepts an explicit `false` to **disable** that skill for the repo, distinct from an absent block, which just falls back to defaults. Use `false` when a skill can't or shouldn't run here (e.g. no working forge/tracker); omit when it's simply unconfigured.

## Setup — config missing, or a section incomplete

Walk the sections; per section, propose from detection, ask only the **essentials**, and leave everything else an editable key.

**Forge & tracker selection is capability-gated** — always ask, never auto-select (not even when only one option works). Offer only forges/trackers whose tooling actually works here; show the rest with the reason they're out:

- **`github`** — viable only if the remote host is GitHub (`git remote get-url`) **and** `gh auth status` covers that host. gh signed in to github.com while the remote is GitLab / Gitea / Bitbucket → not viable.
- **`linear`** — viable only if the Linear MCP answers (`whoami` / list teams).
- **`none`** — always offered. Either omit the section (unconfigured — runs only when explicitly invoked) or write `false` to **disable** the skill outright (it refuses even when invoked). Prefer `false` when the repo has no working forge/tracker, so an accidental call stops cleanly.

A repo with no working forge/tracker (e.g. self-hosted GitLab) just lands on `none` — no special-casing. The **forge** lives once at the repo root as `forge`, `github`-only in the schema and shared by `pr` / `release` / `mergeDeps`; when the remote isn't GitHub, name it as a known gap.

**Three keys live at the root, not in a section** — `forge`, `language` and `verify` — because each is a fact about the **repo** that several skills need. Put a shared fact in one skill's section and disabling that skill silently withdraws it from the others, so when a repo states its check command, write it as the root `verify`.

- **root `language`** — existing config / repo language → ask → default `en`.
- **`commit`** — usually omit the whole block; `scopes` defaults to `auto`. Add `scopeVocab` / `instructions` only on an explicit preference.
- **`pr`** — `false`-or-omit; the forge comes from the root `forge` key (above). Propose `base` when the repo integrates onto a non-default branch (e.g. a `dev` branch exists). `title.convention` is `conventional` when commitlint or a Conventional-Commits history is present, else ask.
- **`issue`** — pick the tracker (above). For Linear, list teams and pick `linear.team` (the one required field). Set the languages, `title.convention` (`plain` default), and `labels.exclude` for catalog labels the agent must never auto-apply.
- **`release`** — `promote` is the one key worth asking about: it defaults to `false` (promotion is opt-in), so a repo that wants `pr.base` merged onto its release branch **must say so**. Propose `auto` when automation already opens the rollup PR (a workflow opening `base ← head` on push), `create` when nothing does, and leave it out when promotion isn't this skill's business. Branches and `timeout` default — omit them. `false` for the whole section when the repo has no release-please setup.
- **`mergeDeps`** — only when the repo wants its Dependabot PR queue merged. `merge` is the key worth asking about: it defaults to `false` (report-only), so a repo that wants merges **must say so** (`patch` / `grouped` / `all`) — the same opt-in shape as `release.promote`. `verify` falls back to the root `verify`; `cap` defaults to 5 — omit both unless overriding. `false` for the whole section to disable the skill outright.
- **`docs`** — `preset` from project type (cli / library / app / infra / ai-tool), or `false` to opt out; language inherits root. `docs.instructions` for repo-wide docs wording, only on an explicit preference.
- **`work`** — only when the repo runs the queue. Pick the tracker (above); it and `linear.team` fall back to `issue.*`. Set `cap` (default 10), `branch` (`worktree` default), and the lifecycle `labels`. **On Linear the schema requires `linear.team`, `linear.statuses` (startable states) and `labels.repo` (the repo discriminator) — set all three.** Also offer `linear.states` — the lifecycle step → workflow state map. It has no default (state names are per-team), and without it the worker moves the label but never the board, so propose it from the team's real states rather than leaving it out silently.

- **`profiles`** — never propose one during setup. A profile answers "this context wants different values", which a fresh repo has no evidence for; write one only when the user names the context and what should differ in it.

**Fast-path** — most repos reduce to one real decision (commit auto-detects from commitlint, languages default to `en`, forges/trackers resolve to a single viable option or `none`). After detection, name only what is actually non-default and ask those — don't walk every section aloud when just `docs.preset` is open.

## Profiles — one config, several execution contexts

`profiles` holds named overlays, each a **partial** config deep-merged onto the base when selected. It exists for the case where the same repo wants different behaviour depending on who is running: a remote runner that should open pull requests where a local session commits straight onto the integration branch.

```json
{
  "work": { "branch": "branch:dev" },
  "profiles": {
    "ci": { "work": { "branch": "worktree" }, "release": false }
  }
}
```

Four rules govern what may go in one:

- **Write only the delta.** The overlay merges recursively, so a profile touching `work.branch` leaves every other `work` key intact. Repeating the base's values is the same no-op as writing a default, and it drifts the moment the base changes.
- **A fragment need not be valid alone, but the merged result must be.** The schema references section _shapes_ inside `profiles` — no required keys, no cross-key rules — precisely so `{"tracker": "linear"}` is writable. The constraints still apply to what the merge produces, so check the merged config, never the fragment.
- **Arrays and scalars replace; they do not merge.** A profile setting `commit.scopeVocab` replaces the whole list. Where the intent is "the base plus one more", the base is the wrong place for the shared part.
- **Profiles do not nest**, and a profile may not contain `profiles` or `$schema`.

**Selection is explicit.** `TITUSKIRCH_SKILLS_PROFILE` names the profile; failing that, `CI` holding a truthy value selects `ci`. An unset or unknown name resolves to the base config unchanged — so a typo degrades to the base rather than to something arbitrary. When writing a profile, say which variable the context sets, because a profile nothing selects is dead config.

**In reconcile & check**, treat profiles as first-class: a profile referencing a branch, label or template that no longer exists is the same drift as in the base, and an overlay whose every value now equals the base is worth reporting as removable.

Write the file with a leading `$schema` key pointing at the canonical raw URL so editors validate it. Plan → confirm → write.

## Reconcile & check — config exists

Desired-state, idempotent — a `--fix` linter for the config. **check** is the same job in report-only mode — it runs steps 1–2 and reports the drift, but never writes.

1. Read the config fresh **and** the schema (local `tituskirch-skills.schema.json`, else fetch the canonical URL).
2. Diff against the schema **and the repo**, then group the plan:
   - **Auto-fix (mechanical)** — unknown or removed keys, a value off the schema's enum with one unambiguous correction, a `commit.scopeVocab` missing a current skill / package scope, a missing `$schema` pointer, key ordering.
   - **Prompt (value-needing)** — a required value that is absent (`issue.tracker` `linear` with no `linear.team`, or `work.tracker` `linear` without `linear.statuses` / `labels.repo` — both now schema-enforced by if/then), or a setting the repo can no longer satisfy (a `pr.base`, template, label, team, or `scopeVocab` folder that does not exist).
   - **Report only** — a key written to its own default (suggest dropping it — resolution order makes it a no-op), never auto-removing one that documents deliberate intent; and a **label an issue template declares that the tracker doesn't have** (below).
3. Show the **plan + diff**; on confirm, write **only** config keys. **check** stops here — it never writes.

**Template labels are swept too.** An issue template's `labels:` is a claim about repo reality exactly like a `pr.base` or a lifecycle label, but nothing enforces it: GitHub applies the names that exist and drops the rest **silently**, so the template keeps looking correct while quietly doing less than it says. Read every template under `.github/ISSUE_TEMPLATE/` — `*.yml` and `*.md` alike, never `config.yml`, which is the chooser's config and not a template — collect the label names each declares, and check them against the tracker's real labels (`gh label list`; on Linear the configured team's labels, since labels are team-scoped there — the same catalog the `issue` skill caches). Report per finding **which template names which missing label**, plus the closest existing name where there is one (`enhancement` → `improvement`), so a human can tell a rename from an omission. This matters more the more the templates are trusted: once a template is selected by reading it, the labels it declares reach the created issue directly.

**Report only — never auto-fixed.** Creating the missing label and correcting the template are opposite repairs, and only the human knows which was meant. It is also outside what this skill writes: the finding names the drift, the fix stays with the user.

## Config

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

## Guardrails

- **Plan → confirm → write.** Respect plan-only / dry-run.
- **The schema is the single source of truth** — read it to validate and enumerate; never duplicate it into a repo's config or into this skill.
- **Forge/tracker is never guessed or auto-selected** — always asked, with the offered options gated to what actually works here (see Setup).
- **Minimal config** — resolution order means defaults need not be written.
- **Valid before writing** — the result must be valid JSON and validate against the schema. Only ever touch `.tituskirch-skills.json`.
- **Commit via `atomic-commit`**, not from here.

## Reference

- Every key, type, enum, and default: [`tituskirch-skills.schema.json`](https://raw.githubusercontent.com/TitusKirch/skills/main/tituskirch-skills.schema.json) — the single source of truth.
- Per-section setup detail and forge/tracker recipes stay with each owning skill: `issue`, `pull-request`, `release`, `merge-deps`, `work-implement`, `write-docs`.
