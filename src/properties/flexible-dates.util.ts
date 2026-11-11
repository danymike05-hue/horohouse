/** "± N days" choices on the search screen. Anything else means exact dates. */
export const FLEX_DAY_OPTIONS = [1, 2, 3, 7];

const DAY_MS = 86_400_000;

export interface StayWindow {
  checkIn: Date;
  checkOut: Date;
}

export function parseFlexDays(raw: unknown): number {
  const days = Number(raw);
  return FLEX_DAY_OPTIONS.includes(days) ? days : 0;
}

/**
 * The same length of stay, moved up to `flexDays` either way: the dates asked for first,
 * then nearest first, later before earlier. Stays starting before today are left out.
 */
export function stayWindows(checkIn: Date, checkOut: Date, flexDays: number, now = new Date()): StayWindow[] {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const shifts = [0];
  for (let d = 1; d <= flexDays; d++) shifts.push(d, -d);
  return shifts
    .map((shift) => ({
      checkIn: new Date(checkIn.getTime() + shift * DAY_MS),
      checkOut: new Date(checkOut.getTime() + shift * DAY_MS),
    }))
    .filter((window, index) => index === 0 || window.checkIn.getTime() >= today);
}

type Range = { from: Date | string; to: Date | string };

const overlaps = (window: StayWindow, from: Date | string, to: Date | string) =>
  new Date(from) < window.checkOut && new Date(to) > window.checkIn;

/** The first of these stays that no booking or host block touches. */
export function firstOpenWindow(
  windows: StayWindow[],
  bookings: { checkIn: Date | string; checkOut: Date | string }[],
  blocks: Range[],
): StayWindow | null {
  return windows.find((window) =>
    !bookings.some((b) => overlaps(window, b.checkIn, b.checkOut))
    && !blocks.some((b) => overlaps(window, b.from, b.to))) ?? null;
}

/** Which listings each stay can't use, given every booking that touches any of them. */
export function bookedIdsPerWindow<T>(
  windows: StayWindow[],
  bookings: { propertyId: T; checkIn: Date | string; checkOut: Date | string }[],
): T[][] {
  return windows.map((window) =>
    bookings.filter((b) => overlaps(window, b.checkIn, b.checkOut)).map((b) => b.propertyId));
}
