// Static tasks: lint-staged appends the staged paths itself, as separate arguments, so a
// path with a space stays one path. The two files oxfmt ignores are left out by their
// exact basename — CHANGELOG.md (a release-please merge back to dev stages nothing else,
// and oxfmt exits non-zero when every file it is handed is ignored) and pnpm-lock.yaml.
export default {
  '!(CHANGELOG).md': 'pnpm exec oxfmt',
  '!(pnpm-lock).{json,jsonc,yml,yaml}': 'pnpm exec oxfmt',
  '*.{js,ts,mjs,cjs}': [
    'pnpm exec oxlint --fix --deny-warnings',
    'pnpm exec oxfmt'
  ]
};
