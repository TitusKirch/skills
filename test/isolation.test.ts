// A skill is installable on its own, so nothing it ships may point outside its own
// folder — not the generated config block, and not a hand-written "see also" into a
// sibling skill. These tests enforce that, and that what stays inside still resolves.

import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { ROOT, sandbox, type Sandbox } from './helpers.ts';

const boxes: Sandbox[] = [];
after(() => boxes.forEach((b) => b.cleanup()));

/** Every skill directory, as "<category>/<name>". */
function allSkills(): string[] {
  const skillsDir = join(ROOT, 'skills');
  return readdirSync(skillsDir)
    .filter((c) => statSync(join(skillsDir, c)).isDirectory())
    .flatMap((c) =>
      readdirSync(join(skillsDir, c))
        .filter((s) => statSync(join(skillsDir, c, s)).isDirectory())
        .map((s) => `${c}/${s}`)
    );
}

/** Markdown files a skill ships. */
function docsOf(skillDir: string): string[] {
  return readdirSync(skillDir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => join(skillDir, f));
}

/**
 * Relative markdown link targets in `file`, ignoring pure anchors and URLs.
 *
 * Code is stripped first. A link inside a fence or backticks is a fragment of what
 * the skill *generates* — a badge pointing at the consuming repo's LICENSE, an
 * image path for a README it writes — and is not navigation within the skill.
 * Treating those as links reported five false positives on the first run.
 */
function relativeLinks(file: string): string[] {
  const body = readFileSync(file, 'utf8')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`\n]*`/g, '');
  return [...body.matchAll(/\]\(([^)]+)\)/g)]
    .flatMap((m) => {
      const target = m[1]?.split('#')[0];
      return target ? [target] : [];
    })
    .filter((t) => !/^[a-z]+:/i.test(t) && !t.startsWith('/'));
}

/** Skills whose shipped markdown contains `tag` (an opening block marker). */
function skillsWithTag(tag: string): string[] {
  return allSkills().filter((p) =>
    docsOf(join(ROOT, 'skills', p)).some((f) =>
      readFileSync(f, 'utf8').includes(tag)
    )
  );
}

const withConfigBlock = skillsWithTag('<skills-config>');
// `<skills-authority>` is a strict prefix of `<skills-authority-reduced>` only up to
// the `-`, so the trailing `>` in each literal keeps the two sets from overlapping.
const withAuthorityFull = skillsWithTag('<skills-authority>');
const withAuthorityReduced = skillsWithTag('<skills-authority-reduced>');
// Same trailing-`>` reasoning for the check-command block's two variants.
const withVerifyBase = skillsWithTag('<skills-verify>');
const withVerifyIsolated = skillsWithTag('<skills-verify-isolated>');

/**
 * Which skills run the repo's gate, and in which tree.
 *
 * `base` runs it in the working tree; `isolated` runs it against a head that is not the
 * working tree, so it installs that head's lockfile first. The roster lives here rather
 * than being inferred, because both failure directions are silent on disk: a skill that
 * starts running checks without the block re-invents detection, and a listed one that
 * lost its block keeps the prose that promises it.
 */
const VERIFY_CARRIERS: Record<'base' | 'isolated', string[]> = {
  base: ['repo/prune-comments', 'repo/update-deps', 'work/work-implement'],
  isolated: ['repo/merge-deps', 'work/work-review']
};

describe('the generated config block is self-contained', () => {
  test('it is present in the skills that read config, and nowhere else by accident', () => {
    assert.equal(
      withConfigBlock.length,
      16,
      `found: ${withConfigBlock.join(', ')}`
    );
  });

  test('no link inside the block leaves the skill folder', () => {
    for (const path of withConfigBlock) {
      const dir = join(ROOT, 'skills', path);
      for (const file of docsOf(dir)) {
        const body = readFileSync(file, 'utf8');
        const from = body.indexOf('<skills-config>');
        if (from === -1) continue;
        const block = body.slice(from, body.indexOf('</skills-config>'));
        for (const target of relativeLinks(file).filter((t) =>
          block.includes(`(${t}`)
        )) {
          assert.ok(
            !target.startsWith('..'),
            `${path}: block links out of the skill via "${target}"`
          );
        }
      }
    }
  });

  test('every path the block points at exists in an isolated copy', () => {
    const box = sandbox('minimal.json', 'work/work-implement');
    boxes.push(box);
    const file = join(box.skill, 'REFERENCE.md');
    const body = readFileSync(file, 'utf8');
    const block = body.slice(
      body.indexOf('<skills-config>'),
      body.indexOf('</skills-config>')
    );
    const targets = [...block.matchAll(/\]\(([^)]+)\)/g)]
      .flatMap((m) => {
        const target = m[1]?.split('#')[0];
        return target ? [target] : [];
      })
      .filter((t) => !/^[a-z]+:/i.test(t));
    assert.ok(targets.length > 0, 'the block should reference the resolver');
    for (const target of targets) {
      assert.ok(
        existsSync(join(box.skill, target)),
        `missing after install: ${target}`
      );
    }
  });

  test('the resolver ships with every skill that carries the block', () => {
    for (const path of withConfigBlock) {
      assert.ok(
        existsSync(
          join(ROOT, 'skills', path, 'templates', 'resolve-config.sh')
        ),
        `${path} has the block but no resolver`
      );
    }
  });

  test('all shipped resolvers are byte-identical to the canonical one', () => {
    const canonical = readFileSync(
      join(ROOT, 'scripts', 'resolve-config.sh'),
      'utf8'
    );
    for (const path of withConfigBlock) {
      const copy = readFileSync(
        join(ROOT, 'skills', path, 'templates', 'resolve-config.sh'),
        'utf8'
      );
      assert.equal(
        copy,
        canonical,
        `${path} drifted from scripts/resolve-config.sh`
      );
    }
  });
});

