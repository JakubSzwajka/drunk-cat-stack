---
name: add-an-effect-module
description: Add one Effect module and carry it through a use-case and a delivery handler without breaking the layer rules.
---

# Add an Effect module

Build one capability from the inside out: module, then use-case, then delivery. Copy the bookings example in `examples/hosti-after/src`. Do not put business logic in delivery.

Before you start, read `node_modules/effect/AGENTS.md`. For API shape, read the source mirror at `.agent_sources/github.com/Effect-TS/effect`. If it is missing, run `npm run vendor:agent-sources`.

## 1. Define the module

Create `src/modules/<name>/`.

1. Put the data types and the expected errors in `types.ts`. Each expected error is a `Schema.TaggedError` class, such as `BookingNotFound`. Never fail with a global `Error`.
2. Put private helpers under `internal/`. Nothing outside the module imports them.
3. Put the service in `facade.ts`. Use a `Context.Service` class. Its methods return `Effect.Effect<Success, TypedError>` with no requirements. Give it a static layer, such as `Bookings.fromRecords`.
4. Write `index.ts` as the one public entry. Name each export. No `export *`.
5. Add a path alias for the module to `tsconfig.json` under `paths`, such as `@hosti/bookings`.

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

A new module also needs its own dependency-cruiser rule. Copy `bookings-public-entry-only` in `.dependency-cruiser.cjs` and point it at the new module root.

## 2. Compose it in a use-case

Create `src/use-cases/<action>.ts`. Import the module by its alias, never by a relative path into the module.

Write the use-case with `Effect.fn("<action>")`. Yield the service and its methods. Let typed errors flow through the error channel. Do not catch them here.

## 3. Map errors once in delivery

Create the handler under `src/delivery/`. It calls the use-case and maps every typed error to a response in one place, with `Effect.catchTag` or `Effect.catchTags`. The handler's error channel ends as `never`.

Delivery returns an Effect. The entry point that owns the runtime runs it. Do not call `Effect.run*` inside Effect code.

## 4. Test it

Put tests beside the code as `<file>.test.ts`. Use `@effect/vitest`:

- `it.layer(<Service>.<layer>)` to provide the service;
- `it.effect` for each case;
- `Effect.flip` to inspect an expected error.

Do not call `Effect.run*` or build a runtime by hand in tests.

## 5. Prove it

```sh
npm run check
npm test
```

| Check | What it proves |
| --- | --- |
| `npm run typecheck` | Effect diagnostics: no floating Effects, no global `Error` in the failure channel, no `Effect.run*` inside Effect code, no leaked requirements. |
| `npm run deps` | Delivery does not import server, use-cases do not import outer layers, modules do not import use-cases, callers use the module's `index.ts`. |
| `npm run lint` | No comments that restate the code. |
| `npm run biome` | Named barrel exports and file names. |
| `npm test` | The module, use-case, and delivery tests pass under vitest. |

Fix failures. Do not loosen a rule, a hook, or a pinned version.
