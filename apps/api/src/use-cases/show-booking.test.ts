import { Bookings } from "@hosti/bookings";
import { expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { showBooking } from "./show-booking.js";

it.layer(Bookings.fromRecords([{ id: "b-1", guestName: "Ada" }]))("showBooking", (test) => {
  test.effect("formats the booking", () =>
    Effect.gen(function* formatsBooking() {
      expect(yield* showBooking("b-1")).toBe("Ada (b-1)");
    }),
  );

  test.effect("keeps BookingNotFound in the error channel", () =>
    Effect.gen(function* keepsTypedError() {
      const error = yield* Effect.flip(showBooking("missing"));

      expect(error._tag).toBe("BookingNotFound");
    }),
  );
});
