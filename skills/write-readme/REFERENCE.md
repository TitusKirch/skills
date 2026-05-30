# write-readme — Reference

## Hero emoji (project type)

| Emoji | Project type                         |
| :---: | :----------------------------------- |
|  🛡️   | Security / authz / policy libraries  |
|  📱   | Device / session management          |
|  🏗️   | Infrastructure / IaC                 |
|  📚   | Documentation / knowledge bases      |
|  🧰   | Developer tooling / CLIs             |
|  🖥️   | TUI / terminal apps                  |
|  🧩   | Skills / plugins / extensions        |
|  ⚡   | Performance / runtime libraries      |
|  🤖   | Agents / automation                  |
|  📦   | Generic library / package (fallback) |

Pick one and use it consistently across the README's `# {emoji} {name}` and any social-card / banner art.

## Section emoji catalogue

These are the **prescribed** emojis for recurring sections. Use the same emoji for the same kind of section across all kirchDev READMEs — readers should be able to find "Versioning" by scanning for 🛣️ without reading the heading.

| Section                                    | Emoji | Notes                                              |
| :----------------------------------------- | :---: | :------------------------------------------------- |
| Features / Highlights                      |  ✨   | "Features" for libs, "Highlights" for infra/apps.  |
| Installation / Stack                       |  📦   | "Installation" for libs, "Stack" for infra.        |
| Quick start / Setup                        |  🚀   | "Quick start" for libs, "Setup" for infra/apps.    |
| Configuration                              |  ⚙️   | Use when there's a non-trivial config table.       |
| Testing                                    |  🧪   | Library-grade test suites.                         |
| Multi-tenant / Org / Workspace scoping     |  🏢   | Anything tenant-aware.                             |
| Sessions / device management               |  📱   | Listing, naming, revoking sessions/devices.        |
| Events / listeners / broadcasting          |  📡   | Emitted events, listeners, broadcast channels.     |
| Overridable contracts / extension points   |  🧩   | Swappable interfaces, custom implementations.      |
| Decision trace / Observability / Debugging |  🔍   | Inspection, tracing, debug surfaces.               |
| Cascade / Cleanup / Lifecycle              |  🧹   | Delete semantics, GC, retention.                   |
| Migration (from / to)                      |  🔁   | Migrating from another package, or workflow loops. |
| Layout / Repo structure                    |  🗂️   | File tree blocks.                                  |
| Adding things                              |  ➕   | "How do I add a new X?" sections.                  |
| Contributing                               |  🤝   | Always this emoji.                                 |
| Versioning                                 |  🛣️   | Always this emoji.                                 |
| License                                    |  📄   | Always this emoji.                                 |
| Security policy                            |  🔐   | When linking SECURITY.md prominently.              |
| FAQ                                        |  ❓   | If included.                                       |
| Roadmap                                    |  🗺️   | If included.                                       |

If you need a section that's not in the catalogue, pick a sensible emoji and **add it here in the same PR** so the next README stays consistent.

## Feature-bullet emojis

Each bullet starts with an emoji that reflects the feature's nature — these are free-form, but stay tight and scannable. Common picks:

| Theme               | Suggested emoji |
| :------------------ | :-------------- |
| Roles / identity    | 🎭              |
| Tenants / orgs      | 🏢              |
| Gates / routing     | 🚪              |
| Performance / cache | ⚡              |
| Inspection / trace  | 🔍              |
| Runtime / Octane    | 🚀              |
| Configuration       | 🧰              |
| Testing             | 🧪              |
| Security defaults   | 🛡️              |
| YAML / declarative  | 🧩              |
| Lifecycle / archive | 🗂️              |
| Auth / GitHub App   | 🤖              |
| CI / plan-on-PR     | 📋              |
| Apply / deploy      | 🚀              |
| Save / persistence  | 💾              |
| Warning / guard     | ⚠️              |
| Mouse / input       | 🖱️              |
| Navigation / panes  | 🧭              |
| Toggle / enable     | ☑️              |

## Badges

Use shields.io with `style=flat-square`. **Never invent new colors** — pick from the palette below so every kirchDev README shares the same visual fingerprint. If a badge purpose isn't covered here, add it to this table in the same PR.

### Badge color palette

| Token     |   Hex    | Swatch | Use for                                                                                         |
| :-------- | :------: | :----: | :---------------------------------------------------------------------------------------------- |
| `primary` | `4f46e5` |   🟣   | Identity badges — package version, total downloads, GitHub release. One badge type per repo.    |
| `neutral` | `8993be` |   ⚪   | Runtime / dependency version badges (PHP, Node, Python, Go) — anything language-agnostic.       |
| `success` | `10b981` |   🟢   | License badge. Also: "tests passing", coverage ≥ threshold, status badges with green semantics. |
| `laravel` | `ff2d20` |   🔴   | Laravel-specific dependency badges only. Do not reuse for generic "error/critical."             |
| `php`     | `777bb4` |   🟦   | PHP-branded badges (rare — `neutral` is preferred unless the badge is explicitly PHP-themed).   |
| `node`    | `5fa04e` |   🟩   | Node-branded badges (rare — `neutral` is preferred).                                            |
| `warning` | `f59e0b` |   🟠   | Reserved for "alpha / unstable / experimental" status badges. Use sparingly.                    |

Rules:

