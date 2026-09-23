import type { Booking } from "../types.js";

export function findBooking(bookings: readonly Booking[], id: string): Booking | undefined {
  return bookings.find((booking) => booking.id === id);
}
