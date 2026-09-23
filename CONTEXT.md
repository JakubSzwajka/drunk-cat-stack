# Context

This repository, drunk-cat-stack, is a copyable configuration example. It is not a package, checker, or source of product code.

The comment rule comes from the external `eslint-plugin-codebase-ai-rules` package, installed from GitHub at a pinned commit. No rule code lives in this repository.

A **module** is a capability with one **interface** and a private **implementation**. The interface is the small set of imports callers need. The implementation stays behind it. A **seam** is the location of that interface. **Depth** is the useful behavior a caller gets for the amount of interface it must learn.

The checked example places the bookings seam at `modules/bookings/index.ts`. Delivery and use-cases may import that entry. They may not import the implementation under `internal/`.

In the example, a module's interface is an Effect **service**: a `Context.Service` class, such as `Bookings`, whose methods return Effects. An **expected error** is a `Schema.TaggedError` class, such as `BookingNotFound`, carried in the Effect error channel. A **layer** in Effect code means an Effect `Layer` that provides a service. It is not a delivery, server, use-case, or module layer.

The **agent sources** are shallow clones of dependency source under `.agent_sources/`, made by `npm run vendor:agent-sources`. Agents read them. Nothing imports them.

The **fence** is what stops an agent from skipping the checks: exact pins, `npm run check`, `npm test`, the lefthook pre-commit hook, and the harness hooks that block `git ... --no-verify`. Its code lives in `scripts/` and `.pi/extensions/`. **Law** is `AGENTS.md`. **Vision** is `VISION.md`, and each project made from the template writes its own.
