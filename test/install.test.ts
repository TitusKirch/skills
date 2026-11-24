// What a user installs is what the README's installer copies, not what `skills:link`
// links — and the installer copies a skill folder whole, evals/ included. Eval data may
// travel (no client reads it), but a nested SKILL.md would read as a skill of its own,
// so the first test forbids one anywhere below a skill's root, always.
//
// The second test runs the real installer when it is on PATH (`skills`, the skills.sh
// CLI) into a throwaway project, and checks what landed: every skill once, by name,
// with its templates still executable and no SKILL.md below a skill's root. CI does
// not install the CLI, so there it is skipped and says so.

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  mkdtempSync,
  readdirSync,
  rmSync,
  statSync,
  existsSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { ROOT } from './helpers.ts';
import { discoverSkills, paths } from '../scripts/gen-skills.ts';

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    return e.isDirectory() ? walk(p) : [p];
  });
}

const nestedSkillMd = (root: string) =>
  walk(root)
    .map((f) => relative(root, f))
    .filter((f) => f.endsWith('SKILL.md') && f !== 'SKILL.md');

test('no skill carries a SKILL.md below its own root', () => {
  for (const skill of discoverSkills(paths(ROOT))) {
    assert.deepEqual(
      nestedSkillMd(join(ROOT, 'skills', skill.path)),
      [],
      `skills/${skill.path} — rename a fixture to SKILL.md.fixture`
    );
  }
});

const cli = spawnSync('skills', ['--version'], { encoding: 'utf8' });
const project = mkdtempSync(join(tmpdir(), 'skills-install-'));
after(() => rmSync(project, { recursive: true, force: true }));

test(
  'the README installer lands every skill once, executable templates intact',
  { skip: cli.status !== 0 && 'the skills CLI is not installed' },
  () => {
    spawnSync('git', ['init', '-q'], { cwd: project });
    const out = spawnSync(
      'skills',
      ['add', ROOT, '--skill', '*', '--agent', 'codex', '--copy', '-y'],
      { cwd: project, encoding: 'utf8', timeout: 120_000 }
    );
    assert.equal(out.status, 0, out.stdout + out.stderr);
    const installed = join(project, '.agents', 'skills');
    assert.ok(existsSync(installed), `nothing installed under ${installed}`);
    const skills = discoverSkills(paths(ROOT));
    assert.deepEqual(
      readdirSync(installed).sort(),
      skills.map((s) => s.name).sort()
    );
    for (const skill of skills) {
      const dir = join(installed, skill.name);
      assert.deepEqual(nestedSkillMd(dir), [], skill.name);
      for (const f of walk(join(ROOT, 'skills', skill.path))) {
        if (!f.endsWith('.sh')) continue;
        const copy = join(dir, relative(join(ROOT, 'skills', skill.path), f));
        assert.ok(
          existsSync(copy),
          `${skill.name}: ${relative(ROOT, f)} missing`
        );
        assert.equal(
          statSync(copy).mode & 0o111,
          statSync(f).mode & 0o111,
          `${copy} lost its mode`
        );
      }
    }
  }
);
