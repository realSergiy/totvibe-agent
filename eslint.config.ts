import { zyplux } from '@zyplux/eslint-config';
import { defineConfig } from 'eslint/config';

export default defineConfig(
  ...zyplux({
    ignores: ['reference_clones/**', '**/.tsbuild/**', 'packages/sandbox/**/target/**'],
    react: {
      dom: [
        'apps/web/src/**/*.{ts,tsx}',
        'packages/view/src/**/*.{ts,tsx}',
        'tests/view/**/*.{ts,tsx}',
        'tests/web/**/*.{ts,tsx}',
      ],
      opentui: ['apps/tui/src/**/*.{ts,tsx}', 'tests/tui/**/*.{ts,tsx}'],
    },
    reactVersion: '19.0',
    tsconfigRootDir: import.meta.dirname,
  }),
);
