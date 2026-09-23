import { Context, Effect, Layer } from "effect";
import { findBooking } from "./internal/find-booking.js";
import { type Booking, BookingNotFound } from "./types.js";

export class Bookings extends Context.Service<
  Bookings,
  {
    readonly get: (id: string) => Effect.Effect<Booking, BookingNotFound>;
  }
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
