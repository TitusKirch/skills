# write-readme — Reference

## Hero emoji (project type)

| Emoji | Project type                         |
| :---: | :----------------------------------- |
|  🛡️   | Security / authz / policy libraries  |
|  🏗️   | Infrastructure / IaC                 |
|  📚   | Documentation / knowledge bases      |
|  🧰   | Developer tooling / CLIs             |
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

## Badges

Use shields.io with `style=flat-square`. Standard set for **published Composer packages**:

```markdown
[![Latest Version on Packagist](https://img.shields.io/packagist/v/{vendor}/{pkg}.svg?style=flat-square&color=4f46e5)](https://packagist.org/packages/{vendor}/{pkg})
[![Total Downloads](https://img.shields.io/packagist/dt/{vendor}/{pkg}.svg?style=flat-square&color=4f46e5)](https://packagist.org/packages/{vendor}/{pkg})
[![Tests](https://img.shields.io/github/actions/workflow/status/{owner}/{repo}/ci.yml?branch=main&style=flat-square&label=tests)](https://github.com/{owner}/{repo}/actions/workflows/ci.yml)
[![PHP Version](https://img.shields.io/packagist/dependency-v/{vendor}/{pkg}/php?style=flat-square&color=8993be)](https://packagist.org/packages/{vendor}/{pkg})
[![License: MIT](https://img.shields.io/packagist/l/{vendor}/{pkg}.svg?style=flat-square&color=10b981)](LICENSE)
```

For **npm packages**, swap Packagist for `npm/v`, `npm/dm`, and adjust accordingly.

For **internal infrastructure repos**, omit badges entirely.

Brand colors used in the existing READMEs: `4f46e5` (primary), `8993be` (neutral), `10b981` (license), `ff2d20` (Laravel).

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
