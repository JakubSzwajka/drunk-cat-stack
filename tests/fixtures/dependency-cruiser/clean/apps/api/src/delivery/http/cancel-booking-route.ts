import { cancelBooking } from "../../use-cases/cancel-booking/index";
import { formatId } from "./string-utils";
export const cancelRoute = (id: string) => cancelBooking(formatId(id));
