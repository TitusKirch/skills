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

describe('the generated config block is self-contained', () => {
  test('it is present in the skills that read config, and nowhere else by accident', () => {
    assert.equal(
      withConfigBlock.length,
      14,
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

describe('the author-authority block is mirrored into the right skills', () => {
  test('the full rule reaches exactly the skills that act on third-party text', () => {
    assert.deepEqual(withAuthorityFull.sort(), [
      'repo/merge-deps',
      'work/handoff',
      'work/issue',
      'work/work-implement',
      'work/work-review'
    ]);
  });

  test('the reduced rule reaches exactly the narrower-exposure skills', () => {
    assert.deepEqual(withAuthorityReduced.sort(), [
      'repo/release',
      'repo/update-deps',
      'work/work-implement-queue',
      'work/work-review-queue'
    ]);
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
