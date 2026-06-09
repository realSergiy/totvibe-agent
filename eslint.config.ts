import { totvibe } from '@totvibe/eslint-config';
import { defineConfig } from 'eslint/config';

export default defineConfig(
  ...totvibe({
    ignores: ['reference_clones/**', '**/.tsbuild/**', 'packages/sandbox/**/target/**'],
    react: {
      dom: ['apps/web/src/**/*.{ts,tsx}', 'packages/view/src/**/*.{ts,tsx}', 'tests/src/web/**/*.{ts,tsx}'],
      opentui: ['apps/tui/src/**/*.{ts,tsx}', 'tests/src/tui/**/*.{ts,tsx}'],
    },
    reactVersion: '19.0',
    tsconfigRootDir: import.meta.dirname,
  }),
);
