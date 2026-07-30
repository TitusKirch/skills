Canonical text mirrored into every skill that runs the repo's checks. `scripts/gen-skills.ts`
writes the **base** body inside each such skill's `<skills-verify>` element and the **isolated**
body — the base plus the install section — inside `<skills-verify-isolated>`; `pnpm skills:check`
fails if a copy drifts. Edit it here, never in a skill.

Everything below is self-contained on purpose: a skill can be installed on its own, so it must not
link to another skill or to a file at the repo root — name the other skill instead.

Which body a skill carries is decided by **what tree the command runs in**, not by a roster kept in
step with the skills — so a skill added later is classified by what it does, not by whether anyone
remembered to list it:

- **Base** — the command runs in the **working tree**, where the repo's dependencies are already
  installed and the change under test is already applied.
- **Isolated** — the command runs in a tree that is **not** the working tree: a pull request's head,
  a pushed branch, a worktree the run created for its own work. Nothing is installed there, so
  nothing about the result means anything until it is. Whose change is under test does not enter
  into it — a worktree holding the run's _own_ commits is as empty as one holding a stranger's.
- **Either, decided by config** — carries **isolated**. A skill whose tree depends on how the repo
  configures it (`work-implement`, sequential in the working tree but in a fresh worktree once
  `parallel` is on) cannot be classified per run from here, and the isolated body is the safe
  superset: its install section is scoped by its own heading to the non-working-tree case, so the
  working-tree path reads past it unchanged. Carrying **base** and hand-writing the install into the
  skill would be the same text un-mirrored, which is what this file exists to prevent.

<!-- verify:base -->

## Running the repo's checks

The repo already declared what "still passes" means — the root `verify` key. Running anything else
runs the wrong gate, so read it before reaching for a guess:

```sh
# $resolved comes from the resolver — see "Reading the config" in this file.
verify=$(printf '%s' "$resolved" | jq -er '.verify // empty' 2>/dev/null) || verify=
```

**Absent, `null`, or unreadable → detect it.** Detection is the fallback, never the first answer.
Take the first that exists:

| Where to look                        | In this order               |
| :----------------------------------- | :-------------------------- |
| `package.json` → `scripts`           | `verify` · `check` · `test` |
| `composer.json` → `scripts`          | `verify` · `check` · `test` |
| A `Makefile` target                  | `verify` · `check` · `test` |
| `Cargo.toml`, with none of the above | `cargo test --locked`       |

Run a script with the repo's own package manager, read from the lockfile it commits —
`pnpm-lock.yaml` → `pnpm`, `package-lock.json` → `npm`, `bun.lock`/`bun.lockb` → `bun`,
`yarn.lock` → `yarn`.

**Nothing detected is a finding, not a pass.** Report it in those words — the repo declares no check
command — and never let a gate that never ran read as a green one. That distinction is the whole
reason the key exists: a command that was never run and a command that passed are opposite facts,
and only one of them licenses going on.

<!-- verify:isolated -->

### When the tree is not the working tree

Running the checks anywhere but the working tree — a pull request's head, a pushed branch, a
worktree created for this run — means a fresh worktree with **no dependencies installed**. `git
worktree` checks out **tracked** files only, so everything gitignored (`node_modules`, `vendor`,
build caches) is absent no matter how completely installed the working tree beside it is; the
emptiness follows from the tree being new, not from whose commits it holds. Run the command there
as-is and it resolves against whatever happens to be on `PATH`: red on a clean machine, falsely
green wherever the tooling is installed globally, and in neither case touching the versions the head
actually pins. **Install first, from the head's own lockfile:**

| Lockfile in the head     | Install with                     |
| :----------------------- | :------------------------------- |
| `pnpm-lock.yaml`         | `pnpm install --frozen-lockfile` |
| `package-lock.json`      | `npm ci`                         |
| `bun.lock` / `bun.lockb` | `bun install --frozen-lockfile`  |
| `yarn.lock`              | `yarn install --immutable`       |
| `composer.lock`          | `composer install`               |
| `Cargo.lock`             | nothing — cargo builds from it   |

Each of these installs the lockfile **as committed** rather than re-resolving it, which is the point:
the head's pinned versions are the thing under test.

**The install is part of the gate, not setup before it.** A lockfile that will not install is a red
result and reports as one — for a dependency change it is the most likely finding there is, and
recording it as an environment problem loses exactly the information the run existed to get.

**In the working tree, skip it.** A run that never leaves the tree it was invoked from — a
sequential run hopping branches in place — already has the dependencies installed, so the section
above does not apply to it and the base gate is the whole gate. It is worth skipping deliberately:
every tree that installs pays a full install of its own, which on a large repo is gigabytes and
minutes, and doing that per tree is the real cost of running several trees at once.
