import { BookingStatus, PaymentStatus } from './schema/booking.schema';

/**
 * Which bookings make their dates unavailable to other guests. The one rule for the whole
 * app (booking, calendars, rooms and date search all use it), modelled on Airbnb:
 *
 *  - Paid: always.
 *  - Accepted by the host (or confirmed without a deadline, e.g. cash / older bookings):
 *    while the guest's payment deadline hasn't passed.
 *  - Instant Book, not paid yet: only while the payment is going through (a short hold).
 *    A failed, cancelled or timed-out payment releases it at once (`holdReleasedAt`).
 *  - A request the host hasn't answered: never. Other guests can still book those dates;
 *    if they do, the request is declined ("dates no longer available").
 *
 * Mix it into a query that also limits `status` to the open ones (pending, confirmed,
 * completed). Plain strings so it works where the enums aren't imported.
 */
export function calendarHoldFilter(now: Date = new Date()) {
  const deadlineOpen = [{ expiresAt: { $exists: false } }, { expiresAt: null }, { expiresAt: { $gt: now } }];
  return {
    $or: [
      { paymentStatus: PaymentStatus.PAID },
      { status: { $in: [BookingStatus.CONFIRMED, BookingStatus.COMPLETED] }, $or: deadlineOpen },
      { status: BookingStatus.PENDING, isInstantBook: true, holdReleasedAt: null, expiresAt: { $gt: now } },
    ],
  };
}

/** How long an Instant Book stays held while the guest pays. */
export const INSTANT_HOLD_MINUTES = 30;

/** After a payment fails, how long the guest has to try again or send a request instead. */
export const RETRY_WINDOW_MINUTES = 60;
