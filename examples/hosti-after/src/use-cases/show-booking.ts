import { Bookings } from "@hosti/bookings";
import { Effect } from "effect";

export const showBooking = Effect.fn("showBooking")(function* showBooking(id: string) {
  const bookings = yield* Bookings;
  const booking = yield* bookings.get(id);
  return `${booking.guestName} (${booking.id})`;
});
