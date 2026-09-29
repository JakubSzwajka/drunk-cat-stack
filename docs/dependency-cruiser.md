# Dependency Cruiser layout preset

Import path: `eslint-plugin-codebase-ai-rules/dependency-cruiser`

This preset is not an ESLint preset. It is a [Dependency Cruiser](https://github.com/sverweij/dependency-cruiser) configuration for a workspace monorepo with apps under `apps/` and packages under `packages/`. The `layout(options)` factory returns a whole config object, `forbidden` rules and `options` together, that a `.dependency-cruiser.cjs` file can export as-is. With the defaults and `scope: "@hosti/"` it returns exactly drunk-cat-stack's hand-written `.dependency-cruiser.cjs`. A test checks that.

```js
// .dependency-cruiser.cjs
module.exports = require("eslint-plugin-codebase-ai-rules/dependency-cruiser").layout({ scope: "@acme/" });
```

Run it with the Dependency Cruiser CLI:

```sh
npx depcruise --config .dependency-cruiser.cjs apps packages
```

The file is CommonJS and loads no other module. `require()` and `import` both work, and neither loads ESLint, `@eslint/css`, or `@eslint/markdown`. Dependency Cruiser is an optional peer dependency (`^18.4.0`), so install it yourself:

```sh
npm install --save-dev --save-exact dependency-cruiser@18.4.0
```

## Expected layout

```text
apps/<app>/src/delivery/       delivery layer
apps/<app>/src/server/         server layer
apps/<app>/src/use-cases/      use-cases layer
packages/<pkg>/src/index.ts    the one public entry of a package
packages/<pkg>/src/internal/   private package code
<workspace>/src/**/tests/*.test.ts   tests, directly inside a tests folder under src/
```

Every folder name above is an option. The `src` segment is fixed.

## Options

| Option | Default | Meaning |
| --- | --- | --- |
| `scope` | required | npm scope of the workspace packages, such as `"@acme/"`. A missing trailing `/` is added. Used by `no-unresolved-deep-package-imports`. |
| `appsDir` | `"apps"` | Folder that holds the apps. |
| `packagesDir` | `"packages"` | Folder that holds the packages. |
| `layers.delivery` | `"delivery"` | Delivery folder under `<app>/src/`. |
| `layers.server` | `"server"` | Server folder under `<app>/src/`. |
| `layers.useCases` | `"use-cases"` | Use-cases folder under `<app>/src/`. |
| `publicEntry` | `"src/index.ts"` | The only file of a package that another workspace may import. |
| `internalDir` | `"src/internal"` | Private package code that tests may not import. |
| `testsDir` | `"tests"` | Name of the folder every test file must sit in directly, somewhere under `<workspace>/src/`. It also counts as a test path for `production-does-not-import-tests`, next to `test`, `tests`, and `__tests__`. |

Option values are folder names and paths, not regular expressions. The factory escapes them. Each layer root ends in `(?:/|$)`, so `delivery-legacy` is not `delivery`. An unknown option or layer name throws, and so does a path that is empty or starts or ends with `/`.

## Rules

All 13 rules run at error level.

| Rule | Reports |
| --- | --- |
| `no-cycles` | Any import cycle. |
| `packages-do-not-import-apps` | A package importing app code. |
| `apps-do-not-import-other-apps` | An app importing another app. |
| `packages-imported-by-name` | A relative-path import into another package. Import it by its package name. |
| `packages-public-entry-only` | Another workspace reaching a package file other than its `publicEntry`. |
| `delivery-does-not-import-server` | Delivery code importing server code. |
| `server-does-not-import-delivery` | Server code importing delivery code. |
| `use-cases-do-not-import-outer-layers` | Use-cases code importing delivery or server code. |
| `no-unresolved-deep-package-imports` | An unresolved deep import such as `@acme/bookings/internal/x`. |
| `production-does-not-import-tests` | Source code under `src/` importing a test file or anything in a test folder. |
| `no-unresolved-imports` | Any import that does not resolve, including a workspace package the importer does not declare. |
| `tests-live-in-tests-dir` | A `*.test.*` or `*.spec.*` file in a workspace that does not sit directly in a `testsDir` folder under `src/`. A package-root `tests/`, a subfolder of `tests/`, and `unit-tests/` all fail. |
| `tests-do-not-import-internals` | A test file, or a file in a test folder, importing `packages/<pkg>/src/internal/`. Test through the public entry. |

A deep import that does not resolve fires both `no-unresolved-deep-package-imports` and `no-unresolved-imports`. That is intended: the first names the cause.

`tests-live-in-tests-dir` is a module rule, so it reports the test file itself. A dependency rule would miss a test that imports nothing, or only a `node_modules` package such as `@effect/vitest`, because the excluded `node_modules` leaves such a test with no dependencies to match. Dependency Cruiser has no plain "every module" condition, so the rule uses `numberOfDependentsLessThan: 100`, which every test file meets.

## Dependency Cruiser options

The returned `options` block:

- parses with SWC (`parser: "swc"`). Install `@swc/core` for that. Without it, Dependency Cruiser falls back to its other parsers.
- skips `node_modules`, `dist`, `coverage`, `generated`, `.turbo`, and `.agent_sources`, and does not follow `node_modules`.
- sets `skipAnalysisNotInRules: true` and `tsPreCompilationDeps: "specify"`.
- resolves packages through their `exports` field, with the `import`, `require`, `node`, and `default` conditions.

## Adding project rules

`layout()` returns a fresh object on every call. Append your own rules to `forbidden`, or change `options`:

```js
// .dependency-cruiser.cjs
const { layout } = require("eslint-plugin-codebase-ai-rules/dependency-cruiser");

const config = layout({ scope: "@acme/", layers: { useCases: "application" } });
config.forbidden.push({
  name: "no-lodash",
  severity: "error",
  from: {},
  to: { path: "^node_modules/lodash/" },
});
module.exports = config;
```
