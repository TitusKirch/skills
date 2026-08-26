# GitLab CI's version model

The **GitLab CI** branch of `update-deps` — reached when step 1 detects a `.gitlab-ci.yml` carrying `include:` or `component:` references. Everything a run needs whatever its ecosystem stays in `REFERENCE.md`.

**A `.gitlab-ci.yml` pins third-party code three ways, and only one of them is new here.** A pipeline definition references **container images**, **remote CI fragments** held in other projects, and **catalog components** — all third-party, all stale-able, and none of them declared with a range or recorded in a lockfile. Two of the three resolve with machinery this skill already has, which is why this ecosystem is mostly assembly:

| Reference                           | Resolves against     | Model                                                                       |
| :---------------------------------- | :------------------- | :-------------------------------------------------------------------------- |
| `image:` / `services:`              | a container registry | the container tag model (`ecosystems/container-images.md`) — reported there |
| `include:` with `project:` + `ref:` | a project's git tags | the action ref model (`ecosystems/github-actions.md`), via `glab api`       |
| `include:` with `component:`        | the CI/CD Catalog    | this section — the one new resolution path                                  |

**The image tags are reported with the container ecosystem, not here.** Same registry, same tag semantics, same digest-pin handling, so routing them anywhere else would write one model twice and risk counting one reference in two sections — exactly the call `uses: docker://…` already gets. What that leaves for this section is the two **forge-resolved** kinds, which share a resolver, a host and a write site with each other and with nothing else.

## The five `include:` forms, and which three are dependencies

`include:` is one key with five forms, and telling them apart is most of the work:

| Form                                          | Example                                            | This run                                                                            |
| :-------------------------------------------- | :------------------------------------------------- | :---------------------------------------------------------------------------------- |
| `local:`                                      | `- local: .gitlab/ci/test.yml`                     | **not a dependency** — part of this repo, and part of this ecosystem's manifest set |
| `template:`                                   | `- template: Security/SAST.gitlab-ci.yml`          | **not a dependency** — shipped with the instance and versioned with it              |
| `project:` + `ref:`                           | `- project: g/p` · `ref: v1.4.2` · `file: /ci.yml` | **moves** — `v1.4.9` under `minor`, `v2` only under an explicit `major`             |
| `project:` with a branch `ref:`, or no `ref:` | `ref: main` · _(omitted)_                          | **held — floating**, reported and never rewritten                                   |
| `project:` with a SHA `ref:`                  | `ref: a1b2c3…`                                     | **held — no readable version**, reported with the SHA                               |
| `remote:`                                     | `- remote: https://host/g/p/-/raw/v1.2.3/ci.yml`   | **held — reported**, never rewritten: the host may not be a GitLab instance         |
| `component:`                                  | `- component: $CI_SERVER_FQDN/g/p/n@1.4.2`         | **moves** — the catalog's newest released version in range                          |
| `component:` at `@~latest` or a branch        | `@~latest`, `@main`                                | **held — floating**, reported and never rewritten                                   |

- **A `local:` include is a manifest, not a dependency.** It names a file in this repo, so counting it would report the repo to itself — the same answer a `uses: ./…` action ref and a Compose `build:` service already get. What it **does** do is extend the file set this ecosystem reads: follow it transitively, because an included file may include more.
- **A `template:` include is versioned with the instance.** GitLab ships those files, and their version is the GitLab version the pipeline runs on — there is no ref to move and no upgrade for this skill to perform. Do not report it as held; it is not a dependency at all.
- **A missing `ref:` is floating, not pinned, and that is the trap in this ecosystem.** `include: {project: g/p, file: /ci.yml}` looks pinned because it names one file in one project, but GitLab resolves it against that project's **default branch** — so it silently runs whatever was last merged there. It gets the floating answer: reported, never rewritten. Adding a `ref:` where a repo left one out is a **pinning-policy change**, not an update.
- **A branch `ref:` is the same fact stated explicitly**, and it earns the same call a GitHub Actions `@main` gets: name the exposure, and do not decide that a repo pinning to a branch meant to pin a tag.
- **A SHA `ref:` is readable only if a tag matches it.** Unlike an action ref, a GitLab include carries **no version comment** to pair the SHA with — there is nowhere in the syntax to put one — so a SHA that no tag resolves to is held with the SHA reported. Where a tag does match it exactly, say which, and treat the pair the way a SHA pin and its comment (`ecosystems/github-actions.md`) are treated: both halves or neither.
- **A `remote:` include is a URL to any host**, GitLab or not. Where its path carries a readable `/-/raw/<ref>/` segment, report the ref it names — but do not rewrite the URL: a version-looking path segment on an unknown host is a guess, and this ecosystem's whole resolution story rests on knowing which instance is being asked.

## Components and the catalog