// Every skill is classified here — not just the carriers (issue #92). The tier follows a
// criterion, never a maintained roster: FULL for a skill that acts on text from an
// identifiable author — authorship is checkable, so it is checked — REDUCED for one that
// reads third-party text with no author to check, where the rule is flat (data, never
// instruction), and NONE for a skill that reads only its own repo or session, with no
// third-party text to judge. Each entry states the text that decides its tier (carriers)
// or why it is exempt (non-carriers); the union type makes that field mandatory, so a
// tier cannot be declared without its justification. The two tests below check this table
// against `allSkills()` and against the tags on disk — so a skill added later is
// classified by what it does: one absent from the table, or one whose on-disk tag
// disagrees with its declared tier, fails the suite. It is no longer possible to add a
// skill and have no assertion ever look at it — the trap that let `prune-comments` and
// `prune-branches` slip the earlier name list.
const authorityClass: Record<
  string,
  { tier: 'full' | 'reduced'; reads: string } | { tier: 'none'; reason: string }
> = {
  // FULL — acts on text from an identifiable author.
  'repo/merge-deps': { tier: 'full', reads: "a Dependabot PR's author" },
  'work/handoff': { tier: 'full', reads: 'a handoff document author' },
  'work/issue': { tier: 'full', reads: 'issue and comment authors' },
  'work/work-implement': {
    tier: 'full',
    reads: 'an issue body and review feedback'
  },
  'work/work-review': { tier: 'full', reads: 'an issue body and its comments' },
  // REDUCED — reads third-party text with no author to check.
  'repo/prune-branches': { tier: 'reduced', reads: "closed PRs' titles" },
  'repo/prune-comments': { tier: 'reduced', reads: 'code comments' },
  'repo/release': { tier: 'reduced', reads: 'upstream changelogs' },
  'repo/update-deps': { tier: 'reduced', reads: 'changelogs and advisories' },
  'work/work-implement-queue': {
    tier: 'reduced',
    reads: 'issue references and PR state'
  },
  'work/work-review-queue': {
    tier: 'reduced',
    reads: 'issue references and PR state'
  },
  // NONE — reads only its own repo or session; no third-party text to judge.
  'docs/compact-readme': {
    tier: 'none',
    reason: "the repo's own README — no third-party text"
  },
  'docs/vhs-demo': {
    tier: 'none',
    reason: "the repo's own CLI and tape — no third-party text"
  },
  'docs/write-docs': {
    tier: 'none',
    reason: "the repo's own code and docs — no third-party text"
  },
  'docs/write-readme': {
    tier: 'none',
    reason: "the repo's own project metadata — no third-party text"
  },
  'meta/tituskirch-skills-config': {
    tier: 'none',
    reason: "the repo's own config and signals — no third-party text"
  },
  'meta/validate-skills': {
    tier: 'none',
    reason:
      "the repo's own skill files, read as data to validate — the spec and house verdicts come from tools, not the agent reading the text"
  },
  'repo/atomic-commit': {
    tier: 'none',
    reason: "the session's own working-tree diff — no third-party text"
  },
  'repo/pull-request': {
    tier: 'none',
    reason:
      "the branch's own commits and the repo's PR template — no third-party text"
  }
};

