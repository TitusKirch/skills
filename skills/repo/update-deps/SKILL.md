---
name: update-deps
metadata:
  summary: Updates a repo's dependencies through the repo's own tooling — minor by default, honouring gates and pins.
description: Updates a repo's dependencies across Node (npm / pnpm / bun), PHP (Composer), Rust (Cargo), Go (modules), container images (Dockerfile / Compose), GitHub Actions (workflows) and GitLab CI, monorepos included — minor by default, patch or major only when explicitly asked. Detects ecosystems from lockfiles and manifests, drives the repo's own updater or resolves refs itself, honours a release-age gate or an exact pin, and reports what is held and why. Always runs the advisory check, reporting what it cannot fix. Invoke manually only — plans first, writes after confirmation, never commits, pushes, opens a PR or merges. Use when the user wants to update, upgrade or refresh dependencies, bump packages, image tags, action refs or CI components, run taze, composer update, cargo update or go get, check for outdated packages or advisories, or says things like "update the deps", "upgrade the packages", "Abhängigkeiten aktualisieren", "Pakete updaten".
allowed-tools:
  - Bash
  - Read
  - Grep
  - Glob
  - Edit
---

# update-deps

Move a repo's dependencies to their **newest allowed versions** — **minor by default**, `patch` or `major` only when explicitly asked. **Manual invocation only.** The skill **plans first** and writes only after confirmation, and **never commits, pushes, opens a PR or merges**: the verified working tree is the deliverable, and `atomic-commit` and `pull-request` own what comes after it.

Its one principle:

> **The repo's own tooling and config decide what "allowed" means.** A release-age gate, an exact pin, a declared constraint, a private registry — each is a deliberate choice to **honour**, never an obstacle to route around. What the skill does not move, it **reports with the reason**. Silence is the one failure mode this skill exists to prevent.

The sibling skill `merge-deps` triages the **Dependabot queue** — updates a bot already opened as PRs; this one **performs** them locally. They cannot collide: `merge-deps` refuses any request its configured bot did not author, and this skill authors none.

## Workflow

### 1. Detect — read the repo, never assume

