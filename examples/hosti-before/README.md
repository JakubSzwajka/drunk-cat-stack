# Hosti-shaped before

These snippets are documentation, not failing fixtures. Each one is a concrete shape rejected by the copied configuration.

```ts
// apps/api/src/server/start-server.ts: an outer server layer imports delivery
import { getBookingRoute } from "../delivery/http/get-booking-route.js";
```

```ts
// apps/api/src/use-cases/show-booking.ts: bypasses the bookings package's public entry
import { findBooking } from "@hosti/bookings/internal/find-booking";

const booking = findBooking(bookings, id)!;
```

```ts
// apps/api/src/use-cases/show-booking.ts: reaches into a package by relative path
import { Bookings } from "../../../../packages/bookings/src/index.js";
```

```ts
// packages/bookings/src/facade.ts: a package imports an app
import { showBooking } from "../../../apps/api/src/use-cases/show-booking.js";
```

```jsonc
// packages/bookings/package.json: the exports field opens the internals
"exports": {
  ".": "./src/index.ts",
  "./internal/*": "./src/internal/*"
}
```

```ts
// packages/bookings/src/index.ts: the interface is not curated
export * from "./facade.js";
export * from "./types.js";
```

```tsx
// apps/api/src/delivery/web/GuestCard.tsx: component filename and export disagree
export function BookingCard() {
  return "Booking";
}
```

```ts
// packages/bookings/src/facade.ts: an untyped error, then an Effect run by hand inside Effect code
get: Effect.fn("Bookings.get")(function* get(id: string) {
  const booking = findBooking(records, id);
  if (booking === undefined) {
    return yield* Effect.fail(new Error("Booking was not found"));
  }
  return Effect.runSync(Effect.succeed(booking));
}),
```

```ts
// packages/bookings/src/facade.ts: top-level narrative and a two-line comment group
// Returns the booking with the given id.
export function getBooking(bookings: readonly Booking[], id: string): Booking | undefined {
  // Look up the booking
  // and return it.
  return findBooking(bookings, id);
}
```

The passing counterpart is the workspace itself: [`packages/bookings`](../../packages/bookings) and [`apps/api`](../../apps/api). It removes the server-to-delivery import, imports `@hosti/bookings` by name, keeps `exports` to `src/index.ts`, keeps the package free of app imports, fails with a typed `BookingNotFound` instead of a global `Error`, yields Effects instead of running them by hand, names exports in the barrel, uses `BookingCard.tsx` for `BookingCard`, and drops comments that restate the code. `pnpm run typecheck` rejects the Effect snippet through the `globalErrorInEffectFailure` and `runEffectInsideEffect` diagnostics. `pnpm run deps` rejects the relative import with `packages-imported-by-name`, the package-to-app import with `packages-do-not-import-apps`, and a deep import through the widened `exports` with `packages-public-entry-only`.
