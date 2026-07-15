# update-deps — Reference

Mechanics for the [`update-deps`](SKILL.md) skill. Scope in v1 is **Node** (npm / pnpm / bun) and **PHP** (Composer), monorepos included. The updater is **detected from the repo**, never configured — see [Decisions](#decisions).

## Config

**This skill owns no config section.** Everything it would configure is either a per-run decision or already expressed by the repo's own updater — [why](#decisions). It reads two keys that other sections already own:

| Key           | Use                                                                  |
| :------------ | :------------------------------------------------------------------- |
| `work.verify` | the check command run after updating. Absent → detect from the repo. |
| `language`    | report wording (shared root key).                                    |

Per-package policy belongs in the **repo's own updater config**, where the repo's own `pnpm taze` will honour it too — `taze.config.ts` (`exclude`, `packageMode` per package), the declared range or constraint itself, and `minimumReleaseAgeExclude` in `pnpm-workspace.yaml`.

## Detection

Lockfile-driven, with `packageManager` as the override:

| Signal                            | Ecosystem | Manager  |
| :-------------------------------- | :-------- | :------- |
| `pnpm-lock.yaml`                  | Node      | pnpm     |
| `bun.lock` / `bun.lockb`          | Node      | bun      |
| `package-lock.json`               | Node      | npm      |
| `composer.lock` / `composer.json` | PHP       | Composer |

- **`packageManager` in `package.json` wins** over the lockfile guess — it is the repo's explicit statement, and under `packageManagerStrict: true` a wrong manager is **rejected**, not merely discouraged.
- **`taze` in `devDependencies` outranks the native updater** for the Node side, whichever manager it is — taze rewrites `package.json` and installs through the repo's own manager, so it is manager-agnostic.
- **Several ecosystems at once** → each is its own run, plan and report section. Never let one ecosystem's range leak into another's.

## Range → command

**Only taze has real range granularity.** Every native Node updater collapses to "within the declared range" or "latest", with nothing in between:

| Range               | taze (preferred) | pnpm / npm             | bun                   | Composer                        |
| :------------------ | :--------------- | :--------------------- | :-------------------- | :------------------------------ |
| `patch`             | `taze patch -w`  | `pnpm update`¹         | `bun update`¹         | `composer update`¹              |
| `minor` _(default)_ | `taze minor -w`  | `pnpm update`¹         | `bun update`¹         | `composer update`¹              |
| `major`             | `taze major -w`  | `pnpm update --latest` | `bun update --latest` | `composer require <pkg>:^<new>` |

¹ **Within the declared range only** — the manifest is not rewritten. Under `^1.2.0` that lands the newest 1.x (a minor, achieved); under `~1.2.0` it lands patches only; under an exact pin it does nothing. **The declared range is doing the ranging**, which is why native `patch` and `minor` share a command: the repo already said which it wanted.

Useful taze flags (`taze --help` is the authority; all verified against `taze@19.14.1`):

| Flag                       | Use                                                            |
| :------------------------- | :------------------------------------------------------------- |
| `-w, --write`              | write to `package.json` — **the only writing flag**            |
| `-r, --recursive`          | monorepo — every workspace `package.json`                      |
| `-n, --include <deps>`     | scope to one package or a pattern                              |
| `-x, --exclude <deps>`     | skip packages; overrides `--include`                           |
| `-l, --include-locked`     | bring **exact pins** into scope — see [pins](#exact-pins)      |
| `-I, --interactive`        | pick per package                                               |
| `--maturity-period [days]` | override the release-age gate — **read-only diagnostics only** |

## The release-age gate

The single most important fact about updating in a repo with `minimumReleaseAge` set: **the gate does not announce itself — it silently substitutes an older target.**

`pnpm-workspace.yaml` is where pnpm 10+ keeps this (`.npmrc` carries only auth/registry). taze **auto-detects it** — its `detectMaturityConfig()` reads `pnpm-workspace.yaml`, converts `minimumReleaseAge` minutes → `maturityPeriod` days (`4320 / 1440 = 3`), and adopts `minimumReleaseAgeExclude` as its own exclude list. So taze and pnpm agree, without a flag.

The trap is what that looks like in the report. **Worked example**, this repo, same mode and same `-l` scope, minutes apart:

```text
# gated — the repo's real config (minimumReleaseAge: 4320 → 3 days)
@tituskirch/skills - 2 minor, 1 patch
  pnpm      ^11.2.2  →  ^11.12.0  ~4d
  oxlint     1.72.0  →    1.73.0  ~9d

# ungated — taze minor -l --maturity-period 0
@tituskirch/skills - 2 minor, 1 patch
  pnpm      ^11.2.2  →  ^11.13.0  ~2d
  oxlint     1.72.0  →    1.74.0  ~2d
```

**Same row count, same headline, no marker.** `11.13.0` and `1.74.0` exist and are withheld for being ~2 days old, and nothing in the gated run says so. A reader concludes "2 minor updates, applied" and is simply unaware a newer minor was refused.

So there are **two** failure shapes, not one:

| Situation                        | What the gated run shows       | Why it misleads                        |
| :------------------------------- | :----------------------------- | :------------------------------------- |
| A mature version exists in range | the **older** version, plainly | looks like a complete, ordinary update |
| **No** mature version exists     | the row **disappears**         | reads as "up to date" — nothing to do  |

**Never read "up to date" as "nothing newer exists."** Diff the plan against an ungated read and report the delta:

```bash
pnpm exec taze minor -l                       # the plan — gated, what you will write
pnpm exec taze minor -l --maturity-period 0   # evidence — what the gate withheld
```

The ungated read is **evidence, never the write**. `--maturity-period 0` in a `-w` command is a bypass of the repo's policy, which this skill does not do.

**Security fixes are gated too** — the gate is a resolution-time rule, blind to why you want the version. A patch published hours ago will not install under a 3-day gate. The repo's **own** sanctioned exception is per-package:

```yaml
# pnpm-workspace.yaml — a human's edit, never the skill's
minimumReleaseAgeExclude:
  - '<package>'
```

Report the advisory, the fix, its age, and that knob. **Do not write it.** Excepting a package from the repo's supply-chain gate is precisely the judgement the gate was installed to force.

## Exact pins

A dependency declared without an operator (`oxfmt: 0.57.0`) is **locked**. Two consequences:

- **Native updaters cannot move it** — there is no range to move within. The pin _is_ the exclude.
- **taze's default scope omits it entirely** — not "up to date", not listed; **absent**. `-l, --include-locked` is what brings it into the table.

**Held by default, but never silent.** Moving `1.72.0` → `1.73.0` keeps the pin exact, so it is not _unpinning_ — but it still overrides the reason the pin exists, so it needs the ask. Do the `-l` read anyway and report the pins as **held — exact pin**.

**`-l` is the flag for pins; `latest` is not.** Scope (`-l`) and range (the mode) are separate axes, and conflating them is expensive — measured on this repo, `taze latest -l` targets `oxfmt 0.57.0 → 0.58.0` (a **0.x major**, since a caret on `0.x` allows patches only) and `packageManager pnpm → 12.0.0-alpha.9` (a **prerelease**). `taze minor -l` correctly moves `oxlint` and leaves `oxfmt` alone. Whenever pins are in scope, compose `-l` with the run's own mode.

## Composer's constraint model

**Composer differs from npm at the root**, and it is not a gap to paper over: `composer update` moves the **lock** within the constraints in `composer.json`; it never rewrites them.

| Constraint | `composer update` reaches | So a "minor run"                   |
| :--------- | :------------------------ | :--------------------------------- |
| `^6.1`     | newest `6.x`              | **already achieved** — just update |
| `~6.1.0`   | newest `6.1.x`            | patch-only by the author's choice  |
| `6.1.0`    | nothing                   | pinned — report as held            |

- **v1 is constraint-respecting.** Under a caret, `composer update` already lands the newest minor — the goal, with no manifest churn.
- **Constraint rewriting happens only under an explicit `major`** — `composer require <pkg>:^7.0`. `composer bump` (rewrite constraints to what is installed) is a **separate act** a user must ask for by name; for a library it narrows what consumers may install, which is a decision, not a refresh.
- **Report with** `composer outdated --direct` (and `--minor`), which lists what the constraints are holding back.
- **Honour `minimum-stability` / `prefer-stable`** in `composer.json` exactly as the release-age gate is honoured.

**Accepted asymmetry:** a minor run rewrites `package.json` (taze's doing) but leaves `composer.json` untouched. Same installed outcome, different manifest diff — because the two ecosystems disagree about what a declared range is _for_. Say so in the report rather than manufacturing symmetry.

## Monorepos

- **pnpm** — `packages:` in `pnpm-workspace.yaml`. **npm / bun** — `workspaces` in `package.json`. **Composer** — path repositories.
- **taze `-r`** walks every workspace `package.json`. Note `--ignore-other-workspaces` defaults to **true** — a nested package with its own `.git`/`pnpm-workspace.yaml` is a different repo and is skipped, which is the correct default.
- **Keep a shared dependency on one version across packages** — a version skew introduced by an update is a finding, not an outcome.
- **Resolve the lockfile once, at the root**, with one install after all manifests are written.

## Security

Run **every time**, independent of the range, and before declaring the run clean:

```bash
pnpm audit          # or: npm audit | bun audit | composer audit
```

| Situation                           | Action                                                                 |
| :---------------------------------- | :--------------------------------------------------------------------- |
| Fix is inside the run's range       | it lands with the run — name it in the report as an advisory fix       |
| Fix needs a **major**, run is minor | **report loudly**; never widen the range on your own initiative        |
| Fix is blocked by the **gate**      | report advisory + fix + age + `minimumReleaseAgeExclude`; do not write |
| **No fix available**                | report it every run — a vulnerability nobody can patch stays visible   |

`pnpm audit --fix` writes `pnpm.overrides` into `package.json` — a real edit with real blast radius, so it is **proposed in the plan, never run implicitly**.

## Decisions

The issue that specified this skill left its defaults open. What was settled, and why:

- **Name `update-deps`** — verb-noun, matching `merge-deps` / `write-docs` / `compact-readme`, and it pairs with `merge-deps` as the domain's two verbs. Rejected `bump-deps`: in a repo running release-please, "bump" already names the **version bump of a release** (`bump-minor-pre-major`), and a skill called `bump-deps` sitting next to a skill called `release` invites exactly the wrong reading. Rejected `update-dependencies` — the siblings abbreviate (`merge-deps`, `pr.*`).
- **No config section — the skill reads `work.verify` and `language`, and owns nothing.** The specifying issue sketched `update-deps.range` / `.verify` / `.exclude` / `false`. Each fell to the skill's own principle:
  - **`exclude`** — the repo's updater already owns this, and owns it better. taze reads its own `taze.config.ts` (`exclude`, and `packageMode` for per-package ranges), a declared range or constraint **is** an exclude, and `minimumReleaseAgeExclude` is honoured verbatim. A second list in `.tituskirch-skills.json` would be one the repo's own `pnpm taze` ignores — two lists that can disagree, where one already works everywhere, for every tool, including the human's hands. Same reasoning that rejected [`release.tool`](../release/REFERENCE.md#decisions): a key whose only power is to contradict the repo.
  - **`range`** — a per-run decision by design, and the issue says so itself. The one thing a stored default could do that a spoken word cannot is make an unqualified "update the deps" perform **majors** — the exact overreach the minor-by-default rule exists to prevent. A knob that can only be neutral or harmful is not a knob.
  - **`verify`** — `work.verify` answers the identical question and is already written by the repos that care; `deps.verify` documents that same fallback. A second key before anyone needs a different command is speculative.
  - **`false`** — manual-only, plans first, writes after confirmation, and never commits, pushes or merges. There is no unattended act to disable; **not invoking it** is the off switch. `deps: false` and `release: false` exist because those skills **merge**.

  Nothing survived, so there is no section — and no `oneOf [{}, false]` shell whose only content is an off switch, which no sibling has. **Revisit when** a repo actually needs a non-`work.verify` command or a patch-by-default policy; that is when the section earns its keys, and adding one later is additive.

- **Not folded into `deps.*`** — `deps.*` is **merge-deps'** section that happens to be named for the domain, exactly as `pr.*` is `pull-request`'s ([its own Decisions say so](../merge-deps/REFERENCE.md#decisions)). Sharing it would hand two skills one `false`, so "do not merge Dependabot's PRs" would silently also mean "do not update deps locally" — two unrelated permissions collapsed into one word. No section in the schema is shared by two skills, and this is not the one to start with.
- **Complementary to [`merge-deps`](../merge-deps/SKILL.md), not overlapping** — that skill triages PRs **a bot authored**, selected strictly by author, and merges them by comment; it never opens a PR and never bumps a version. This one bumps versions and never touches a PR. They cannot even collide: merge-deps refuses anything not authored by `app/dependabot`, and this skill authors nothing. The shared part is the noun.
- **It does not commit; it hands off a verified tree** — [`atomic-commit`](../atomic-commit/SKILL.md) owns commits and already knows commitlint, the scope vocabulary and the message language; deriving a `build(deps)` message here would be a second implementation of that, free to drift. Same delegation as [`release`'s `"create"` → `pull-request`](../release/REFERENCE.md#decisions): one skill owns the act. The issue's open question — _majors in one run, or one PR per major?_ — dissolves in the handoff: splitting a tree into atomic commits **is** atomic-commit's job, so majors land reviewably without this skill owning a commit or PR strategy at all.
- **Exact pins are held by default, and never silent** — a repo that wanted a floating minor would have written `^1.72.0`. Held is therefore right; **invisible** is not, and taze's default scope makes them invisible rather than reported. Hence the `-l` read on every run, purely to name them. Silence was the bug; held-and-named is the fix.
- **`--include-locked`, not `latest`, is how a pin moves** — the obvious-looking advice for a pinned dep is `taze latest -w`, and the specifying issue and this repo's `CLAUDE.md` both carried it. Measured against the real tree it conflates two axes and buys more than it was asked for: `latest` is a **mode** spanning majors, and at the time of writing it targeted `oxfmt 0.57.0 → 0.58.0` (a 0.x major) and `packageManager` pnpm → a `12.0.0-alpha.9` **prerelease** — from a request that only meant "include the pinned ones". Scope (`-l`) and range (the mode) are orthogonal, so `taze minor -l` is the honest "minor run, pins included". `CLAUDE.md` was corrected alongside this skill.
- **Composer is constraint-respecting in v1** — under a caret, `composer update` already achieves the newest minor, so v1 needs no constraint rewriting to deliver its headline promise. Rewriting (`composer bump`, `composer require pkg:^7`) is reserved for an explicit `major`, because for a library it narrows what consumers may install — a decision, not a refresh.
- **`packageManager` is a toolchain change, not a dependency** — taze offers it like any other row, but bumping it re-points every contributor and CI, and `packageManagerStrict` makes a mismatch fatal rather than cosmetic. It gets its own line in the plan; it never rides along inside "3 minor updates".
- **Yarn is out of scope in v1** — the issue scoped Node to npm/pnpm/bun plus Composer. taze already reads yarn's config, so adding it later is a detection row, not a reshape.
