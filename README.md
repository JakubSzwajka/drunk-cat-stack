# drunk-cat-stack

drunk-cat-stack is a TypeScript monorepo template whose `pnpm check` fails on structure rules instead of leaving them to review. It is a [pnpm](https://pnpm.io) workspace run by [Turborepo](https://turborepo.com), with apps under `apps/` and packages under `packages/`. It uses maintained tools as-is: Biome, ESLint with [`eslint-plugin-codebase-ai-rules`](https://github.com/JakubSzwajka/eslint-plugin-codebase-ai-rules), TypeScript 7 with the Effect language service ([`@effect/tsgo`](https://github.com/Effect-TS/tsgo)), Dependency Cruiser, Vitest, and [varlock](https://varlock.dev) for the environment. The example code is written in [Effect 4](https://effect.website). CI runs `pnpm install --frozen-lockfile`, `pnpm check`, and `pnpm test`, nothing else. A [fence](#fence) stops agents from skipping those checks at commit time.

It is a GitHub template. Create a repo from it with `gh repo create <name> --template JakubSzwajka/drunk-cat-stack`.

## Layout

```text
.
├── apps/
│   └── api/                @hosti/api: delivery, server, use-cases
│       ├── src/delivery/
│       ├── src/use-cases/
│       ├── package.json    depends on "@hosti/bookings": "workspace:0.0.0"
│       └── tsconfig.json   extends ../../tsconfig.base.json
├── packages/
│   └── bookings/           @hosti/bookings: one Effect module
│       ├── src/index.ts    the only path in "exports"
│       ├── src/internal/   private to the package
│       ├── package.json
│       └── tsconfig.json   extends ../../tsconfig.base.json
├── pnpm-workspace.yaml     workspace folders and install policy
├── turbo.json              typecheck and test order
└── tsconfig.base.json      compiler flags and Effect diagnostics
```

`pnpm check` runs the root-level tools once: pins, varlock, Biome, ESLint, and Dependency Cruiser over the whole repo. It runs `typecheck` in each workspace package through Turborepo. `pnpm test` runs the fence tests once, then `test` in each workspace package through Turborepo.

```text
pnpm check ─> pins ─> env:check ─> biome ─> lint ─> turbo run typecheck ─> deps
                                                     ├─ @hosti/bookings typecheck
                                                     └─ @hosti/api typecheck (after bookings)

pnpm test  ─> node --test tests/ ─> turbo run test
                                     ├─ @hosti/bookings typecheck ─> test
                                     └─ @hosti/api typecheck ─> test
```

Packages export TypeScript source, so there is no build step. Turborepo caching is off for `typecheck` and `test`: a gate always runs.

## What is enforced

| Rule | Tool | Config file | Change when adapting |
| --- | --- | --- | --- |
| Every dependency in the root and in each workspace `package.json` is an exact version, a full commit SHA, or `workspace:<exact>`; `packageManager` is exact | `scripts/check-exact-pins.mjs` | `package.json`, `apps/*/package.json`, `packages/*/package.json`, `pnpm-workspace.yaml` (`saveExact`) | Nothing |
| No dependency younger than one day, except listed exact versions | pnpm `minimumReleaseAge` | `pnpm-workspace.yaml` | `minimumReleaseAgeExclude` when you pin a version younger than a day, such as a new Effect RC |
| No dependency runs an install script unless approved | pnpm `allowBuilds` (unlisted scripts fail the install) | `pnpm-workspace.yaml` | Nothing |
| A dependency's engines must match | pnpm `engineStrict` | `pnpm-workspace.yaml` | Nothing |
| Every declared environment variable resolves and matches its type | varlock `load` (`pnpm env:check`) | `.env.schema`, `.varlock/config.json` | The variables in `.env.schema` |
| Formatting: spaces, indent 2, line width 100 | Biome formatter | `biome.json` | Your house style, if different |
| No `export *` | Biome `noReExportAll` | `biome.json` | Nothing |
| No non-null assertions (`x!`) | Biome `noNonNullAssertion` | `biome.json` | Nothing |
| Filename is kebab-case or matches an export | Biome `useFilenamingConvention` | `biome.json` | Nothing |
| Files over 300 lines (warn only) | Biome `noExcessiveLinesPerFile` | `biome.json` | `maxLines`, if you want another limit |
| Comments are one line and sit inside a function or class body; tool directives excepted | ESLint `codebase-ai-rules/comment-discipline` | `eslint.config.mjs` | The `ignores` list; the plugin commit pin in `package.json` |
| Strict types, plus `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `erasableSyntaxOnly`, in every workspace package | TypeScript 7, run by `turbo run typecheck` | `tsconfig.base.json`, each package's `tsconfig.json`, `turbo.json` | Nothing |
| No floating Effects, in code or in Vitest callbacks | Effect diagnostics `floatingEffect`, `floatingEffectInVitest` | `tsconfig.base.json` plugin block | Nothing |
| Expected errors are typed: no global `Error`, `unknown`, or `any` in an Effect error channel; no try/catch in `Effect.gen` | Effect diagnostics `globalErrorInEffectFailure`, `globalErrorInEffectCatch`, `unknownInEffectCatch`, `anyUnknownInErrorContext`, `tryCatchInEffectGen` | `tsconfig.base.json` plugin block | Nothing |
| No `Effect.run*` inside Effect code, and no Effect returned from a generator | Effect diagnostics `runEffectInsideEffect`, `returnEffectInGen` | `tsconfig.base.json` plugin block | Nothing |
| Requirements and errors are handled, and services do not leak their dependencies | Effect diagnostics `missingEffectContext`, `missingEffectError`, `missingLayerContext`, `leakingRequirements`, `unsafeEffectTypeAssertion` | `tsconfig.base.json` plugin block | Nothing |
| No `async`, `new Promise`, global `console`, `Date`, `fetch`, `Math.random`, timers, `crypto.randomUUID`, or Node built-ins that Effect replaces | Effect diagnostics `asyncFunction`, `newPromise`, `global*`, `cryptoRandomUUID*`, `nodeBuiltinImport` | `tsconfig.base.json` plugin block | Nothing |
| No sync Schema calls inside Effect code, no `instanceof` on a Schema | Effect diagnostics `schemaSyncInEffect`, `instanceOfSchema` | `tsconfig.base.json` plugin block | Nothing |
| No import cycles | Dependency Cruiser `no-cycles` | `.dependency-cruiser.cjs` | Nothing |
| A package never imports an app | Dependency Cruiser `packages-do-not-import-apps` | `.dependency-cruiser.cjs` | `PACKAGES_ROOT`, `APPS_ROOT` |
| An app never imports another app | Dependency Cruiser `apps-do-not-import-other-apps` | `.dependency-cruiser.cjs` | `APP_ROOT` |
| Another package is imported by its name, never by a relative path | Dependency Cruiser `packages-imported-by-name` | `.dependency-cruiser.cjs` | `WORKSPACE_ROOT` |
| Callers reach another package only through its `src/index.ts` | Dependency Cruiser `packages-public-entry-only`, plus `exports` in each package's `package.json` | `.dependency-cruiser.cjs`, `packages/*/package.json` | `PUBLIC_ENTRY` |
| Delivery and server never import each other | Dependency Cruiser `delivery-does-not-import-server`, `server-does-not-import-delivery` | `.dependency-cruiser.cjs` | `DELIVERY_ROOT`, `SERVER_ROOT` |
| Use-cases never import delivery or server | Dependency Cruiser `use-cases-do-not-import-outer-layers` | `.dependency-cruiser.cjs` | `USE_CASES_ROOT` |
| No deep package imports such as `@hosti/bookings/internal/x` | Dependency Cruiser `no-unresolved-deep-package-imports` | `.dependency-cruiser.cjs` | `PACKAGE_NAMESPACE` |
| No unresolved imports, including a workspace package the importer does not declare | Dependency Cruiser `no-unresolved-imports` | `.dependency-cruiser.cjs` | Nothing |
| Production code never imports test files | Dependency Cruiser `production-does-not-import-tests` | `.dependency-cruiser.cjs` | `SOURCE_ROOT`, `TEST_PATH` |
| The fence behaves as documented | Node test runner over `tests/**/*.test.mjs` (`pnpm test`) | `package.json` | Nothing |
| Example code behaves as documented, with Effects run only by `it.effect` and `it.layer` | Vitest with `@effect/vitest` in each workspace package, run by `turbo run test` (`pnpm test`) | each package's `vitest.config.ts`, `turbo.json` | `test.include` |

Biome, ESLint, and Dependency Cruiser all skip `node_modules`, `dist`, `coverage`, `generated`, and `.agent_sources`. Dependency Cruiser also skips `.turbo`.

## TypeScript 7 and Effect

TypeScript is pinned to 7.0.2 in the root and in every workspace package. The Effect diagnostics come from `@effect/tsgo`, which targets that version. `pnpm install` runs the root `prepare` script, and `prepare` runs `effect-tsgo patch` before `lefthook install`. The patch moves the installed `tsc` binary aside and copies the Effect build in its place, so `pnpm run typecheck` fails on the Effect diagnostics set to `error` in `tsconfig.base.json`. All workspace packages link to the same TypeScript 7.0.2 install under `node_modules/.pnpm`, so one patch covers them all. If `tsc` stops reporting Effect errors, run `pnpm exec effect-tsgo patch` again.

Two tools do not speak TypeScript 7 yet:

- **Dependency Cruiser 18.4.0** supports TypeScript below 7. It parses with SWC instead (`parser: "swc"` and an exact `@swc/core`). It resolves `@hosti/bookings` through pnpm's `node_modules` symlink and the package's `exports`, so no path alias is needed. Each run prints a `missing-typescript-transpiler` warning. The warning is expected: it means the `tsc` parser is unavailable, and SWC reads the TypeScript sources in its place.
- **`@typescript-eslint/parser` 8.70.1**, which the comment plugin uses, peers on TypeScript below 6.1 and loads the TypeScript compiler API at runtime. The plugin does not depend on TypeScript itself, so a `plugin>typescript` override has nothing to rewrite. Instead `packageExtensions` in `pnpm-workspace.yaml` adds `typescript: 6.0.3` to the plugin's dependencies, and pnpm resolves the parser's peer from there. The root and every workspace package keep 7.0.2. `pnpm peers check` reports no issues. ESLint still checks comments in `.js`, `.mjs`, `.cjs`, `.ts`, and `.tsx` files. Drop the extension when the parser accepts TypeScript 7.

Effect 4 is a release candidate. `effect` and `@effect/vitest` share one exact version in every workspace package, and they move together. Vitest is pinned to 5.0.1, the major `@effect/vitest` accepts. A new Effect RC is often less than a day old, so it is the usual case for `minimumReleaseAgeExclude`, and a bump replaces its entries there.

`pnpm vendor:agent-sources` shallow-clones the Effect repository at the tag that matches the pinned `effect` version into `.agent_sources/`, which git ignores. It fails if the workspace packages pin different `effect` versions. Agents read it for API shape. It is not part of `pnpm check`.

## pnpm and Turborepo

pnpm is pinned by `packageManager` in `package.json` (`pnpm@12.5.1`). Corepack reads that field, so run `corepack enable` once and `pnpm` resolves to the pinned version. pnpm 12 reads project settings from `pnpm-workspace.yaml`, not `.npmrc`:

- `engineStrict` and `saveExact`, which were in `.npmrc`, plus `saveWorkspaceProtocol: true`, so `pnpm add <workspace package>` writes `workspace:<exact version>`;
- `minimumReleaseAge: 1440`, a supply-chain guard. Setting it explicitly makes the check strict, so any exact pin younger than a day fails the install. Either wait a day, or add a `minimumReleaseAgeExclude` entry for that exact version, with owner approval, and replace the entry when you bump. Today it lists the Effect RC pins;
- `allowBuilds`, where `@swc/core` and `lefthook` are set to `false`. `@swc/core` ships its native binary as an optional dependency; its script only adds a wasm fallback. lefthook's script runs `lefthook install`, which `prepare` already runs. pnpm fails an install that meets an install script not listed here;
- `packageExtensions`, for the ESLint plugin's TypeScript 6.

The install uses pnpm's default isolated `node_modules`. No hoisting setting is used.

Turborepo (`turbo@2.11.2`) runs `typecheck` and `test` in each workspace package. `typecheck` waits for the `typecheck` of the packages it depends on, and `test` waits for the same package's `typecheck`. Caching is off for both. Turborepo collects anonymous telemetry by default. The root scripts that call `turbo` set `TURBO_TELEMETRY_DISABLED=1`, and CI sets it for the whole job. Turborepo has no project config for this. If you run `turbo` by hand, run `pnpm exec turbo telemetry disable` once per machine.

`turbo@2.11.3` was the latest release when this was set up, but it was less than a day old, and its six platform binaries failed the release-age check. `2.11.2` is pinned instead.

## Environment

`.env.schema` declares every environment variable the code reads. It holds no secret values. Local values, secrets included, go in `.env.local`, which git ignores. `pnpm env:check` runs `varlock load`, which checks each variable against its type and fails when a required one is empty. It runs inside `pnpm check`, right after the pin check. Varlock prints the resolved values and hides the ones marked `@sensitive`.

Run a command with the values injected:

```sh
pnpm exec varlock run -- <cmd>
```

Every variable starts as optional and sensitive (`@defaultRequired=false`, `@defaultSensitive=true`). CI has no `.env.local`, so a required variable needs a default in the schema or a value set in CI.

Varlock sends anonymous usage data by default. `.varlock/config.json` turns that off for this repo. To confirm, run `DEBUG=varlock:telemetry pnpm exec varlock load` and look for `telemetry opted out - config file (project config)`.

Type generation (`varlock codegen`) is off. Nothing here reads the environment yet, and a generated file would have to exist before `tsc` runs.

## Review only

No tool here can check these without guessing:

- whether a one-line comment gives a real reason or just restates the code (ESLint checks the comment's place and shape, not its meaning);
- error design beyond the typing rules, and whether delivery maps errors in one place;
- whether a test calls `Effect.run*` outside Effect code instead of using `it.effect` (the diagnostics catch it only inside Effect code);
- whether all Effect packages share one version across the workspace (pins only checks that each is exact; `pnpm vendor:agent-sources` fails on a split `effect` pin, but it is not part of `check`);
- whether a cast has an allowed intent;
- folder naming, sibling counts, grouping, module depth, and seam placement, including whether a new capability should be its own package;
- test placement, and whether a module's own tests use only its interface;
- whether a frontend library solves a named pain;
- React semantics beyond the filename matching an export;
- compiler option changes, because TypeScript accepts `strict: true` next to `strictNullChecks: false`.

## Fence

lefthook runs `pnpm check` and then `pnpm test` before each commit. `git commit --no-verify` would skip that, so the agent harnesses block it before the shell runs it.

```text
git commit ──> lefthook pre-commit ──> pnpm check ──> pnpm test

agent bash call
  Claude Code  .agents/settings.json PreToolUse ─> scripts/hooks/block-git-no-verify.mjs ─┐
  Pi           .pi/extensions/git-interceptor.ts tool_call ──────────────────────────────┤
                                                                                        v
                                                          scripts/vcs-command-policy.mjs
                                                            bypass    ─> deny, with reason
                                                            git or jj ─> allow
```

The policy blocks a `git` command that contains `--no-verify` or `core.hooksPath`, a `git commit` with `-n`, and any command that sets `LEFTHOOK=0`. It matches `--no-verify` anywhere in a `git` command, so `git commit -m "skip --no-verify"` is blocked too. The shell strips the quotes from `"--no-verify"` and passes a real flag, and telling a flag from message text is not worth the risk. Reword the message. `echo --no-verify` and `git merge --no-verify-signatures` pass. `tests/` holds the full case list.

In Pi, the extension also prefixes every allowed `git` or `jj` call with no-op editors (`GIT_EDITOR=:` and the like), so a rebase or merge never waits on an editor nobody sees. The Claude Code hook only denies. A PreToolUse hook that rewrites a command must also answer allow, which skips the permission prompt, or ask, which prompts on every `git` call.

Pi is the harness this repo uses. Claude Code reads hooks only from `.claude/settings.json`, so it does not load `.agents/settings.json`. To turn the Claude Code block on, copy or link that file to `.claude/settings.json`.

This raises the floor. It does not stop an agent that writes the command into a script file and runs that.

`pnpm acceptance` clones the committed HEAD into a temp dir and runs `pnpm install --frozen-lockfile`, `pnpm check`, and `pnpm test` there. It fails if the install did not put the lefthook pre-commit hook in place. It proves a cold clone works. It does not see uncommitted changes.

The fence is adapted from [rat-stack](https://github.com/joelhooks/rat-stack) by Joel Hooks, MIT. See `NOTICE`.

## Adapt it

Start from the template, or copy the files into an existing pnpm workspace.

1. Copy the root config: `biome.json`, `eslint.config.mjs`, `tsconfig.base.json`, `.dependency-cruiser.cjs`, `turbo.json`, `pnpm-workspace.yaml`, and `.github/workflows/ci.yml`.
2. Copy the `scripts`, `devDependencies`, `engines`, and `packageManager` fields from the root `package.json`. Keep the plugin pinned to a full commit SHA. To upgrade, change the SHA and run `pnpm install`. Keep every Effect package on the same version in every workspace package.
3. Copy `.env.schema` and `.varlock/config.json`, and the `.env` lines from `.gitignore`. Replace `APP_ENV` in `.env.schema` with the variables your code reads.
4. Copy the fence: `.nvmrc`, `lefthook.yml`, `scripts/`, `tests/`, `.agents/settings.json`, `.pi/extensions/git-interceptor.ts`, and `NOTICE`. Copy `skills/` and the `.agent_sources` line from `.gitignore` if your agents should use them.
5. Copy `AGENTS.md`, then rewrite the workspace and layer rules in `AGENTS.md` for your project. Write your own `VISION.md`.
6. Rename the scope. Replace `@hosti/` in every `package.json` `name` and dependency, in the imports, in the `Context.Service` keys, and in `PACKAGE_NAMESPACE` in `.dependency-cruiser.cjs`. Then run `pnpm install` so the lockfile follows.
7. Check the constants at the top of `.dependency-cruiser.cjs`. The defaults match `apps/<name>/src/{delivery,server,use-cases}` and `packages/<name>/src/index.ts`. Change `DELIVERY_ROOT`, `SERVER_ROOT`, `USE_CASES_ROOT`, `PUBLIC_ENTRY`, or `TEST_PATH` if your folders differ. Keep `(?:/|$)` at the end of each root, so `delivery-legacy` does not count as `delivery`.
8. Run `pnpm install`, which patches `tsc` and installs the pre-commit hook. Then run `pnpm check` and `pnpm test`.

### Add an app

1. Create `apps/<name>/` with a `package.json` copied from `apps/api`: a new `name`, the same exact pins, and the `typecheck` and `test` scripts.
2. Copy `tsconfig.json` and `vitest.config.ts` from `apps/api`.
3. Put code under `src/delivery/`, `src/server/`, and `src/use-cases/`. The layer rules already match every app.
4. Add each package the app imports with `pnpm --filter <app name> add <package name>`. pnpm writes `workspace:<exact version>` because of `saveWorkspaceProtocol` and `saveExact`.
5. Run `pnpm install`, `pnpm check`, and `pnpm test`.

### Add a package

Follow [`skills/add-an-effect-module/SKILL.md`](skills/add-an-effect-module/SKILL.md). In short: create `packages/<name>/` from `packages/bookings`, keep `exports` to `"." : "./src/index.ts"`, keep private code under `src/internal/`, and run `pnpm install`. The dependency-cruiser rules already match every package.

## Example

[`examples/hosti-before`](examples/hosti-before/README.md) holds code that fails each check, as Markdown snippets so this repo stays green.

[`packages/bookings`](packages/bookings) and [`apps/api`](apps/api) are real code that passes. Dependencies point inward:

```text
apps/api
  delivery ───> use-cases ───> @hosti/bookings  (packages/bookings/src/index.ts)
      └──────────────────────> @hosti/bookings  (types only)
```

The bookings package exposes a `Bookings` service and a typed `BookingNotFound` error through `src/index.ts`, the only path in its `exports`. The `showBooking` use-case in `apps/api` yields that service. The HTTP handler maps `BookingNotFound` to a 404 once, so its error channel is `never`. `apps/api` has no server code yet, so the diagram shows none. The server layer rules still apply to `src/server/` once you add it. Tests sit beside each file and run under `it.effect`.

## Commands

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm check
pnpm env:check
pnpm test
pnpm fix
pnpm format
pnpm acceptance
pnpm vendor:agent-sources
```