describe('the author-authority tier follows the criterion, not a name list', () => {
  test('every skill on disk is classified exactly once — one absent from the table fails here, so it cannot be added without being placed', () => {
    assert.deepEqual(Object.keys(authorityClass).sort(), allSkills().sort());
  });

  test('each skill carries exactly the tag its classification declares — a declared full/reduced carries that tag, a declared non-carrier neither', () => {
    for (const path of allSkills()) {
      const carried = withAuthorityFull.includes(path)
        ? 'full'
        : withAuthorityReduced.includes(path)
          ? 'reduced'
          : 'none';
      assert.equal(
        carried,
        authorityClass[path]?.tier,
        `${path}: classified ${authorityClass[path]?.tier} but carries ${carried} on disk`
      );
    }
  });

  test('no skill carries both variants', () => {
    const both = withAuthorityFull.filter((p) =>
      withAuthorityReduced.includes(p)
    );
    assert.deepEqual(both, [], 'a skill has both the full and reduced block');
  });

  test('every authority-carrier also carries the config block, so it ships the resolver it needs to read trustedBots', () => {
    for (const path of [...withAuthorityFull, ...withAuthorityReduced]) {
      assert.ok(
        withConfigBlock.includes(path),
        `${path} carries the authority block but not the config block/resolver`
      );
    }
  });

  test('no link inside either authority block leaves the skill folder', () => {
    const pairs = [
      ['<skills-authority>', '</skills-authority>'],
      ['<skills-authority-reduced>', '</skills-authority-reduced>']
    ] as const;
    for (const path of [...withAuthorityFull, ...withAuthorityReduced]) {
      const dir = join(ROOT, 'skills', path);
      for (const file of docsOf(dir)) {
        const body = readFileSync(file, 'utf8');
        for (const [open, close] of pairs) {
          const from = body.indexOf(open);
          if (from === -1) continue;
          const block = body.slice(from, body.indexOf(close));
          for (const target of relativeLinks(file).filter((t) =>
            block.includes(`(${t}`)
          )) {
            assert.ok(
              !target.startsWith('..'),
              `${path}: authority block links out of the skill via "${target}"`
            );
          }
        }
      }
    }
  });
});

describe('the check-command contract reaches every skill that runs the gate', () => {
  test('the tags on disk are exactly the roster, in both variants', () => {
    assert.deepEqual(withVerifyBase.sort(), [...VERIFY_CARRIERS.base].sort());
    assert.deepEqual(
      withVerifyIsolated.sort(),
      [...VERIFY_CARRIERS.isolated].sort()
    );
  });

  test('no skill carries both variants', () => {
    const both = withVerifyBase.filter((p) => withVerifyIsolated.includes(p));
    assert.deepEqual(both, [], 'a skill has both the base and isolated block');
  });

  test('every verify-carrier also carries the config block, so it ships the resolver the block reads $resolved from', () => {
    for (const path of [...withVerifyBase, ...withVerifyIsolated]) {
      assert.ok(
        withConfigBlock.includes(path),
        `${path} carries the verify block but not the config block/resolver`
      );
    }
  });

  test('no link inside either verify block leaves the skill folder', () => {
    const pairs = [
      ['<skills-verify>', '</skills-verify>'],
      ['<skills-verify-isolated>', '</skills-verify-isolated>']
    ] as const;
    for (const path of [...withVerifyBase, ...withVerifyIsolated]) {
      const dir = join(ROOT, 'skills', path);
      for (const file of docsOf(dir)) {
        const body = readFileSync(file, 'utf8');
        for (const [open, close] of pairs) {
          const from = body.indexOf(open);
          if (from === -1) continue;
          const block = body.slice(from, body.indexOf(close));
          for (const target of relativeLinks(file).filter((t) =>
            block.includes(`(${t}`)
          )) {
            assert.ok(
              !target.startsWith('..'),
              `${path}: verify block links out of the skill via "${target}"`
            );
          }
        }
      }
    }
  });
});

describe('nothing a skill ships points out of its folder', () => {
  test('no skill links outside its own folder', () => {
    const offenders: string[] = [];
    for (const path of allSkills()) {
      const dir = join(ROOT, 'skills', path);
      for (const file of docsOf(dir)) {
        for (const target of relativeLinks(file)) {
          if (target.startsWith('..')) offenders.push(`${path}: ${target}`);
        }
      }
    }
    assert.deepEqual(
      offenders,
      [],
      'a cross-skill link dangles on an installed copy — name the skill instead'
    );
  });

  test('a link that stays inside a skill actually resolves', () => {
    const broken: string[] = [];
    for (const path of allSkills()) {
      const dir = join(ROOT, 'skills', path);
      for (const file of docsOf(dir)) {
        for (const target of relativeLinks(file)) {
          if (target.startsWith('..')) continue;
          if (!existsSync(join(dirname(file), target)))
            broken.push(`${path}: ${target}`);
        }
      }
    }
    assert.deepEqual(broken, [], 'intra-skill links must not dangle');
  });
});
