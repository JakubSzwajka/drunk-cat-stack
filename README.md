# drunk-cat-stack

drunk-cat-stack is config files you copy into a TypeScript repo so `npm run check` fails on structure rules instead of leaving them to review. It uses maintained tools as-is: Biome, ESLint with [`eslint-plugin-codebase-ai-rules`](https://github.com/JakubSzwajka/eslint-plugin-codebase-ai-rules), TypeScript, and Dependency Cruiser. CI runs `npm ci` and `npm run check`, nothing else.

It is a GitHub template. Create a repo from it with `gh repo create <name> --template JakubSzwajka/drunk-cat-stack`.

## What is enforced

| Rule | Tool | Config file | Change when adapting |
| --- | --- | --- | --- |
| Formatting: spaces, indent 2, line width 100 | Biome formatter | `biome.json` | Your house style, if different |
| No `export *` | Biome `noReExportAll` | `biome.json` | Nothing |
| No non-null assertions (`x!`) | Biome `noNonNullAssertion` | `biome.json` | Nothing |
| Filename is kebab-case or matches an export | Biome `useFilenamingConvention` | `biome.json` | Nothing |
| Files over 300 lines (warn only) | Biome `noExcessiveLinesPerFile` | `biome.json` | `maxLines`, if you want another limit |
| Comments are one line and sit inside a function or class body; tool directives excepted | ESLint `codebase-ai-rules/comment-discipline` | `eslint.config.mjs` | The `ignores` list; the plugin commit pin in `package.json` |
| Strict types | TypeScript `strict` | `tsconfig.base.json` | Nothing |
| No import cycles | Dependency Cruiser `no-cycles` | `.dependency-cruiser.cjs` | Nothing |
| Delivery and server never import each other | Dependency Cruiser `delivery-does-not-import-server`, `server-does-not-import-delivery` | `.dependency-cruiser.cjs` | `DELIVERY_ROOT`, `SERVER_ROOT` |
| Use-cases never import delivery or server | Dependency Cruiser `use-cases-do-not-import-outer-layers` | `.dependency-cruiser.cjs` | `USE_CASES_ROOT` |
| Modules never import use-cases, delivery, or server | Dependency Cruiser `modules-do-not-import-outer-layers` | `.dependency-cruiser.cjs` | `MODULES_ROOT` |
| Callers import the bookings module only through `index.ts` | Dependency Cruiser `bookings-public-entry-only` | `.dependency-cruiser.cjs` | Rename per module, set `BOOKINGS_MODULE_ROOT` |
| No deep package imports such as `@hosti/bookings/internal/x` | Dependency Cruiser `no-unresolved-deep-package-imports` | `.dependency-cruiser.cjs` | `PACKAGE_NAMESPACE` |
| No unresolved imports | Dependency Cruiser `no-unresolved-imports` | `.dependency-cruiser.cjs` | Nothing |
| Production code never imports test files | Dependency Cruiser `production-does-not-import-tests` | `.dependency-cruiser.cjs` | `SOURCE_ROOT`, `TEST_PATH` |

Biome, ESLint, and Dependency Cruiser all skip `node_modules`, `dist`, `coverage`, and `generated`.

## Review only

No tool here can check these without guessing:

- whether a one-line comment gives a real reason or just restates the code (ESLint checks the comment's place and shape, not its meaning);
- error design and one-time delivery mapping;
- whether a cast has an allowed intent;
- folder naming, sibling counts, grouping, module depth, and seam placement;
- test placement, and whether a module's own tests use only its interface;
- whether a frontend library solves a named pain;
- React semantics beyond the filename matching an export;
- compiler option changes, because TypeScript accepts `strict: true` next to `strictNullChecks: false`.

## Adapt it

1. Copy `biome.json`, `eslint.config.mjs`, `tsconfig.base.json`, `.dependency-cruiser.cjs`, and `.github/workflows/ci.yml`.
2. Copy the `scripts` and `devDependencies` from `package.json`. Keep the plugin pinned to a full commit SHA. To upgrade, change the SHA and run `npm install`.
3. Set the constants at the top of `.dependency-cruiser.cjs`: `SOURCE_ROOT`, `DELIVERY_ROOT`, `SERVER_ROOT`, `USE_CASES_ROOT`, `MODULES_ROOT`, `BOOKINGS_MODULE_ROOT`, `PACKAGE_NAMESPACE`, `TSCONFIG`, and `TEST_PATH` if your tests live elsewhere. Keep `(?:/|$)` at the end of each root, so `modules-legacy` does not count as `modules`.
4. Copy `bookings-public-entry-only` once per module that hides its internals, with its own root constant. One regular expression cannot compare source and target module names.
5. Map each public alias in your `tsconfig.json`, the way this repo maps `@hosti/bookings` to `modules/bookings/index.ts`. Add no deep alias.
6. Run `npm install`, then `npm run check`.

TypeScript stays on 6.0.3 because Dependency Cruiser 18.4.0 skips the TypeScript import graph on TypeScript 7. Recheck when Dependency Cruiser supports 7.

## Example

[`examples/hosti-before`](examples/hosti-before/README.md) holds code that fails each check, as Markdown snippets so this repo stays green.

[`examples/hosti-after`](examples/hosti-after) is real code that passes. Its layers point inward:

```text
delivery ─┐
          ├─> use-cases ─> modules
server ───┘          └───> modules
```

## Commands

```sh
npm ci
npm run check
npm run format
```
