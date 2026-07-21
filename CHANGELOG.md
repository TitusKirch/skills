# Changelog

## [0.14.0](https://github.com/TitusKirch/skills/compare/v0.13.0...v0.14.0) (2026-07-21)


### Features

* **issue:** constrain issue body to intent, not implementation ([baae26e](https://github.com/TitusKirch/skills/commit/baae26e654df152112ff01ce2afd1f5fc95fb1ba)), closes [#63](https://github.com/TitusKirch/skills/issues/63)
* **issue:** translate title domain terms across languages ([5f15471](https://github.com/TitusKirch/skills/commit/5f15471b02f783d390972015abffbc43af8a55b7)), closes [#64](https://github.com/TitusKirch/skills/issues/64)

## [0.13.0](https://github.com/TitusKirch/skills/compare/v0.12.0...v0.13.0) (2026-07-20)


### Features

* **update-deps:** add Rust/Cargo (src-tauri) support ([26e6677](https://github.com/TitusKirch/skills/commit/26e6677bc0086cb9df831ded8bd97096175c234e)), closes [#60](https://github.com/TitusKirch/skills/issues/60)

## [0.12.0](https://github.com/TitusKirch/skills/compare/v0.11.0...v0.12.0) (2026-07-20)


### Features

* **release:** support multi-stage promotion chains ([79ac3dc](https://github.com/TitusKirch/skills/commit/79ac3dc17310913523c3d99377c6b13c23c0bc9c)), closes [#57](https://github.com/TitusKirch/skills/issues/57)

## [0.11.0](https://github.com/TitusKirch/skills/compare/v0.10.0...v0.11.0) (2026-07-18)


### Features

* **atomic-commit:** reuse convention cache on hash match regardless of age ([222c45f](https://github.com/TitusKirch/skills/commit/222c45f2475cd9e4c9a6be615d4836592c0bf91c)), closes [#53](https://github.com/TitusKirch/skills/issues/53)
* **handoff:** add skill ([ac4007b](https://github.com/TitusKirch/skills/commit/ac4007b72d36eb252bc9da75364c9d8408c27b19)), closes [#44](https://github.com/TitusKirch/skills/issues/44)
* **merge-deps:** add skill ([2a0ae35](https://github.com/TitusKirch/skills/commit/2a0ae3577bd60435fb2833300f707eafa02300db)), closes [#47](https://github.com/TitusKirch/skills/issues/47)
* **release:** add skill ([e26d5a5](https://github.com/TitusKirch/skills/commit/e26d5a5994ba8512c6d34a5214a8c70fc033693b)), closes [#46](https://github.com/TitusKirch/skills/issues/46)
* **release:** make branch promotion opt-in ([c584361](https://github.com/TitusKirch/skills/commit/c58436124b5dbb9e42a18d16aa133964154fc791)), closes [#46](https://github.com/TitusKirch/skills/issues/46)
* **release:** report an unrecognised release tool as unsupported ([4a9a5c5](https://github.com/TitusKirch/skills/commit/4a9a5c5edf068f7ca08d434ec15f21f81dcdebeb)), closes [#46](https://github.com/TitusKirch/skills/issues/46)
* **tituskirch-skills-config:** offer linear.states during work setup ([4582537](https://github.com/TitusKirch/skills/commit/4582537efee305849542e29fd482afb8e14d18c3)), closes [#51](https://github.com/TitusKirch/skills/issues/51)
* **tituskirch-skills-config:** teach setup and drift-check the release section ([4c9086d](https://github.com/TitusKirch/skills/commit/4c9086d5a00a031a906e28e5b144ed0a35016e95)), closes [#46](https://github.com/TitusKirch/skills/issues/46)
* **update-deps:** add skill ([8502724](https://github.com/TitusKirch/skills/commit/85027241f5664597dc937e37ecbcad2a57382a25)), closes [#50](https://github.com/TitusKirch/skills/issues/50)
* **work-issue:** add an explicit Linear lifecycle to workflow state map ([06f79e2](https://github.com/TitusKirch/skills/commit/06f79e228bf87994c3073f30ea430a21b0626c83)), closes [#51](https://github.com/TitusKirch/skills/issues/51)
* **work-queue:** order the queue by dependency in branch:&lt;name&gt; mode ([55f916c](https://github.com/TitusKirch/skills/commit/55f916cddc4ad4f7175fbaf20f8ab9a40c1a75ed)), closes [#34](https://github.com/TitusKirch/skills/issues/34)
* **work-queue:** reconcile issues left in review at the start of a drain ([b401250](https://github.com/TitusKirch/skills/commit/b401250496c0e0fc73135972921e9829a31e08a9)), closes [#52](https://github.com/TitusKirch/skills/issues/52)
* **write-docs:** teach the docs format to record ADRs ([e27f66d](https://github.com/TitusKirch/skills/commit/e27f66d62b15d70c473c957cf0aafa40123b58ab)), closes [#43](https://github.com/TitusKirch/skills/issues/43)


### Bug Fixes

* **work-issue:** align documented label defaults with the real convention ([1181c73](https://github.com/TitusKirch/skills/commit/1181c73d53152eb4076033fb2f60126b036dd652)), closes [#45](https://github.com/TitusKirch/skills/issues/45)
* **work-issue:** make done the human's sign-off instead of the merge ([4ee0f43](https://github.com/TitusKirch/skills/commit/4ee0f4338b40aa15194d3cc4c3ac267dd0f01d8f)), closes [#52](https://github.com/TitusKirch/skills/issues/52)
* **work-issue:** make the lifecycle label operative for eligibility ([ae80a2e](https://github.com/TitusKirch/skills/commit/ae80a2e235cdf11a0322d186c64fcacc64117c32)), closes [#49](https://github.com/TitusKirch/skills/issues/49)
* **work-queue:** surface worker label/body conflicts in the drain report ([391246a](https://github.com/TitusKirch/skills/commit/391246aae7599c22c219c6e757c024573fc63df7)), closes [#49](https://github.com/TitusKirch/skills/issues/49)

## [0.10.0](https://github.com/TitusKirch/skills/compare/v0.9.0...v0.10.0) (2026-07-07)


### Features

* **write-docs:** rule out subject-matter sections in the docs catalogue ([aeadce6](https://github.com/TitusKirch/skills/commit/aeadce6f53e9aa21f0e743158644b71522afa8cf))

## [0.9.0](https://github.com/TitusKirch/skills/compare/v0.8.0...v0.9.0) (2026-07-07)


### Features

* **skills:** allow disabling issue and pr via config false ([8e19c93](https://github.com/TitusKirch/skills/commit/8e19c93af49195b9da1f77b45fb0e7f214e8ef8a))
* **tituskirch-skills-config:** gate backend selection and harden schema loading ([500a0ff](https://github.com/TitusKirch/skills/commit/500a0fff35150447acaecd0e123321da88ab4787))

## [0.8.0](https://github.com/TitusKirch/skills/compare/v0.7.0...v0.8.0) (2026-07-07)


### Features

* **atomic-commit:** flag stale commit.scopeVocab in the plan ([fc34a8b](https://github.com/TitusKirch/skills/commit/fc34a8b1d3279518abd401f06e14cb232f61308f))
* **atomic-commit:** never type a release-relevant change as refactor ([cddae4f](https://github.com/TitusKirch/skills/commit/cddae4fd41de6c4523f0cfc0fcb1e2d2a4761afa))
* **issue:** pin the repo-scope label on linear create ([209cbe5](https://github.com/TitusKirch/skills/commit/209cbe5154643b3a8dddd10e921705b8c65ef1aa))
* **skills:** add commit scope overrides and per-skill instructions ([228d33c](https://github.com/TitusKirch/skills/commit/228d33c6e9cb208d5b62ea426c7af334d9c1e4c8))
* **skills:** add work-issue and work-queue skills ([c078c5d](https://github.com/TitusKirch/skills/commit/c078c5d784588a80ed9470cf197c5fb9d2337cdf))
* **tituskirch-skills-config:** add skill ([ad63981](https://github.com/TitusKirch/skills/commit/ad63981425b5c2a2ca74f0bc669ce6d5179460ec))
* **write-docs:** allow disabling docs via config ([cd345cb](https://github.com/TitusKirch/skills/commit/cd345cb90fe2219a28513f7c3e82dd6523aca0ea))


### Bug Fixes

* align dependabot labels to the stack: convention ([e30f0fd](https://github.com/TitusKirch/skills/commit/e30f0fd37986c2afe73712ed09d79eaf8fbb66e7))
* **work-queue:** correct stale skill name in config schema ([a07d489](https://github.com/TitusKirch/skills/commit/a07d489d94f2b586df33ddf7a87aaf9a60aebfa8))

## [0.7.0](https://github.com/TitusKirch/skills/compare/v0.6.0...v0.7.0) (2026-06-23)


### Features

* **write-docs:** trigger proactively on final feature approval ([adabefe](https://github.com/TitusKirch/skills/commit/adabefe2380198b8debd6b1535d07f8cf1643394))


### Bug Fixes

* **write-readme:** declare allowed-tools ([c1fdf29](https://github.com/TitusKirch/skills/commit/c1fdf29420d629014c270f01bf5fadeb94748171))

## [0.6.0](https://github.com/TitusKirch/skills/compare/v0.5.1...v0.6.0) (2026-06-21)


### Features

* **atomic-commit:** reference the issue when in issue context ([49d7eee](https://github.com/TitusKirch/skills/commit/49d7eeef5f82aae237c83dba228ef8c660e8c4a7))
* **issue:** ship a built-in label denylist ([a4325a8](https://github.com/TitusKirch/skills/commit/a4325a8186a3d61e000835a82e88b673ef4d4ab7))
* **issue:** support a label exclude list ([bec0dff](https://github.com/TitusKirch/skills/commit/bec0dffff5843fc093b134ae9f9eff3d47b8a9f2))
* **pull-request:** close linked issues with keywords ([5d1084a](https://github.com/TitusKirch/skills/commit/5d1084a4aa681108c44ecd3669ac7c8770613ba7))


### Bug Fixes

* **issue:** drive label exclusions from config only ([15bac96](https://github.com/TitusKirch/skills/commit/15bac9663515651d7293e6951bc76c7abf0c5446))
* **issue:** keep field metadata out of the issue body ([a842112](https://github.com/TitusKirch/skills/commit/a8421122b17dbb0e0999577255024b85cfd859b9))
* **issue:** keep issue titles short and scannable ([1b85a86](https://github.com/TitusKirch/skills/commit/1b85a86a9ffba0e011ab2646f06ad9f16c5b085f))

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
