// The Claude plugin manifest carries a version, and a set version holds users of some
// plugin sources at it until the field changes. So it is the release's version, bumped
// by release-please with the package, and this pins both halves: the value matches
// today, and release-please is told to keep it matching.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './helpers.ts';

const json = (path: string) =>
  JSON.parse(readFileSync(join(ROOT, path), 'utf8')) as Record<string, unknown>;

test('the plugin version is the release version', () => {
  assert.equal(
    json('.claude-plugin/plugin.json').version,
    json('package.json').version
  );
});

test('release-please bumps the plugin version with the package', () => {
  const config = json('release-please-config.json') as {
    packages: Record<
      string,
      { 'extra-files'?: { path: string; jsonpath?: string }[] }
    >;
  };
  const extra = config.packages['.']?.['extra-files'] ?? [];
  assert.ok(
    extra.some(
      (f) =>
        f.path === '.claude-plugin/plugin.json' && f.jsonpath === '$.version'
    ),
    'release-please-config.json does not list .claude-plugin/plugin.json as an extra file'
  );
});

// Where Claude Code is installed, its own validator reads the manifest the way the client
// will; CI does not install it, so there the test is skipped and says so.
const claude = spawnSync('claude', ['--version'], { encoding: 'utf8' });
test(
  "Claude Code's own validator accepts the plugin",
  { skip: claude.status !== 0 && 'claude is not installed' },
  () => {
    const out = spawnSync('claude', ['plugin', 'validate', ROOT, '--strict'], {
      encoding: 'utf8',
      timeout: 60_000
    });
    assert.equal(out.status, 0, out.stdout + out.stderr);
    assert.match(out.stdout + out.stderr, /Validation passed/);
  }
);