**A component reference is `<fqdn>/<group>/<project>/<name>@<version>`**, and everything left of the `@` is identity. Three things about the version make this the one new path:

- **A component's versions are the component project's _releases_, not its tags.** A version reaches the CI/CD Catalog when a **release** is created from a tag, so a tag that was never released is not a version anyone can use. Read `glab api projects/<url-encoded-path>/releases` rather than the tag list — offering a version the catalog cannot serve is worse than offering none. The project path is URL-encoded (`group%2Fproject`), which is the shape GitLab's API needs and `gh`'s does not.
- **`@~latest` is GitLab's own floating form**, and it means the newest **released** version rather than the newest tag. It resolves on every pipeline run by design, so pinning it narrows what the repo left open: report it, and move it only if a human asks for something this skill does not do.
- **`$CI_SERVER_FQDN` is not an unresolvable interpolation, and this is the one place the skill reads through a variable.** It is a predefined variable whose value **is** the instance the pipeline runs on — which is the host the ladder below just resolved — so substituting it is reading the reference, not rewriting through an indirection. That is the opposite call an `ARG`-interpolated image tag (`ecosystems/container-images.md`) gets, for a concrete reason: an `ARG` can be overridden at build time by CI the run cannot see, while `$CI_SERVER_FQDN` is fixed by the instance. **Any other variable in the prefix is held**, exactly as the image tag is.

## Resolving and writing, on the instance this repo resolves to

This is the **third ecosystem the skill updates itself**, and the first whose resolution depends on which _instance_ the repo belongs to:

- **Resolve through `glab api`**, against the host the repo resolves to — the root `forgeHost` key where the config states one, else the host in the `origin` remote, else whatever `glab` is already configured for. Pass it as `GITLAB_HOST=<host> glab api …` where it was resolved, and pass nothing where it was not. `glab api projects/<url-encoded-path>/repository/tags` lists what an include's `ref:` may move to; `glab api projects/<url-encoded-path>/releases` does the same for a component. This is the same host ladder the forge-driving skills carry as a mirrored block, resolved here in a sentence for the reason the action ref model (`ecosystems/github-actions.md`) gives: this skill **drives** no forge, it reads one.
- **Write `.gitlab-ci.yml` — or the included file the reference actually sits in — directly.** The `ref:` value, or the `@version` after a component path. **There is no lockfile**, so nothing is regenerated and nothing is installed afterwards; the edited pipeline file is the whole write.
- **A `glab` that is absent, unauthenticated, or pointed at an unreachable instance leaves the ecosystem _unread_** — reported in those words, with which of the three it was **and the host that was tried**, never as "nothing to update". **Self-hosted is the ordinary deployment here rather than the exception**, so an unreachable or unauthenticated host is the expected failure mode, not an exotic one. `glab auth login --hostname <host>` is the fix, and naming it is the run's job.
- **A reference into another instance is not resolvable from this one.** A `remote:` include can name any host, and a component prefixed with a literal FQDN rather than `$CI_SERVER_FQDN` can name a different GitLab. Where the host is not the one `glab` is authenticated against, report it **unread with the host named** — never resolve it against the instance that happens to be at hand, which would answer about a different project of the same path.
- **A project that does not resolve is a gap, not a zero** — renamed, deleted, moved to another group, or simply not visible to the token in use. Say which, exactly as an unresolvable action repository is reported.

## The gate and the advisories

**No release-age gate exists here, and that must be said rather than skipped.** Neither GitLab's tag API nor its catalog offers a `minimumReleaseAge` equivalent, so the gated-versus-ungated diff (**The release-age gate** in `REFERENCE.md`) has nothing to compare and there is no held-by-gate row for the GitLab CI side. **Report the section _not applicable_**, the same rule Cargo (`ecosystems/cargo.md`), Go (`ecosystems/go.md`), container images (`ecosystems/container-images.md`) and GitHub Actions (`ecosystems/github-actions.md`) already carry.

**The advisory answer splits by kind, and neither half is clean.** The `image:` and `services:` tags are scanned with the container ecosystem they belong to (`docker scout cves` / `trivy image`), reported **unavailable** where neither tool is installed. For includes and components there is **no advisory command at all** — nothing of `cargo audit`'s shape has ever shipped for them, exactly as for action refs — so that half is reported **not available for this ecosystem**. The exposure that _is_ knowable belongs there instead: a fragment pinned to a **branch** or left with **no `ref:`**, and a component at **`@~latest`**, run whatever their author last pushed; and a GitLab tag is **mutable**, so a tag-pinned include trusts a ref its author can re-point, the same standing risk tag-pinned action refs (`ecosystems/github-actions.md`) carry. **Name it, and do not close it** — pinning a floating include or adding a missing `ref:` changes the repo's pinning policy rather than updating a dependency, so the report names the exposure and a human decides.
