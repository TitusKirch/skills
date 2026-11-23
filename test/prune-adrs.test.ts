// What rewrite-adr-refs.sh promises, checked against a real git repository. The script is
// the mechanical half of prune-adrs: the map carries every judgement, so the same map has to
// produce the same tree, a dry run has to touch nothing, and a removed id must never survive
// silently anywhere a reader could follow it.

import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  existsSync,
  rmSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { ROOT } from './helpers.ts';

const SCRIPT = join(
  ROOT,
  'skills',
  'docs',
  'prune-adrs',
  'templates',
  'rewrite-adr-refs.sh'
);

const dirs: string[] = [];
after(() => dirs.forEach((d) => rmSync(d, { recursive: true, force: true })));

const FILES: Record<string, string> = {
  'docs/99.adr/0001-keep-a.md': '# ADR-0001 — Keep a\n\nStands alone.\n',
  'docs/99.adr/0002-old-b.md': '# ADR-0002 — Old b\n\nSee ADR-0001.\n',
  'docs/99.adr/0003-feature-c.md': '# ADR-0003 — Feature c\n\nRules.\n',
  'docs/99.adr/0004-feature-d.md': '# ADR-0004 — Feature d\n\nRules.\n',
  'docs/de-DE/99.adr/0003-feature-c.md': '# ADR-0003 — Feature c\n',
  'docs/99.adr/index.md': [
    '| ADR | Decision |',
    '| :-- | :------- |',
    '| [ADR-0001](0001-keep-a.md) | a |',
    '| [ADR-0002](0002-old-b.md) | b |',
    '| [ADR-0003](0003-feature-c.md) | c |',
    '| [ADR-0004](0004-feature-d.md) | d |',
    ''
  ].join('\n'),
  'docs/2.concepts/c.md': '---\ntitle: c\n---\n\n# C\n',
  'docs/2.concepts/other.md': [
    'See [ADR-0002](../99.adr/0002-old-b.md#context) and [ADR-0003](../99.adr/0003-feature-c.md).',
    'Also ADR-0030 and ADR-00031 stay; ADR-0003 moves.',
    'Rendered: [ADR-0004](/adr/0004-feature-d).',
    ''
  ].join('\n'),
  'src/a.ts': '// ADR-0003: rules\n// ADR-0002\nconst x = 1;\n',
  'CHANGELOG.md': 'Released with ADR-0002.\n'
};

const MAP = [
  '# id\taction\ttarget\tlabel',
  '0001\tkeep',
  '0002\tmerge\t0001',
  '0003\tmove\tdocs/2.concepts/c.md\tthe c concept',
  '0004\tmove\t/concepts/d\tthe d concept',
  ''
].join('\n');

function repo(files: Record<string, string> = FILES): string {
  const dir = mkdtempSync(join(tmpdir(), 'prune-adrs-'));
  dirs.push(dir);
  for (const [path, body] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), body);
  }
  const git = (...args: string[]) =>
    spawnSync('git', args, { cwd: dir, encoding: 'utf8' });
  git('init', '-q');
  git('add', '-A');
  git(
    '-c',
    'user.name=t',
    '-c',
    'user.email=t@example.invalid',
    'commit',
    '-qm',
    'init'
  );
  return dir;
}

function run(dir: string, map: string, ...flags: string[]) {
  writeFileSync(join(dir, '..', `${dir.split('/').pop()}.tsv`), map);
  const mapPath = join(dir, '..', `${dir.split('/').pop()}.tsv`);
  dirs.push(mapPath);
  return spawnSync('sh', [SCRIPT, ...flags, mapPath], {
    cwd: dir,
    encoding: 'utf8'
  });
}

const read = (dir: string, path: string) =>
  readFileSync(join(dir, path), 'utf8');

describe('a dry run', () => {
  test('reports what would change and touches nothing', () => {
    const dir = repo();
    const out = run(dir, MAP);
    assert.equal(out.status, 0, out.stderr);
    assert.match(out.stdout, /would change: src\/a\.ts/);
    assert.match(out.stdout, /would remove: docs\/99\.adr\/0002-old-b\.md/);
    for (const [path, body] of Object.entries(FILES)) {
      assert.equal(read(dir, path), body, `${path} changed in a dry run`);
    }
  });
});

