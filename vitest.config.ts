import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    coverage: {
      enabled: true,
      include: ['packages/*/src/**'],
      provider: 'istanbul',
      thresholds: {
        branches: 90,
        functions: 90,
        lines: 90,
        statements: 90,
      },
    },
    deps: { interopDefault: false },
    projects: [
      {
        extends: true,
        test: {
          include: ['tests/tui/stories/**/*.test.{ts,tsx}'],
          name: 'tui',
        },
      },
      {
        extends: true,
        test: {
          environment: 'happy-dom',
          include: ['tests/web/stories/**/*.test.{ts,tsx}', 'tests/view/stories/**/*.test.{ts,tsx}'],
          name: 'web',
        },
      },
      {
        extends: true,
        test: {
          include: [
            'tests/core/stories/**/*.test.ts',
            'tests/protocol/stories/**/*.test.ts',
            'tests/runtime/stories/**/*.test.ts',
            'tests/safety/stories/**/*.test.ts',
            'tests/sandbox/stories/**/*.test.ts',
            'tests/tools/stories/**/*.test.ts',
          ],
          name: 'packages',
        },
      },
    ],
    restoreMocks: true,
    unstubEnvs: true,
    unstubGlobals: true,
  },
});
