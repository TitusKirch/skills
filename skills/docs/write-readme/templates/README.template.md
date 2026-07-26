<!--
README template — kirchDev house style.
Replace every {{placeholder}}. Delete optional sections that don't apply.
Keep the section order; keep the section emojis (see ../REFERENCE.md).
-->

<div align="center">

# {{hero-emoji}} {{project-name}}

**{{one-line tagline — bold, em-dashes welcome, no trailing period unless it's a full sentence}}**

<!--
BADGES: keep for public packages, delete for internal/infra repos.
Colors are FIXED — see ../REFERENCE.md#badge-color-palette:
  primary  4f46e5  — version + downloads
  neutral  8993be  — runtime/dep version (PHP/Node)
  success  10b981  — license
  laravel  ff2d20  — Laravel-only badges
No color override on the CI/Tests badge.
-->

[![Latest Version](https://img.shields.io/{{registry}}/v/{{slug}}.svg?style=flat-square&color=4f46e5)]({{registry-url}})
[![Downloads](https://img.shields.io/{{registry}}/{{downloads-path}}/{{slug}}.svg?style=flat-square&color=4f46e5)]({{registry-url}})
[![Tests](https://img.shields.io/github/actions/workflow/status/{{owner}}/{{repo}}/ci.yml?branch=main&style=flat-square&label=tests)](https://github.com/{{owner}}/{{repo}}/actions/workflows/ci.yml)
[![Runtime](https://img.shields.io/{{registry}}/dependency-v/{{slug}}/{{runtime}}?style=flat-square&color=8993be)]({{registry-url}})
[![License: MIT](https://img.shields.io/{{registry}}/l/{{slug}}.svg?style=flat-square&color=10b981)](LICENSE)

</div>

---

```{{lang}}
{{representative one-liner or tiny snippet}}
```

That's it. {{single sentence summarising the value proposition}}.

<!-- Optional: a short problem→solution "why this exists" block, right after the hook. Drop it if the tagline already says enough. -->

## 🤔 {{Why}}

{{one or two sentences: the problem, then how this solves it}}.

## 📦 {{Installation|Stack}}

<!-- Library: install command. Infra/app: stack bullets. Lead with install so the reader reaches a runnable command fast; may merge with Quick start into a single "Install & run". -->

```bash
{{install command}}
```

## 🚀 {{Quick start|Setup}}

```{{lang}}
{{minimal usage example}}
```

## ✨ {{Features|Highlights}}

- **{{emoji}} {{Feature title}}** — {{one-sentence body}}.
- **{{emoji}} {{Feature title}}** — {{one-sentence body}}.
- **{{emoji}} {{Feature title}}** — {{one-sentence body}}.

<!-- Optional domain sections. Add as many as needed; pick emojis from REFERENCE.md. -->

## {{emoji}} {{Domain section title}}

{{body}}

## ⚙️ Configuration

<!-- Optional. Include only if there's a meaningful config surface. -->

| Key       | What it controls |
| :-------- | :--------------- |
| `{{key}}` | {{description}}  |

## 🧪 Testing

<!-- Optional. Include for libraries with a test suite. -->

```bash
{{test command}}
```

## 🤝 Contributing

<!-- Optional. Drop for internal-only repos. -->

PRs welcome. Conventional Commits required (enforced via commitlint). Husky runs the project's linters/formatters on `git commit`.

> [!TIP]
> Run `pnpm check:fix` before pushing — CI will catch what husky missed.

## 🛣️ Versioning

[Semantic Versioning](https://semver.org/) via [release-please](https://github.com/googleapis/release-please) — see [CHANGELOG.md](CHANGELOG.md).

## 📄 License

[MIT](LICENSE) © [Titus Kirch](https://github.com/TitusKirch/) / [IT-Dienstleistungen Titus Kirch](https://kirch.dev)
