# codebase-ai-rules

A small, copyable setup for the deterministic parts of a TypeScript code-structure playbook. It uses maintained tools as-is: Biome, TypeScript, Dependency Cruiser, npm, and GitHub Actions. There is no package to publish and no custom checker to maintain.

## The split

`npm run check` is the local contract. CI only installs dependencies and runs it.

| Level | Rule | Owner |
| --- | --- | --- |
| Enforce | no non-null assertions | Biome `noNonNullAssertion` |
| Enforce | curated barrels, no `export *` | Biome `noReExportAll` |
| Enforce | kebab-case filename or a filename matching an export | Biome `useFilenamingConvention` |
| Enforce | type safety | TypeScript `strict` |
| Enforce | no cycles | Dependency Cruiser `no-cycles` |
| Enforce | delivery and server stay separate; both may call use-cases and modules; use-cases may call modules; modules stay innermost | Dependency Cruiser layer rules |
| Enforce | callers use the bookings module's public entry | Dependency Cruiser `bookings-public-entry-only` |
| Enforce | unresolved deep package specifiers such as `@hosti/bookings/internal/x` fail | Dependency Cruiser `no-unresolved-deep-package-imports` |
| Enforce | all other unresolved imports fail | Dependency Cruiser `no-unresolved-imports` |
| Enforce | production under `SOURCE_ROOT` does not import `/tests/`, `/__tests__/`, `.test.*`, or `.spec.*` files | Dependency Cruiser `production-does-not-import-tests` |
| Warn | files over 300 lines | Biome `noExcessiveLinesPerFile` |

The formatter is also part of `biome check`. `biome.json` excludes only the explicit generated roots `node_modules`, `dist`, `coverage`, and `generated`; it does not inherit broad ignore patterns.

Review still owns rules that these tools cannot prove without guesswork:

- whether comments explain a decision instead of restating code;
- error design and one-time delivery mapping;
- whether a cast has an allowed intent;
- folder naming, sibling counts, useful grouping, module depth, and seam placement;
- test placement and whether a module's own tests use only its interface;
- whether a frontend library solves named pain;
- React semantics beyond the filename matching an export.

TypeScript also permits `strict: true` beside a constituent option set to `false`, such as `strictNullChecks: false`. This repository does not pretend otherwise. Review changes to compiler options; add a shared guard only when maintaining one becomes justified.

## Copy it

1. Copy `biome.json`, `tsconfig.base.json`, `.dependency-cruiser.cjs`, the scripts and dev dependencies from `package.json`, and the workflow if the repository uses GitHub Actions.
2. Change every repository-specific constant at the top of `.dependency-cruiser.cjs`. Set `SOURCE_ROOT`, `DELIVERY_ROOT`, `SERVER_ROOT`, `USE_CASES_ROOT`, `MODULES_ROOT`, `BOOKINGS_MODULE_ROOT`, `PACKAGE_NAMESPACE`, and `TSCONFIG`. Keep `(?:/|$)` at the end of each filesystem root so names such as `modules-legacy` do not enter the `modules` layer. Review `TEST_PATH` if the repository uses different test conventions.
3. Rename `bookings-public-entry-only` for the real module and set its module root. Duplicate the rule and root constant for each module whose private implementation must stay hidden. Dependency Cruiser cannot compare arbitrary source and target module names in one regular expression, so each module root is explicit.
4. Put each public package-style alias in the project's example or main tsconfig. The checked example maps `@hosti/bookings` to `modules/bookings/index.ts` and deliberately provides no deep alias.
5. Run `npm install`, then `npm run check`.

The `deps` script scans `.` so its command has no repository-specific path. The config excludes `node_modules`, `dist`, `coverage`, and `generated` at any depth, and skips analysis that no rule needs.

Use current stable releases compatible with the repository's Node version when copying. This example requires Node 22.13.0 or later on the Node 22 release line, and CI requests the current Node 22 release. TypeScript is pinned to 6.0.3 because Dependency Cruiser 18.4.0 supports TypeScript below 7; with TypeScript 7 it warns and skips the TypeScript import graph. Recheck that limit when Dependency Cruiser adds TypeScript 7 support.

## Example

[`examples/hosti-before`](examples/hosti-before/README.md) shows an outer server layer importing delivery, a deep package import, a non-null assertion, re-export-all, and a component filename/export mismatch. The snippets stay in Markdown so the repository remains green.

[`examples/hosti-after`](examples/hosti-after) is real `.ts` and `.tsx`. It puts the bookings interface at `modules/bookings/index.ts`, keeps the implementation private, and handles absence. Its configured direction is:

```text
delivery ─┐
          ├─> use-cases ─> modules
server ───┘          └───> modules
```

`delivery` contains inbound HTTP or UI code. `server` is a separate outer layer for host-side adapters and wiring. Neither outer layer may import the other. Use-cases may compose module interfaces, but may not import delivery or server code. Modules may not import use-cases, delivery, or server code. TypeScript and Dependency Cruiser check this code on every run.

## Commands

```sh
npm ci
npm run check
npm run format
```

The workflow is intentionally thin. Change the npm scripts once and local development and CI run the same contract.
