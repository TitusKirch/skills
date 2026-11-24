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
  'docs/99.adr/0001-keep-a.md':
    '# ADR-0001 — Keep a\n\n## Context\n\nStands alone.\n',
  'docs/99.adr/0002-old-b.md':
    '# ADR-0002 — Old b\n\n## Context\n\nSee ADR-0001.\n',
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

describe('listing the citations of a trimmed record', () => {
  const dir = repo();
  const out = run(dir, '0002\ttrim\n0001\tsplit\n0003\tkeep\n', '--cites');

  test('lists every citing line, grouped by id, and exits 0', () => {
    assert.equal(out.status, 0, out.stderr);
    assert.match(out.stdout, /ADR-0002 — 3 citing lines/);
    assert.match(out.stdout, /docs\/2\.concepts\/other\.md:1:/);
    assert.match(out.stdout, /src\/a\.ts:2:\/\/ ADR-0002/);
    assert.match(out.stdout, /docs\/99\.adr\/0002-old-b\.md:5:See ADR-0001/);
  });

  test('leaves out the record itself, changelogs and kept records', () => {
    assert.doesNotMatch(out.stdout, /0002-old-b\.md:1:/);
    assert.doesNotMatch(out.stdout, /CHANGELOG/);
    assert.doesNotMatch(out.stdout, /ADR-0003 —/);
  });

  test('touches nothing', () => {
    for (const [path, body] of Object.entries(FILES)) {
      assert.equal(read(dir, path), body, `${path} changed`);
    }
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

describe('a link into a surviving record', () => {
  test('whose anchor left in a trim is refused by the check', () => {
    const dir = repo({
      ...FILES,
      'docs/99.adr/0002-old-b.md': '# ADR-0002 — Old b\n\nSee ADR-0001.\n'
    });
    const out = run(dir, '0002\ttrim\n', '--check');
    assert.equal(out.status, 1, out.stdout);
    assert.match(out.stdout, /anchor no longer exists/);
    assert.match(
      out.stdout,
      /other\.md:1:See \[ADR-0002\]\(\.\.\/99\.adr\/0002-old-b\.md#context\)/
    );
  });

  test('whose anchor still exists passes', () => {
    const dir = repo();
    const out = run(dir, '0002\ttrim\n', '--check');
    assert.equal(out.status, 0, out.stdout);
  });
});

describe('a trim checked for rewording', () => {
  const RECORD = 'docs/99.adr/0001-keep-a.md';
  const base = {
    ...FILES,
    [RECORD]:
      '# ADR-0001 — Keep a\n\n## Context\n\nStands alone, and it was weighed with care. It reads well.\n'
  };
  const trimmed = (body: string) => {
    const dir = repo(base);
    writeFileSync(
      join(dir, RECORD),
      `# ADR-0001 — Keep a\n\n## Context\n\n${body}\n`
    );
    return run(dir, '0001\ttrim\n', '--reworded');
  };

  test('a pure deletion passes, capitalised where a clause went', () => {
    const out = trimmed('Stands alone. Reads well.');
    assert.equal(out.status, 0, out.stdout);
  });

  test('a sentence carrying the added link is exempt', () => {
    const out = trimmed('Stands alone. The rest is in [the page](c.md).');
    assert.equal(out.status, 0, out.stdout);
  });

  test('a reworded sentence is named', () => {
    const out = trimmed('Stands apart, weighed with care.');
    assert.equal(out.status, 1, out.stdout);
    assert.match(out.stdout, /0001-keep-a\.md: Stands apart/);
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

describe('only a link that lands on a record of the log is rewritten', () => {
  const dir = repo({
    ...FILES,
    'guide/0002-jobs.md': '# Jobs\n',
    'guide/index.md': 'See [Jobs](0002-jobs.md).\n',
    'docs/2.concepts/far.md': [
      'Elsewhere: <https://example.org/adr/0002-unrelated>.',
      'Dotted: [b](../99.adr/./0002-old-b.md).',
      'Rooted: [b](/docs/99.adr/0002-old-b.md).',
      ''
    ].join('\n'),
    'docs/2.concepts/München.md': 'Umlaut: ADR-0002.\n'
  });
  const out = run(dir, MAP, '--apply');

  test('finishes clean', () => {
    assert.equal(out.status, 0, out.stdout + out.stderr);
  });

  test('a same-numbered page outside the log is left alone', () => {
    assert.equal(read(dir, 'guide/index.md'), 'See [Jobs](0002-jobs.md).\n');
  });

  test("another site's ADR url is left alone, and named", () => {
    assert.ok(
      read(dir, 'docs/2.concepts/far.md').includes(
        '<https://example.org/adr/0002-unrelated>'
      )
    );
    assert.match(out.stdout, /another site's ADR path/);
  });

  test('a dotted and a rooted path are resolved before they are compared', () => {
    const far = read(dir, 'docs/2.concepts/far.md');
    assert.match(far, /\[b\]\(\.\.\/99\.adr\/\.\/0001-keep-a\.md\)/);
    assert.match(far, /\[b\]\(\/docs\/99\.adr\/0001-keep-a\.md\)/);
  });

  test('a file name outside ASCII is read and rewritten', () => {
    assert.equal(
      read(dir, 'docs/2.concepts/München.md'),
      'Umlaut: ADR-0001.\n'
    );
  });

  test('the batch is written into the protocol', () => {
    const protocol = read(dir, 'docs/99.adr/migration.tsv');
    assert.match(protocol, /\t0002\tmerge\t0001\t/);
    assert.match(protocol, /\t0004\tmove\t\/concepts\/d\tthe d concept/);
  });
});

describe('the origin remote', () => {
  test("a blob url into the repo's own log is a repo path", () => {
    const dir = repo({
      ...FILES,
      'docs/2.concepts/blob.md':
        '[b](https://github.com/o/r/blob/main/docs/99.adr/0002-old-b.md)\n'
    });
    spawnSync('git', ['remote', 'add', 'origin', 'git@github.com:o/r.git'], {
      cwd: dir
    });
    const out = run(dir, MAP, '--apply');
    assert.equal(out.status, 0, out.stdout + out.stderr);
    assert.equal(
      read(dir, 'docs/2.concepts/blob.md'),
      '[b](https://github.com/o/r/blob/main/docs/99.adr/0001-keep-a.md)\n'
    );
  });
});

describe('an apply refused before anything is written', () => {
  const untouched = (dir: string, extra: Record<string, string> = {}) => {
    for (const [path, body] of Object.entries({ ...FILES, ...extra })) {
      assert.equal(read(dir, path), body, `${path} changed`);
    }
  };

  test('a dropped record something still references', () => {
    const dir = repo();
    const out = run(dir, '0002\tdrop\n', '--apply');
    assert.equal(out.status, 1);
    assert.match(out.stdout, /src\/a\.ts:2:\/\/ ADR-0002/);
    assert.ok(
      existsSync(join(dir, 'docs/99.adr/0002-old-b.md')),
      'the record went'
    );
    untouched(dir);
  });

  test('a wiki link to a removed record', () => {
    const extra = { 'docs/2.concepts/wiki.md': 'See [[0003-feature-c]].\n' };
    const dir = repo({ ...FILES, ...extra });
    const out = run(dir, MAP, '--apply');
    assert.equal(out.status, 1, out.stdout);
    assert.match(out.stdout, /cannot rewrite/);
    untouched(dir, extra);
  });

  test('a move that would collapse a #fragment, unless told to', () => {
    const map = '0002\tmove\tdocs/2.concepts/c.md\tthe c concept\n';
    const dir = repo();
    const out = run(dir, map, '--apply');
    assert.equal(out.status, 1, out.stdout);
    assert.match(out.stdout, /#fragment/);
    untouched(dir);
    const forced = run(dir, map, '--apply', '--fragments=drop');
    assert.equal(forced.status, 0, forced.stdout + forced.stderr);
    assert.match(
      read(dir, 'docs/2.concepts/other.md'),
      /\[ADR-0002\]|\[the c concept\]\(c\.md\)/
    );
  });
});

describe('what the check resolves', () => {
  test('a link to a record under a wrong slug', () => {
    const dir = repo({
      ...FILES,
      'docs/2.concepts/slug.md': '[a](../99.adr/0001-wrong.md#context)\n'
    });
    const out = run(dir, '0001\tkeep\n', '--check');
    assert.equal(out.status, 1, out.stdout);
    assert.match(out.stdout, /does not exist[^\n]*\n[^\n]*slug\.md:1:/);
  });

  test("a locale link is checked against the locale's own record", () => {
    const files = {
      ...FILES,
      'docs/de-DE/99.adr/0001-keep-a.md':
        '# ADR-0001 — Behalte a\n\n## Entscheidung\n',
      'docs/2.concepts/de.md':
        '[a](../de-DE/99.adr/0001-keep-a.md#entscheidung)\n'
    };
    assert.equal(run(repo(files), '0001\tkeep\n', '--check').status, 0);
    const dead = repo({
      ...files,
      'docs/2.concepts/de.md': '[a](../de-DE/99.adr/0001-keep-a.md#context)\n'
    });
    assert.equal(run(dead, '0001\tkeep\n', '--check').status, 1);
  });
});

describe('a mixed batch after its apply', () => {
  const dir = repo();
  const map = '0002\ttrim\n0003\tmove\tdocs/2.concepts/c.md\tthe c concept\n';
  const applied = run(dir, map, '--apply');

  test('applies', () =>
    assert.equal(applied.status, 0, applied.stdout + applied.stderr));

  test('still lists citations and checks rewording, the moved record gone', () => {
    assert.equal(run(dir, map, '--cites').status, 0);
    const reworded = run(dir, map, '--reworded');
    assert.equal(reworded.status, 0, reworded.stdout + reworded.stderr);
    assert.match(reworded.stdout, /compared 2 pages/);
  });

  test('refuses a base that does not resolve', () => {
    assert.equal(run(dir, map, '--reworded', '--base=no-such-rev').status, 2);
  });
});

describe('a split checked for rewording', () => {
  const base = {
    ...FILES,
    'docs/99.adr/0001-keep-a.md':
      '# ADR-0001 — Keep a\n\n## Context\n\nStands alone. It was not weighed lightly.\n'
  };
  const split = (record: string) => {
    const dir = repo(base);
    writeFileSync(
      join(dir, 'docs/99.adr/0001-keep-a.md'),
      '# ADR-0001 — Keep a\n\n## Context\n\nStands alone.\n'
    );
    writeFileSync(join(dir, 'docs/99.adr/0005-weigh-a.md'), record);
    return run(dir, '0001\tsplit\t0005\n', '--reworded');
  };

  test('a new record may have its own head, then only moved sentences', () => {
    const out = split(
      '# ADR-0005 — Weigh a\n\nPartly supersedes [ADR-0001](/adr/0001-keep-a).\n\nSplit off a.\n\n## Context\n\nIt was not weighed lightly.\n'
    );
    assert.equal(out.status, 0, out.stdout);
  });

  test('a sentence it invents is named', () => {
    const out = split(
      '# ADR-0005 — Weigh a\n\nSplit off a.\n\n## Context\n\nIt was weighed with great care.\n'
    );
    assert.equal(out.status, 1, out.stdout);
    assert.match(
      out.stdout,
      /0005-weigh-a\.md: It was weighed with great care/
    );
  });

  test('a deletion that drops a negation is listed for review', () => {
    const out = split(
      '# ADR-0005 — Weigh a\n\nSplit off a.\n\n## Context\n\nIt was weighed lightly.\n'
    );
    assert.equal(out.status, 0, out.stdout);
    assert.match(
      out.stdout,
      /dropped a negation[^\n]*\n[^\n]*It was weighed lightly/
    );
  });
});

describe('renumbering', () => {
  const files: Record<string, string> = {
    'docs/99.adr/0001-a.md': '# ADR-0001 — A\n\nSee ADR-0004.\n',
    'docs/99.adr/0003-c.md':
      '# ADR-0003 — C\n\n## Why\n\nAfter [ADR-0001](0001-a.md).\n',
    'docs/99.adr/0004-d.md':
      '# ADR-0004 — D\n\nBuilds on [ADR-0003](0003-c.md#why).\n',
    'docs/de-DE/99.adr/0004-d.md': '# ADR-0004 — D\n',
    'docs/99.adr/index.md':
      '| [ADR-0001](0001-a.md) |\n| [ADR-0003](0003-c.md) |\n| [ADR-0004](0004-d.md) |\n',
    'src/x.ts': '// ADR-0003 then ADR-0004, see /adr/0004-d\n',
    'CHANGELOG.md': 'ADR-0004.\n'
  };

  test('a dry run names every rename and touches nothing', () => {
    const dir = repo(files);
    const out = spawnSync('sh', [SCRIPT, '--renumber'], {
      cwd: dir,
      encoding: 'utf8'
    });
    assert.equal(out.status, 0, out.stdout + out.stderr);
    assert.match(
      out.stdout,
      /would rename: docs\/99\.adr\/0004-d\.md -> docs\/99\.adr\/0003-d\.md/
    );
    for (const [path, body] of Object.entries(files))
      assert.equal(read(dir, path), body);
  });

  const dir = repo(files);
  const out = spawnSync('sh', [SCRIPT, '--renumber', '--apply'], {
    cwd: dir,
    encoding: 'utf8'
  });

  test('finishes clean', () =>
    assert.equal(out.status, 0, out.stdout + out.stderr));

  test('every reference moves once, never along a chain', () => {
    assert.equal(
      read(dir, 'src/x.ts'),
      '// ADR-0002 then ADR-0003, see /adr/0003-d\n'
    );
    assert.equal(
      read(dir, 'docs/99.adr/0003-d.md'),
      '# ADR-0003 — D\n\nBuilds on [ADR-0002](0002-c.md#why).\n'
    );
    assert.equal(
      read(dir, 'docs/99.adr/0001-a.md'),
      '# ADR-0001 — A\n\nSee ADR-0003.\n'
    );
  });

  test('files are renamed in every locale tree, and the index follows', () => {
    assert.ok(existsSync(join(dir, 'docs/99.adr/0002-c.md')));
    assert.ok(existsSync(join(dir, 'docs/de-DE/99.adr/0003-d.md')));
    assert.ok(!existsSync(join(dir, 'docs/99.adr/0004-d.md')));
    assert.match(
      read(dir, 'docs/99.adr/index.md'),
      /\[ADR-0003\]\(0003-d\.md\)/
    );
  });

  test('history stays, and the protocol maps the old ids', () => {
    assert.equal(read(dir, 'CHANGELOG.md'), 'ADR-0004.\n');
    const protocol = read(dir, 'docs/99.adr/migration.tsv');
    assert.match(protocol, /^renumber\t\w+\t0003\trenumber\t0002\t$/m);
    assert.match(protocol, /^renumber\t\w+\t0004\trenumber\t0003\t$/m);
  });

  test('a second renumbering has nothing to do', () => {
    const again = spawnSync('sh', [SCRIPT, '--renumber'], {
      cwd: dir,
      encoding: 'utf8'
    });
    assert.equal(again.status, 0);
    assert.match(again.stdout, /nothing to renumber/);
  });
});
