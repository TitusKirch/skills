# Composer's constraint model

The **PHP / Composer** branch of `update-deps` — reached when step 1 detects a `composer.lock` or `composer.json`. Everything a run needs whatever its ecosystem stays in `REFERENCE.md`.

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
