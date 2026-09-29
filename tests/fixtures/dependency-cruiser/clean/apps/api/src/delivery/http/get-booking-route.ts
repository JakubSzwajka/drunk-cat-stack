import { showBooking } from "../../use-cases/show-booking";
export const route = (id: string) => showBooking(id);
