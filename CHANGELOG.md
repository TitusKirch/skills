# Changelog

## [0.16.0](https://github.com/TitusKirch/skills/compare/v0.15.0...v0.16.0) (2026-07-27)


### ⚠ BREAKING CHANGES

* **write-docs:** docs.preset no longer accepts "library". A repo set to it renames the value to "package"; nothing else about the preset changes.
* **write-docs:** docs.preset no longer accepts "ai-tool". A repo set to it must move to another preset — library for a published skill or agent set.

### Features

* **skills:** mirror the check-command contract into every gate-running skill ([f6c62f3](https://github.com/TitusKirch/skills/commit/f6c62f388f1c535a0d394851a30d9bcc04754c4f))
* **skills:** mirror the single-flight lock spec into the work skills ([286e372](https://github.com/TitusKirch/skills/commit/286e372b10b5cf7f5d5efb20bf83df8722d72c5b))
* **work-review:** establish green instead of inheriting it ([4e40927](https://github.com/TitusKirch/skills/commit/4e40927166aaefde417455163b5ef0567ac685f7))
* **write-docs:** add a service preset ([10c0763](https://github.com/TitusKirch/skills/commit/10c076380deb08785398707ac5ae958c5686fc34)), closes [#122](https://github.com/TitusKirch/skills/issues/122)
* **write-docs:** dissolve the preset core into the presets ([75e50b6](https://github.com/TitusKirch/skills/commit/75e50b65ca83d266f705ab8e035de93570570257)), closes [#123](https://github.com/TitusKirch/skills/issues/123)
* **write-docs:** drop the ai-tool preset ([8c703e6](https://github.com/TitusKirch/skills/commit/8c703e68a63d4761e49ed23313c76e5b1d07a770)), closes [#120](https://github.com/TitusKirch/skills/issues/120)
* **write-docs:** rename the library preset to package ([2574345](https://github.com/TitusKirch/skills/commit/2574345c220da730314f8ac61b3f2e83954fd158)), closes [#121](https://github.com/TitusKirch/skills/issues/121)
* **write-readme:** state the guardrails the house canon expects ([ab2a72c](https://github.com/TitusKirch/skills/commit/ab2a72c5a1d5587d6544114ae13ed2b43747ba7c))


### Bug Fixes

* **ci:** assert the effective mergeDeps verify, not the explicit key ([f3c2e4f](https://github.com/TitusKirch/skills/commit/f3c2e4fe899a333c6d42c791db5e3b6da70941b5))
* **ci:** install before verifying a dependency PR's head ([b860e31](https://github.com/TitusKirch/skills/commit/b860e3197f45666f9f79d1b56504ec899008b1b3))
* **ci:** make the workflow reader fail loudly on what it cannot read ([e963b9f](https://github.com/TitusKirch/skills/commit/e963b9fc78fa422d8bf185bdc0b1d88ff5d86856))
* **ci:** skip CHANGELOG.md in the lint-staged markdown task ([bcc496e](https://github.com/TitusKirch/skills/commit/bcc496e59d81a4d24462255253113babc2321977))
* fail loudly when a SKILL.md cannot be read ([9382426](https://github.com/TitusKirch/skills/commit/93824264235b7ae96e659714a4bd07644e99b96d))
* give skill discovery one definition ([5071953](https://github.com/TitusKirch/skills/commit/507195313eb2ea13eb676768d378731f574e795a))
* name and link every supported client, not just Claude Code ([18c35c2](https://github.com/TitusKirch/skills/commit/18c35c2185807ac66a266e7d8d6be5aee9bfceb2))
* **prune-branches:** stop writing the protection list twice ([ba2d038](https://github.com/TitusKirch/skills/commit/ba2d03809ced11257ea012b0662158678f095406))
* **skills:** make the plan-only trigger vocabulary one vocabulary ([aa1e46a](https://github.com/TitusKirch/skills/commit/aa1e46af1752432fa35f4b5f0155a6d66ba089d4))
* **work-implement:** cover the states statuses writes in the example ([c80dbb4](https://github.com/TitusKirch/skills/commit/c80dbb4d47ca89db69966be1b1580a5a07c68ff9))
* **work-implement:** point the review reconcile at a real owner ([f3837ca](https://github.com/TitusKirch/skills/commit/f3837cabb56939e277fe7d4c740823d1071fa93a))
* **write-docs:** align three details with the house pattern ([fb41dbe](https://github.com/TitusKirch/skills/commit/fb41dbe12a60d1ebdeba59222ffefe640cf10cfc))

## [0.15.0](https://github.com/TitusKirch/skills/compare/v0.14.0...v0.15.0) (2026-07-26)


### ⚠ BREAKING CHANGES

* **skills:** state every config key explicitly and trust two bots
* **skills:** work.labels.review is now work.labels.reviewRequested, and work.linear.states.review is now work.linear.states.reviewRequested. A repo setting either key must rename it; an unrenamed key is silently ignored and the label falls back to its default.
* **skills:** work.verify moved to the root verify key. A repo that set it inside the work block must lift it one level; the schema no longer accepts it there. mergeDeps.verify is unchanged and now falls back to the root key.
* **skills:** every skill path changed from skills/<skill>/ to skills/<category>/<skill>/. Skill names are unchanged, so skills.sh installs and invocation are unaffected, but deep links into a skill's files and hand-copy instructions need the category segment. Re-run pnpm skills:link to repoint existing symlinks.
* **work-implement-queue:** work-implement-queue and work-review-queue no longer prompt for a batch confirmation before draining approved (ai: ready / review) issues; the lifecycle label is the approval. Use a plan-only/dry-run trigger to preview.
* **skills:** the `work-issue`/`work-queue` skills are renamed to `work-implement`/`work-implement-queue`, and two new lifecycle labels (`ai: changes requested`, `ai: needs human`) must exist — create them in the infrastructure label catalog (GitHub + Linear) before running the loops.
* **skills:** config keys renamed/removed — `issue.tracker` (was `issue.backend`), `work.tracker` (was `work.backend`), the `mergeDeps` section (was `deps`), and the root `forge` key (replaces the per-section `pr.backend` / `release.backend` / `deps.backend`).

### Features

* **atomic-commit:** type dependency bumps by release relevance ([0cc240b](https://github.com/TitusKirch/skills/commit/0cc240b4354139e89be0b828ea449fac99c6c84c))
* **compact-readme:** resolve the config before ruling docs/ out ([02c1855](https://github.com/TitusKirch/skills/commit/02c1855f101aa0c5203f3c74240e762fc0642ced)), closes [#71](https://github.com/TitusKirch/skills/issues/71)
* **issue:** pick the GitHub issue template by reading the templates ([b6b55a8](https://github.com/TitusKirch/skills/commit/b6b55a8b41ad32fd049c56beb26a3a5bee3afeff)), closes [#75](https://github.com/TitusKirch/skills/issues/75)
* **issue:** read the repo's issue templates on Linear too ([43349c0](https://github.com/TitusKirch/skills/commit/43349c0cf3077d351ecb97eb37a3a31e994cf0b2)), closes [#76](https://github.com/TitusKirch/skills/issues/76)
* **issue:** settle a template's title and assignees like its labels ([f7a6c71](https://github.com/TitusKirch/skills/commit/f7a6c711be4bcd2495415d3515a76704b6386091)), closes [#75](https://github.com/TitusKirch/skills/issues/75)
* **issue:** sharpen thin requests with a grilling pass before drafting ([ec84e1f](https://github.com/TitusKirch/skills/commit/ec84e1f698dd3201a9e5a0874965cad6e3e8b7bb)), closes [#90](https://github.com/TitusKirch/skills/issues/90)
* **issue:** state the skill's own default body structure ([dec1f51](https://github.com/TitusKirch/skills/commit/dec1f51494afd987b02b3432ca7cf053909a677c)), closes [#77](https://github.com/TitusKirch/skills/issues/77)
* **merge-deps:** auto-merge the low-risk tier, confirm only majors ([7baead8](https://github.com/TitusKirch/skills/commit/7baead8b8a88ecd843c00f13e1e9f2acf00dde2b)), closes [#83](https://github.com/TitusKirch/skills/issues/83)
* **prune-branches:** add skill ([8f604a3](https://github.com/TitusKirch/skills/commit/8f604a388fb23e16b56afcc1f86b45247a350785)), closes [#85](https://github.com/TitusKirch/skills/issues/85)
* **prune-comments:** add skill ([ed5af52](https://github.com/TitusKirch/skills/commit/ed5af52a14ad58c26048576d9321adc1f6798f51)), closes [#84](https://github.com/TitusKirch/skills/issues/84)
* route questions, ideas and possible bugs to the Discord forum ([a546473](https://github.com/TitusKirch/skills/commit/a546473e67cfe31a60df79abbeb07890ab995036))
* **skills:** add ai: reviewing lease label to work config schema ([fa0ca39](https://github.com/TitusKirch/skills/commit/fa0ca3930dda10176c3cc2386e73624de97c3889)), closes [#100](https://github.com/TitusKirch/skills/issues/100)
* **skills:** add execution-context profiles to the config schema ([01d13b5](https://github.com/TitusKirch/skills/commit/01d13b5543bf5625479b7cd61cdd6799bbb00e57)), closes [#71](https://github.com/TitusKirch/skills/issues/71)
* **skills:** budget descriptions at 960 and enforce it ([cdcda17](https://github.com/TitusKirch/skills/commit/cdcda17671e60a0dde63a36e3bff6f33f8bb24c3)), closes [#101](https://github.com/TitusKirch/skills/issues/101)
* **skills:** declare every cross-skill call required or optional ([3cf3fd2](https://github.com/TitusKirch/skills/commit/3cf3fd258c759519a0be29e715b05d77ee6f30b4)), closes [#104](https://github.com/TitusKirch/skills/issues/104)
* **skills:** exclude evals/ dev artifacts from skills:link ([466fd24](https://github.com/TitusKirch/skills/commit/466fd246f26713916843bf90814d6550af8d1789)), closes [#95](https://github.com/TitusKirch/skills/issues/95)
* **skills:** make the docs skills stop mirroring files that already exist ([dbce9e8](https://github.com/TitusKirch/skills/commit/dbce9e8e527832baf3155f0c11e38936d33d9f4a))
* **skills:** mirror the config contract into each skill instead of linking to it ([19eacce](https://github.com/TitusKirch/skills/commit/19eacce6202f27e07d4b47f249ab017a950abbcd))
* **skills:** move verify to the config root ([687d99d](https://github.com/TitusKirch/skills/commit/687d99d4f5460a0458c076619cb8c2e951f864ea))
* **skills:** nest skills into category subfolders ([736b097](https://github.com/TitusKirch/skills/commit/736b09769ead5feea34949565191a25535a5e198)), closes [#27](https://github.com/TitusKirch/skills/issues/27)
* **skills:** redraw the lifecycle diagrams as mermaid ([c24a34a](https://github.com/TitusKirch/skills/commit/c24a34a14d9ed0cb8ae6226e05aae995346bceb0))
* **skills:** rename the review label key to reviewRequested ([9d6d107](https://github.com/TitusKirch/skills/commit/9d6d1072aac663eb439a94f33e808b5cbf647535)), closes [#98](https://github.com/TitusKirch/skills/issues/98)
* **skills:** restructure and harden the config schema ([dca0a42](https://github.com/TitusKirch/skills/commit/dca0a42ada6b3a07cc882c81b0d78d60bceb06ba)), closes [#67](https://github.com/TitusKirch/skills/issues/67)
* **skills:** split work into implement and review loops (AI-review gate) ([85ee0f2](https://github.com/TitusKirch/skills/commit/85ee0f272f0efe6bb3a2a68d8186966945b65833)), closes [#70](https://github.com/TitusKirch/skills/issues/70)
* **skills:** state every config key explicitly and trust two bots ([a9ecebd](https://github.com/TitusKirch/skills/commit/a9ecebd0a004b659b917107b368df79031674d9b)), closes [#98](https://github.com/TitusKirch/skills/issues/98)
* **skills:** state how one skill may refer to another ([9104e32](https://github.com/TitusKirch/skills/commit/9104e322eeedb034cbcc5fc60bd56079f35318b4)), closes [#103](https://github.com/TitusKirch/skills/issues/103)
* **skills:** trust third-party feedback only from authorized authors ([9ddd81c](https://github.com/TitusKirch/skills/commit/9ddd81cb31e7bd33819147bea28bbfe973544e04)), closes [#80](https://github.com/TitusKirch/skills/issues/80)
* **skills:** widen the verify key to the repo's whole gate ([4112c88](https://github.com/TitusKirch/skills/commit/4112c88548d8241112ceccfcb4f074ed3544f2fe)), closes [#98](https://github.com/TitusKirch/skills/issues/98)
* **tituskirch-skills-config:** cover mergeDeps and the Linear requireds ([52ab8a7](https://github.com/TitusKirch/skills/commit/52ab8a7e4c4d61e9b528f07535c06279a25d7128)), closes [#68](https://github.com/TitusKirch/skills/issues/68)
* **tituskirch-skills-config:** support profiles in setup and reconcile ([1d9047c](https://github.com/TitusKirch/skills/commit/1d9047c3d7b38a743efcdd8b745f890d2c4791cd)), closes [#71](https://github.com/TitusKirch/skills/issues/71)
* **tituskirch-skills-config:** sweep issue-template labels for drift ([2da417f](https://github.com/TitusKirch/skills/commit/2da417f487c648e50bcb592fb5dc088dfc1de67a)), closes [#78](https://github.com/TitusKirch/skills/issues/78)
* **validate-skills:** add skill ([17768cb](https://github.com/TitusKirch/skills/commit/17768cbafcdc1b05c746cdca6b5b0b197330d191)), closes [#94](https://github.com/TitusKirch/skills/issues/94)
* **validate-skills:** check cross-skill references in the house tier ([b55f31c](https://github.com/TitusKirch/skills/commit/b55f31ce770ae42ea3804794a2f3c4617949a0e4)), closes [#103](https://github.com/TitusKirch/skills/issues/103)
* **work-implement-queue:** disallow AskUserQuestion on the unattended drain ([218c9a0](https://github.com/TitusKirch/skills/commit/218c9a09c6b903e661ef7141e6ea43f62308aece)), closes [#99](https://github.com/TitusKirch/skills/issues/99)
* **work-implement-queue:** drain without a confirmation gate ([e3d7ee5](https://github.com/TitusKirch/skills/commit/e3d7ee5ecc9623e37d5bf81c8ea335a666c4118c))
* **work-implement:** add reviewing to the lifecycle state machine ([af65a99](https://github.com/TitusKirch/skills/commit/af65a995ccf31e7f1d9c3aca20bc85c1cefed4a6)), closes [#100](https://github.com/TitusKirch/skills/issues/100)
* **work-review-queue:** disallow AskUserQuestion on the unattended drain ([0b0c3b4](https://github.com/TitusKirch/skills/commit/0b0c3b4429375f3f6dfcdc31cbba07331de74676)), closes [#99](https://github.com/TitusKirch/skills/issues/99)
* **work-review-queue:** reclaim reviewing orphans and lease per issue ([958a056](https://github.com/TitusKirch/skills/commit/958a05688b50eb597f3d6cdce53dd1c8bfeaeaa6)), closes [#100](https://github.com/TitusKirch/skills/issues/100)
* **work-review:** claim via the reviewing lease before reviewing ([f4a07d8](https://github.com/TitusKirch/skills/commit/f4a07d8341f2af47da9f16f0f12d16a6bd2e01b3)), closes [#100](https://github.com/TitusKirch/skills/issues/100)
* **write-docs:** document and read the docs.instructions key ([5fe8132](https://github.com/TitusKirch/skills/commit/5fe81329ddce24960320ca07492040a6753749d9)), closes [#68](https://github.com/TitusKirch/skills/issues/68)
* **write-docs:** gate every page on what code cannot express ([7d00494](https://github.com/TitusKirch/skills/commit/7d0049482d1fc1ca1b4d8e0c678e6ee16b8f79bc))
* **write-docs:** stop scaffolding sections that can only redirect ([a189121](https://github.com/TitusKirch/skills/commit/a1891219d9a5c501cc5a322e81c1c9a094b94dd2))
* **write-readme:** lead with install and unify the section catalogue ([b8ebf04](https://github.com/TitusKirch/skills/commit/b8ebf0409029a8581d329bfccb23035646b71159)), closes [#68](https://github.com/TitusKirch/skills/issues/68)


### Bug Fixes

* align issue-template labels with the label catalog ([359d011](https://github.com/TitusKirch/skills/commit/359d01178103a15e8c37ab7c2ea25b4dd7a6ef87))
* **atomic-commit:** name commit.gpgsign as a git setting, not a config key ([9bb5d48](https://github.com/TitusKirch/skills/commit/9bb5d486aec920e970a7497bea1a9d71d5442395))
* **atomic-commit:** stop when the commit section is false ([cf2ebd4](https://github.com/TitusKirch/skills/commit/cf2ebd43dedb1c7a22410db85591983728a3bba5)), closes [#68](https://github.com/TitusKirch/skills/issues/68)
* **docs:** correct stale skill counts in concept docs ([d12e4f1](https://github.com/TitusKirch/skills/commit/d12e4f1b44beea335bf825278d04711d024fc8d7)), closes [#96](https://github.com/TitusKirch/skills/issues/96)
* **issue:** correct the allowed-tools note's no-wildcards misreading ([0679aaf](https://github.com/TitusKirch/skills/commit/0679aaf0bcfe696fd333c7f8366f29d39381a05b)), closes [#93](https://github.com/TitusKirch/skills/issues/93)
* **issue:** fetch the whole label catalog, not the first 30 ([621fe6f](https://github.com/TitusKirch/skills/commit/621fe6f3e24f44ab4de64bf15909a8b9d769b303)), closes [#81](https://github.com/TitusKirch/skills/issues/81)
* **issue:** make priority Linear's native field, not a label ([632e3e9](https://github.com/TitusKirch/skills/commit/632e3e9e829405eb25a701a27d9ec28c3f427bae)), closes [#86](https://github.com/TitusKirch/skills/issues/86)
* **issue:** name the Linear create tool the server actually has ([e2cf96a](https://github.com/TitusKirch/skills/commit/e2cf96a19ef2905372e1cbb13f84a93e48e99f78)), closes [#76](https://github.com/TitusKirch/skills/issues/76)
* **issue:** page the Linear label catalog past its result cap ([c86b2ba](https://github.com/TitusKirch/skills/commit/c86b2ba525c080be8f294a9b8755a94c44b49fd4)), closes [#87](https://github.com/TitusKirch/skills/issues/87)
* **issue:** resolve a template's labels before they reach the write ([4c8808f](https://github.com/TitusKirch/skills/commit/4c8808f9b989b71130974647cea18f9623b1ed29)), closes [#75](https://github.com/TitusKirch/skills/issues/75)
* **issue:** settle issue.github.template as a path, not a gh template name ([70b5953](https://github.com/TitusKirch/skills/commit/70b59537f7482db5206bd91bec82a858126b9fc3)), closes [#74](https://github.com/TitusKirch/skills/issues/74)
* **issue:** settle whether a null template falls back to the deprecated key ([490f7b4](https://github.com/TitusKirch/skills/commit/490f7b45b7badd8a993d5af7aa236b8d376917a6)), closes [#76](https://github.com/TitusKirch/skills/issues/76)
* **issue:** stop the schema calling a forced template a default ([e0ec3ef](https://github.com/TitusKirch/skills/commit/e0ec3efae53a66be9bd15f5fa0eff86d42de0a76)), closes [#75](https://github.com/TitusKirch/skills/issues/75)
* **merge-deps:** describe merge as the ceiling, not a confirmation gate ([1194afc](https://github.com/TitusKirch/skills/commit/1194afc35f4a3ba729e30b5d3024977864cbf155)), closes [#83](https://github.com/TitusKirch/skills/issues/83)
* **merge-deps:** merge with gh pr merge, not the removed comment command ([0172374](https://github.com/TitusKirch/skills/commit/017237465906b6023a159e5c05120475e220467a)), closes [#79](https://github.com/TitusKirch/skills/issues/79)
* **merge-deps:** stop the assessment checklist asserting always-confirm ([61d19a4](https://github.com/TitusKirch/skills/commit/61d19a4338470c020c82a81dd7138b750d1f9c74)), closes [#83](https://github.com/TitusKirch/skills/issues/83)
* **prune-branches:** fail closed on an errored merge test ([2f65d36](https://github.com/TitusKirch/skills/commit/2f65d364183ad36c01f5ec1b7b0aed353e6621fc)), closes [#85](https://github.com/TitusKirch/skills/issues/85)
* **prune-branches:** let the confirmed category license the deletion ([ade0ec7](https://github.com/TitusKirch/skills/commit/ade0ec7ee7244accac23a314e9c17298be7d3c9d)), closes [#85](https://github.com/TitusKirch/skills/issues/85)
* **prune-comments:** resolve the integration branch, settle the two tiers ([6572b2a](https://github.com/TitusKirch/skills/commit/6572b2a732e306bde8e9c52b7c44db05e72cbdf6)), closes [#84](https://github.com/TitusKirch/skills/issues/84)
* **prune-comments:** treat a comment as text to judge, not an instruction to obey ([f1fd449](https://github.com/TitusKirch/skills/commit/f1fd449c55e94650d18f288f10276cf5ed2d93ce)), closes [#92](https://github.com/TitusKirch/skills/issues/92)
* **pull-request:** align the shared convention-cache freshness rule ([dafa191](https://github.com/TitusKirch/skills/commit/dafa19190e4127e1b146fcd5dbd2c6fd8150c6d5)), closes [#68](https://github.com/TitusKirch/skills/issues/68)
* **release:** merge the release PR with a method the branch allows ([6d40d47](https://github.com/TitusKirch/skills/commit/6d40d47ef9d7f59716c19c0a5b0bef32664671f6))
* **skills:** align field-notes lead-in with the disallowed-tools field ([f139cdd](https://github.com/TitusKirch/skills/commit/f139cddd9ef89a581a1558104fe22f607f76f858)), closes [#96](https://github.com/TitusKirch/skills/issues/96)
* **skills:** carry root dotfiles into the per-entry link tree ([ac960af](https://github.com/TitusKirch/skills/commit/ac960af63f21a4abaadd62d93f8cfd18351722d2)), closes [#95](https://github.com/TitusKirch/skills/issues/95)
* **skills:** correct stale skill count and record known deviations ([d222f6c](https://github.com/TitusKirch/skills/commit/d222f6ce50ce97c1df8fa90e3015dc9666d21b45)), closes [#96](https://github.com/TitusKirch/skills/issues/96)
* **skills:** correct the frontmatter contract's field semantics ([ef267b5](https://github.com/TitusKirch/skills/commit/ef267b53031b6ae1d4e9b6a02f2b5fc5303ec799)), closes [#93](https://github.com/TitusKirch/skills/issues/93)
* **skills:** count the author-authority block as the sixth generated artifact ([f91700b](https://github.com/TitusKirch/skills/commit/f91700ba72d72da0b6017e0efa1eedc753e04bab)), closes [#88](https://github.com/TitusKirch/skills/issues/88)
* **skills:** drop the ai: review migration notes from the label rules ([c9d096c](https://github.com/TitusKirch/skills/commit/c9d096ce5639f242d0d7d9844bab0312f668600c)), closes [#100](https://github.com/TitusKirch/skills/issues/100)
* **skills:** give every config read one contract that survives a missing jq ([80b59e9](https://github.com/TitusKirch/skills/commit/80b59e9a6b6c351b953e6fbb9bdf983ec3b12c91)), closes [#72](https://github.com/TitusKirch/skills/issues/72)
* **skills:** give the longest descriptions room to be edited ([d170f0b](https://github.com/TitusKirch/skills/commit/d170f0be50d4350c0920cba3e3b8b2885c0c04e8)), closes [#101](https://github.com/TitusKirch/skills/issues/101)
* **skills:** make a mislocated resolver fail loudly instead of silently ([b9714d7](https://github.com/TitusKirch/skills/commit/b9714d7c0a4076223498923947c29cc818fb513c)), closes [#71](https://github.com/TitusKirch/skills/issues/71)
* **skills:** make author-authority coverage a criterion, not a name list ([1b05e94](https://github.com/TitusKirch/skills/commit/1b05e94014052fbaf2595b7a60524ad08c3a01e7)), closes [#92](https://github.com/TitusKirch/skills/issues/92)
* **skills:** make work.verify survive work being false ([e51bc56](https://github.com/TitusKirch/skills/commit/e51bc568caf919ad15c4f078c4b8154cd77b80bc))
* **skills:** name the Linear update tool the work-* skills actually have ([78d8420](https://github.com/TitusKirch/skills/commit/78d8420e6a255ca186f2342722e703974e8560fe)), closes [#82](https://github.com/TitusKirch/skills/issues/82)
* **skills:** name the review label key by its current name in the schema ([756cfcf](https://github.com/TitusKirch/skills/commit/756cfcf70b2f379583ffb8e1267c5426af6195bc)), closes [#98](https://github.com/TitusKirch/skills/issues/98)
* **skills:** note summary's [#96](https://github.com/TitusKirch/skills/issues/96) tracking and allowed-tools' experimental status ([bc7f577](https://github.com/TitusKirch/skills/commit/bc7f5779fbe67d00c3400abe526b42285651922d)), closes [#93](https://github.com/TitusKirch/skills/issues/93)
* **skills:** point every config-resolution statement at the resolver ([3cfd527](https://github.com/TitusKirch/skills/commit/3cfd5279e07722816ba2d875fd0733d63a0b8ac8)), closes [#71](https://github.com/TitusKirch/skills/issues/71)
* **skills:** point the summary note at its migration's tracked home ([91881ff](https://github.com/TitusKirch/skills/commit/91881ffc997b42e63ac4558e86a5b5d1e3b82674)), closes [#93](https://github.com/TitusKirch/skills/issues/93)
* **skills:** put the mirrored config block under a Config heading everywhere ([bf04f77](https://github.com/TitusKirch/skills/commit/bf04f77bd68a9f5c943f1fd6248e086c53c648a4)), closes [#71](https://github.com/TitusKirch/skills/issues/71)
* **skills:** repair the stale skill path in the README ([3347303](https://github.com/TitusKirch/skills/commit/3347303772f7b3d71288835057b3ebd48460bc95))
* **skills:** resolve lifecycle labels before they reach a queue query ([70b4f99](https://github.com/TitusKirch/skills/commit/70b4f99c23fd6a71ba8621f153c53a7f42ef1477)), closes [#72](https://github.com/TitusKirch/skills/issues/72)
* **skills:** stop skills linking into each other's folders ([082ef8a](https://github.com/TitusKirch/skills/commit/082ef8a65a29a688e23083da3a1a3a8dfad7a292)), closes [#73](https://github.com/TitusKirch/skills/issues/73)
* **skills:** trim five descriptions under the 1024-char spec cap ([aa03f99](https://github.com/TitusKirch/skills/commit/aa03f990c357d1b5254fbb7669fb8c39b7c029ff)), closes [#96](https://github.com/TitusKirch/skills/issues/96)
* **tituskirch-skills-config:** fix the template-label sweep's premise and its catalog ([bc4b207](https://github.com/TitusKirch/skills/commit/bc4b207bc468bacd0989ccc99b75c7746f7a8d46)), closes [#78](https://github.com/TitusKirch/skills/issues/78)
* **update-deps:** correct the stale note on how merge-deps merges ([bf91391](https://github.com/TitusKirch/skills/commit/bf913913b6c11f2b8f3b572246c5e634c23bf36b)), closes [#79](https://github.com/TitusKirch/skills/issues/79)
* **validate-skills:** add client-extension tier and import frontmatter contract ([9fa93a3](https://github.com/TitusKirch/skills/commit/9fa93a3f5f6aeca2425b7c35a362c30d3afddfd5)), closes [#94](https://github.com/TitusKirch/skills/issues/94)
* **vhs-demo:** measure duration against visible sleeps only ([ff85894](https://github.com/TitusKirch/skills/commit/ff85894743bfc383fc5298f27f12e852331d9540)), closes [#68](https://github.com/TitusKirch/skills/issues/68)
* **work-implement-queue:** cite the specified lock and assignee-guard the reconcile ([cf9971f](https://github.com/TitusKirch/skills/commit/cf9971f19cbd52be30af2cf8b7034b9109c387cf)), closes [#97](https://github.com/TitusKirch/skills/issues/97)
* **work-implement-queue:** heartbeat the lock each drain iteration ([dfa05e7](https://github.com/TitusKirch/skills/commit/dfa05e7d9c47980e849e9c9ac4e9a9a9c751d377)), closes [#97](https://github.com/TitusKirch/skills/issues/97)
* **work-implement-queue:** keep the reconcile and lock summary consistent ([8d6e001](https://github.com/TitusKirch/skills/commit/8d6e001946c3dd13b1a1c2a814044308f584e9f1)), closes [#97](https://github.com/TitusKirch/skills/issues/97)
* **work-implement:** base lock liveness on a refreshed heartbeat, not a probed pid ([e6583fd](https://github.com/TitusKirch/skills/commit/e6583fdff4cb4009405249d5e9030ac3353df61b)), closes [#97](https://github.com/TitusKirch/skills/issues/97)
* **work-implement:** document the review rename and lease changeover ([334be57](https://github.com/TitusKirch/skills/commit/334be57445d5115b7b8e56c85bc9b54bb19cb3d3)), closes [#100](https://github.com/TitusKirch/skills/issues/100)
* **work-implement:** make the reconcile guard operative and migrate the lock ([5c9624e](https://github.com/TitusKirch/skills/commit/5c9624eb9f7bde9f168ded4f8f021423ee628d5a)), closes [#97](https://github.com/TitusKirch/skills/issues/97)
* **work-implement:** specify the single-flight lock and guard the reconcile ([d247c1c](https://github.com/TitusKirch/skills/commit/d247c1c0fcdcd2bd2e0880c228acf120282c5899)), closes [#97](https://github.com/TitusKirch/skills/issues/97)
* **work-implement:** thread reviewing through the not-ours states ([29fb5f5](https://github.com/TitusKirch/skills/commit/29fb5f5ce26fc97d8a61aecabeec6a89d55911d1)), closes [#100](https://github.com/TitusKirch/skills/issues/100)
* **work-issue:** reconcile working-orphans and close lease and opt-out gaps ([f64bc47](https://github.com/TitusKirch/skills/commit/f64bc471d8b439a39e98daec81c7cf9bcc2c5729)), closes [#68](https://github.com/TitusKirch/skills/issues/68)
* **work-review-queue:** cite the specified separate review lock ([0bf24da](https://github.com/TitusKirch/skills/commit/0bf24da967d601ce71b70b22a3845b1a424b33c0)), closes [#97](https://github.com/TitusKirch/skills/issues/97)
* **work-review-queue:** heartbeat the lock each drain iteration ([c003b3f](https://github.com/TitusKirch/skills/commit/c003b3f8476fea8ef1a3ec2fa1cc9cdb0bdf73f0)), closes [#97](https://github.com/TitusKirch/skills/issues/97)
* **work-review-queue:** note the migration off the old loose lock ([ce86630](https://github.com/TitusKirch/skills/commit/ce866309e2fa9279067fe3a2a0058434c3e2999e)), closes [#97](https://github.com/TitusKirch/skills/issues/97)
* **work-review:** make the round-count recipe runnable ([9a32494](https://github.com/TitusKirch/skills/commit/9a324949857dcb094aad6e4e568d0c52460820b6)), closes [#72](https://github.com/TitusKirch/skills/issues/72)
* **work-review:** stop an unreadable round count reading as zero ([f1fd7bb](https://github.com/TitusKirch/skills/commit/f1fd7bbdf1cf9bedb563a130a354fe4b769f545f)), closes [#72](https://github.com/TitusKirch/skills/issues/72)
* **write-docs:** check the docs opt-out against the resolved config ([9a8be92](https://github.com/TitusKirch/skills/commit/9a8be929a1624e829831b78187a449ec50e55019)), closes [#71](https://github.com/TitusKirch/skills/issues/71)

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
