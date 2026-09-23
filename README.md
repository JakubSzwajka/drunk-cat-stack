# drunk-cat-stack

drunk-cat-stack is config files you copy into a TypeScript repo so `npm run check` fails on structure rules instead of leaving them to review. It uses maintained tools as-is: Biome, ESLint with [`eslint-plugin-codebase-ai-rules`](https://github.com/JakubSzwajka/eslint-plugin-codebase-ai-rules), TypeScript 7 with the Effect language service ([`@effect/tsgo`](https://github.com/Effect-TS/tsgo)), Dependency Cruiser, Vitest, and [varlock](https://varlock.dev) for the environment. The example code is written in [Effect 4](https://effect.website). CI runs `npm ci`, `npm run check`, and `npm test`, nothing else. A [fence](#fence) stops agents from skipping those checks at commit time.

It is a GitHub template. Create a repo from it with `gh repo create <name> --template JakubSzwajka/drunk-cat-stack`.

## What is enforced

| Rule | Tool | Config file | Change when adapting |
| --- | --- | --- | --- |
| Every dependency is an exact version or a full commit SHA | `scripts/check-exact-pins.mjs` | `package.json`, `.npmrc` | Nothing |
| Every declared environment variable resolves and matches its type | varlock `load` (`npm run env:check`) | `.env.schema`, `.varlock/config.json` | The variables in `.env.schema` |
| Formatting: spaces, indent 2, line width 100 | Biome formatter | `biome.json` | Your house style, if different |
| No `export *` | Biome `noReExportAll` | `biome.json` | Nothing |
| No non-null assertions (`x!`) | Biome `noNonNullAssertion` | `biome.json` | Nothing |
| Filename is kebab-case or matches an export | Biome `useFilenamingConvention` | `biome.json` | Nothing |
| Files over 300 lines (warn only) | Biome `noExcessiveLinesPerFile` | `biome.json` | `maxLines`, if you want another limit |
| Comments are one line and sit inside a function or class body; tool directives excepted | ESLint `codebase-ai-rules/comment-discipline` | `eslint.config.mjs` | The `ignores` list; the plugin commit pin in `package.json` |
| Strict types, plus `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `erasableSyntaxOnly` | TypeScript 7 | `tsconfig.base.json` | Nothing |
| No floating Effects, in code or in Vitest callbacks | Effect diagnostics `floatingEffect`, `floatingEffectInVitest` | `tsconfig.base.json` plugin block | Nothing |
| Expected errors are typed: no global `Error`, `unknown`, or `any` in an Effect error channel; no try/catch in `Effect.gen` | Effect diagnostics `globalErrorInEffectFailure`, `globalErrorInEffectCatch`, `unknownInEffectCatch`, `anyUnknownInErrorContext`, `tryCatchInEffectGen` | `tsconfig.base.json` plugin block | Nothing |
| No `Effect.run*` inside Effect code, and no Effect returned from a generator | Effect diagnostics `runEffectInsideEffect`, `returnEffectInGen` | `tsconfig.base.json` plugin block | Nothing |
| Requirements and errors are handled, and services do not leak their dependencies | Effect diagnostics `missingEffectContext`, `missingEffectError`, `missingLayerContext`, `leakingRequirements`, `unsafeEffectTypeAssertion` | `tsconfig.base.json` plugin block | Nothing |
| No `async`, `new Promise`, global `console`, `Date`, `fetch`, `Math.random`, timers, `crypto.randomUUID`, or Node built-ins that Effect replaces | Effect diagnostics `asyncFunction`, `newPromise`, `global*`, `cryptoRandomUUID*`, `nodeBuiltinImport` | `tsconfig.base.json` plugin block | Nothing |
| No sync Schema calls inside Effect code, no `instanceof` on a Schema | Effect diagnostics `schemaSyncInEffect`, `instanceOfSchema` | `tsconfig.base.json` plugin block | Nothing |
| No import cycles | Dependency Cruiser `no-cycles` | `.dependency-cruiser.cjs` | Nothing |
| Delivery and server never import each other | Dependency Cruiser `delivery-does-not-import-server`, `server-does-not-import-delivery` | `.dependency-cruiser.cjs` | `DELIVERY_ROOT`, `SERVER_ROOT` |
| Use-cases never import delivery or server | Dependency Cruiser `use-cases-do-not-import-outer-layers` | `.dependency-cruiser.cjs` | `USE_CASES_ROOT` |
| Modules never import use-cases, delivery, or server | Dependency Cruiser `modules-do-not-import-outer-layers` | `.dependency-cruiser.cjs` | `MODULES_ROOT` |
| Callers import the bookings module only through `index.ts` | Dependency Cruiser `bookings-public-entry-only` | `.dependency-cruiser.cjs` | Rename per module, set `BOOKINGS_MODULE_ROOT` |
| No deep package imports such as `@hosti/bookings/internal/x` | Dependency Cruiser `no-unresolved-deep-package-imports` | `.dependency-cruiser.cjs` | `PACKAGE_NAMESPACE` |
| No unresolved imports | Dependency Cruiser `no-unresolved-imports` | `.dependency-cruiser.cjs` | Nothing |
| Production code never imports test files | Dependency Cruiser `production-does-not-import-tests` | `.dependency-cruiser.cjs` | `SOURCE_ROOT`, `TEST_PATH` |
| The fence behaves as documented | Node test runner over `tests/**/*.test.mjs` (`npm test`) | `package.json` | Nothing |
| Example code behaves as documented, with Effects run only by `it.effect` and `it.layer` | Vitest with `@effect/vitest` (`npm test`) | `vitest.config.ts` | `test.include` |

Biome, ESLint, and Dependency Cruiser all skip `node_modules`, `dist`, `coverage`, `generated`, and `.agent_sources`.

## TypeScript 7 and Effect

TypeScript is pinned to 7.0.2. The Effect diagnostics come from `@effect/tsgo`, which targets that version. `npm ci` runs `prepare`, and `prepare` runs `effect-tsgo patch` before `lefthook install`. The patch puts the Effect language service into the installed `tsc`, so `npm run typecheck` fails on the Effect diagnostics set to `error` in `tsconfig.base.json`. If `tsc` stops reporting Effect errors, run `npx effect-tsgo patch` again.

Two tools do not speak TypeScript 7 yet:

- **Dependency Cruiser 18.4.0** supports TypeScript below 7. It parses with SWC instead (`parser: "swc"` and an exact `@swc/core`). It still reads `tsconfig.json` for the path aliases, so the alias rules fire as before. Each run prints a `missing-typescript-transpiler` warning. The warning is expected: it means the `tsc` parser is unavailable, and SWC reads the TypeScript sources in its place.
- **`@typescript-eslint/parser` 8.70.1**, which the comment plugin uses, peers on TypeScript below 6.1 and loads the TypeScript compiler API at runtime. The `overrides` block in `package.json` gives the plugin's subtree its own TypeScript 6.0.3. The root keeps 7.0.2. ESLint still checks comments in `.js`, `.mjs`, `.cjs`, `.ts`, and `.tsx` files. Drop the override when the parser accepts TypeScript 7.

Effect 4 is a release candidate. `effect` and `@effect/vitest` share one exact version, and they move together. Vitest is pinned to 5.0.1, the major `@effect/vitest` accepts.

`npm run vendor:agent-sources` shallow-clones the Effect repository at the tag that matches the pinned `effect` version into `.agent_sources/`, which git ignores. Agents read it for API shape. It is not part of `npm run check`.

## Environment

`.env.schema` declares every environment variable the code reads. It holds no secret values. Local values, secrets included, go in `.env.local`, which git ignores. `npm run env:check` runs `varlock load`, which checks each variable against its type and fails when a required one is empty. It runs inside `npm run check`, right after the pin check. Varlock prints the resolved values and hides the ones marked `@sensitive`.

Run a command with the values injected:

```sh
npx varlock run -- <cmd>
```

Every variable starts as optional and sensitive (`@defaultRequired=false`, `@defaultSensitive=true`). CI has no `.env.local`, so a required variable needs a default in the schema or a value set in CI.

Varlock sends anonymous usage data by default. `.varlock/config.json` turns that off for this repo. To confirm, run `DEBUG=varlock:telemetry npx varlock load` and look for `telemetry opted out - config file (project config)`.

Type generation (`varlock codegen`) is off. Nothing here reads the environment yet, and a generated file would have to exist before `tsc` runs.

## Review only

No tool here can check these without guessing:

- whether a one-line comment gives a real reason or just restates the code (ESLint checks the comment's place and shape, not its meaning);
- error design beyond the typing rules, and whether delivery maps errors in one place;
- whether a test calls `Effect.run*` outside Effect code instead of using `it.effect` (the diagnostics catch it only inside Effect code);
- whether all Effect packages share one version (pins only checks that each is exact);
- whether a cast has an allowed intent;
- folder naming, sibling counts, grouping, module depth, and seam placement;
- test placement, and whether a module's own tests use only its interface;
- whether a frontend library solves a named pain;
- React semantics beyond the filename matching an export;
- compiler option changes, because TypeScript accepts `strict: true` next to `strictNullChecks: false`.

## Fence

lefthook runs `npm run check` and then `npm test` before each commit. `git commit --no-verify` would skip that, so the agent harnesses block it before the shell runs it.

```text
git commit ──> lefthook pre-commit ──> npm run check ──> npm test

agent bash call
  Claude Code  .claude/settings.json PreToolUse ─> scripts/hooks/block-git-no-verify.mjs ─┐
  Pi           .pi/extensions/git-interceptor.ts tool_call ──────────────────────────────┤
                                                                                        v
                                                          scripts/vcs-command-policy.mjs
                                                            bypass    ─> deny, with reason
                                                            git or jj ─> allow
```

The policy blocks a `git` command that contains `--no-verify` or `core.hooksPath`, a `git commit` with `-n`, and any command that sets `LEFTHOOK=0`. It matches `--no-verify` anywhere in a `git` command, so `git commit -m "skip --no-verify"` is blocked too. The shell strips the quotes from `"--no-verify"` and passes a real flag, and telling a flag from message text is not worth the risk. Reword the message. `echo --no-verify` and `git merge --no-verify-signatures` pass. `tests/` holds the full case list.

In Pi, the extension also prefixes every allowed `git` or `jj` call with no-op editors (`GIT_EDITOR=:` and the like), so a rebase or merge never waits on an editor nobody sees. The Claude Code hook only denies. A PreToolUse hook that rewrites a command must also answer allow, which skips the permission prompt, or ask, which prompts on every `git` call.

This raises the floor. It does not stop an agent that writes the command into a script file and runs that.

`npm run acceptance` clones the committed HEAD into a temp dir and runs `npm ci`, `npm run check`, and `npm test` there. It proves a cold clone works. It does not see uncommitted changes.

The fence is adapted from [rat-stack](https://github.com/joelhooks/rat-stack) by Joel Hooks, MIT. See `NOTICE`.

## Adapt it

1. Copy `biome.json`, `eslint.config.mjs`, `tsconfig.base.json`, `.dependency-cruiser.cjs`, `vitest.config.ts`, and `.github/workflows/ci.yml`.
2. Copy the `scripts`, `dependencies`, `devDependencies`, and `overrides` from `package.json`, plus the `engines` and `packageManager` fields. Keep the plugin pinned to a full commit SHA. To upgrade, change the SHA and run `npm install`. Keep every Effect package on the same version.
3. Copy `.env.schema` and `.varlock/config.json`, and the `.env` lines from `.gitignore`. Replace `APP_ENV` in `.env.schema` with the variables your code reads.
4. Copy the fence: `.npmrc`, `.nvmrc`, `lefthook.yml`, `scripts/`, `tests/`, `.claude/settings.json`, `.pi/extensions/git-interceptor.ts`, and `NOTICE`. Copy `skills/` and the `.agent_sources` line from `.gitignore` if your agents should use them.
5. Copy `AGENTS.md` and `CLAUDE.md`, then rewrite the layer rules in `AGENTS.md` for your project. Write your own `VISION.md`.
6. Set the constants at the top of `.dependency-cruiser.cjs`: `SOURCE_ROOT`, `DELIVERY_ROOT`, `SERVER_ROOT`, `USE_CASES_ROOT`, `MODULES_ROOT`, `BOOKINGS_MODULE_ROOT`, `PACKAGE_NAMESPACE`, `TSCONFIG`, and `TEST_PATH` if your tests live elsewhere. Keep `(?:/|$)` at the end of each root, so `modules-legacy` does not count as `modules`.
7. Copy `bookings-public-entry-only` once per module that hides its internals, with its own root constant. One regular expression cannot compare source and target module names.
8. Map each public alias in your `tsconfig.json`, the way this repo maps `@hosti/bookings` to `modules/bookings/index.ts`. Add no deep alias. Vitest reads the same aliases through `resolve.tsconfigPaths`. Point `include` in `tsconfig.json` and `test.include` in `vitest.config.ts` at your sources.
9. Run `npm install`, which patches `tsc` and installs the pre-commit hook. Then run `npm run check` and `npm test`.

To add a module the Effect way, follow [`skills/add-an-effect-module/SKILL.md`](skills/add-an-effect-module/SKILL.md).

## Example

[`examples/hosti-before`](examples/hosti-before/README.md) holds code that fails each check, as Markdown snippets so this repo stays green.

[`examples/hosti-after`](examples/hosti-after) is real code that passes. Its layers point inward:

```text
delivery ─┐
          ├─> use-cases ─> modules
server ───┘          └───> modules
```

The bookings module exposes a `Bookings` service and a typed `BookingNotFound` error through `modules/bookings/index.ts`. The `showBooking` use-case yields that service. The HTTP handler maps `BookingNotFound` to a 404 once, so its error channel is `never`. Tests sit beside each file and run under `it.effect`.

## Commands

```sh
npm ci
npm run check
npm run env:check
npm test
npm run fix
npm run format
npm run acceptance
npm run vendor:agent-sources
```
