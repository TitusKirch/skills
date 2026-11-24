---
name: update-deps
metadata:
  summary: Updates dependencies, Java builds and project-local skills across mixed monorepos, honouring gates and pins.
description: Updates a repo's dependencies locally with its own tooling — Node, PHP, Rust, Go, Java, containers, GitHub Actions, GitLab CI and project-local skills, monorepos included; minor by default, patch or major only when asked, release-age gates and pins honoured, advisories reported. To work through PRs a dependency bot already opened, use merge-deps; to ship a release, use release. Invoke manually only — plans first, never commits, pushes, opens a PR or merges. Use when the user wants to upgrade packages, runtimes, image tags, action refs or CI tools, check outdated packages or advisories, or says "update the deps", "upgrade everything", "Abhängigkeiten aktualisieren", "Pakete updaten".
allowed-tools:
  - Bash
  - Read
  - Grep
  - Glob
  - Edit
---

# update-deps

Move a repo's dependencies to their **newest allowed versions** — **minor by default**, `patch` or `major` only when explicitly asked. **Manual invocation only.** The skill **plans first** and writes only after confirmation or explicit existing session authorization, and **never commits, pushes, opens a PR or merges**: the verified working tree is the deliverable, and `atomic-commit` and `pull-request` own what comes after it.

Its one principle:

> **The repo's own tooling and config decide what "allowed" means.** A release-age gate, an exact pin, a declared constraint, a private registry — each is a deliberate choice to **honour**, never an obstacle to route around. What the skill does not move, it **reports with the reason**. Silence is the one failure mode this skill exists to prevent.

The sibling skill `merge-deps` triages the **Dependabot queue** — updates a bot already opened as PRs; this one **performs** them locally. They cannot collide: `merge-deps` refuses any request its configured bot did not author, and this skill authors none.

## Workflow

### 1. Detect — read the repo, never assume

