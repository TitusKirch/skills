// The generator writes seven artifacts that nineteen published skills depend on, and
// until its functions took a root rather than a module constant, none of them could be
// run anywhere but this repo — so none of them had a test. These run the real thing
// against `test/fixtures/registry`, a miniature of this repo's own shape, copied to a
// throwaway directory so a `--write` run may rewrite it.
//
// The fixture is deliberately stale, which is what makes the round trip assertable:
// `--check` has something to report, `--write` has something to fix, and a second
// `--check` proves the write landed.

import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { registry, type Registry } from './helpers.ts';
import {
  main,
  paths,
  discoverSkills,
  byCategory,
  parseFrontmatter,
  deriveSummary,
  lintFrontmatter,
  assertPlacement,
  renderTable,
  parseTable,
  expectedTableTokens,
  type Skill
} from '../scripts/gen-skills.ts';

const boxes: Registry[] = [];
const open = () => {
  const box = registry();
  boxes.push(box);
  return box;
};
after(() => boxes.forEach((b) => b.cleanup()));

const skill = (over: Partial<Skill> = {}): Skill => ({
  category: 'repo',
  dir: 'x',
  path: 'repo/x',
  name: 'x',
  summary: 's',
  frontmatter: {},
  ...over
});

describe('a run reports, writes, and then has nothing left to do', () => {
  test('--check reports the stale artifacts and exits 1', () => {
    const { root } = open();
    const run = main(['--check'], root);

    assert.equal(run.code, 1);
    assert.equal(run.stdout, '');
    assert.match(run.stderr, /^skills registry out of sync: /);
    assert.match(run.stderr, /run `pnpm skills:sync`/);
    // Every artifact class the fixture staged, named in the one report.
    for (const artifact of [
      'README.md table',
      'plugin.json skills array',
      'skills.sh.json groupings',
      'skills/repo/README.md',
      'skills/repo/alpha/SKILL.md config block',
      'skills/repo/beta/SKILL.md authority block',
      'skills/repo/beta/SKILL.md verify block',
      'skills/work/gamma/SKILL.md worklock block',
      'skills/work/gamma/SKILL.md plan block'
    ]) {
      assert.ok(
        run.stderr.includes(artifact),
        `expected the report to name ${artifact}\n${run.stderr}`
      );
    }
  });

  test('--check writes nothing', () => {
    const { root } = open();
    const before = readFileSync(join(root, 'README.md'), 'utf8');
    main(['--check'], root);
    assert.equal(readFileSync(join(root, 'README.md'), 'utf8'), before);
  });

  test('--write fixes them and says which', () => {
    const { root } = open();
    const run = main(['--write'], root);

    assert.equal(run.code, 0);
    assert.equal(run.stderr, '');
    assert.match(run.stdout, /^skills registry updated /);
  });

  test('a second --check after a write is clean', () => {
    const { root } = open();
    main(['--write'], root);
    const run = main(['--check'], root);

    assert.equal(run.code, 0);
    assert.equal(run.stderr, '');
    assert.equal(run.stdout, 'skills registry in sync (3 skills)\n');
  });

  test('a second --write is a no-op, not a rewrite', () => {
    const { root } = open();
    main(['--write'], root);
    const run = main(['--write'], root);

    assert.equal(run.code, 0);
    assert.equal(run.stdout, 'skills registry already in sync (3 skills)\n');
  });

  test('the default mode is --write', () => {
    const { root } = open();
    assert.match(main([], root).stdout, /^skills registry updated /);
  });

  test('an unknown mode exits 2 and touches nothing', () => {
    const { root } = open();
    const before = readFileSync(join(root, 'README.md'), 'utf8');
    const run = main(['--rewrite'], root);

    assert.equal(run.code, 2);
    assert.equal(run.stderr, 'unknown mode: --rewrite\n');
    assert.equal(readFileSync(join(root, 'README.md'), 'utf8'), before);
  });
});

