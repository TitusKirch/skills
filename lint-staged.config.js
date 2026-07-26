export default {
  '*.md': (filenames) => {
    // oxfmt ignores CHANGELOG.md and exits non-zero when every file it is
    // handed is ignored — which is exactly a release-please merge back to dev.
    const files = filenames.filter((f) => !f.endsWith('CHANGELOG.md'));
    return files.length > 0 ? [`pnpm exec oxfmt ${files.join(' ')}`] : [];
  },
  '*.{json,jsonc,yml,yaml}': (filenames) => {
    const files = filenames.filter((f) => !f.includes('pnpm-lock.yaml'));
    return files.length > 0 ? `pnpm exec oxfmt ${files.join(' ')}` : [];
  },
  '*.{js,ts,mjs,cjs}': (filenames) => [
    `pnpm exec oxlint --fix --deny-warnings ${filenames.join(' ')}`,
    `pnpm exec oxfmt ${filenames.join(' ')}`
  ]
};