- **No `color=` query param ⇒ shields' default blue.** Always pass one of the tokens above.
- **CI / Tests badge has no color override** — it reflects build status (green/red) on its own.
- **License is always `success` (`10b981`).**
- **Version + downloads share `primary` (`4f46e5`)** — they're a logical pair.

### Standard sets

**Published Composer packages:**

```markdown
[![Latest Version on Packagist](https://img.shields.io/packagist/v/{vendor}/{pkg}.svg?style=flat-square&color=4f46e5)](https://packagist.org/packages/{vendor}/{pkg})
[![Total Downloads](https://img.shields.io/packagist/dt/{vendor}/{pkg}.svg?style=flat-square&color=4f46e5)](https://packagist.org/packages/{vendor}/{pkg})
[![Tests](https://img.shields.io/github/actions/workflow/status/{owner}/{repo}/ci.yml?branch=main&style=flat-square&label=tests)](https://github.com/{owner}/{repo}/actions/workflows/ci.yml)
[![PHP Version](https://img.shields.io/packagist/dependency-v/{vendor}/{pkg}/php?style=flat-square&color=8993be)](https://packagist.org/packages/{vendor}/{pkg})
[![License: MIT](https://img.shields.io/packagist/l/{vendor}/{pkg}.svg?style=flat-square&color=10b981)](LICENSE)
```

**Published npm packages:**

```markdown
[![npm Version](https://img.shields.io/npm/v/{pkg}.svg?style=flat-square&color=4f46e5)](https://www.npmjs.com/package/{pkg})
[![Downloads](https://img.shields.io/npm/dm/{pkg}.svg?style=flat-square&color=4f46e5)](https://www.npmjs.com/package/{pkg})
[![Tests](https://img.shields.io/github/actions/workflow/status/{owner}/{repo}/ci.yml?branch=main&style=flat-square&label=tests)](https://github.com/{owner}/{repo}/actions/workflows/ci.yml)
[![Node Version](https://img.shields.io/node/v/{pkg}.svg?style=flat-square&color=8993be)](https://www.npmjs.com/package/{pkg})
[![License: MIT](https://img.shields.io/npm/l/{pkg}.svg?style=flat-square&color=10b981)](LICENSE)
```

> [!NOTE]
> **Bun-only / non-`npx`-compatible packages:** skip the npm badge set entirely. The version and downloads badges imply `npx {pkg}` works — showing them on a package that only runs under `bunx` (or requires a global install) is semantically wrong, even if the numbers are correct.

**Bun engine badge** (use in place of the Node version badge for Bun-only packages — shields has no dynamic `engines.bun` lookup, so the version is static and must be bumped manually in the README when `package.json#engines.bun` changes):

```markdown
[![Bun Version](https://img.shields.io/badge/bun-{minVersion}%2B-8993be?style=flat-square)](https://bun.sh)
```

**Laravel-specific framework badge** (add alongside the standard PHP set when the package is Laravel-only):

```markdown
[![Laravel Version](https://img.shields.io/packagist/dependency-v/{vendor}/{pkg}/illuminate%2Fsupport?style=flat-square&label=laravel&color=ff2d20)](https://packagist.org/packages/{vendor}/{pkg})
```

**Claude Code skills repos** (add at the top of the hero block, separate from the regular badge row):

```markdown
[![skills.sh](https://skills.sh/b/{owner}/{repo})](https://skills.sh/{owner}/{repo})
```

The `skills.sh` badge is **self-styled** by the registry — do not pass `style=` or `color=`. It renders the live install count from the [skills.sh](https://skills.sh) leaderboard and links to the repo's detail page.

**Internal infrastructure / private repos:** omit badges entirely.

## Hook block — patterns

The hook is the first thing after the hero. Pick the format that best fits the project:

- **Library** → minimal usage line(s):

  ```php
  Pbac::withOrganisation($org->id, fn () => $user->can('members.invite')); // ✅
  ```

- **IaC / declarative** → a tiny YAML/HCL snippet that shows the contract:

  ```yaml
  repositories:
    my-new-repo:
      description: 'Something cool.'
  ```

- **CLI** → a single command + expected output line.

- **CLI with multiple invocation forms** (e.g. `bunx` / `npx` / global) → a bash block with one command per line and an inline comment naming the form:

  ```bash
  bunx {pkg}              # one-off, no install
  bun add -g {pkg} && {pkg}  # global install
  ```

Always follow the hook with **one** plain sentence summarising the value (no list, no second snippet). Example:

> That's it. Tenant-aware authorization in one line, native Laravel `Gate` semantics, no manual scope plumbing.

## Closing footer (mandatory)

```markdown
## 🛣️ Versioning

[Semantic Versioning](https://semver.org/) via [release-please](https://github.com/googleapis/release-please) — see [CHANGELOG.md](CHANGELOG.md).

## 📄 License

[MIT](LICENSE) © [Titus Kirch](https://github.com/TitusKirch/) / [IT-Dienstleistungen Titus Kirch](https://kirch.dev)
```

## Anti-patterns

- ❌ Heading without its prescribed emoji.
- ❌ Multiple code blocks in the hook section.
- ❌ Centered everything — only the hero block is centered.
- ❌ Plain `>` blockquotes for warnings — use GitHub `> [!IMPORTANT]` callouts.
- ❌ Reordering Versioning / License away from the end.
- ❌ Inventing a new emoji for a section that already has one in the catalogue.
