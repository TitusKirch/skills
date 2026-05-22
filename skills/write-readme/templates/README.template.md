<!--
README template — kirchDev house style.
Replace every {{placeholder}}. Delete optional sections that don't apply.
Keep the section order; keep the section emojis (see ../REFERENCE.md).
-->

<div align="center">

# {{hero-emoji}} {{project-name}}

**{{one-line tagline — bold, em-dashes welcome, no trailing period unless it's a full sentence}}**

<!-- BADGES: keep for public packages, delete for internal/infra repos. -->

[![Latest Version](https://img.shields.io/{{registry}}/v/{{slug}}.svg?style=flat-square&color=4f46e5)]({{registry-url}})
[![Tests](https://img.shields.io/github/actions/workflow/status/{{owner}}/{{repo}}/ci.yml?branch=main&style=flat-square&label=tests)](https://github.com/{{owner}}/{{repo}}/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/{{registry}}/l/{{slug}}.svg?style=flat-square&color=10b981)](LICENSE)

</div>

---

```{{lang}}
{{representative one-liner or tiny snippet}}
```

That's it. {{single sentence summarising the value proposition}}.

## ✨ {{Features|Highlights}}

- **{{emoji}} {{Feature title}}** — {{one-sentence body}}.
- **{{emoji}} {{Feature title}}** — {{one-sentence body}}.
- **{{emoji}} {{Feature title}}** — {{one-sentence body}}.

## 📦 {{Installation|Stack}}

<!-- Library: install command. Infra/app: stack bullets. -->

```bash
{{install command}}
```

## 🚀 {{Quick start|Setup}}

```{{lang}}
{{minimal usage example}}
```

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
