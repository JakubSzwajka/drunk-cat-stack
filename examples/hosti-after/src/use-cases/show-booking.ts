import { type Booking, getBooking } from "@hosti/bookings";

export function showBooking(bookings: readonly Booking[], id: string): string {
  const booking = getBooking(bookings, id);
  return booking ? `${booking.guestName} (${booking.id})` : "Booking was not found.";
}
