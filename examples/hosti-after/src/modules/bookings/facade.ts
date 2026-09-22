import { findBooking } from "./internal/find-booking.js";
import type { Booking } from "./types.js";

export function getBooking(bookings: readonly Booking[], id: string): Booking | undefined {
  return findBooking(bookings, id);
}
