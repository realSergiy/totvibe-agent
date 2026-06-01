# Roadmap: adopt @totvibe/eslint-config

Replace this repo's hand-maintained flat config with the shared
[`@totvibe/eslint-config`](https://www.npmjs.com/package/@totvibe/eslint-config)
preset. One `totvibe()` call bundles ESLint recommended, `typescript-eslint`
strict + stylistic (type-checked), `eslint-plugin-react` + hooks, perfectionist
(import/object sorting), unicorn, the custom `@totvibe/*` rules, and
`eslint-config-prettier`. The preset ships as TypeScript source and is loaded
through `jiti` (already a dependency).

## Prerequisites

The preset peer-requires `eslint ^10` (already satisfied) and `typescript ^6`.
Bump TypeScript first — the repo is on `^5`:

```bash
bun add -d typescript@^6
```

## Install

```bash
bun add -d @totvibe/eslint-config
```

`eslint`, `jiti`, and `prettier` stay. `@eslint/js` and `typescript-eslint` are
now pulled in by the preset and can be dropped:

```bash
bun remove @eslint/js typescript-eslint
```

## Replace `eslint.config.ts`

Before — the hand-rolled config:

```ts
import eslint from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import tseslint from "typescript-eslint";

export default defineConfig(
  globalIgnores([
    "reference_clones/**",
    "**/node_modules/**",
    "**/.tsbuild/**",
    "packages/sandbox/**/target/**",
  ]),
  eslint.configs.recommended,
  tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
  },
  { files: ["**/*.js", "**/*.mjs", "**/*.cjs"], extends: [tseslint.configs.disableTypeChecked] },
);
```

After:

```ts
import { totvibe } from "@totvibe/eslint-config";

export default totvibe({
  ignores: ["reference_clones/**", "**/.tsbuild/**", "packages/sandbox/**/target/**"],
  react: true,
  tsconfigRootDir: import.meta.dirname,
});
```

`node_modules` is already in the preset's default ignores, so it leaves the
list. `react: true` enables the React + hooks rules for `apps/tui` and
`apps/web` (default `reactFiles: ["**/src/**/*.{ts,tsx}"]`). The repo uses
neither TanStack Router nor generated route trees, so leave `tanstack` off.

## Options

| option            | default                       | use                                                  |
| ----------------- | ----------------------------- | ---------------------------------------------------- |
| `tsconfigRootDir` | `process.cwd()`               | root for type-checked rules; set `import.meta.dirname` |
| `react`           | `false`                       | React + hooks rules                                  |
| `reactFiles`      | `["**/src/**/*.{ts,tsx}"]`    | narrow if non-React packages misfire                 |
| `tanstack`        | `false`                       | TanStack Router route-tree handling                  |
| `ignores`         | `[]`                          | appended to the preset's default ignores             |

## Expect stricter rules

The preset is tighter than the current config. Beyond strict type-checking, it
also enforces:

- arrow functions only — no `function` declarations or expressions
- no `as` assertions (`consistent-type-assertions: never`)
- `type` over `interface`
- sorted imports and object keys (perfectionist)
- unicorn rules, and the `@totvibe/*` rules (`no-type-predicate`,
  `no-inferrable-return-type`, `no-zod-custom`, `prefer-arrow-functions`)

Auto-fix the mechanical violations first, then resolve the rest by hand:

```bash
bun run lint:fix
bun run lint
```

## Centralize versions with a catalog

`@totvibe/eslint-config` pins its toolchain through a Bun
[catalog](https://bun.sh/docs/install/catalogs); this repo should do the same so
every app and package shares one version of each external dependency. Convert
`workspaces` from the array form to the object form and add a `catalog`:

```json
"workspaces": {
  "packages": ["apps/*", "packages/*"],
  "catalog": {
    "@ai-sdk/openai-compatible": "^2",
    "@happy-dom/global-registrator": "^20",
    "@opentui/core": "latest",
    "@opentui/react": "latest",
    "@testing-library/react": "^16",
    "@totvibe/eslint-config": "^0.1.0",
    "@types/bun": "latest",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "ai": "^6",
    "eslint": "^10.4.1",
    "jiti": "^2.7.0",
    "jotai": "^2",
    "knip": "^6.15.0",
    "prettier": "^3.8.3",
    "react": "^19",
    "react-dom": "^19",
    "typescript": "^6.0.3",
    "zod": "^4"
  }
}
```

Then replace the version specifier in every `package.json` with `catalog:`:

```json
"dependencies": {
  "jotai": "catalog:",
  "react": "catalog:",
  "react-dom": "catalog:"
}
```

Internal `@totvibe/*` packages keep `workspace:*`. `@eslint/js` and
`typescript-eslint` are gone once the preset is in (above), so they need no
catalog entry. Relink:

```bash
bun install
```

Afterward, bump a version once in the catalog and `bun install` moves every
workspace together.
