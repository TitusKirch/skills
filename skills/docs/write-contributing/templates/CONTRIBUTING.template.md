<!--
CONTRIBUTING template — house style.
Replace every {{placeholder}} with a DERIVED value (see ../REFERENCE.md#derivation-table);
never type one in from memory or from another repo's guide.
Delete any section whose signal this repo does not show — never leave it empty.
Keep the section order. Emoji in the intro line only, never in a heading.
-->

# Contributing to {{project-name}}

Thanks for taking the time to contribute! {{emoji}} This document covers what you need to get a PR landed.

<!-- Only if CODE_OF_CONDUCT.md exists. -->

## Code of Conduct

This project follows the [{{code-of-conduct-name}}](CODE_OF_CONDUCT.md). By participating, you agree to uphold it.

## Reporting issues

<!-- One line per intake route, derived from .github/ISSUE_TEMPLATE/ and its config.yml. -->

- **Bugs**: open a [{{bug-template-name}}]({{bug-template-url}}).
- **Feature requests**: open a [{{feature-template-name}}]({{feature-template-url}}).
- **Questions & ideas**: {{contact-link-line}}.
- **Security vulnerabilities**: **do not** open a public issue. Follow [SECURITY.md](SECURITY.md).

## Development setup

Requirements:

- {{runtime}} **{{runtime-version}}**
- **{{package-manager}} {{package-manager-version}}**

Clone and install:

```bash
git clone {{clone-url}}
cd {{repo-name}}
{{install-command}}   # {{what the install also does, e.g. wires the git hooks}}
```

<!-- Only where the repo has a repeatable contribution unit. Derive the steps from the repo's
     own scaffolding: where the folder goes, which sync/codegen must follow, which check fails
     if it does not. -->

## Adding a new {{unit}}

1. {{create the folder / run the generator}}
2. {{fill in the required files}}
3. {{run the sync/codegen command}} — see {{link the file that owns the generated artifacts}} for what it rewrites.
4. Run `{{verify-command}}` before pushing.
5. Commit as `{{commit-example-for-a-new-unit}}`.

## Running the suite

| Command              | What it does               |
| :------------------- | :------------------------- |
| `{{verify-command}}` | {{what the gate composes}} |
| `{{command}}`        | {{what it does}}           |

{{one sentence on how CI relates to the gate — same commands, or which ones it adds}}

## Branching & PRs

1. **Don't push directly to `{{base-branch}}`.** Branch off `{{base-branch}}` for every change.
2. **{{commit-convention}} required.** {{what enforces it}} on every commit. Examples:
   - `{{commit-example-feat}}`
   - `{{commit-example-fix}}`
   - Breaking changes: `{{commit-example-breaking}}`
3. **One concern per PR.** Smaller PRs land faster.

<!-- Only where hooks or a formatter are configured. -->

## Style & quality gates

{{hook-manager}} runs the following on `git commit`:

- **{{file-kinds}}** → `{{tool}}`

If a hook fails, fix the issue and commit again. **Don't `--no-verify`** unless explicitly asked.

> [!TIP]
> Run `{{fix-command}}` before opening a PR — saves a CI cycle.

<!-- Only where release automation exists. -->

## Releases

Releases are automated via [{{release-tool}}]({{release-tool-url}}). {{what a contributor's merged commit triggers, and from which branch}}.

## License

By contributing, you agree that your contributions will be licensed under the [{{license}}](LICENSE).
