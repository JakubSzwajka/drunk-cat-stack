import { Bookings } from "@hosti/bookings";
import { expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { getBookingRoute } from "./get-booking-route.js";

it.layer(Bookings.fromRecords([{ id: "b-1", guestName: "Ada" }]))("getBookingRoute", (test) => {
  test.effect("answers 200 with the booking", () =>
    Effect.gen(function* answersOk() {
      expect(yield* getBookingRoute("b-1")).toEqual({ status: 200, body: "Ada (b-1)" });
    }),
  );

  test.effect("maps BookingNotFound to 404", () =>
    Effect.gen(function* answersNotFound() {
      expect(yield* getBookingRoute("missing")).toEqual({
        status: 404,
        body: "Booking missing was not found.",
      });
    }),
  );
});
