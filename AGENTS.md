# Agent instructions

This file is the law for agents and people working in this repo, and in any project made from the drunk-cat-stack template. Read `VISION.md` for why. It does not override this file. Read `CONTEXT.md` for the words this repo uses.

## Commands

This repo is a pnpm workspace run by Turborepo. Use pnpm, at the version `packageManager` in `package.json` pins. Corepack picks it up: run `corepack enable` once per machine. Do not replace pnpm with npm, Yarn, or Bun, and do not add a second lockfile.

| Command | What it does |
| --- | --- |
| `pnpm install --frozen-lockfile` | Install from `pnpm-lock.yaml`. The root `prepare` script then patches `tsc` with the Effect language service (`effect-tsgo patch`) and installs the lefthook pre-commit hook. |
| `pnpm check` | Exact pins in every workspace `package.json`, environment schema, Biome, ESLint, Dependency Cruiser once at the root, and `typecheck` in each workspace package through Turborepo. |
| `pnpm env:check` | `varlock load`: resolve and validate every variable in `.env.schema`. |
| `pnpm exec varlock run -- <cmd>` | Run a command with the environment values injected. |
| `pnpm test` | Node test runner over `tests/**/*.test.mjs`, then `test` (Vitest) in each workspace package through Turborepo. |
| `pnpm fix` | Apply Biome formatting and safe lint fixes. |
| `pnpm format` | Apply Biome formatting only. |
| `pnpm acceptance` | Clone the committed HEAD into a temp dir and run `pnpm install --frozen-lockfile`, `check`, and `test` there. |
| `pnpm vendor:agent-sources` | Shallow-clone the Effect source at the pinned version into `.agent_sources/`. Not part of `check`. |
| `pnpm --filter <package> add <dep>` | Add a dependency to one workspace package. `saveExact` writes an exact pin. |

Run `pnpm fix` or `pnpm format` only when you mean to rewrite files. Before you call a change ready, `pnpm check` and `pnpm test` must both exit 0.

## What check enforces

The table under "What is enforced" in `README.md` lists every rule, its tool, and its config file. That table is the source. Do not copy it here.

## Workspace, apps, and packages

- An app lives in `apps/<name>`. A package lives in `packages/<name>`. `pnpm-workspace.yaml` lists both folders.
- A package never imports an app. An app never imports another app.
- An app or package imports another package by its name, such as `@hosti/bookings`, and declares it in its own `package.json` as `workspace:<exact version>`. Never import another package by a relative path.
- A package has one public entry, `src/index.ts`, and its `package.json` `exports` names only that entry. Callers never import a file under the package's `src/internal/`, by name or by path.
- Each workspace package has its own `tsconfig.json` that extends the root `tsconfig.base.json`, plus `typecheck` and `test` scripts.

## Layers inside an app

- Delivery and server never import each other.
- Use-cases import packages. They never import delivery or server.
- No import cycles. No deep package imports. Production code never imports tests.

## Effect

Before you edit Effect code, read `effect/AGENTS.md` and the docs under `effect/ai-docs/` in any workspace package's `node_modules`, such as `packages/bookings/node_modules/effect/AGENTS.md`. pnpm does not install `effect` at the repo root. `ls -d packages/*/node_modules/effect` lists the copies. For API shape and examples, read the source mirror at `.agent_sources/github.com/Effect-TS/effect`. Run `pnpm vendor:agent-sources` if it is missing. Trust the installed version over memory: Effect 4 is a release candidate and its API still moves. To add a package, follow `skills/add-an-effect-module/SKILL.md`.

- Expected errors are typed. Define each one as a `Schema.TaggedError` class and put it in the error channel. Never fail with a global `Error`, and never `throw` inside Effect code.
- A package's service methods return Effects with no requirements. The service captures its own dependencies.
- Delivery maps typed errors to responses once, in the handler. Use-cases let them flow.
- Never run an Effect by hand inside Effect code or tests. No `Effect.run*` and no hand-built runtime. Tests use `it.effect` or `it.layer` from `@effect/vitest`. Only an application entry point runs Effects.
- Pin all Effect packages together. `effect`, `@effect/vitest`, and any other `@effect/*` runtime package share one exact version, and a bump moves all of them in the same change. `@effect/tsgo` versions separately and must support the pinned TypeScript.
- Never set an Effect diagnostic in `tsconfig.base.json` below `error` to make a change pass. Fix the code.

