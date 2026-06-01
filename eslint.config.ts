import { totvibe } from "@totvibe/eslint-config";

export default [
  ...totvibe({
    ignores: ["reference_clones/**", "**/.tsbuild/**", "packages/sandbox/**/target/**"],
    react: true,
    tsconfigRootDir: import.meta.dirname,
  }),
  { settings: { react: { version: "19.0" } } },
  {
    files: ["**/*.{ts,tsx,js,mjs,cjs}"],
    rules: {
      "unicorn/filename-case": [
        "error",
        { cases: { camelCase: true, kebabCase: true, pascalCase: true } },
      ],
    },
  },
  {
    files: ["apps/tui/src/**/*.{ts,tsx}"],
    rules: { "react/no-unknown-property": "off" },
  },
];
