// A link into a skill's own markdown can name a file that exists and a heading that does
// not — `REFERENCE.md#review-after-land` where the target is a bold list item, not a
// heading. The file check in isolation.test.ts passes that; a reader following it lands
// at the top of a 170 KB page. This checks every #fragment in every shipped markdown file
// (DESIGN.md included, evals/ excluded) against the headings and explicit ids of its
// target, slugged the way GitHub renders them: lowercase, punctuation dropped (letters of
// any script kept), each space a hyphen, a repeated heading suffixed -1, -2, ….

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { ROOT } from './helpers.ts';

function markdown(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return e.name === 'evals' ? [] : markdown(p);
    return p.endsWith('.md') ? [p] : [];
  });
}

const slug = (heading: string) =>
  heading
    .replace(/`/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, '')
    .replace(/\s/g, '-');

const cache = new Map<string, Set<string>>();
function anchors(file: string): Set<string> {
  const hit = cache.get(file);
  if (hit) return hit;
  const text = readFileSync(file, 'utf8').replace(/```[\s\S]*?```/g, '');
  const out = new Set<string>();
  const seen = new Map<string, number>();
  for (const m of text.matchAll(/^#{1,6}\s+(.+?)\s*#*\s*$/gm)) {
    const base = slug(m[1] as string);
    const n = seen.get(base);
    seen.set(base, n === undefined ? 0 : n + 1);
    out.add(n === undefined ? base : `${base}-${n + 1}`);
  }
  for (const m of text.matchAll(/(?:id|name)="([^"]+)"/g))
    out.add(m[1] as string);
  cache.set(file, out);
  return out;
}

test('every #fragment in a skill names a heading or id its target has', () => {
  const dead: string[] = [];
  for (const file of markdown(join(ROOT, 'skills'))) {
    const body = readFileSync(file, 'utf8')
      .replace(/```[\s\S]*?```/g, '')
      .replace(/`[^`\n]*`/g, '');
    for (const m of body.matchAll(/\]\(([^)\s]+)\)/g)) {
      const link = m[1] as string;
      if (/^[a-z]+:/i.test(link) || link.startsWith('/')) continue;
      const [path, fragment] = link.split('#');
      if (fragment === undefined) continue;
      const target = path ? resolve(dirname(file), path) : file;
      if (!target.endsWith('.md') || !existsSync(target)) continue;
      if (!anchors(target).has(decodeURIComponent(fragment))) {
        dead.push(`${relative(ROOT, file)}: ${link}`);
      }
    }
  }
  assert.deepEqual(dead, []);
});
