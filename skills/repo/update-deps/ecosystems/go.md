# Go's version model

The **Go modules** branch of `update-deps` — reached when step 1 detects a `go.mod`. Everything a run needs whatever its ecosystem stays in `REFERENCE.md`.

**Go has no ranges.** `go.mod` records an **exact** version per module — `require github.com/spf13/cobra v1.8.1` — with no `^`, no `~` and nothing for a native updater to move _within_. Every other ecosystem here lets the manifest do the ranging; Go moves that job into the command:

| Range               | Command                 | Reaches                                          |
| :------------------ | :---------------------- | :----------------------------------------------- |
| `patch`             | `go get -u=patch ./...` | newest patch of each module's current minor      |
| `minor` _(default)_ | `go get -u ./...`       | newest minor+patch below the next major          |
| `major`             | —                       | **not performed** — reported and stopped (below) |

- **`go mod tidy` follows every write.** `go get` updates `go.mod` and `go.sum`; `tidy` is what prunes what is no longer imported and adds what is. Treat it as part of the update, not as cleanup afterwards.
- **`go get -u ./...` never crosses a major**, because a Go major is a different module path — the command has no way to reach it even if it wanted to. That is the property the `minor` default rests on.
- **Report with `go list -u -m all`**, which lists each module with the newest version available — the parallel of `composer outdated --direct` and `cargo outdated`.

## A major is an import-path change, so the run reports and stops

From `/v2` onward Go encodes the major **in the module path** (`github.com/foo/bar/v2`). Moving to it therefore means editing the `require` line **and every file that imports the module** — a source rewrite, not a version bump, and one no flag performs.

That collides head-on with the skill's **never widen a constraint** guardrail: the guardrail was written for ecosystems where an update is a version string, and rewriting imports is a categorically larger act than anything it contemplates. So a `major` run on Go:

- **names the available `/vN`** for each module that has one, with the path it would move to,
- **leaves `go.mod` and every source file untouched**, and
- reports the majors as **held — major is a module-path change**, alongside every other held row.

This is the same shape as the missing-toolchain rule elsewhere (`cargo upgrade` without cargo-edit): where the act exceeds what the skill may do on its own, the answer is a report. A human performing the `/vN` migration — by hand or with a tool like `gomajor` — is the sanctioned path, and naming it is the run's job.

**No release-age gate exists for Go.** The module proxy has no `minimumReleaseAge` equivalent, so the gated-versus-ungated diff (**The release-age gate** in `REFERENCE.md`) has nothing to compare and there is no held-by-gate row for the Go side. **Report it as _not applicable_, never omit it** — a step silently skipped is indistinguishable from a step that ran and found nothing withheld, and telling those two apart is the whole point of the gate section.

**Advisories are the one part that needs no special case.** `govulncheck ./...` (from `golang.org/x/vuln`) satisfies the security step (**Security** in `REFERENCE.md`) as-is, and it is sharper than most: it reports only vulnerabilities the code actually _reaches_. Like `cargo audit`, it is a **separate tool** — a missing `govulncheck` is reported, never auto-installed.