## Review only

The "Review only" section in `README.md` lists what no tool here checks. A green `pnpm check` says nothing about those. Point them out in review instead of claiming a check covers them.

## Environment

- Declare every environment variable the code reads in `.env.schema`. Put no secret values there.
- Secrets live only in `.env.local`. Never commit `.env.local` or any `.env.*.local` file.
- Varlock telemetry stays off through `.varlock/config.json`. Check with `DEBUG=varlock:telemetry pnpm exec varlock load`.
- Turborepo telemetry stays off because every script that runs `turbo` sets `TURBO_TELEMETRY_DISABLED=1`, and so does CI. Run `turbo` only through those scripts, or run `pnpm exec turbo telemetry disable` once per machine.

## Pins

Every dependency in the root `package.json` and in each workspace `package.json` is an exact version. A GitHub dependency is pinned to a full 40-character commit SHA. A workspace dependency is `workspace:` plus the exact version, such as `workspace:0.0.0`. `packageManager` names an exact pnpm version. `pnpm-workspace.yaml` sets `saveExact: true` and `saveWorkspaceProtocol: true`, so `pnpm add <pkg>` writes an exact pin, and `pnpm add <workspace package>` writes `workspace:<exact version>`. `pnpm check` fails on `^`, `~`, ranges, tags, branch names, and `workspace:*`. Node is pinned in `.nvmrc`, and CI reads it from there.

`pnpm-workspace.yaml` also holds the install policy:

- `minimumReleaseAge: 1440` refuses a version younger than one day. Any exact pin younger than that fails `pnpm install`. Either wait a day, or add a `minimumReleaseAgeExclude` entry for that exact version, with owner approval. One entry per version. A bump replaces its entry. Effect release candidates are the usual case: a new RC is often less than a day old.
- `allowBuilds` lists every dependency that has an install script, each set to `false`. No dependency runs a build script. A new dependency with a script fails the install until you add it here.
- `packageExtensions` gives the ESLint comment plugin its own TypeScript 6.0.3.

Never add `shamefully-hoist`, `nodeLinker: hoisted`, or a broad `publicHoistPattern`, and never install with `--force`.

## Hooks

- lefthook runs `pnpm check` and then `pnpm test` before each commit.
- If a hook fails, fix the failure. Never weaken or bypass a hook.
- Never run `git ... --no-verify`, `git commit -n`, `LEFTHOOK=0`, or change `core.hooksPath`.
- Pi (`.pi/extensions/git-interceptor.ts`) blocks those commands through `scripts/vcs-command-policy.mjs`. `.agents/settings.json` holds the same hook in Claude Code format. Claude Code does not load it from there.

## Safe vs needs approval

Safe without asking:

- code changes that keep `pnpm check` and `pnpm test` green;
- new or tighter tests;
- docs edits in `README.md`, `AGENTS.md`, and `CONTEXT.md`;
- tightening a lint or dependency rule;
- adding a variable to `.env.schema`.

Ask the owner first:

- adding, removing, or bumping a dependency, the TypeScript version, the Node version, pnpm, or Turborepo;
- adding an entry to `minimumReleaseAgeExclude`, or setting an `allowBuilds` entry to `true`;
- removing the TypeScript 6 `packageExtensions` entry for the ESLint plugin, or narrowing the files ESLint checks;
- any change to `biome.json`, `eslint.config.mjs`, `.dependency-cruiser.cjs`, `tsconfig*.json`, `turbo.json`, `pnpm-workspace.yaml`, `lefthook.yml`, CI, or the hook policy that loosens a rule;
- deleting tests;
- changing how secrets are handled: `@sensitive`, `.env.local`, the `.gitignore` env lines, or `.varlock/config.json`;
- changing `VISION.md`;
- commit, push, or anything that writes outside this repo.
