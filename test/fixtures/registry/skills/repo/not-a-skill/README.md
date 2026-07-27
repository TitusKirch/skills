A directory under a category that holds no `SKILL.md`.

`discoverSkills` skips it — `test/gen-skills.test.ts` pins that, because the same
`catch` also swallows a read that failed for any other reason.
