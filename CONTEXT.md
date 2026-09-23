# Context

This repository, drunk-cat-stack, is a copyable configuration example. It is not a published library, a checker, or a source of product code.

The comment rule comes from the external `eslint-plugin-codebase-ai-rules` package, installed from GitHub at a pinned commit. No rule code lives in this repository.

The repository is a pnpm **workspace**: one root with one lockfile, plus workspace packages listed in `pnpm-workspace.yaml`. Turborepo runs each workspace package's `typecheck` and `test` scripts in dependency order. A **workspace package** is any folder under `apps/` or `packages/` with its own `package.json`. An **app** is a workspace package under `apps/`. It holds delivery, server, and use-case code, and nothing imports it. A **package** is a workspace package under `packages/`. It holds one module, and apps and other packages import it by its package name.

A **module** is a capability with one **interface** and a private **implementation**. The interface is the small set of imports callers need. The implementation stays behind it. A **seam** is the location of that interface. **Depth** is the useful behavior a caller gets for the amount of interface it must learn. In this repo each module is a package, so a package's **public entry** is its seam: `src/index.ts`, the only path its `package.json` `exports` names.

The checked example puts the bookings module in `packages/bookings`, named `@hosti/bookings`, and the app that uses it in `apps/api`. The app's delivery and use-cases import `@hosti/bookings`. They may not import the implementation under `packages/bookings/src/internal/`.

In the example, a module's interface is an Effect **service**: a `Context.Service` class, such as `Bookings`, whose methods return Effects. An **expected error** is a `Schema.TaggedError` class, such as `BookingNotFound`, carried in the Effect error channel. A **layer** in Effect code means an Effect `Layer` that provides a service. It is not a delivery, server, or use-case layer of an app.

The **agent sources** are shallow clones of dependency source under `.agent_sources/`, made by `pnpm vendor:agent-sources`. Agents read them. Nothing imports them.

The **fence** is what stops an agent from skipping the checks: exact pins, `pnpm check`, `pnpm test`, the lefthook pre-commit hook, and the harness hooks that block `git ... --no-verify`. Its code lives in `scripts/` and `.pi/extensions/`. **Law** is `AGENTS.md`. **Vision** is `VISION.md`, and each project made from the template writes its own.
