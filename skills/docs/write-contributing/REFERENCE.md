# write-contributing — reference

Supporting detail for the [`write-contributing`](SKILL.md) skill: what each section holds, where every derived fact comes from, and the rules a reconcile pass follows.

## Section catalogue

The order in [SKILL.md](SKILL.md#structure--the-house-order) is fixed. What each section is **for**, and the failure it invites when it is written the other way:

| Section               | Holds                                                                                                | Never                                                                        |
| :-------------------- | :--------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------- |
| Title + intro         | One line: thanks, and what this document covers                                                      | A project pitch — that is the README's job                                   |
| Code of Conduct       | Two sentences and the link                                                                           | A summary of the code, which then disagrees with it                          |
| Reporting issues      | One line per intake route: bug, feature, question, security                                          | A description of what makes a good bug report — the issue template asks that |
| Development setup     | Runtime floor, package manager, `git clone` + install, and any one-time step the install does not do | Every environment variable; point at `.env.example`                          |
| Adding a new `<unit>` | The numbered path from empty folder to commit, ending at the commit message                          | A duplicate of the unit's own README or spec                                 |
| Running the suite     | The gate, then the few commands a contributor types by hand, one row each                            | A transcription of the manifest's scripts                                    |
| Branching & PRs       | The base branch, the commit convention with two or three real examples, one concern per PR           | A git tutorial                                                               |
| Style & quality gates | What runs on commit, and what to do when it fails                                                    | The lint rules themselves — the config owns those                            |
| Releases              | Two sentences: what cuts a release, from which branch, and what a contributor need not do            | A release runbook; that is the maintainer's, and belongs in `docs/`          |
| License               | Inbound = outbound, and the link                                                                     | A restatement of the license terms                                           |

**"Adding a new `<unit>`" is the one section with no generic form.** It exists only where the repo has a repeatable contribution shape — a skill, a package, a rule, a provider — and it is worth more than the rest of the guide combined when it does, because it is the section that turns a willing contributor into a merged PR. Derive its steps from the repo's own scaffolding: the generator command, the directory it writes into, the sync or codegen command that must follow, the check that will fail if it does not.

## Derivation table

One row per fact the guide states. **Owner** is read first; the fallback chain runs left to right; **never** names what must not stand in for it.

| Fact                  | Owner → fallback                                                                                            | Never                                                                                |
| :-------------------- | :---------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------- |
| **Base branch**       | `pr.base` in the config → the remote's default branch → ask                                                 | `main` by assumption, or the branch the session happens to be on                     |
| **Gate command**      | the root `verify` key → a `verify` / `check` / `test` script in the manifest → the command CI runs → ask    | the script's **body** in place of its name; a command in no manifest and no workflow |
| **Package manager**   | the committed lockfile → a `packageManager` / `engines.packageManager` pin                                  | `npm` because the manifest is a `package.json`                                       |
| **Runtime floor**     | `engines` → `.nvmrc` / `.tool-versions` / `mise.toml` → the CI matrix → ask                                 | the version installed on this machine                                                |
| **Commit convention** | a commitlint config → the husky hook that runs it → the last ~50 commit subjects                            | "Conventional Commits" because the repo happens to use them elsewhere                |
| **Commit scopes**     | a `scopeVocab` / `scope-enum` in the commitlint config → the scopes the recent history actually uses        | an invented scope list                                                               |
| **Commit hooks**      | `.husky/` + the lint-staged config → any other hook manager's config                                        | claiming a hook the repo does not install                                            |
| **Intake routes**     | `.github/ISSUE_TEMPLATE/*.yml` (one row each) + `config.yml`'s `contact_links` → the plain new-issue URL    | a route the forge does not offer, e.g. Discussions when they are off                 |
| **Security route**    | `SECURITY.md` → the forge's private-reporting setting                                                       | "open an issue" — the one instruction that must never appear here                    |
| **Code of Conduct**   | `CODE_OF_CONDUCT.md`                                                                                        | linking a code of conduct the repo does not carry                                    |
| **PR expectations**   | `.github/pull_request_template.md` → the PR checks that are required                                        | a checklist the template does not ask for                                            |
| **Release flow**      | the release tool's config and its workflow (release-please, changesets, semantic-release) → the tag history | describing a manual flow where automation exists, or the reverse                     |
| **Release branch**    | the release workflow's trigger branch                                                                       | assuming it is the same branch contributors target                                   |
| **License**           | `LICENSE` → the manifest's `license` field                                                                  | naming a license from the badge alone                                                |
| **Repo slug / URLs**  | the `origin` remote                                                                                         | the owner name from another repo's guide                                             |

**Where the config and a repo file disagree, the config wins** — it is the deliberate statement, the file the maintainer edited on purpose. Where two _files_ disagree, nothing wins: that is the **prompt** case, and it is reported with both candidates and their sources.

### Recipes

Enough to read each owner without guessing. All are reads; nothing here writes.

```sh
# Base branch — config first, then the remote's default.
base=$(printf '%s' "$resolved" | jq -er '.pr.base // empty' 2>/dev/null) || base=
[ -n "$base" ] || base=$(git symbolic-ref --short refs/remotes/origin/HEAD 2>/dev/null | sed 's|^origin/||')
# …and where the forge CLI is available and origin/HEAD is unset:
#   gh repo view --json defaultBranchRef --jq '.defaultBranchRef.name'

# Package manager — the lockfile is the fact; the pin is only the version.
#   pnpm-lock.yaml → pnpm · package-lock.json → npm · bun.lock/bun.lockb → bun · yarn.lock → yarn
#   composer.lock → composer · Cargo.lock → cargo
pm=
for probe in pnpm-lock.yaml:pnpm package-lock.json:npm bun.lock:bun bun.lockb:bun \
             yarn.lock:yarn composer.lock:composer Cargo.lock:cargo; do
  [ -f "${probe%%:*}" ] || continue
  pm=${probe#*:}; break
done
jq -r '.packageManager // empty' package.json 2>/dev/null   # the pinned version, where one exists

# Gate command — the root key, then the script the manifest declares.
# Take the script's KEY and prefix the package manager; never take its VALUE.
verify=$(printf '%s' "$resolved" | jq -er '.verify // empty' 2>/dev/null) || verify=
if [ -z "$verify" ]; then
  key=$(jq -er '.scripts | if has("verify") then "verify"
                           elif has("check") then "check"
                           elif has("test")  then "test"
                           else empty end' package.json 2>/dev/null) || key=
  [ -n "$key" ] && [ -n "$pm" ] && verify="$pm run $key"
fi

# Intake routes — one row per template, plus the contact links.
grep -l . .github/ISSUE_TEMPLATE/*.yml 2>/dev/null   # then read each file's `name:` and `description:`
```

**The gate fallback reads the script's name, never its body** — the one trap in this table, because `jq '.scripts.verify'` returns the value and looks right until you read it. The value is the **expansion** (`pnpm check && pnpm skills:check && pnpm typecheck && pnpm test`): a string no contributor types, that restates the manifest into the guide, and that goes stale the moment the script composes one command more. It is the [never transcribe a file](SKILL.md#style-rules) rule, hit on the single row the guide most needs correct — and this is the path **every repo without a config** takes, so it is the common case, not a corner. The two branches must also agree in kind: `.verify` yields a runnable command, so the fallback has to yield one too.

`<pm> run <key>` is always valid; pnpm, bun and yarn also accept the shorthand `<pm> <key>` for a name that collides with no built-in. Prefer whichever form the repo's own workflows and docs already type — that is another derivation, not a style choice. Composer repos read `composer.json`'s `scripts` the same way (`composer <key>`); a Cargo repo with no such manifest falls to `cargo test --locked`; and where no manifest declares one, the [table's](#derivation-table) next fallback is the command CI runs, then asking.

A template's new-issue URL is `https://github.com/<owner>/<repo>/issues/new?template=<file>`; a `config.yml` contact link carries its own `url` verbatim.

**A missing `jq` does not stop the derivation** — read the manifest with `Read` and take the same values. It stops only the config resolution, which the [config section](#config) covers.

## Reconcile rules

- **Read the file whole before planning.** A span cannot be classified derived or authored from a grep hit; the paragraph around it is what decides.
- **Classification is per statement, not per section.** A "Branching & PRs" section is usually one derived sentence (the base branch), one derived list (the commit convention) and one authored paragraph (what this project wants in a PR) — and only the first two are this skill's.
- **Rewrite the minimum span.** A wrong branch name is a phrase, not a section: replacing the paragraph around it destroys authored prose that was never in question, and buries the one change a reviewer has to check.
- **Order the plan by blast radius** — the statements that misdirect a contributor first (base branch, gate command, security route), the cosmetic ones last. A guide that sends people to the wrong branch is broken in a way that a missing hook note is not.
- **Idempotence is the test of a good pass.** Run the reconcile again on its own output: a second run that still wants to change something means a derivation is unstable — usually a value read from the machine rather than from a file.
- **Structural drift is reported, not enforced.** A section in an unusual order, or one this catalogue has no row for, is named in the report with a suggested placement. Reordering someone's guide unasked is a rewrite wearing a lint's clothing.
- **A guide in another language stays in it.** Reconcile the derived values, keep the prose's language, and never translate ([config](#config)).

## Config

`.tituskirch-skills.json` at the consuming repo's root is an optional, committed config shared across TitusKirch skills. This skill owns **no section of its own** — it reads three root keys, each a fact about the repo rather than about a skill. **Resolve it before reading it** — [Reading the config](#reading-the-config) is the single statement of how, including what happens when `jq` is absent.

| Key        | Effect                                                                                              |
| :--------- | :-------------------------------------------------------------------------------------------------- |
| `pr.base`  | the branch contributors start from and target — the guide's single most consequential derived value |
| `verify`   | the repo's gate command, named first in the "Running the suite" table                               |
| `language` | the guide's language; falls back to the existing guide's language, then the repo's, then `en`       |

```sh
# $resolved comes from the resolver — see "Reading the config" below.
base=$(printf '%s' "$resolved" | jq -er '.pr.base // empty' 2>/dev/null) || base=
verify=$(printf '%s' "$resolved" | jq -er '.verify // empty' 2>/dev/null) || verify=
lang=$(printf '%s' "$resolved" | jq -er '.language // empty' 2>/dev/null) || lang=
```

Each falls back to the [derivation table](#derivation-table) when absent — an absent config is never an error, and never a reason to guess. This skill keeps **no cache**: `CONTRIBUTING.md` and the files it describes are live state, read fresh every run.

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

## One convention, many repos

The structure, the order and the style rules are the **same in every repo** — that is what makes a contributor who has read one guide able to skim the next. What differs is only the derived values. So a guide is never produced by copying a sibling repo's file and editing the names: copy the **structure** from this catalogue, and derive every value from the repo in front of you. The two defects that produced this skill — a guide naming the wrong base branch, and a command table that predated the repo's real gate — are both what copying produces, at one remove.
