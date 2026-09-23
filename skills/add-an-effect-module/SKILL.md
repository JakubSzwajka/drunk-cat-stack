---
name: add-an-effect-module
description: Add one Effect module as a workspace package and carry it through a use-case and a delivery handler in an app without breaking the workspace or layer rules.
---

# Add an Effect module

Build one capability from the inside out: package, then use-case, then delivery. Each module is its own workspace package under `packages/`. Copy the bookings example in `packages/bookings` and the app in `apps/api`. Do not put business logic in delivery.

Before you start, read `effect/AGENTS.md` in any workspace package's `node_modules`, such as `packages/bookings/node_modules/effect/AGENTS.md`. pnpm does not install `effect` at the repo root. `ls -d packages/*/node_modules/effect` lists the copies. For API shape, read the source mirror at `.agent_sources/github.com/Effect-TS/effect`. If it is missing, run `pnpm vendor:agent-sources`.

## 1. Create the package

Create `packages/<name>/` with these files, copied from `packages/bookings`:

1. `package.json`. Set `name` to `@hosti/<name>`, or your own scope. `exports` names one entry, `"." : "./src/index.ts"`. Add no other `exports` path. Keep the `typecheck` and `test` scripts. Pin `effect`, `@effect/vitest`, `typescript`, and `vitest` to the same exact versions the other workspace packages use.
2. `tsconfig.json`, which extends `../../tsconfig.base.json`.
3. `vitest.config.ts`.

Then run `pnpm install` so pnpm links the new package and updates `pnpm-lock.yaml`.

## 2. Define the module

Inside `packages/<name>/src/`:

1. Put the data types and the expected errors in `types.ts`. Each expected error is a `Schema.TaggedError` class, such as `BookingNotFound`. Never fail with a global `Error`.
2. Put private helpers under `internal/`. Nothing outside the package imports them.
3. Put the service in `facade.ts`. Use a `Context.Service` class. Its methods return `Effect.Effect<Success, TypedError>` with no requirements. Give it a static layer, such as `Bookings.fromRecords`.
4. Write `index.ts` as the one public entry. Name each export. No `export *`.

```ts
export class Bookings extends Context.Service<
  Bookings,
  { readonly get: (id: string) => Effect.Effect<Booking, BookingNotFound> }
>()("@hosti/bookings/Bookings") {
  static readonly fromRecords = (records: readonly Booking[]): Layer.Layer<Bookings> =>
    Layer.succeed(this, {
      get: Effect.fn("Bookings.get")(function* get(id: string) {
        const booking = findBooking(records, id);
        if (booking === undefined) {
          return yield* new BookingNotFound({ id });
        }
        return booking;
      }),
    });
}
```

The dependency-cruiser rules already cover a new package. `packages-public-entry-only` and `packages-imported-by-name` apply to every folder under `packages/`. If you use a new scope, add it to `PACKAGE_NAMESPACE` in `.dependency-cruiser.cjs`.

## 3. Compose it in a use-case

Add the package to the app that uses it:

```sh
pnpm --filter @hosti/api add @hosti/<name>
```

`saveWorkspaceProtocol: true` and `saveExact: true` in `pnpm-workspace.yaml` make pnpm write `"@hosti/<name>": "workspace:0.0.0"` into the app's `package.json`. Do not name a spec such as `@workspace:0.0.0` on the command line: pnpm then writes `workspace:*`, which the pin check rejects.

Create `apps/<app>/src/use-cases/<action>.ts`. Import the module by its package name, never by a relative path into `packages/`.

Write the use-case with `Effect.fn("<action>")`. Yield the service and its methods. Let typed errors flow through the error channel. Do not catch them here.

## 4. Map errors once in delivery

Create the handler under `apps/<app>/src/delivery/`. It calls the use-case and maps every typed error to a response in one place, with `Effect.catchTag` or `Effect.catchTags`. The handler's error channel ends as `never`.

Delivery returns an Effect. The entry point that owns the runtime runs it. Do not call `Effect.run*` inside Effect code.

## 5. Test it

Put tests beside the code as `<file>.test.ts`. Use `@effect/vitest`:

- `it.layer(<Service>.<layer>)` to provide the service;
- `it.effect` for each case;
- `Effect.flip` to inspect an expected error.

Do not call `Effect.run*` or build a runtime by hand in tests.

## 6. Prove it

```sh
pnpm check
pnpm test
```

| Check | What it proves |
| --- | --- |
| `pnpm run pins` | Every `package.json` in the workspace pins exact versions, including `workspace:0.0.0`. |
| `pnpm run typecheck` | Effect diagnostics in every workspace package: no floating Effects, no global `Error` in the failure channel, no `Effect.run*` inside Effect code, no leaked requirements. |
| `pnpm run deps` | Packages do not import apps, apps import packages only by name and only through `src/index.ts`, use-cases do not import delivery or server. |
| `pnpm run lint` | No comments that restate the code. |
| `pnpm run biome` | Named barrel exports and file names. |
| `pnpm test` | The package, use-case, and delivery tests pass under Vitest in each workspace package. |

Fix failures. Do not loosen a rule, a hook, or a pinned version.