describe('apply', () => {
  const dir = repo();
  const out = run(dir, MAP, '--apply');

  test('finishes clean', () => {
    assert.equal(out.status, 0, out.stdout + out.stderr);
    assert.match(out.stdout, /clean/);
  });

  test('a merge points every reference at the survivor, link and token alike', () => {
    const other = read(dir, 'docs/2.concepts/other.md');
    assert.match(
      other,
      /\[ADR-0001\]\(\.\.\/99\.adr\/0001-keep-a\.md#context\)/
    );
    assert.match(read(dir, 'src/a.ts'), /\/\/ ADR-0001\n/);
  });

  test('a move to a repo path is written relative to each linking file', () => {
    const other = read(dir, 'docs/2.concepts/other.md');
    assert.match(other, /\[the c concept\]\(c\.md\)/);
    assert.match(read(dir, 'src/a.ts'), /\/\/ the c concept: rules/);
  });

  test('a move to a site path is written as given', () => {
    assert.match(
      read(dir, 'docs/2.concepts/other.md'),
      /\[the d concept\]\(\/concepts\/d\)/
    );
  });

  test('an id is matched whole, never as a prefix of another', () => {
    assert.match(
      read(dir, 'docs/2.concepts/other.md'),
      /ADR-0030 and ADR-00031 stay/
    );
  });

  test('removed records go, in every locale tree, and so do their index rows', () => {
    for (const path of [
      'docs/99.adr/0002-old-b.md',
      'docs/99.adr/0003-feature-c.md',
      'docs/99.adr/0004-feature-d.md',
      'docs/de-DE/99.adr/0003-feature-c.md'
    ]) {
      assert.ok(!existsSync(join(dir, path)), `${path} survived`);
    }
    const index = read(dir, 'docs/99.adr/index.md');
    assert.match(index, /\[ADR-0001\]/);
    assert.doesNotMatch(index, /ADR-000[234]/);
    assert.ok(existsSync(join(dir, 'docs/99.adr/0001-keep-a.md')));
  });

  test('released history is left alone', () => {
    assert.equal(read(dir, 'CHANGELOG.md'), FILES['CHANGELOG.md']);
  });

  test('a second run of the same map changes nothing more', () => {
    const again = run(dir, MAP, '--check');
    assert.equal(again.status, 0, again.stdout + again.stderr);
  });
});

describe("a move into a component's own design notes", () => {
  test('a relative target outside docs/ is a repo path too', () => {
    const dir = repo({
      ...FILES,
      'skills/x/DESIGN.md': '# x — design\n'
    });
    const out = run(
      dir,
      '0003\tmove\tskills/x/DESIGN.md\tthe x design notes\n0001\tsplit\n',
      '--apply'
    );
    assert.equal(out.status, 0, out.stdout + out.stderr);
    assert.match(
      read(dir, 'docs/2.concepts/other.md'),
      /\[the x design notes\]\(\.\.\/\.\.\/skills\/x\/DESIGN\.md\)/
    );
    assert.ok(
      existsSync(join(dir, 'docs/99.adr/0001-keep-a.md')),
      'a split record stays'
    );
  });
});

describe('a page the batch has just written', () => {
  test('is rewritten and checked although git does not track it yet', () => {
    const dir = repo();
    writeFileSync(join(dir, 'docs/2.concepts/new.md'), 'Builds on ADR-0002.\n');
    const out = run(dir, MAP, '--apply');
    assert.equal(out.status, 0, out.stdout + out.stderr);
    assert.equal(read(dir, 'docs/2.concepts/new.md'), 'Builds on ADR-0001.\n');
  });
});

describe('what the check refuses to call clean', () => {
  test('a survivor that would now cite itself', () => {
    const dir = repo({
      ...FILES,
      'docs/99.adr/0001-keep-a.md':
        '# ADR-0001 — Keep a\n\nSupersedes ADR-0002.\n'
    });
    const out = run(dir, MAP, '--apply');
    assert.equal(out.status, 1);
    assert.match(out.stdout, /reference themselves/);
    assert.match(out.stdout, /0001-keep-a\.md:3:Supersedes ADR-0001/);
  });

  test('a dropped record something still references', () => {
    const dir = repo();
    const out = run(dir, '0002\tdrop\n', '--apply');
    assert.equal(out.status, 1);
    assert.match(out.stdout, /src\/a\.ts:2:\/\/ ADR-0002/);
  });
});

describe('an invalid map stops before anything is written', () => {
  const cases: Record<string, string> = {
    'an unknown action': '0002\tsquash\n',
    'a merge into a removed record': '0002\tmerge\t0003\n0003\tdrop\n',
    'a merge into itself': '0002\tmerge\t0002\n',
    'a move to a page that does not exist':
      '0003\tmove\tdocs/2.concepts/missing.md\tlabel\n',
    'a move with no label': '0003\tmove\t/concepts/c\n',
    'an id listed twice': '0002\tkeep\n0002\tdrop\n',
    'an id with no record': '0099\tdrop\n',
    'an id that is not four digits': '2\tdrop\n'
  };
  for (const [name, map] of Object.entries(cases)) {
    test(name, () => {
      const dir = repo();
      const out = run(dir, map, '--apply');
      assert.equal(out.status, 2, `${name}: ${out.stdout}${out.stderr}`);
      for (const [path, body] of Object.entries(FILES)) {
        assert.equal(read(dir, path), body, `${path} changed on ${name}`);
      }
    });
  }
});
