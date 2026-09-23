import { expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { Bookings } from "./index.js";

const records = [{ id: "b-1", guestName: "Ada" }];

it.layer(Bookings.fromRecords(records))("Bookings", (test) => {
  test.effect("returns a stored booking", () =>
    Effect.gen(function* returnsStoredBooking() {
      const bookings = yield* Bookings;

      const booking = yield* bookings.get("b-1");

      expect(booking).toEqual({ id: "b-1", guestName: "Ada" });
    }),
  );

  test.effect("fails with a typed BookingNotFound", () =>
    Effect.gen(function* failsWithBookingNotFound() {
      const bookings = yield* Bookings;

      const error = yield* Effect.flip(bookings.get("missing"));

      expect(error._tag).toBe("BookingNotFound");
      expect(error.id).toBe("missing");
    }),
  );
});
