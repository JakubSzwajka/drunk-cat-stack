import type { Booking } from "@hosti/bookings";

export function BookingCard({ booking }: { booking: Booking }): string {
  return `${booking.guestName} · ${booking.id}`;
}
