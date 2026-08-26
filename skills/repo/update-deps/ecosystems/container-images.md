# Container images' version model

The **container images** branch of `update-deps` — reached when step 1 detects a `Dockerfile`, a `*.Dockerfile`, a `Containerfile`, a Compose file, or `image:` / `services:` keys in a `.gitlab-ci.yml`. Everything a run needs whatever its ecosystem stays in `REFERENCE.md`.

**A container tag is an arbitrary string that _conventionally_ carries a version.** `FROM node:22-alpine` and `image: postgres:16.2` pin third-party code as surely as any dependency line — they go stale and they carry CVEs no Node, PHP, Rust or Go pass will ever surface — but the registry guarantees nothing about what the string means. Every rule below follows from that one fact, and reading a tag as semver is the failure mode this section exists to prevent.

**One reference is `<registry>/<repository>:<tag>` or `…@sha256:<digest>`.** The part this skill may move is the **version segment of the tag**, and only where the rest of the reference stays identical.

## What is in scope, and what is held

| Reference                  | Example                             | This run                                                                  |
| :------------------------- | :---------------------------------- | :------------------------------------------------------------------------ |
| Pinned version tag         | `postgres:16.2`                     | **moves** — `16.4` under `minor`, `17` only under an explicit `major`     |
| Version tag with a variant | `node:22-alpine`                    | **moves the version only** — `24-alpine`, never `24-slim`                 |
| Floating tag               | `:latest`, `node:22`, `alpine:3`    | **held — floating**, reported and never rewritten                         |
| Digest pin                 | `nginx@sha256:…`                    | **held — digest pin**, named on every run                                 |
| `ARG`-interpolated tag     | `FROM node:${NODE_VERSION}`         | **held — not statically resolvable**, reported with the `ARG` default     |
| Compose `build:` service   | `build: ./api`                      | **not a dependency** — it points at a Dockerfile this run already reads   |
| Stage alias                | `FROM build`                        | **not a registry reference** — internal to the multi-stage build          |
| GitLab CI job image        | `image: node:22-alpine`             | **this ecosystem** — a `.gitlab-ci.yml` tag, read here, not in two places |
| GitLab CI service          | `services: [{name: postgres:16.2}]` | **this ecosystem** — same tag rules, under a `name:` key                  |

- **A floating tag moves on its own, so pinning it is a narrowing, not an update.** `:latest`, `node:22` and `alpine:3` already resolve to the newest thing in their track; the repo chose that openness deliberately, exactly as a GitHub Actions `@v4` ref (`ecosystems/github-actions.md`) does. Report it as floating and leave it alone. Reporting is not optional — a floating tag the run silently passes over reads as a tag that was checked and found current.
- **A digest pin is this ecosystem's exact pin.** `image@sha256:…` names one immutable manifest, so nothing resolves "newer" for it without a human choosing a new digest. **Held is right; invisible is not** — the same reasoning that puts a `taze -l` read on every Node run, so that pins are named rather than absent.
- **A variant suffix is a base-OS choice, never a version.** `-alpine`, `-slim`, `-bookworm` and friends select a different image, built from a different base, with a different libc and a different package set. `22-alpine → 24-alpine` is an update; `22-alpine → 24-slim` is a substitution nobody asked for. Move the version segment and carry the suffix through **verbatim**.
- **An `ARG`-interpolated tag is not resolvable statically.** `FROM node:${NODE_VERSION}` defers the tag to build time, so the manifest does not say what runs. Report the reference **with the `ARG` default it would use**, and do not rewrite through the indirection — the `ARG` may be overridden by CI, and the run cannot see that.
- **A Compose service with `build:` rather than `image:` is not a dependency**, it is a pointer to a Dockerfile this run already reads. Counting it would double-report the same `FROM` lines. A service carrying **both** is a build with a tag to push to; the `image:` there names the repo's own artefact, not a dependency, so it is out of scope too.
- **Multi-stage builds carry several `FROM` lines, and each is its own reference.** `FROM node:22 AS build` … `FROM build` — the second names a stage in the same file, not a registry, and resolving it against a registry is how a build gets silently rerouted to an unrelated public image. Track the stage aliases declared by `AS` and exclude every `FROM` that names one.
- **A `.gitlab-ci.yml`'s `image:` and `services:` are container references and belong here**, not to the GitLab CI ecosystem (`ecosystems/gitlab-ci.md`) that reads the same file — the same routing a `uses: docker://…` action ref already gets, and for the same reason: same registry, same tag semantics, same digest-pin handling, so splitting them would report one model in two sections and count one reference twice. Two GitLab-shaped details and no more. The **long form** (`image: {name: node:22, entrypoint: […]}`, `services: [{name: postgres:16.2, alias: db}]`) is the same reference under a `name:` key, so read the key rather than the shape; and a **`$VARIABLE`-interpolated tag** (`image: $CI_REGISTRY_IMAGE:$TAG`) is this ecosystem's `ARG`-interpolated tag — reported with what it would resolve to, never rewritten through the indirection. **If it ever takes more than that, the container model was under-generalised**, and saying so is better than growing a GitLab-shaped copy of it.
- **Keeping them here is also what makes a skew visible.** A repo whose `Dockerfile` says `node:22.4` and whose `.gitlab-ci.yml` says `image: node:22.1` is running two versions of one base image, and that is only a finding while both live in one section — see **Monorepos** in `REFERENCE.md`.

## Resolving and writing, with no updater to drive

This is the **first ecosystem where the skill resolves and writes itself**, and that is a consequence of the domain rather than a preference: no updater owns a Dockerfile the way taze owns `package.json` or `go get` owns `go.mod`.

- **Resolve through whatever the environment already has.** The registry v2 API (`GET /v2/<repo>/tags/list`) needs nothing installed; `crane ls`, `skopeo list-tags` and `docker` are used where one is present. Preference is irrelevant — the first one available is the right one.
- **Write the manifest file directly.** The `FROM` line in a Dockerfile, the `image:` value in a Compose service. **There is no lockfile**, so nothing is regenerated and nothing is installed afterwards; the edited manifest is the whole write.
- **No resolver available → report it and skip the ecosystem.** Never install one on the fly. This is the same answer the skill already gives when `cargo upgrade` needs an absent cargo-edit, and it discharges the same rule: the repo's tooling decides, and the skill does not reach past it.
- **Registry auth is the repo's own config to honour.** A private registry the environment is already logged in to resolves like any other; one it is not, or one that is simply unreachable, is a **reported gap** — never a zero, and never a silent omission from the plan. "No newer tag found" and "the registry did not answer" are opposite facts.

## The gate and the advisories

**No release-age gate exists here, and that must be said rather than skipped.** No container registry offers a `minimumReleaseAge` equivalent, so the gated-versus-ungated diff (**The release-age gate** in `REFERENCE.md`) has nothing to compare and there is no held-by-gate row for the container side. **Report the section _not applicable_** — the same rule Cargo (`ecosystems/cargo.md`) and Go (`ecosystems/go.md`) already carry, for the same reason: a step silently omitted reads exactly like a step that ran and found nothing withheld.

**Advisories run every time, like every other ecosystem's.** `docker scout cves <image>` or `trivy image <image>` where one is available. Both are **separate tools**, as `cargo audit` and `govulncheck` are, so a missing one is **reported as unavailable, never as clean** — see **Security** in `REFERENCE.md`.
