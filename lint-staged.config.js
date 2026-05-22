export default {
  '*.md': (filenames) => [`pnpm exec oxfmt ${filenames.join(' ')}`],
  '*.{json,jsonc,yml,yaml}': (filenames) => {
    const files = filenames.filter((f) => !f.includes('pnpm-lock.yaml'));
    return files.length > 0 ? `pnpm exec oxfmt ${files.join(' ')}` : [];
  },
  '*.{js,ts,mjs,cjs}': (filenames) => [
    `pnpm exec oxlint --fix --deny-warnings ${filenames.join(' ')}`,
    `pnpm exec oxfmt ${filenames.join(' ')}`
  ]
};