- **Map the monorepo before choosing commands** — inventory manifests below the repository root, including hidden project skill directories. Read workspace membership and exclusions; assign each manifest to its manager, version owner, resolution root and verification command. A pnpm/Turbo wrapper can own a Gradle, Composer or Cargo build as well as Node scripts. Do not infer one manager or one lockfile for the whole repo. Read [Monorepos](REFERENCE.md#monorepos) before recursive discovery or writes.
- **Ecosystems, from lockfiles** — `pnpm-lock.yaml` → pnpm, `bun.lock`/`bun.lockb` → bun, `package-lock.json` → npm, `composer.lock`/`composer.json` → Composer, `Cargo.lock`/`Cargo.toml` → Cargo (including a nested `src-tauri/Cargo.toml`), `go.mod`/`go.sum` → the Go toolchain. Java is manifest-driven: `settings.gradle(.kts)`, `build.gradle(.kts)` and `pom.xml`, even without locks. Project-local skills use `skills-lock.json` and installed skill directories, not the publisher’s `skills.sh.json`. Full table: [REFERENCE.md](REFERENCE.md#detection).
- **`packageManager` in `package.json` overrides the lockfile guess** — the repo's explicit statement. Under `packageManagerStrict` a wrong manager is not a style slip; the install is **rejected outright**.
- **The package-manager config is an input, not scenery** — `pnpm-workspace.yaml` (pnpm 10+ keeps its settings **there**, not in `.npmrc`), `.npmrc` (auth, registries, scope routing), `composer.json`'s `config`. Read them **before** planning: they change what the answer is.
- **Runtime versions and CI CLI pins are a separate inventory**, even when the updater omits them: `.nvmrc`, `.node-version`, runtime constraints in `package.json`, CI setup versions, version manifests read by scripts, and pinned installs such as `opencode-ai@1.18.30` or `skills-ref==0.1.1`. Follow a referenced version file as data; never execute it to discover a value. Each tool has one source of truth and every consumer is checked for drift. Open **Runtime and CLI toolchains** in `REFERENCE.md` for scope, gate and installation rules before proposing a runtime change.
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

**Some ecosystems need their own version model** — open the one step 1 detected. Go's `major` is the one range this skill will not perform: a Go major lives in the **module path**, so a `major` run **names the available `/vN` and stops**, leaving the code untouched ([`ecosystems/go.md`](ecosystems/go.md)). A **container tag** is not semver ([`ecosystems/container-images.md`](ecosystems/container-images.md)); an **action ref** and a **GitLab CI reference** resolve against a forge's git tags rather than a package registry, and a SHA pin's trailing `# v4.2.1` comment is half of one reference ([`ecosystems/github-actions.md`](ecosystems/github-actions.md), [`ecosystems/gitlab-ci.md`](ecosystems/gitlab-ci.md)). Floating container tags, branch refs and `@~latest` are reported and held. An Actions **major-tag ref** is held under `patch`/`minor`, but may cross its major under an explicit `major`; it retains its tag style.

**Java literals are normal version declarations**, not automatically held npm-style exact pins; explicit strict constraints and policy pins still hold. Stable qualifiers, snapshots and server API tracks need the [Java model](ecosystems/java.md). **skills.sh revisions have no patch/minor/major classification**: a general dependency run inventories them, but updating their content needs explicit local-skill scope or approval of that separate plan ([project skills](ecosystems/project-skills.md)).

### 3. Plan — read-only first, and make the gate visible

Run the updater **read-only** and show the version diff. Then do the part a plain read does **not** tell you:

> **A release-age gate does not announce itself — it silently substitutes an older target.** With pnpm's `minimumReleaseAge` set, `taze` offers the newest version _old enough to install_, with the same rows and the **same counts** as an ungated run and nothing marking the substitution.

So **always diff the gated plan against an ungated read** (`--maturity-period 0`) and report the delta as **held by the gate, with the age**. Recipe and a worked example: [REFERENCE.md](REFERENCE.md#the-release-age-gate). The ungated read is a **read** — never the thing you write with.

**Where no gate can exist, say so — never just skip the step.** Cargo, Go, Java, skills.sh content, container images, GitHub Actions and GitLab CI do not inherit pnpm’s `minimumReleaseAge`, so there is no gated-versus-ungated diff to run there. Report that section **not applicable**, never omit it.

Same duty for **exact pins**: `taze`'s default scope skips them entirely, so they are invisible rather than reported. Do a `--include-locked` read and report them as **held — exact pin**. [Pins](REFERENCE.md#exact-pins).

**`packageManager` gets a line of its own, never a place inside a count.** It is a **toolchain** change rather than a dependency, and under `packageManagerStrict` a mismatch is fatal — so it is planned and reported on its own line, never folded into "3 minor updates".

Present the plan — moved, held, and why — and **write only after confirmation**. Explicit session authorization such as "autonom ausführen", including permission to move exact pins or Node, already confirms that scope: still present each concrete plan, then proceed without asking again. It never overrides the repo's gate. Plan-only triggers ("dry run", "just show me", "nur den Plan", "nicht schreiben") override that authorization: print the plan and the exact commands, then stop. **The per-ecosystem package lists _are_ the plan**, so they arrive rendered, never folded away — [Presenting the plan](#presenting-the-plan) below binds this step and the report alike.

### 4. Update — drive the repo's own updater

- **`taze` in devDependencies → drive taze** (Node). It has real range granularity and already reads the repo's gate. Mode maps straight to the range — `taze minor|patch|major -w`; inspect `--help` and disable its Actions and unauthorized runtime writers as described in **Runtime and CLI toolchains** in `REFERENCE.md`; `-r` for workspaces, `-n <pkg>` to scope to one package. **Never fall back to native just because the request is narrow** — `--include`/`--exclude` express that.
- **No taze → native** — `pnpm update`, `npm update`, `bun update`, `composer update`, `cargo update`. These move **within the declared ranges** only; what that does and does not mean per ecosystem: [REFERENCE.md](REFERENCE.md#range--command).
- **Five ecosystems take their own path, each stated in its own file.** Cargo drives the repo's own script where it exists, else `cargo update`, which moves the **lock** within `Cargo.toml`'s constraints and never rewrites them ([`ecosystems/cargo.md`](ecosystems/cargo.md)). Go puts the range in the command — `go get -u=patch ./...` / `go get -u ./...`, each followed by `go mod tidy` ([`ecosystems/go.md`](ecosystems/go.md)). The other three have **no updater to drive** and **no lockfile**, so the skill **resolves and writes the manifest itself** and nothing is regenerated or installed afterwards: the registry v2 API or whichever of `crane` / `skopeo` / `docker` is present ([`ecosystems/container-images.md`](ecosystems/container-images.md)), `gh api` ([`ecosystems/github-actions.md`](ecosystems/github-actions.md)), `glab api` against the instance _this repo_ resolves to ([`ecosystems/gitlab-ci.md`](ecosystems/gitlab-ci.md)).
- **Java** — use the existing Gradle/Maven wrapper and updater if configured, else resolve candidates from the declared repositories and edit the owning catalog/property/declaration. Include build plugins and BOMs; keep JDK and wrapper upgrades separately authorized. Read [Java](ecosystems/java.md) before resolving or writing.
- **Project-local skills.sh skills** — use the verified project-only CLI or repository script from each installation root, preserving sources and destinations. Read [Project skills](ecosystems/project-skills.md) before checking or updating; never fall back to global scope.
- **A resolver that is absent, unauthenticated, rate-limited or pointed at an unreachable host leaves its ecosystem _unread_** — reported in those words, naming the host that was tried, never as "nothing to update": a check that could not run and one that passed are opposite facts. **Never fetch a resolver or install a host toolchain without explicit authorization**, and honour the repo's own registry and instance auth. Verification of an authorized CLI update may install its exact version into a disposable directory using the repo's manager and gate; it never replaces the user's global CLI implicitly.
- **Resolve once per owning root**, after its manifest changes. Use that manager to regenerate its locks; never hand-edit them. A shared Node/Cargo lock, each Composer/Go module, each Gradle build and each project skill installation have different ownership. Maven normally has no lockfile to regenerate.
- **Never bypass the config to force an install through** — no `--no-frozen-lockfile`, no lowering or disabling the release-age gate, no install-time `--force`. A version the repo's own config refuses is **held and reported**, not smuggled in. A taze cache-refresh flag is a read-only fetch option; it grants no permission to bypass installation policy.

### 5. Security — every run, independent of the range

Run the advisory check **every time** — even on a `patch` run, even when nothing else moves: `pnpm audit` / `npm audit` / `bun audit` / `composer audit` / `cargo audit` / `govulncheck ./...` / `docker scout cves` or `trivy image`.

- **A vulnerable dependency whose fix lies outside the run's range is reported loudly** — never dropped because the range said no. "The fix is a major and this was a minor run" is a finding, not a reason for silence.
- **A scanner that is not installed is reported as _unavailable_, never as clean.** `docker scout`, `trivy`, `cargo audit` and `govulncheck` are all optional, and an advisory step that never ran says nothing about whether the ecosystem is safe.
- **An ecosystem with no scanner _at all_ is a third case, and it is not clean either.** No advisory command exists for GitHub Actions references, nor for GitLab CI's `include:` fragments and components, so those sections are reported **not available for this ecosystem** — distinct from a tool merely not installed. What belongs there instead is the standing exposure: a ref pinned by a **mutable tag** rather than a SHA, a fragment pinned to a **branch**, a component left at `@~latest`. Naming it is the report's job; rewriting it is not. (A `.gitlab-ci.yml`'s `image:`/`services:` tags are scanned with the **container** ecosystem, not here.)
- **The gate applies to security fixes too.** A patch published hours ago will not install under a 3-day gate. Report the advisory, the fix version, its age, and the repo's own sanctioned exception (`minimumReleaseAgeExclude`) — then stop. Excepting a package is a human's call, [not the skill's](REFERENCE.md#the-release-age-gate).
- **Never weaken the repo's config to land a fix.** A security advisory is not a licence to bypass; it is a reason to escalate.

### 6. Verify

Check coverage against the inventory: Turbo/Nx task success does not prove an omitted nested build was checked. Add the affected member/build checks when the root gate omits them; report missing coverage. For Java and local skills, follow their ecosystem verification rules.

Run the repo's own check command — the root `verify` key in `.tituskirch-skills.json`, else the repo's detected check/test/build. Green → report. **Red → say so plainly and leave the tree as it is**; do not revert packages one by one unless asked. A failed verify after a bump is information, and the diff is the evidence.

### 7. Report

One report, every section of it visible on arrival — the run's only account of what moved.

- **TL;DR** — before any group: how many packages moved and across which ecosystems, how many were held, how many advisories this run does **not** fix, and the verify result. **Leading the report** below binds the form.
- **Moved** — package, from → to, bump level, per ecosystem.
- **Held, with the reason** — release-age gate (and the version it withheld, or **not applicable** where the ecosystem has none), exact pin, a container **digest pin** or **ARG-interpolated tag**, any **floating reference** (`:latest`, `node:22`, `@v4`, `@main`, a branch `ref:` or none at all, `@~latest`), an action ref whose **SHA and comment disagree**, major outside range, a Go `/vN` the run will not perform, declared constraint, excluded by the repo's updater config.
- **Unread** — an ecosystem the run could not resolve at all: an unreachable registry, a `gh` unauthenticated or rate-limited, a `glab` that could not reach the instance. Name the host tried; never fold it into "nothing to update".
- **Project skills** — report changed skill revisions/content hashes separately, without inventing semver bump levels; list local modifications, unsupported CLI scope or unresolved provenance as held/unread.
- **Advisories** — open ones, which this run fixes, which it does not, and why not. A scanner that was **unavailable**, or an ecosystem with **no advisory command at all**, belongs here too, named as such — with the tag-pinned refs and branch-pinned includes a repo is standing exposed on.
- **Verify** — the command and its result.
- **Hand-off** — the tree is dirty and verified; committing is `atomic-commit`'s job, a PR `pull-request`'s. Name them; do not do them.

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

<skills-tldr>

## Leading the report

The report this skill ends with is read **once, in a terminal**, so it **opens with its result**:
a `## TL;DR` section before every other heading — `## Kurzfassung` in a German run — holding, in a
few lines:

- **the counts**, per group, in the words the groups below use, with the total stated;
- **what the run acted on**, or proposes to — or that it acted on nothing;
- **the decision asked for**, said plainly, or **no decision needed**;
- **whatever the run could not establish** — a check that never ran, a list it could not read —
  because a reader who stops here must not leave with a picture the rest would correct.

**The lead opens the detail, it does not replace it.** Every item that needs action renders in full
below. A group that needs none may be counted with its reason and the command that lists it.
**"Nothing found" is a result too:** one line, naming the scope that was searched. The `tldr`
skill fixes the same opening for the summaries it writes on request.

</skills-tldr>

## Guardrails

- **Minor by default.** `patch` and `major` require an explicit ask, every run, with no memory of the last one.
- **Manual invocation only.** Never fire proactively — not on a stale lockfile, not because bumps "look due".
- **Plan first; write only after confirmation or explicit existing session authorization.** Plan-only requests still stop after the plan.
- **Never bypass the repo's config** — not the release-age gate, not `packageManagerStrict`, not a frozen lockfile, not a registry. If the repo's own tooling refuses, the answer is a report.
- **Never widen a constraint** (`~` → `^`) and **never unpin an exact pin** unless explicitly asked. Moving a policy pin `1.2.0` → `1.3.0` still needs the ask. Ordinary Java catalog/POM literals follow the Java declaration model; generated skill content hashes follow the authorized skill-refresh model, not npm exact-pin semantics. **Go's `/vN` major sits past this line, not on it**: it rewrites import paths in source, so it is reported and **never performed**, `major` run or not.
- **Never pin a floating reference, and never change a variant suffix.** `:latest`, `node:22`, an Actions `@v4` or `@main`, a CI include with a branch `ref:` or none at all, and a component at `@~latest` already resolve to the newest thing in their track, so rewriting one narrows what the repo deliberately left open. `-alpine`, `-slim` and `-bookworm` are a base-OS choice, so `22-alpine → 24-slim` is a different image, not an update. Floating container and branch refs are **reported and held**. An Actions major-tag ref may cross its major under an explicit `major`, preserving its tag style; its ecosystem file owns that exception.
- **A SHA pin and its version comment are one edit.** `uses: owner/action@<sha> # v4.2.1` says two things about one reference, and moving the SHA alone leaves a file that **lies about what it runs**. Move both or neither, and **report a comment that does not match its SHA** rather than updating through it.
- **Never change a repo's pinning policy**, in either direction. Rewriting tag refs to SHA pins — or a branch-pinned CI include to a tag — is a hardening pass, not a dependency update. Report the exposure and leave the decision to a human.
- **Never touch an ecosystem that was not in scope** for the run.
- **Never edit a lockfile by hand**, and never resolve a conflict in one — regenerate it with the repo's manager.
- **Never commit, push, open a PR or merge.** The deliverable is a verified tree.
- **Attribution-free** — no `Generated with`/🤖 line, no session url, no agent self-naming in anything it writes.

## Reference

Open [REFERENCE.md](REFERENCE.md) at step 1 to inventory runtime and CLI pins alongside the detected ecosystems, at step 3 to compare gated targets and exact pins, and before the Node write to limit taze's enabled manifest writers. It also owns the unconditional range → command mapping and monorepo rules.

**One file per ecosystem, opened only where step 1 detected that ecosystem**, which settles the branch before anything deep is read: [`ecosystems/composer.md`](ecosystems/composer.md), [`ecosystems/cargo.md`](ecosystems/cargo.md), [`ecosystems/go.md`](ecosystems/go.md), [`ecosystems/java.md`](ecosystems/java.md), [`ecosystems/project-skills.md`](ecosystems/project-skills.md), [`ecosystems/container-images.md`](ecosystems/container-images.md), [`ecosystems/github-actions.md`](ecosystems/github-actions.md) and [`ecosystems/gitlab-ci.md`](ecosystems/gitlab-ci.md). **Node has none, and that is not an omission**: npm / pnpm / bun are the default path in the range → command mapping, so a Node repo's whole model is already unconditional in `REFERENCE.md`.