describe('what a write actually puts on disk', () => {
  test('the README table lists every skill under its category', () => {
    const { root } = open();
    main(['--write'], root);
    const readme = readFileSync(join(root, 'README.md'), 'utf8');

    assert.match(readme, /### Repository & release/);
    assert.match(readme, /### Tracked work/);
    assert.match(readme, /\[`alpha`\]\(skills\/repo\/alpha\/SKILL\.md\)/);
    assert.match(readme, /\[`gamma`\]\(skills\/work\/gamma\/SKILL\.md\)/);
    // The stale row the fixture shipped is gone, not merely added to.
    assert.ok(!readme.includes('a stale summary'));
  });

  test('plugin.json and skills.sh.json carry the same three skills', () => {
    const { root } = open();
    main(['--write'], root);

    const plugin = JSON.parse(
      readFileSync(join(root, '.claude-plugin', 'plugin.json'), 'utf8')
    );
    assert.deepEqual(plugin.skills, [
      './skills/repo/alpha',
      './skills/repo/beta',
      './skills/work/gamma'
    ]);
    // Keys the generator does not own survive the rewrite.
    assert.equal(plugin.name, 'fixture');

    const sh = JSON.parse(readFileSync(join(root, 'skills.sh.json'), 'utf8'));
    assert.deepEqual(
      sh.groupings.map((g: { title: string; skills: string[] }) => [
        g.title,
        g.skills
      ]),
      [
        ['Repository & release', ['alpha', 'beta']],
        ['Tracked work', ['gamma']]
      ]
    );
  });

  test('a category README is generated per populated category', () => {
    const { root } = open();
    main(['--write'], root);

    const repo = readFileSync(
      join(root, 'skills', 'repo', 'README.md'),
      'utf8'
    );
    assert.match(repo, /^<!-- Generated by/);
    assert.match(repo, /# Repository & release/);
    assert.match(repo, /\*\*\[alpha\]\(\.\/alpha\/SKILL\.md\)\*\*/);
    assert.match(repo, /Back to \[all skills\]\(\.\.\/README\.md\)/);

    assert.ok(existsSync(join(root, 'skills', 'work', 'README.md')));
    // meta and docs hold no skills here, so they get no README.
    assert.ok(!existsSync(join(root, 'skills', 'meta', 'README.md')));
  });

  test('the mirrored bodies come from their sources', () => {
    const { root } = open();
    main(['--write'], root);

    const alpha = readFileSync(
      join(root, 'skills', 'repo', 'alpha', 'SKILL.md'),
      'utf8'
    );
    assert.match(alpha, /<skills-config>\n\n### Reading the config/);
    assert.ok(alpha.includes('Fixture config body,'));
    assert.ok(!alpha.includes('stale config body'));
    // The preamble above `<!-- config:body -->` is not part of the body.
    assert.ok(!alpha.includes('Fixture stand-in'));

    const beta = readFileSync(
      join(root, 'skills', 'repo', 'beta', 'SKILL.md'),
      'utf8'
    );
    assert.ok(beta.includes('Fixture full authority body.'));
    assert.ok(!beta.includes('stale authority body'));
    // `isolated` is base plus the install section; `<skills-verify>` is base alone.
    assert.ok(beta.includes('Fixture base verify body.'));
    assert.ok(!beta.includes('Fixture install section.'));

    const gamma = readFileSync(
      join(root, 'skills', 'work', 'gamma', 'SKILL.md'),
      'utf8'
    );
    assert.ok(gamma.includes('Fixture worklock body.'));
    assert.ok(!gamma.includes('stale worklock body'));
    // Two mirrored blocks in one file: the second must land without the first
    // block's rewrite dropping it.
    assert.ok(gamma.includes('Fixture plan body.'));
    assert.ok(!gamma.includes('stale plan body'));
  });

  test('the resolver ships to every skill that names it, byte-exact, and to nobody else', () => {
    const { root } = open();
    main(['--write'], root);

    const source = readFileSync(
      join(root, 'scripts', 'resolve-config.sh'),
      'utf8'
    );
    const resolverIn = (...segments: string[]) =>
      join(root, 'skills', ...segments, 'templates', 'resolve-config.sh');

    // alpha hosts the config block, and the body this run wrote into it names the
    // resolver — so the mention the shipping decision reads is one the same run
    // produced, not something that had to be on disk beforehand.
    assert.ok(existsSync(resolverIn('repo', 'alpha')), 'alpha hosts the block');
    assert.equal(readFileSync(resolverIn('repo', 'alpha'), 'utf8'), source);

    // gamma hosts no config block and names the script anyway — the queue-skill
    // shape: the contract's prose is left to a required sibling, the script is not.
    assert.ok(
      existsSync(resolverIn('work', 'gamma')),
      'a skill naming the resolver ships it without hosting the block'
    );
    assert.equal(readFileSync(resolverIn('work', 'gamma'), 'utf8'), source);

    // beta carries tagged blocks, hosts no config block and names no resolver.
    assert.ok(
      !existsSync(join(root, 'skills', 'repo', 'beta', 'templates')),
      'a skill that never names the resolver ships none'
    );
  });
});

describe('discovery', () => {
  test('--paths lists CATEGORIES order, alphabetical within a category', () => {
    const { root } = open();
    const run = main(['--paths'], root);

    assert.equal(run.code, 0);
    assert.equal(
      run.stdout,
      'skills/repo/alpha/SKILL.md\n' +
        'skills/repo/beta/SKILL.md\n' +
        'skills/work/gamma/SKILL.md\n'
    );
  });

  test('a directory holding no SKILL.md is skipped', () => {
    const { root } = open();
    const found = discoverSkills(paths(root)).map((s) => s.path);

    assert.ok(existsSync(join(root, 'skills', 'repo', 'not-a-skill')));
    assert.deepEqual(found, ['repo/alpha', 'repo/beta', 'work/gamma']);
  });

  test('a SKILL.md that exists but cannot be read is a loud failure', () => {
    const { root } = open();
    // A directory where the file belongs: readFileSync fails with EISDIR, standing in
    // for any non-ENOENT read failure. Swallowed, such a failure would drop the skill
    // from every artifact at once and still report success.
    mkdirSync(join(root, 'skills', 'repo', 'broken', 'SKILL.md'), {
      recursive: true
    });

    assert.throws(() => discoverSkills(paths(root)), { code: 'EISDIR' });
  });

  test('an unknown category is a loud failure, not a silent skip', () => {
    const { root } = open();
    mkdirSync(join(root, 'skills', 'bogus'), { recursive: true });

    assert.throws(() => discoverSkills(paths(root)), /not a known category/);
  });

  test('byCategory drops categories with no skills', () => {
    const { root } = open();
    const groups = byCategory(discoverSkills(paths(root)));

    assert.deepEqual(
      groups.map((g) => g.category),
      ['repo', 'work']
    );
  });
});

describe('the config block has to sit under its own heading', () => {
  const place = (heading: string) => {
    const content = `# s\n\n${heading}\n\n<skills-config>\n\nbody\n\n</skills-config>\n`;
    return () =>
      assertPlacement(
        content,
        content.indexOf('<skills-config>'),
        'skills/x/y'
      );
  };

  test('under "## Config" it passes', () => {
    assert.doesNotThrow(place('## Config'));
  });

  test('under any other heading it throws, naming the heading', () => {
    assert.throws(place('## Workflow'), /sits under ## Workflow/);
  });

  test('under no heading at all it throws too', () => {
    assert.throws(place('some prose'), /sits under no heading/);
  });

  test('a whole run refuses a misplaced block', () => {
    const { root } = open();
    const file = join(root, 'skills', 'repo', 'alpha', 'SKILL.md');
    writeFileSync(
      file,
      readFileSync(file, 'utf8').replace('## Config', '## Workflow')
    );

    assert.throws(() => main(['--check'], root), /move it under a "## Config"/);
  });
});

describe('frontmatter the loose parser has to survive', () => {
  test('one level of nesting flattens to parent.child', () => {
    const fm = parseFrontmatter(
      '---\nname: a\nmetadata:\n  summary: s\ndescription: d\n---\nbody'
    );
    assert.equal(fm.name, 'a');
    assert.equal(fm['metadata.summary'], 's');
    assert.equal(fm.description, 'd');
  });

  test('a list-valued key does not swallow the keys after it', () => {
    const fm = parseFrontmatter(
      '---\nallowed-tools:\n  - Bash\n  - Read\nname: a\n---'
    );
    assert.equal(fm.name, 'a');
  });

  test('no frontmatter at all is empty, not a throw', () => {
    assert.deepEqual(parseFrontmatter('# just a heading\n'), {});
  });

  test('deriveSummary cuts at the first clause', () => {
    assert.equal(
      deriveSummary('Does a thing — and then some.'),
      'Does a thing'
    );
    assert.equal(deriveSummary('Does a thing. Then more.'), 'Does a thing.');
  });
});

describe('the two frontmatter faults nothing else catches', () => {
  test('a description over the house budget is reported', () => {
    const problems = lintFrontmatter([
      skill({ frontmatter: { description: 'x'.repeat(961) } })
    ]);
    assert.equal(problems.length, 1);
    assert.match(
      problems[0] as string,
      /961 chars — over the 960 house budget/
    );
  });

  test('a description exactly at the budget passes', () => {
    assert.deepEqual(
      lintFrontmatter([
        skill({ frontmatter: { description: 'x'.repeat(960) } })
      ]),
      []
    );
  });

  test('": " and " #" are reported in either field', () => {
    const problems = lintFrontmatter([
      skill({ frontmatter: { description: 'a: b', summary: 'c #d' } })
    ]);
    assert.equal(problems.length, 2);
    assert.ok(problems.some((p) => p.includes('colon+space')));
    assert.ok(problems.some((p) => p.includes('space+hash')));
  });

  test('a quoted value is exempt, because YAML reads it as one scalar', () => {
    assert.deepEqual(
      lintFrontmatter([skill({ frontmatter: { description: "'a: b'" } })]),
      []
    );
  });

  test('a run stops on a lint problem before writing anything', () => {
    const { root } = open();
    const file = join(root, 'skills', 'work', 'gamma', 'SKILL.md');
    // Matched by shape, not by the fixture's exact wording: a literal that stops
    // matching would leave this test passing against an unmodified fixture.
    const broken = readFileSync(file, 'utf8').replace(
      /^description: .*$/m,
      'description: has a colon: right here'
    );
    assert.match(broken, /has a colon: right here/, 'the fixture was modified');
    writeFileSync(file, broken);
    const before = readFileSync(join(root, 'README.md'), 'utf8');
    const run = main(['--write'], root);

    assert.equal(run.code, 1);
    assert.match(run.stderr, /skill frontmatter invalid:/);
    assert.match(run.stderr, /colon\+space/);
    assert.equal(readFileSync(join(root, 'README.md'), 'utf8'), before);
  });
});

describe('the table is compared semantically, not byte for byte', () => {
  test('a committed table round-trips to the tokens it renders from', () => {
    const { root } = open();
    const groups = byCategory(discoverSkills(paths(root)));

    assert.deepEqual(
      parseTable(renderTable(groups)),
      expectedTableTokens(groups)
    );
  });

  test('reflowed column padding is not drift', () => {
    const { root } = open();
    const groups = byCategory(discoverSkills(paths(root)));
    const padded = renderTable(groups)
      .split('\n')
      .map((line) =>
        line.startsWith('| [') ? line.replace('| [', '|  [') : line
      )
      .join('\n');

    assert.deepEqual(parseTable(padded), expectedTableTokens(groups));
  });

  test('a skill moving category is drift', () => {
    const { root } = open();
    const groups = byCategory(discoverSkills(paths(root)));
    const moved = renderTable(groups).replace(
      'skills/work/gamma/SKILL.md',
      'skills/repo/gamma/SKILL.md'
    );

    assert.notDeepEqual(parseTable(moved), expectedTableTokens(groups));
  });
});
