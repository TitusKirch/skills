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

Move a repo's dependencies to their **newest allowed versions** — **minor by default**, `patch` or `major` only when explicitly asked. **Manual invocation only.** The skill **plans first** and writes only after confirmation, and it **never commits, pushes, opens a PR or merges** — the verified working tree is the deliverable ([why](REFERENCE.md#decisions)).

Its one principle, from which everything else follows:

> **The repo's own tooling and config decide what "allowed" means.** A release-age gate, an exact pin, a declared constraint, a private registry — each is a deliberate choice to **honour**, never an obstacle to route around. What the skill does not move, it **reports with the reason**. Silence is the one failure mode this skill exists to prevent.

The sibling skill `merge-deps` triages the **Dependabot queue** — updates a bot already opened as PRs. This one **performs** the updates locally. Same domain, disjoint machinery; [why they stay separate](REFERENCE.md#decisions).

## Workflow

### 1. Detect — read the repo, never assume

- **Ecosystems, from lockfiles** — `pnpm-lock.yaml` → pnpm, `bun.lock`/`bun.lockb` → bun, `package-lock.json` → npm, `composer.lock`/`composer.json` → Composer, `Cargo.lock`/`Cargo.toml` → Cargo (including a nested `src-tauri/Cargo.toml`), `go.mod`/`go.sum` → the Go toolchain. Full table: [REFERENCE.md](REFERENCE.md#detection).
- **`packageManager` in `package.json` overrides the lockfile guess** — it is the repo's explicit statement. Where `packageManagerStrict` is set, a wrong manager is not a style slip; the install is **rejected outright**.
- **The package-manager config is an input, not scenery** — `pnpm-workspace.yaml` (pnpm 10+ keeps its settings **there**, not in `.npmrc`), `.npmrc` (auth, registries, scope routing), `composer.json`'s `config` (`minimum-stability`, `prefer-stable`, repositories). Read them **before** planning; they change what the answer even is.
- **Container images are detected from manifests, because they have no lockfile** — `Dockerfile`, `*.Dockerfile`, `Containerfile`, `compose.yaml`/`compose.yml`/`docker-compose.yml` and their override files. A repo may carry several of each; every one is a manifest to read, and all of them together are **one** ecosystem with **one** plan section — never one run per file. [REFERENCE.md](REFERENCE.md#container-images-version-model).
- **GitHub Actions references are detected the same way, from workflow files** — `.github/workflows/*.yml`/`*.yaml`, plus an `action.yml`/`action.yaml` for a composite action the repo defines itself. Every `uses:` in them is a dependency, reusable workflows (`owner/repo/.github/workflows/x.yml@ref`) included — same reference shape, read the same way. All of the files together are **one** ecosystem, as the container manifests are. [REFERENCE.md](REFERENCE.md#github-actions-version-model).
- **GitLab CI is detected from `.gitlab-ci.yml`** — the file at the repo root, plus every local file it pulls in with `include: local:`, followed transitively: they are one pipeline definition, not separate manifests. Its `include:` fragments (`project:` + `ref:`) and its catalog `component:` references are **this** ecosystem; its `image:` and `services:` tags are **container** references and are reported there, exactly as a `uses: docker://…` ref already is — read once, counted once, never in both places. [REFERENCE.md](REFERENCE.md#gitlab-cis-version-model).
- **A repo may carry several at once** (PHP app + JS frontend) — each ecosystem is its own run, its own plan, its own report section.

### 2. Range — minor by default

| Range               | When                          | Meaning                                                  |
| :------------------ | :---------------------------- | :------------------------------------------------------- |
| `minor` _(default)_ | no range named in the request | newest minor+patch; the operator style is preserved      |
| `patch`             | named explicitly              | patch only — the narrowest thing that still moves        |
| `major`             | named explicitly              | majors allowed, each reported **separately as breaking** |

**The range is a per-run decision**, never inferred from the repo and never widened mid-run. "Update the deps" with nothing else said is **always** a minor run — reaching for `major` because a major happens to be available is exactly the overreach the default exists to stop.

**Go's `major` is the one range this skill will not perform.** A Go major lives in the **module path** (`example.com/pkg/v2`), so moving to it edits every importing file rather than a version string — a source rewrite, not an update, and outside what "never widen a constraint" permits. A `major` run on Go **names the available `/vN` and stops**, leaving the code untouched. [Go's version model](REFERENCE.md#gos-version-model).

**A container tag is not semver, and treating it as one is how this ecosystem goes wrong.** The range still maps: `patch` and `minor` move within the same major track (`postgres:16.2 → 16.4`), and `major` is a base-image change (`node:22 → node:24`) reported separately as breaking, like every other ecosystem's. What the range does **not** reach is the rest of the tag — a **floating** tag (`:latest`, `node:22`) is already open by the repo's choice and is reported, never rewritten; a **digest pin** (`image@sha256:…`) is this ecosystem's exact pin, held and named; a **variant suffix** (`-alpine`, `-slim`) names a base OS, not a version. [The container tag model](REFERENCE.md#container-images-version-model).

**An action ref resolves against a repository's git tags, and its version may live in a comment.** `patch` and `minor` move a fully-qualified tag inside its major (`actions/checkout@v4.2.1 → @v4.3.0`); `major` crosses majors (`@v4 → @v5`) and is reported separately as breaking. Two shapes bound that. A **SHA pin with a trailing tag comment** (`@a1b2c3… # v4.2.1`) is one reference in two halves — the SHA is what runs, the comment is the only readable statement of what that is — so **they move together or not at all**, and a comment that does not match its SHA is reported and held rather than half-moved. A **floating ref** — a major tag `@v4`, maintained by the action's author to track its newest minor, or a branch `@main` — is already open by the repo's choice, exactly as a floating container tag is: reported, and moved only under an explicit `major`. [The action ref model](REFERENCE.md#github-actions-version-model).

**A GitLab CI reference is mostly the two models above, resolved on the repo's own instance.** An `include:` fragment pinned with `project:` + `ref:` is the action ref's shape against `glab api` rather than `gh api` — `patch` and `minor` move it inside its major, `major` crosses one and is reported as breaking — and a `ref:` naming a **branch**, or missing entirely (GitLab then reads the project's default branch), is floating: reported, never rewritten. A **catalog component** (`component: $CI_SERVER_FQDN/group/project/name@1.4.2`) is the one genuinely new resolution, and it moves the same way; `@~latest` and `@main` are its floating forms and get the floating answer. [The GitLab CI model](REFERENCE.md#gitlab-cis-version-model).

### 3. Plan — read-only first, and make the gate visible

Run the updater **read-only** and show the version diff. Then do the part a plain read does **not** tell you:

> **A release-age gate does not announce itself. It silently substitutes an older target.** With pnpm's `minimumReleaseAge` set, `taze` auto-detects it and offers the newest version _old enough to install_ — same row, same shape, **same counts** as an ungated run. Nothing marks the substitution, so "1 minor available" can quietly mean "a newer minor exists and you cannot have it yet."

So **always diff the gated plan against an ungated read** (`--maturity-period 0`) and report the delta as **held by the gate, with the age**. Recipe and a worked example: [REFERENCE.md](REFERENCE.md#the-release-age-gate). The ungated read is a **read** — never the thing you write with.

**Where no gate can exist, say so — never just skip the step.** Cargo, Go, container images, GitHub Actions and GitLab CI have no `minimumReleaseAge` equivalent (neither the Go module proxy, nor any container registry, nor GitHub's tag API, nor GitLab's tag and catalog APIs offer one), so there is no gated-versus-ungated diff to run for them. Report that section **not applicable** for those ecosystems: a step silently omitted is indistinguishable from a step that found nothing withheld, which is the exact silence this skill exists to prevent.

Same duty for **exact pins**: the default scope of `taze` skips them entirely, so they are invisible rather than reported. Do a `--include-locked` read to see them and report them as **held — exact pin**. [Pins](REFERENCE.md#exact-pins).

Present the plan — moved, held, and why — and **write only after confirmation**. **The per-ecosystem package lists _are_ the plan**, so they arrive rendered, never folded away: several dozen lines of packages is the normal size of this plan, and it is exactly that bulk a human has to read to answer. How that constrains the form — and what to do instead when a list runs long — is [Presenting the plan](#presenting-the-plan) below; it binds this step and the report alike. Plan-only triggers ("dry run", "just show me", "nur den Plan", "nicht schreiben") → print the plan and the exact commands, then stop.

### 4. Update — drive the repo's own updater

- **`taze` in devDependencies → drive taze** (Node). It is the only updater here with real range granularity, and it already reads the repo's gate. Mode maps straight to the range — `taze minor -w`, `taze patch -w`, `taze major -w`; `-r` for workspaces; `-n <pkg>` to scope to one package. **Never fall back to native just because the request is narrow** — `--include`/`--exclude` express that.
- **No taze → native** — `pnpm update`, `npm update`, `bun update`, `composer update`, `cargo update`. These move **within the declared ranges** only; what that does and does not mean per ecosystem: [REFERENCE.md](REFERENCE.md#range--command).
- **Cargo has no taze** — drive the repo's own script where it exists (`pnpm cargo:outdated` and friends), else `cargo update`, which moves the **lock** within the constraints in `Cargo.toml` and never rewrites them — the newest compatible release under a caret **is** the minor. Rewriting a constraint is an explicit `major` only (`cargo upgrade --incompatible`, from cargo-edit). A nested `src-tauri/Cargo.toml` is its own manifest, its own run. [REFERENCE.md](REFERENCE.md#cargos-constraint-model).
- **Go has no ranges at all** — `go.mod` records an **exact** version per module, so the range lives in the command, not the manifest: `go get -u=patch ./...` for `patch`, `go get -u ./...` for `minor`, each followed by `go mod tidy`. A `major` is a module-path change and is **reported, not performed** (above). [REFERENCE.md](REFERENCE.md#gos-version-model).
- **Container images have no updater to drive**, so this is the first ecosystem where the skill **resolves and writes itself**: resolve the tags through whatever the environment already has — the registry v2 API, or `crane` / `skopeo` / `docker` where one is present — and edit the `FROM` or `image:` line in the manifest. There is **no lockfile** to regenerate and nothing to install afterwards. **No resolver available → report it and skip the ecosystem**, never fetch one on the fly; that is the same answer an absent cargo-edit already gets. Registry auth for a private registry is the repo's own config to honour, and an unreachable registry is a **reported gap, never a zero**. [REFERENCE.md](REFERENCE.md#container-images-version-model).
- **GitHub Actions references have no updater either, and exactly one resolver** — `gh api`, against the host the repo resolves to. `gh api repos/<owner>/<repo>/tags` is what "newer" means here: an action ref resolves against the **referenced repository's git tags**, not against a package registry. Edit the `uses:` value in the workflow file directly, carrying its trailing version comment with it; there is **no lockfile** and nothing to install. A `gh` that is **absent, unauthenticated or rate-limited leaves the ecosystem _unread_** — reported as such, never as "nothing to update": a check that could not run and a check that passed are opposite facts. [REFERENCE.md](REFERENCE.md#github-actions-version-model).
- **GitLab CI resolves through `glab api`, against the instance _this repo_ resolves to** — the root `forgeHost` where the config states one, else the host in the `origin` remote, else whatever `glab` is already configured for, passed as `GITLAB_HOST=<host> glab api …` where it was resolved. A fragment's versions are the referenced project's git tags; a component's are the component project's **releases**, which is what the catalog publishes. Edit the `ref:` value or the `@version` after a component path directly; there is **no lockfile** and nothing to install. **Self-hosted is the ordinary case here, not an edge case**, so a `glab` that is absent, unauthenticated or pointed at an unreachable instance leaves the ecosystem **unread** — reported in those words, naming the host that was tried, never as "nothing to update". [REFERENCE.md](REFERENCE.md#gitlab-cis-version-model).
- **Install through the repo's own manager**, then let the lockfile be regenerated by it. Never hand-edit a lockfile.
- **Never bypass the config to force a version through** — no `--no-frozen-lockfile` to dodge a mismatch, no lowering or disabling the release-age gate, no `--force`. A version the repo's own config refuses is **held and reported**, not smuggled in.

### 5. Security — every run, independent of the range

Run the advisory check **every time**, even on a `patch` run, even when nothing else moves — `pnpm audit` / `npm audit` / `bun audit` / `composer audit` / `cargo audit` / `govulncheck ./...` / `docker scout cves` or `trivy image`.

- **A vulnerable dependency whose fix lies outside the run's range is reported loudly** — never dropped because the range said no. "The fix is a major and this was a minor run" is a finding for a human, not a reason for silence.
- **A scanner that is not installed is reported as _unavailable_, never as clean.** The container scanners are where this bites first — `docker scout` and `trivy` are both optional, as `cargo audit` and `govulncheck` already are — but an advisory step that never ran and one that found nothing are opposite facts, and only one of them says the ecosystem is safe.
- **An ecosystem with no scanner _at all_ is a third case, and it is not clean either.** No advisory command exists for GitHub Actions references, nor for GitLab CI's `include:` fragments and components — nothing of `cargo audit`'s shape has ever shipped for either — so those sections are reported **not available for this ecosystem**, distinct from a tool that is merely not installed. What belongs there instead is the standing exposure: a repo pinning actions by **tag** rather than by SHA, or a fragment pinned to a **branch** and a component left at `@~latest`, trusts a ref its author can re-point, and naming that is the report's job. Rewriting it is not — see the guardrails. (A `.gitlab-ci.yml`'s `image:` and `services:` tags are scanned with the **container** ecosystem they belong to, not here.)
- **The gate applies to security fixes too.** A patch published hours ago will not install under a 3-day gate. Report the advisory, the fix version, its age, and the repo's **own** sanctioned exception (`minimumReleaseAgeExclude`) — then stop. Excepting a package is a human's call, [not the skill's](REFERENCE.md#the-release-age-gate).
- **Never weaken the repo's config to land a fix.** A security advisory is not a licence to bypass; it is a reason to escalate.

### 6. Verify

Run the repo's own check command — the root `verify` key in `.tituskirch-skills.json`, else the repo's detected check/test/build. Green → report. **Red → say so plainly and leave the tree as it is**; do not start reverting packages one by one unless asked. A failed verify after a dependency bump is information, and the diff is the evidence.

### 7. Report

One report, every section of it visible on arrival — same form rule as the plan, for the same reason: this is the run's only account of what moved.

- **TL;DR** — first, before any group: how many packages moved and across which ecosystems, how many were held, how many advisories this run does **not** fix, and the verify result. **Leading the report** below binds the form.
- **Moved** — package, from → to, bump level, per ecosystem.
- **Held, with the reason** — release-age gate (and the version it withheld, or **not applicable** where the ecosystem has none), exact pin, a container **digest pin**, **floating tag** or **ARG-interpolated tag**, a **floating action ref** (`@v4`, `@main`) or one whose **SHA and comment disagree**, a **floating CI include** (a branch `ref:`, or none at all) or a **floating component** (`@~latest`, `@main`), major outside range, a Go `/vN` the run will not perform, declared constraint, excluded by the repo's updater config.
- **Unread** — an ecosystem the run could not resolve at all: an unreachable registry, a `gh` that was unauthenticated or rate-limited, a `glab` that could not reach the instance. Name the host that was tried. Never folded into "nothing to update".
- **Advisories** — open ones, which are fixed by this run, which are not, and why not. A scanner that was **unavailable**, or an ecosystem with **no advisory command at all**, belongs here too, named as such rather than left out — with the tag-pinned action refs and branch-pinned CI includes a repo is standing exposed on.
- **Verify** — the command and its result.
- **Hand-off** — the tree is dirty and verified; committing is `atomic-commit`'s job and a PR is `pull-request`'s. Name them; do not do them.

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
- **Never widen a constraint** (`~` → `^`) and **never unpin an exact pin** unless explicitly asked. Moving a pin `1.2.0` → `1.3.0` still needs the ask — the pin exists to stop exactly that. **Go's `/vN` major sits past this line, not on it**: it rewrites import paths in source, so it is reported and **never performed**, `major` run or not.
- **Never pin a floating reference, and never change a variant suffix.** `:latest`, `node:22`, `alpine:3`, a GitHub Actions `@v4` or `@main` ref, a GitLab CI include with a branch `ref:` or none at all, and a component at `@~latest` all already resolve to the newest thing in their track, so rewriting one narrows what the repo deliberately left open. `-alpine`, `-slim` and `-bookworm` are a base-OS choice, so `22-alpine → 24-slim` is a different image, not an update. Both are **reported**, never moved.
- **A SHA pin and its version comment are one edit.** `uses: owner/action@<sha> # v4.2.1` says two things about one reference; moving the SHA and leaving the comment produces a file that **lies about what it runs**, which is worse than not updating it. Move both or neither, and **report a comment that does not match its SHA** rather than updating through it — the mismatch is the finding, and rewriting it destroys the evidence.
- **Never change a repo's pinning policy.** Rewriting tag refs to SHA pins — or a branch-pinned CI include to a tag — is a hardening pass, not a dependency update, and the same holds for the reverse. Report the exposure and leave the decision to a human.
- **Never touch an ecosystem that was not in scope** for the run.
- **Never edit a lockfile by hand**, and never resolve a conflict in one — regenerate it with the repo's manager.
- **Never commit, push, open a PR or merge.** The deliverable is a verified tree.
- **Attribution-free** — no `Generated with`/🤖 line, no session url, no agent self-naming in anything it writes.

## Reference

Detection table, the range → command mapping per ecosystem, the release-age gate (with a worked example), exact pins, Composer's constraint model, the container tag model, the action ref model, the GitLab CI include and component model, monorepos, and the reasoning behind the defaults: [REFERENCE.md](REFERENCE.md).
