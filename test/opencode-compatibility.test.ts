// OpenCode compatibility is checked through the real CLI, not a second parser. The
// normal test suite skips this probe when the pinned CLI is absent; its own workflow
// installs that exact version and makes absence or drift a failure.

import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ROOT } from './helpers.ts';
import { discoverSkills, paths } from '../scripts/gen-skills.ts';

const OPENCODE_VERSION = '1.18.30';
const OPENCODE = process.env.OPENCODE_BIN ?? 'opencode';
const REQUIRED = process.env.OPENCODE_REQUIRED === 'true';
const homes: string[] = [];

after(() =>
  homes.forEach((home) => rmSync(home, { recursive: true, force: true }))
);

interface Run {
  status: number;
  stdout: string;
  stderr: string;
  missing: boolean;
}

function run(
  args: string[],
  env: NodeJS.ProcessEnv = process.env,
  cwd = ROOT
): Run {
  const result = spawnSync(OPENCODE, args, {
    cwd,
    encoding: 'utf8',
    env,
    maxBuffer: 10 * 1024 * 1024
  });
  return {
    status: result.status ?? -1,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    missing:
      (result.error as NodeJS.ErrnoException | undefined)?.code === 'ENOENT'
  };
}

function home(): string {
  const dir = mkdtempSync(join(tmpdir(), 'tituskirch-skills-opencode-'));
  homes.push(dir);
  return dir;
}

function envFor(home: string): NodeJS.ProcessEnv {
  return {
    ...process.env,
    HOME: home,
    XDG_CACHE_HOME: join(home, '.cache'),
    XDG_CONFIG_HOME: join(home, '.config'),
    XDG_DATA_HOME: join(home, '.local', 'share'),
    OPENCODE_DISABLE_CLAUDE_CODE_SKILLS: '1'
  };
}

function link(home: string, env: NodeJS.ProcessEnv): void {
  const result = spawnSync('bash', [join(ROOT, 'scripts', 'link-skills.sh')], {
    cwd: ROOT,
    encoding: 'utf8',
    env
  });
  assert.equal(result.status, 0, result.stderr);
}

function projectWithPublishedFrontmatter(): string {
  const project = home();
  const git = spawnSync('git', ['init', '--quiet'], {
    cwd: project,
    encoding: 'utf8'
  });
  assert.equal(git.status, 0, git.stderr);

  for (const skill of discoverSkills(paths(ROOT))) {
    const raw = readFileSync(
      join(ROOT, 'skills', skill.path, 'SKILL.md'),
      'utf8'
    );
    const frontmatter = raw.match(/^---\n[\s\S]*?\n---\n/);
    assert.ok(frontmatter, `${skill.name} should have frontmatter`);
    const destination = join(project, '.opencode', 'skills', skill.name);
    mkdirSync(destination, { recursive: true });
    // The CLI consumes the frontmatter while keeping the debug payload bounded.
    writeFileSync(join(destination, 'SKILL.md'), frontmatter[0]);
  }
  return project;
}

interface Permission {
  permission: string;
  pattern: string;
  action?: string;
}

interface Agent {
  permission: Permission[];
}

function action(
  agent: Agent,
  permission: string,
  pattern: string
): string | undefined {
  return agent.permission
    .filter(
      (entry) => entry.permission === permission && entry.pattern === pattern
    )
    .at(-1)?.action;
}

test('OpenCode 1.18.30 accepts published frontmatter and enforces queue permissions', (t) => {
  const version = run(['--version']);
  if (version.missing) {
    if (REQUIRED)
      assert.fail(`OpenCode ${OPENCODE_VERSION} is required but not installed`);
    t.skip(`OpenCode ${OPENCODE_VERSION} is not installed`);
    return;
  }
  if (version.stdout.trim() !== OPENCODE_VERSION) {
    if (REQUIRED) {
      assert.equal(version.stdout.trim(), OPENCODE_VERSION, version.stderr);
    }
    t.skip(
      `requires OpenCode ${OPENCODE_VERSION}; found ${version.stdout.trim()}`
    );
    return;
  }

  const isolatedHome = home();
  const env = envFor(isolatedHome);
  link(isolatedHome, env);

  const project = projectWithPublishedFrontmatter();
  for (const skill of discoverSkills(paths(ROOT))) {
    assert.ok(
      existsSync(
        join(isolatedHome, '.agents', 'skills', skill.name, 'SKILL.md')
      ),
      `${skill.name} should be linked into the agent-compatible directory`
    );
  }

  const agents = join(project, '.opencode', 'agents');
  mkdirSync(agents, { recursive: true });
  for (const name of ['work-implement-queue', 'work-review-queue']) {
    const template = join(
      isolatedHome,
      '.agents',
      'skills',
      name,
      'templates',
      'opencode-agent.md'
    );
    assert.ok(
      existsSync(template),
      `${name} should install its OpenCode agent template`
    );
    cpSync(template, join(agents, `${name}.md`));
  }

  const skills = run(['--pure', 'debug', 'skill'], env, project);
  assert.equal(skills.status, 0, skills.stderr);
  const loaded = JSON.parse(skills.stdout) as Array<{
    name: string;
    location: string;
  }>;

  for (const skill of discoverSkills(paths(ROOT))) {
    const entries = loaded.filter((entry) => entry.name === skill.name);
    assert.equal(
      entries.length,
      1,
      `${skill.name} should be discovered exactly once`
    );
    assert.equal(
      entries[0]?.location,
      join(project, '.opencode', 'skills', skill.name, 'SKILL.md')
    );
  }

  for (const name of ['work-implement-queue', 'work-review-queue']) {
    const configured = run(['--pure', 'debug', 'agent', name], env, project);
    assert.equal(configured.status, 0, configured.stderr);
    const agent = JSON.parse(configured.stdout) as Agent;
    assert.equal(action(agent, 'question', '*'), 'deny');
    assert.equal(action(agent, 'skill', '*'), 'allow');
    assert.equal(action(agent, 'task', '*'), 'deny');
    assert.equal(action(agent, 'task', 'general'), 'allow');
  }
});
