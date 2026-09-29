# Context

This repository, house-rules-stack, is a template. It is not a published library, a checker, or a source of product code.

The **house plugin** is the external `@jakubszwajka/house-rules` package, installed from GitHub at a pinned commit. It owns the **house rules** and the **presets**: the ESLint rules, the TypeScript and Biome presets, the Dependency Cruiser `layout()` factory, and the `house-rules-pins` bin. No rule code and no copy of a preset lives in this repository.

The template is a showcase of the house plugin wired into a real workspace. The plugin gives the deterministic feedback, and its README lists every checked rule. The template adds five things:

1. **Thin configs**: `tsconfig.base.json`, `biome.json`, `.dependency-cruiser.cjs`, and `eslint.config.mjs`. Each points at a preset and sets only **project values**, such as the `@hosti/` scope or Biome's own excludes.
2. **Stack-only files**, which no package can hand down: `turbo.json`, `pnpm-workspace.yaml`, `.env.schema`, CI, `lefthook.yml`, and the agent-harness hooks.
3. Prose: `AGENTS.md`, `CONTEXT.md`, `README.md`, `VISION.md`, and `skills/`. The **prose rules** in `README.md` are what a reviewer checks, because no tool can.
4. Example code: `apps/api` and `packages/bookings`.
5. **Wiring tests** under `tests/`, which prove the thin configs and the fence are hooked up, not how each rule behaves. The plugin tests its own rules.

The repository is a pnpm **workspace**: one root with one lockfile, plus workspace packages listed in `pnpm-workspace.yaml`. Turborepo runs each workspace package's `typecheck` and `test` scripts in dependency order. A **workspace package** is any folder under `apps/` or `packages/` with its own `package.json`. An **app** is a workspace package under `apps/`. It holds delivery, server, and use-case code, and nothing imports it. A **package** is a workspace package under `packages/`. It holds one module, and apps and other packages import it by its package name.

A **module** is a capability with one **interface** and a private **implementation**. The interface is the small set of imports callers need. The implementation stays behind it. A **seam** is the location of that interface. **Depth** is the useful behavior a caller gets for the amount of interface it must learn. In this repo each module is a package, so a package's **public entry** is its seam: `src/index.ts`, the only path its `package.json` `exports` names.

The checked example puts the bookings module in `packages/bookings`, named `@hosti/bookings`, and the app that uses it in `apps/api`. The app's delivery and use-cases import `@hosti/bookings`. They may not import the implementation under `packages/bookings/src/internal/`.

In the example, a module's interface is an Effect **service**: a `Context.Service` class, such as `Bookings`, whose methods return Effects. An **expected error** is a `Schema.TaggedError` class, such as `BookingNotFound`, carried in the Effect error channel. A **layer** in Effect code means an Effect `Layer` that provides a service. It is not a delivery, server, or use-case layer of an app.

The **agent sources** are shallow clones of dependency source under `.agent_sources/`, made by `pnpm vendor:agent-sources`. Agents read them. Nothing imports them.

The **fence** is what stops an agent from skipping the checks: exact pins, `pnpm check`, `pnpm test`, the lefthook pre-commit hook, and the harness hooks that block `git ... --no-verify`. Its code lives in `scripts/` and `.pi/extensions/`. **Law** is `AGENTS.md`. **Vision** is `VISION.md`, and each project made from the template writes its own.
