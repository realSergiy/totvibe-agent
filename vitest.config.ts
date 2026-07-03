import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    deps: { interopDefault: false },
    projects: [
      {
        extends: true,
        test: {
          include: ['tests/src/tui/**/*.test.{ts,tsx}', 'tests/src/wire.test.ts'],
          name: 'tui',
        },
      },
      {
        extends: true,
        test: {
          environment: 'happy-dom',
          include: ['tests/src/web/**/*.test.{ts,tsx}'],
          name: 'web',
        },
      },
    ],
    restoreMocks: true,
    unstubEnvs: true,
    unstubGlobals: true,
  },
});
