# Hosti-shaped before

These snippets are documentation, not failing fixtures. Each one is a concrete shape rejected by the copied configuration.

```ts
// src/server/start-server.ts: an outer server layer imports delivery
import { getBookingRoute } from "../delivery/http/get-booking-route.js";
```

```ts
// src/use-cases/show-booking.ts: bypasses the bookings module interface
import { findBooking } from "@hosti/bookings/internal/find-booking";

const booking = findBooking(bookings, id)!;
```

```ts
// src/modules/bookings/index.ts: the interface is not curated
export * from "./facade.js";
export * from "./types.js";
```

```tsx
// src/delivery/web/GuestCard.tsx: component filename and export disagree
export function BookingCard() {
  return "Booking";
}
```

```ts
// src/modules/bookings/facade.ts: top-level narrative and a two-line comment group
// Returns the booking with the given id.
export function getBooking(bookings: readonly Booking[], id: string): Booking | undefined {
  // Look up the booking
  // and return it.
  return findBooking(bookings, id);
}
```

The passing counterpart is in [`../hosti-after`](../hosti-after). It removes the server-to-delivery import, imports `@hosti/bookings`, handles the missing booking, names exports in the barrel, uses `BookingCard.tsx` for `BookingCard`, and drops comments that restate the code.
