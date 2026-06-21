# Changelog

## [0.5.1](https://github.com/TitusKirch/skills/compare/v0.5.0...v0.5.1) (2026-06-21)


### Bug Fixes

* **skills:** drop colon-space from descriptions so skills.sh parses them ([894bb57](https://github.com/TitusKirch/skills/commit/894bb5700736a0cfb11e683ffa816c6e0a1b3495))

## [0.5.0](https://github.com/TitusKirch/skills/compare/v0.4.0...v0.5.0) (2026-06-21)


### Features

* **atomic-commit:** cache detected conventions per repo ([bead906](https://github.com/TitusKirch/skills/commit/bead906c59085d30d70eb7ec06f4f983328224ad))
* **atomic-commit:** move convention cache to shared namespace ([9bffdd0](https://github.com/TitusKirch/skills/commit/9bffdd087543732a45d76a840922e4092d0822b8))
* **atomic-commit:** require feat/fix for release-relevant changes ([c223b4c](https://github.com/TitusKirch/skills/commit/c223b4c60b0bd7bf9bb958e3837df1501f8fc435))
* **atomic-commit:** support a commit.language config override ([2e3556f](https://github.com/TitusKirch/skills/commit/2e3556fc145cb9b39d555d3d6a4fcbcaa280d4a6))
* **gh-pull-request:** add skill ([03e88f7](https://github.com/TitusKirch/skills/commit/03e88f735a0b0f687ecbd8ee902df6a363d403b3))
* **gh-pull-request:** reuse the shared convention cache ([84fed49](https://github.com/TitusKirch/skills/commit/84fed4910d0e1bf9a1c82b17464969078f040f6a))
* **issue:** add skill ([753384e](https://github.com/TitusKirch/skills/commit/753384e0c3b7d6dfcae4803cc17183c40ad1a9e3))
* **pull-request:** rename gh-pull-request and read pr.backend ([635a1c4](https://github.com/TitusKirch/skills/commit/635a1c4afd0038a7af822007d87e9b12cd7cfb6d))
* **skills:** add docs config section to the shared schema ([40468b8](https://github.com/TitusKirch/skills/commit/40468b85539156a858b94ccb2c39c63e895b520a))
* **skills:** add shared .tituskirch-skills.json config schema ([b1b5d0e](https://github.com/TitusKirch/skills/commit/b1b5d0e1b3a49e982092c95686a67eb5be3912d8))
* **skills:** generate registry from SKILL.md frontmatter ([911e626](https://github.com/TitusKirch/skills/commit/911e626bde63249cc4e0deda5e2931e2065911f6))
* **write-docs:** add skill ([65343aa](https://github.com/TitusKirch/skills/commit/65343aa63ed7cbafe0ce7b39582891ea823ff040))


### Bug Fixes

* **atomic-commit:** forbid AI/agent attribution in commit messages ([ca3d432](https://github.com/TitusKirch/skills/commit/ca3d432638cd4a7f2cabbd99727a2e7291149755))
* **atomic-commit:** refine commit-signing guardrails ([2385e77](https://github.com/TitusKirch/skills/commit/2385e77d2df6ed8bc688a4bd03ed713b33a6f78a))
* **atomic-commit:** respect commitlint body-max-line-length ([0954631](https://github.com/TitusKirch/skills/commit/0954631719b964cffd337d4529eb92eaf717dd9c))
* **issue:** handle Linear's lack of repo issue templates ([252228c](https://github.com/TitusKirch/skills/commit/252228ce3882e5e0284edb3e7c701db684844077))
* **issue:** pin the verified GitHub sub-issues API ([d26d977](https://github.com/TitusKirch/skills/commit/d26d977d9df6e2b8671a7a5f19e45a8d43bc6f7c))
* **skills:** accept any language value, not just en/de ([b270276](https://github.com/TitusKirch/skills/commit/b27027661aa48a961258ea4c1cb2040227030a97))

## [0.4.0](https://github.com/TitusKirch/skills/compare/v0.3.0...v0.4.0) (2026-06-19)


### Features

* add package.json keywords ([96a4ca0](https://github.com/TitusKirch/skills/commit/96a4ca0c7316f48c36ac36bc1e64b7325b256561))
* add package.json keywords ([#10](https://github.com/TitusKirch/skills/issues/10)) ([ccf1e7b](https://github.com/TitusKirch/skills/commit/ccf1e7b159abad5716158e0beb38163d8dced761))
* **atomic-commit:** add skill ([40042a5](https://github.com/TitusKirch/skills/commit/40042a55eb3ddd84a55c1fd01e62f5afce4e1fed))
* **compact-readme:** add skill ([256d5ba](https://github.com/TitusKirch/skills/commit/256d5bab02698cd4d8c068458bd13c24d022bebd))
* **vhs-demo:** add skill ([2390a67](https://github.com/TitusKirch/skills/commit/2390a67e4614ecc389d3c0b52acfba7f9e627f61))


### Bug Fixes

* **dependabot:** match managed area:* label names ([4663d34](https://github.com/TitusKirch/skills/commit/4663d34025e54e5e330092bcbd2d64e7a9cd4f79))

## [0.3.0](https://github.com/TitusKirch/skills/compare/v0.2.0...v0.3.0) (2026-05-25)


### Features

* **ci:** run release-please under the kirchDev Release App ([#6](https://github.com/TitusKirch/skills/issues/6)) ([3ab039c](https://github.com/TitusKirch/skills/commit/3ab039cfc8a697f41865ecc2502f47ae926d9f29))

## [0.2.0](https://github.com/TitusKirch/skills/compare/skills-v0.1.0...skills-v0.2.0) (2026-05-23)


### Features

* add claude-plugin manifest to activate skills bundle ([b31bb48](https://github.com/TitusKirch/skills/commit/b31bb48c72cb5683c4bdeafbb8be85e16dc5c910))
* add link/list/unlink scripts for local skill activation ([0b77c66](https://github.com/TitusKirch/skills/commit/0b77c66b95faa26ef5f0c4676216365fe9fc242c))
* add skills.sh install-count badge ([9de53f4](https://github.com/TitusKirch/skills/commit/9de53f4158b01d9eedfa6e20db3dc4675d3e1091))
* scaffold skills directory with example-skill template ([73d71b7](https://github.com/TitusKirch/skills/commit/73d71b721541fc4479d70e3821155734cbf99c70))
* **write-readme:** add Bun engine badge template ([3947ec9](https://github.com/TitusKirch/skills/commit/3947ec97ea3c32c45eea3cb0c22c1bffcaa73180))
* **write-readme:** add skill for generating kirchDev-style READMEs ([07f34d0](https://github.com/TitusKirch/skills/commit/07f34d0e20657113ed9034db0e533b24fc12cc41))
* **write-readme:** expand REFERENCE catalogue ([#4](https://github.com/TitusKirch/skills/issues/4)) ([aac814e](https://github.com/TitusKirch/skills/commit/aac814e62c50ef3b9da69c2eaaf8f2ea83734bcc))
* **write-readme:** fix badge color palette and require gap report ([0580373](https://github.com/TitusKirch/skills/commit/0580373932a2bb5ebd053f459aee4503f949fbf4))
