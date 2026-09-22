import type { Booking } from "@hosti/bookings";
import { showBooking } from "../../use-cases/show-booking.js";

export function getBookingRoute(bookings: readonly Booking[], id: string): string {
  return showBooking(bookings, id);
}