- **Ecosystems, from lockfiles** — `pnpm-lock.yaml` → pnpm, `bun.lock`/`bun.lockb` → bun, `package-lock.json` → npm, `composer.lock`/`composer.json` → Composer, `Cargo.lock`/`Cargo.toml` → Cargo (including a nested `src-tauri/Cargo.toml`), `go.mod`/`go.sum` → the Go toolchain. Full table: [REFERENCE.md](REFERENCE.md#detection).
- **`packageManager` in `package.json` overrides the lockfile guess** — the repo's explicit statement. Under `packageManagerStrict` a wrong manager is not a style slip; the install is **rejected outright**.
- **The package-manager config is an input, not scenery** — `pnpm-workspace.yaml` (pnpm 10+ keeps its settings **there**, not in `.npmrc`), `.npmrc` (auth, registries, scope routing), `composer.json`'s `config`. Read them **before** planning: they change what the answer is.
- **Three ecosystems have no lockfile, so their manifests _are_ the detection** — container images (`Dockerfile`, `*.Dockerfile`, `Containerfile`, Compose files and their overrides), GitHub Actions references (every `uses:` in `.github/workflows/*`, plus a composite `action.yml` the repo defines itself, reusable workflows included) and GitLab CI (`.gitlab-ci.yml` plus every local file it `include:`s, transitively — one pipeline definition, not separate manifests). A repo may carry several files of each kind, and **all of them together are one ecosystem with one plan section** — never one run per file.
- **A `.gitlab-ci.yml`'s `image:` and `services:` tags are _container_ references**, reported with that ecosystem exactly as a `uses: docker://…` ref already is — read once, counted once, never in both places. Its `include:` fragments and catalog `component:` references are the GitLab CI ecosystem.
- **A repo may carry several at once** (PHP app + JS frontend) — each is its own run, its own plan, its own report section.

### 2. Range — minor by default

| Range               | When                          | Meaning                                                  |
| :------------------ | :---------------------------- | :------------------------------------------------------- |
| `minor` _(default)_ | no range named in the request | newest minor+patch; the operator style is preserved      |
| `patch`             | named explicitly              | patch only — the narrowest thing that still moves        |
| `major`             | named explicitly              | majors allowed, each reported **separately as breaking** |

**The range is a per-run decision**, never inferred from the repo and never widened mid-run. "Update the deps" with nothing else said is **always** a minor run.

**Four ecosystems bend the range, and each states how in its own file** — open the one step 1 detected. Go's `major` is the one range this skill will not perform: a Go major lives in the **module path**, so a `major` run **names the available `/vN` and stops**, leaving the code untouched ([`ecosystems/go.md`](ecosystems/go.md)). A **container tag** is not semver ([`ecosystems/container-images.md`](ecosystems/container-images.md)); an **action ref** and a **GitLab CI reference** resolve against a forge's git tags rather than a package registry, and a SHA pin's trailing `# v4.2.1` comment is half of one reference ([`ecosystems/github-actions.md`](ecosystems/github-actions.md), [`ecosystems/gitlab-ci.md`](ecosystems/gitlab-ci.md)). In all four a **floating** reference (`:latest`, `node:22`, `@v4`, `@main`, a branch `ref:` or none at all, `@~latest`) is already open by the repo's choice: reported, never rewritten.

### 3. Plan — read-only first, and make the gate visible

Run the updater **read-only** and show the version diff. Then do the part a plain read does **not** tell you:

> **A release-age gate does not announce itself — it silently substitutes an older target.** With pnpm's `minimumReleaseAge` set, `taze` offers the newest version _old enough to install_, with the same rows and the **same counts** as an ungated run and nothing marking the substitution.

So **always diff the gated plan against an ungated read** (`--maturity-period 0`) and report the delta as **held by the gate, with the age**. Recipe and a worked example: [REFERENCE.md](REFERENCE.md#the-release-age-gate). The ungated read is a **read** — never the thing you write with.

**Where no gate can exist, say so — never just skip the step.** Cargo, Go, container images, GitHub Actions and GitLab CI have no `minimumReleaseAge` equivalent, so there is no gated-versus-ungated diff to run there. Report that section **not applicable**, never omit it.

Same duty for **exact pins**: `taze`'s default scope skips them entirely, so they are invisible rather than reported. Do a `--include-locked` read and report them as **held — exact pin**. [Pins](REFERENCE.md#exact-pins).

**`packageManager` gets a line of its own, never a place inside a count.** It is a **toolchain** change rather than a dependency, and under `packageManagerStrict` a mismatch is fatal — so it is planned and reported on its own line, never folded into "3 minor updates".

Present the plan — moved, held, and why — and **write only after confirmation**. **The per-ecosystem package lists _are_ the plan**, so they arrive rendered, never folded away — [Presenting the plan](#presenting-the-plan) below binds this step and the report alike. Plan-only triggers ("dry run", "just show me", "nur den Plan", "nicht schreiben") → print the plan and the exact commands, then stop.

### 4. Update — drive the repo's own updater

- **`taze` in devDependencies → drive taze** (Node). It has real range granularity and already reads the repo's gate. Mode maps straight to the range — `taze minor|patch|major -w`; `-r` for workspaces, `-n <pkg>` to scope to one package. **Never fall back to native just because the request is narrow** — `--include`/`--exclude` express that.
- **No taze → native** — `pnpm update`, `npm update`, `bun update`, `composer update`, `cargo update`. These move **within the declared ranges** only; what that does and does not mean per ecosystem: [REFERENCE.md](REFERENCE.md#range--command).
- **Five ecosystems take their own path, each stated in its own file.** Cargo drives the repo's own script where it exists, else `cargo update`, which moves the **lock** within `Cargo.toml`'s constraints and never rewrites them ([`ecosystems/cargo.md`](ecosystems/cargo.md)). Go puts the range in the command — `go get -u=patch ./...` / `go get -u ./...`, each followed by `go mod tidy` ([`ecosystems/go.md`](ecosystems/go.md)). The other three have **no updater to drive** and **no lockfile**, so the skill **resolves and writes the manifest itself** and nothing is regenerated or installed afterwards: the registry v2 API or whichever of `crane` / `skopeo` / `docker` is present ([`ecosystems/container-images.md`](ecosystems/container-images.md)), `gh api` ([`ecosystems/github-actions.md`](ecosystems/github-actions.md)), `glab api` against the instance _this repo_ resolves to ([`ecosystems/gitlab-ci.md`](ecosystems/gitlab-ci.md)).
- **A resolver that is absent, unauthenticated, rate-limited or pointed at an unreachable host leaves its ecosystem _unread_** — reported in those words, naming the host that was tried, never as "nothing to update": a check that could not run and one that passed are opposite facts. **Never fetch a resolver or a toolchain component on the fly**, and honour the repo's own registry and instance auth.
- **Install through the repo's own manager** and let it regenerate the lockfile. Never hand-edit one.
- **Never bypass the config to force a version through** — no `--no-frozen-lockfile`, no lowering or disabling the release-age gate, no `--force`. A version the repo's own config refuses is **held and reported**, not smuggled in.

### 5. Security — every run, independent of the range

Run the advisory check **every time** — even on a `patch` run, even when nothing else moves: `pnpm audit` / `npm audit` / `bun audit` / `composer audit` / `cargo audit` / `govulncheck ./...` / `docker scout cves` or `trivy image`.

- **A vulnerable dependency whose fix lies outside the run's range is reported loudly** — never dropped because the range said no. "The fix is a major and this was a minor run" is a finding, not a reason for silence.
- **A scanner that is not installed is reported as _unavailable_, never as clean.** `docker scout`, `trivy`, `cargo audit` and `govulncheck` are all optional, and an advisory step that never ran says nothing about whether the ecosystem is safe.
- **An ecosystem with no scanner _at all_ is a third case, and it is not clean either.** No advisory command exists for GitHub Actions references, nor for GitLab CI's `include:` fragments and components, so those sections are reported **not available for this ecosystem** — distinct from a tool merely not installed. What belongs there instead is the standing exposure: a ref pinned by a **mutable tag** rather than a SHA, a fragment pinned to a **branch**, a component left at `@~latest`. Naming it is the report's job; rewriting it is not. (A `.gitlab-ci.yml`'s `image:`/`services:` tags are scanned with the **container** ecosystem, not here.)
- **The gate applies to security fixes too.** A patch published hours ago will not install under a 3-day gate. Report the advisory, the fix version, its age, and the repo's own sanctioned exception (`minimumReleaseAgeExclude`) — then stop. Excepting a package is a human's call, [not the skill's](REFERENCE.md#the-release-age-gate).
- **Never weaken the repo's config to land a fix.** A security advisory is not a licence to bypass; it is a reason to escalate.

### 6. Verify

Run the repo's own check command — the root `verify` key in `.tituskirch-skills.json`, else the repo's detected check/test/build. Green → report. **Red → say so plainly and leave the tree as it is**; do not revert packages one by one unless asked. A failed verify after a bump is information, and the diff is the evidence.

### 7. Report

One report, every section of it visible on arrival — the run's only account of what moved.

- **TL;DR** — before any group: how many packages moved and across which ecosystems, how many were held, how many advisories this run does **not** fix, and the verify result. **Leading the report** below binds the form.
- **Moved** — package, from → to, bump level, per ecosystem.
- **Held, with the reason** — release-age gate (and the version it withheld, or **not applicable** where the ecosystem has none), exact pin, a container **digest pin** or **ARG-interpolated tag**, any **floating reference** (`:latest`, `node:22`, `@v4`, `@main`, a branch `ref:` or none at all, `@~latest`), an action ref whose **SHA and comment disagree**, major outside range, a Go `/vN` the run will not perform, declared constraint, excluded by the repo's updater config.
- **Unread** — an ecosystem the run could not resolve at all: an unreachable registry, a `gh` unauthenticated or rate-limited, a `glab` that could not reach the instance. Name the host tried; never fold it into "nothing to update".
- **Advisories** — open ones, which this run fixes, which it does not, and why not. A scanner that was **unavailable**, or an ecosystem with **no advisory command at all**, belongs here too, named as such — with the tag-pinned refs and branch-pinned includes a repo is standing exposed on.
- **Verify** — the command and its result.
- **Hand-off** — the tree is dirty and verified; committing is `atomic-commit`'s job, a PR `pull-request`'s. Name them; do not do them.

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

<skills-tldr>

## Leading the report

The report this skill ends with is read **once, in a terminal**, by someone deciding what happens
next. So it **opens with its result**: a `## TL;DR` section, before every other heading, carrying
the whole answer in a few lines. A report that opens with its first group makes the reader
reconstruct the total by reading every group and adding it up — which is the one thing they needed
before deciding whether to read any of them.

**Three things belong in the lead, and nothing else does:**

- **The counts** — how much was found, per group, in the same words the groups below use. The
  total is stated, never left to be summed.
- **What the run acted on, or proposes to** — the preselected set, the merged set, the changed
  set: the part that is not merely listed. Where nothing was acted on, say so in those words.
- **The decision being asked for** — the one thing the reader is expected to do, said plainly, or
  **no decision needed** where the run is finished. An ask that is only inferable from the groups
  is an ask the reader has to assemble.

**It leads the detail, it never replaces it.** Every group still renders in full underneath, and
nothing is dropped, shortened or folded for having been counted above. The lead is an entry point;
a summary that licenses hiding what it summarises is the failure this repo already forbids
elsewhere.

**Whatever the run could not establish belongs in the lead too**, not only in the section that
holds it — a check that never ran, a list that could not be read, a tier the run declined to
judge. Each changes what the counts mean, and a reader who stops after four lines must not stop
with a picture the rest of the report would have corrected.

**A run that found nothing still leads with it.** "Nothing found" is a result, and it belongs where
every other result does: one line, naming the scope that was actually searched, so an empty report
and an empty search are told apart.

**The heading follows the output language**, as the rest of the report does — a German run reads
`## Kurzfassung`. What is fixed is the position, not the wording. The `tldr` skill fixes this same
opening for the summaries it writes on request; one house frame, reached two ways.

</skills-tldr>

## Guardrails

- **Minor by default.** `patch` and `major` require an explicit ask, every run, with no memory of the last one.
- **Manual invocation only.** Never fire proactively — not on a stale lockfile, not because bumps "look due".
- **Plan first; write only after confirmation.**
- **Never bypass the repo's config** — not the release-age gate, not `packageManagerStrict`, not a frozen lockfile, not a registry. If the repo's own tooling refuses, the answer is a report.
- **Never widen a constraint** (`~` → `^`) and **never unpin an exact pin** unless explicitly asked. Moving a pin `1.2.0` → `1.3.0` still needs the ask. **Go's `/vN` major sits past this line, not on it**: it rewrites import paths in source, so it is reported and **never performed**, `major` run or not.
- **Never pin a floating reference, and never change a variant suffix.** `:latest`, `node:22`, an Actions `@v4` or `@main`, a CI include with a branch `ref:` or none at all, and a component at `@~latest` already resolve to the newest thing in their track, so rewriting one narrows what the repo deliberately left open. `-alpine`, `-slim` and `-bookworm` are a base-OS choice, so `22-alpine → 24-slim` is a different image, not an update. Both are **reported**, never moved.
- **A SHA pin and its version comment are one edit.** `uses: owner/action@<sha> # v4.2.1` says two things about one reference, and moving the SHA alone leaves a file that **lies about what it runs**. Move both or neither, and **report a comment that does not match its SHA** rather than updating through it.
- **Never change a repo's pinning policy**, in either direction. Rewriting tag refs to SHA pins — or a branch-pinned CI include to a tag — is a hardening pass, not a dependency update. Report the exposure and leave the decision to a human.
- **Never touch an ecosystem that was not in scope** for the run.
- **Never edit a lockfile by hand**, and never resolve a conflict in one — regenerate it with the repo's manager.
- **Never commit, push, open a PR or merge.** The deliverable is a verified tree.
- **Attribution-free** — no `Generated with`/🤖 line, no session url, no agent self-naming in anything it writes.

## Reference

Detection table, the range → command mapping across every ecosystem, the release-age gate (with a worked example), exact pins, monorepos, and the reasoning behind the defaults — everything a run needs whatever the repo turns out to hold: [REFERENCE.md](REFERENCE.md).

**One file per ecosystem, opened only where step 1 detected that ecosystem**, which settles the branch before anything deep is read: [`ecosystems/composer.md`](ecosystems/composer.md), [`ecosystems/cargo.md`](ecosystems/cargo.md), [`ecosystems/go.md`](ecosystems/go.md), [`ecosystems/container-images.md`](ecosystems/container-images.md), [`ecosystems/github-actions.md`](ecosystems/github-actions.md) and [`ecosystems/gitlab-ci.md`](ecosystems/gitlab-ci.md). **Node has none, and that is not an omission**: npm / pnpm / bun are the default path in the range → command mapping, so a Node repo's whole model is already unconditional in `REFERENCE.md`.
