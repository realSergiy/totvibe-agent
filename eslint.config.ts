import { totvibe } from '@totvibe/eslint-config';
import { defineConfig } from 'eslint/config';

export default defineConfig(
  ...totvibe({
    ignores: ['reference_clones/**', '**/.tsbuild/**', 'packages/sandbox/**/target/**'],
    react: true,
    tsconfigRootDir: import.meta.dirname,
  }),
  { settings: { react: { version: '19.0' } } },
  {
    files: ['**/*.{ts,tsx,js,mjs,cjs}'],
    rules: {
      'unicorn/filename-case': ['error', { cases: { camelCase: true, kebabCase: true, pascalCase: true } }],
    },
  },
  {
    files: ['apps/tui/src/**/*.{ts,tsx}'],
    rules: { 'react/no-unknown-property': 'off' },
  },
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          message: 'Use an arrow function. If `this`/`arguments`/`new.target`/generators are needed, redesign.',
          selector: 'FunctionDeclaration[generator=false]',
        },
        {
          message: 'Use an arrow function. If `this`/`arguments`/`new.target`/generators are needed, redesign.',
          selector: ':not(MethodDefinition, Property[method=true]) > FunctionExpression[generator=false]',
        },
      ],
    },
  },
);
