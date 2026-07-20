---
name: update-deps
summary: Updates a repo's dependencies to their newest allowed versions — minor by default — across Node, PHP and Rust, driving the repo's own updater instead of bypassing its gates, pins and constraints.
description: Updates a repo's dependencies across Node (npm / pnpm / bun), PHP (Composer) and Rust (Cargo), monorepos included — minor by default, with patch or major only when explicitly asked. Detects ecosystems from lockfiles and drives the repo's own updater (taze when present, else the native one), so a release-age gate, an exact pin or a declared constraint is honoured rather than bypassed, and whatever is held back is reported with its reason instead of silently passing. Always runs the advisory check, and a vulnerable dependency whose fix falls outside the run's range is reported loudly rather than skipped. Plans first and writes only after confirmation; never commits, pushes, opens a pull request or merges. Invoke manually only — this skill never fires proactively. Use when the user wants to update, upgrade or refresh dependencies, bump packages to newer versions, run taze, composer update or cargo update, check for outdated packages or dependency advisories, or says things like "update the deps", "upgrade the packages", "Abhängigkeiten aktualisieren", "Pakete updaten".
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

The sibling skill [`merge-deps`](../merge-deps/SKILL.md) triages the **Dependabot queue** — updates a bot already opened as PRs. This one **performs** the updates locally. Same domain, disjoint machinery; [why they stay separate](REFERENCE.md#decisions).

## Workflow

### 1. Detect — read the repo, never assume

- **Ecosystems, from lockfiles** — `pnpm-lock.yaml` → pnpm, `bun.lock`/`bun.lockb` → bun, `package-lock.json` → npm, `composer.lock`/`composer.json` → Composer, `Cargo.lock`/`Cargo.toml` → Cargo (including a nested `src-tauri/Cargo.toml`). Full table: [REFERENCE.md](REFERENCE.md#detection).
- **`packageManager` in `package.json` overrides the lockfile guess** — it is the repo's explicit statement. Where `packageManagerStrict` is set, a wrong manager is not a style slip; the install is **rejected outright**.
- **The package-manager config is an input, not scenery** — `pnpm-workspace.yaml` (pnpm 10+ keeps its settings **there**, not in `.npmrc`), `.npmrc` (auth, registries, scope routing), `composer.json`'s `config` (`minimum-stability`, `prefer-stable`, repositories). Read them **before** planning; they change what the answer even is.
- **A repo may carry several at once** (PHP app + JS frontend) — each ecosystem is its own run, its own plan, its own report section.

### 2. Range — minor by default

| Range               | When                          | Meaning                                                  |
| :------------------ | :---------------------------- | :------------------------------------------------------- |
| `minor` _(default)_ | no range named in the request | newest minor+patch; the operator style is preserved      |
| `patch`             | named explicitly              | patch only — the narrowest thing that still moves        |
| `major`             | named explicitly              | majors allowed, each reported **separately as breaking** |

**The range is a per-run decision**, never inferred from the repo and never widened mid-run. "Update the deps" with nothing else said is **always** a minor run — reaching for `major` because a major happens to be available is exactly the overreach the default exists to stop.

### 3. Plan — read-only first, and make the gate visible

Run the updater **read-only** and show the version diff. Then do the part a plain read does **not** tell you:

> **A release-age gate does not announce itself. It silently substitutes an older target.** With pnpm's `minimumReleaseAge` set, `taze` auto-detects it and offers the newest version _old enough to install_ — same row, same shape, **same counts** as an ungated run. Nothing marks the substitution, so "1 minor available" can quietly mean "a newer minor exists and you cannot have it yet."

So **always diff the gated plan against an ungated read** (`--maturity-period 0`) and report the delta as **held by the gate, with the age**. Recipe and a worked example: [REFERENCE.md](REFERENCE.md#the-release-age-gate). The ungated read is a **read** — never the thing you write with.

Same duty for **exact pins**: the default scope of `taze` skips them entirely, so they are invisible rather than reported. Do a `--include-locked` read to see them and report them as **held — exact pin**. [Pins](REFERENCE.md#exact-pins).

Present the plan — moved, held, and why — and **write only after confirmation**. Plan-only triggers ("dry run", "just show me", "nur den Plan", "nicht schreiben") → print the plan and the exact commands, then stop.

### 4. Update — drive the repo's own updater

- **`taze` in devDependencies → drive taze** (Node). It is the only updater here with real range granularity, and it already reads the repo's gate. Mode maps straight to the range — `taze minor -w`, `taze patch -w`, `taze major -w`; `-r` for workspaces; `-n <pkg>` to scope to one package. **Never fall back to native just because the request is narrow** — `--include`/`--exclude` express that.
- **No taze → native** — `pnpm update`, `npm update`, `bun update`, `composer update`, `cargo update`. These move **within the declared ranges** only; what that does and does not mean per ecosystem: [REFERENCE.md](REFERENCE.md#range--command).
- **Cargo has no taze** — drive the repo's own script where it exists (`pnpm cargo:outdated` and friends), else `cargo update`, which moves the **lock** within the constraints in `Cargo.toml` and never rewrites them — the newest compatible release under a caret **is** the minor. Rewriting a constraint is an explicit `major` only (`cargo upgrade --incompatible`, from cargo-edit). A nested `src-tauri/Cargo.toml` is its own manifest, its own run. [REFERENCE.md](REFERENCE.md#cargos-constraint-model).
- **Install through the repo's own manager**, then let the lockfile be regenerated by it. Never hand-edit a lockfile.
- **Never bypass the config to force a version through** — no `--no-frozen-lockfile` to dodge a mismatch, no lowering or disabling the release-age gate, no `--force`. A version the repo's own config refuses is **held and reported**, not smuggled in.

### 5. Security — every run, independent of the range

Run the advisory check **every time**, even on a `patch` run, even when nothing else moves — `pnpm audit` / `npm audit` / `bun audit` / `composer audit` / `cargo audit`.

- **A vulnerable dependency whose fix lies outside the run's range is reported loudly** — never dropped because the range said no. "The fix is a major and this was a minor run" is a finding for a human, not a reason for silence.
- **The gate applies to security fixes too.** A patch published hours ago will not install under a 3-day gate. Report the advisory, the fix version, its age, and the repo's **own** sanctioned exception (`minimumReleaseAgeExclude`) — then stop. Excepting a package is a human's call, [not the skill's](REFERENCE.md#the-release-age-gate).
- **Never weaken the repo's config to land a fix.** A security advisory is not a licence to bypass; it is a reason to escalate.

### 6. Verify

Run the repo's own check command — `work.verify` from `.tituskirch-skills.json`, else the repo's detected check/test/build. Green → report. **Red → say so plainly and leave the tree as it is**; do not start reverting packages one by one unless asked. A failed verify after a dependency bump is information, and the diff is the evidence.

### 7. Report

- **Moved** — package, from → to, bump level, per ecosystem.
- **Held, with the reason** — release-age gate (and the version it withheld), exact pin, major outside range, declared constraint, excluded by the repo's updater config.
- **Advisories** — open ones, which are fixed by this run, which are not, and why not.
- **Verify** — the command and its result.
- **Hand-off** — the tree is dirty and verified; committing is [`atomic-commit`](../atomic-commit/SKILL.md)'s job and a PR is [`pull-request`](../pull-request/SKILL.md)'s. Name them; do not do them.

## Guardrails

- **Minor by default.** `patch` and `major` require an explicit ask, every run, with no memory of the last one.
- **Manual invocation only.** Never fire proactively — not on a stale lockfile, not because bumps "look due".
- **Plan first; write only after confirmation.**
- **Never bypass the repo's config** — not the release-age gate, not `packageManagerStrict`, not a frozen lockfile, not a registry. If the repo's own tooling refuses, the answer is a report.
- **Never widen a constraint** (`~` → `^`) and **never unpin an exact pin** unless explicitly asked. Moving a pin `1.2.0` → `1.3.0` still needs the ask — the pin exists to stop exactly that.
- **Never touch an ecosystem that was not in scope** for the run.
- **Never edit a lockfile by hand**, and never resolve a conflict in one — regenerate it with the repo's manager.
- **Never commit, push, open a PR or merge.** The deliverable is a verified tree.
- **Attribution-free** — no `Generated with`/🤖 line, no session url, no agent self-naming in anything it writes.

## Reference

Detection table, the range → command mapping per ecosystem, the release-age gate (with a worked example), exact pins, Composer's constraint model, monorepos, and the reasoning behind the defaults: [REFERENCE.md](REFERENCE.md).
