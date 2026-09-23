# drunk-cat-stack

drunk-cat-stack is config files you copy into a TypeScript repo so `npm run check` fails on structure rules instead of leaving them to review. It uses maintained tools as-is: Biome, ESLint with [`eslint-plugin-codebase-ai-rules`](https://github.com/JakubSzwajka/eslint-plugin-codebase-ai-rules), TypeScript, Dependency Cruiser, and [varlock](https://varlock.dev) for the environment. CI runs `npm ci`, `npm run check`, and `npm test`, nothing else. A [fence](#fence) stops agents from skipping those checks at commit time.

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
- error design and one-time delivery mapping;
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

1. Copy `biome.json`, `eslint.config.mjs`, `tsconfig.base.json`, `.dependency-cruiser.cjs`, and `.github/workflows/ci.yml`.
2. Copy the `scripts` and `devDependencies` from `package.json`, plus the `engines` and `packageManager` fields. Keep the plugin pinned to a full commit SHA. To upgrade, change the SHA and run `npm install`.
3. Copy `.env.schema` and `.varlock/config.json`, and the `.env` lines from `.gitignore`. Replace `APP_ENV` in `.env.schema` with the variables your code reads.
4. Copy the fence: `.npmrc`, `.nvmrc`, `lefthook.yml`, `scripts/`, `tests/`, `.claude/settings.json`, `.pi/extensions/git-interceptor.ts`, and `NOTICE`.
5. Copy `AGENTS.md` and `CLAUDE.md`, then rewrite the layer rules in `AGENTS.md` for your project. Write your own `VISION.md`.
6. Set the constants at the top of `.dependency-cruiser.cjs`: `SOURCE_ROOT`, `DELIVERY_ROOT`, `SERVER_ROOT`, `USE_CASES_ROOT`, `MODULES_ROOT`, `BOOKINGS_MODULE_ROOT`, `PACKAGE_NAMESPACE`, `TSCONFIG`, and `TEST_PATH` if your tests live elsewhere. Keep `(?:/|$)` at the end of each root, so `modules-legacy` does not count as `modules`.
7. Copy `bookings-public-entry-only` once per module that hides its internals, with its own root constant. One regular expression cannot compare source and target module names.
8. Map each public alias in your `tsconfig.json`, the way this repo maps `@hosti/bookings` to `modules/bookings/index.ts`. Add no deep alias.
9. Run `npm install`, which also installs the pre-commit hook. Then run `npm run check` and `npm test`.

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
npm run env:check
npm test
npm run fix
npm run format
npm run acceptance
```
