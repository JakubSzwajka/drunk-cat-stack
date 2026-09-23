import { Schema } from "effect";

export type Booking = Readonly<{
  id: string;
  guestName: string;
}>;

export class BookingNotFound extends Schema.TaggedError<BookingNotFound>()("BookingNotFound", {
  id: Schema.String,
}) {}
