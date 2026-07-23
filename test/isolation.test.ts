// A skill is installable on its own, so nothing it ships may point outside its own
// folder. These tests enforce that on the parts the generator owns, and measure the
// parts that predate the rule.

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

const withConfigBlock = allSkills().filter((p) =>
  docsOf(join(ROOT, 'skills', p)).some((f) =>
    readFileSync(f, 'utf8').includes('<skills-config>')
  )
);

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

describe('links that predate the rule', () => {
  test(
    'no skill links outside its own folder',
    {
      todo: 'tracked in #73 — the two work loops reference each other by design'
    },
    () => {
      const offenders: string[] = [];
      for (const path of allSkills()) {
        const dir = join(ROOT, 'skills', path);
        for (const file of docsOf(dir)) {
          for (const target of relativeLinks(file)) {
            if (target.startsWith('..')) offenders.push(`${path}: ${target}`);
          }
        }
      }
      assert.deepEqual(offenders, []);
    }
  );

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
