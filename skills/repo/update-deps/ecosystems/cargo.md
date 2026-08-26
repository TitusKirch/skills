# Cargo's constraint model

The **Rust / Cargo** branch of `update-deps` — reached when step 1 detects a `Cargo.lock` or `Cargo.toml`, at the root or below it. Everything a run needs whatever its ecosystem stays in `REFERENCE.md`.

**Cargo behaves like Composer, not npm:** `cargo update` moves the **lock** (`Cargo.lock`) within the constraints in `Cargo.toml`; it never rewrites them. There is no taze-equivalent with range granularity, so the declared constraint does the ranging — exactly as it does for a native Composer or pnpm run.

**The one trap is the default operator.** A bare version in `Cargo.toml` is a **caret**, the opposite of a bare npm version (which pins): `serde = "1.2"` means `^1.2` (`>=1.2.0, <2.0.0`), so it already floats to the newest minor.

| Constraint (`Cargo.toml`) | `cargo update` reaches | So a "minor run"                   |
| :------------------------ | :--------------------- | :--------------------------------- |
| `serde = "1.2"` _(caret)_ | newest `1.x`           | **already achieved** — just update |
| `serde = "~1.2"`          | newest `1.2.x`         | patch-only by the author's choice  |
| `serde = "=1.2.3"`        | nothing                | pinned — report as held            |

- **v1 is constraint-respecting.** Under the default caret, `cargo update` already lands the newest compatible release — the minor goal, with no manifest churn. `cargo update -p <crate>` scopes to one crate; `--precise <version>` sets an exact target (a **read**-shaped pin move, held-and-named like any pin).
- **Constraint rewriting is an explicit `major` only** — `cargo upgrade --incompatible` (from **cargo-edit**; `cargo upgrade` alone only modernises within-compatible requirements). It rewrites `Cargo.toml` to the new major, each reported **separately as breaking**. If cargo-edit is absent, report the available majors and stop — installing a toolchain component is a human's call, not the skill's.
- **`0.x` is special-cased, as in npm.** `serde = "0.9"` is `^0.9` → `>=0.9.0, <0.10.0`: the major lives in the middle number, so a caret on `0.x` floats patches only. Read a `0.x` bump the way you read one under npm's caret.
- **Report with** `pnpm cargo:outdated` where the repo defines that script, else `cargo outdated` (from **cargo-outdated**) — it lists what the constraints are holding back, the parallel of `composer outdated --direct`.
- **No release-age gate to honour.** The `minimumReleaseAge` machinery is pnpm-specific; Cargo has no native equivalent, so there is no gated-vs-ungated diff to run and no held-by-gate row for the Rust side. Report that section **not applicable** rather than omitting it — see the same rule for Go (`ecosystems/go.md`).
