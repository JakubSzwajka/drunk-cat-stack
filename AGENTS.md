# Agent instructions

This file is the law for agents and people working in this repo, and in any project made from the drunk-cat-stack template. Read `VISION.md` for why. It does not override this file. Read `CONTEXT.md` for the words this repo uses.

## Commands

| Command | What it does |
| --- | --- |
| `npm ci` | Install from the lockfile. Also installs the lefthook pre-commit hook. |
| `npm run check` | Exact pins, environment schema, Biome, ESLint, TypeScript, Dependency Cruiser. |
| `npm run env:check` | `varlock load`: resolve and validate every variable in `.env.schema`. |
| `npx varlock run -- <cmd>` | Run a command with the environment values injected. |
| `npm test` | Node test runner over `tests/**/*.test.mjs`. |
| `npm run fix` | Apply Biome formatting and safe lint fixes. |
| `npm run format` | Apply Biome formatting only. |
| `npm run acceptance` | Clone the committed HEAD into a temp dir and run `npm ci`, `check`, and `test` there. |

Run `npm run fix` or `npm run format` only when you mean to rewrite files. Before you call a change ready, `npm run check` and `npm test` must both exit 0.

## What check enforces

The table under "What is enforced" in `README.md` lists every rule, its tool, and its config file. That table is the source. Do not copy it here.

## Layers and modules

- Delivery and server never import each other.
- Use-cases import modules. They never import delivery or server.
- Modules never import use-cases, delivery, or server.
- A module has one public entry, its `index.ts`. Callers import that entry, never a file under the module's `internal/`.
- No import cycles. No deep package imports. Production code never imports tests.

## Review only

The "Review only" section in `README.md` lists what no tool here checks. A green `npm run check` says nothing about those. Point them out in review instead of claiming a check covers them.

## Environment

- Declare every environment variable the code reads in `.env.schema`. Put no secret values there.
- Secrets live only in `.env.local`. Never commit `.env.local` or any `.env.*.local` file.
- Varlock telemetry stays off through `.varlock/config.json`. Check with `DEBUG=varlock:telemetry npx varlock load`.

## Pins

Every dependency in `package.json` is an exact version. A GitHub dependency is pinned to a full 40-character commit SHA. `.npmrc` sets `save-exact=true`, so `npm install <pkg>` writes an exact pin. `npm run check` fails on `^`, `~`, ranges, tags, and branch names. Node is pinned in `.nvmrc`, and CI reads it from there.

## Hooks

- lefthook runs `npm run check` and then `npm test` before each commit.
- If a hook fails, fix the failure. Never weaken or bypass a hook.
- Never run `git ... --no-verify`, `git commit -n`, `LEFTHOOK=0`, or change `core.hooksPath`.
- Claude Code (`.claude/settings.json`) and Pi (`.pi/extensions/git-interceptor.ts`) block those commands. Both use `scripts/vcs-command-policy.mjs`.

## Safe vs needs approval

Safe without asking:

- code changes that keep `npm run check` and `npm test` green;
- new or tighter tests;
- docs edits in `README.md`, `AGENTS.md`, and `CONTEXT.md`;
- tightening a lint or dependency rule;
- adding a variable to `.env.schema`.

Ask the owner first:

- adding, removing, or bumping a dependency or the Node version;
- any change to `biome.json`, `eslint.config.mjs`, `.dependency-cruiser.cjs`, `tsconfig*.json`, `lefthook.yml`, `.npmrc`, CI, or the hook policy that loosens a rule;
- deleting tests;
- changing how secrets are handled: `@sensitive`, `.env.local`, the `.gitignore` env lines, or `.varlock/config.json`;
- changing `VISION.md`;
- commit, push, or anything that writes outside this repo.
