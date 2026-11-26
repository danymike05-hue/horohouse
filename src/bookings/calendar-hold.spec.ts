import { calendarHoldFilter } from './calendar-hold';

/** Enough of MongoDB's matching for this filter: $or, $in, $gt, $exists and null */
function matches(doc: any, filter: any): boolean {
  return Object.entries(filter).every(([key, cond]: [string, any]) => {
    if (key === '$or') return (cond as any[]).some((f) => matches(doc, f));
    const v = doc[key];
    if (cond === null) return v === null || v === undefined;
    if (cond && typeof cond === 'object' && !(cond instanceof Date)) {
      if ('$in' in cond) return cond.$in.includes(v);
      if ('$gt' in cond) return v !== undefined && v !== null && new Date(v) > cond.$gt;
      if ('$exists' in cond) return cond.$exists ? v !== undefined : v === undefined;
    }
    return v === cond;
  });
}

describe('which bookings make dates unavailable', () => {
  const now = new Date('2026-11-27T10:00:00Z');
  const later = new Date(now.getTime() + 20 * 60_000);
  const earlier = new Date(now.getTime() - 60_000);
  const blocks = (b: any) => matches(b, calendarHoldFilter(now));

  it('a paid stay always does', () => {
    expect(blocks({ status: 'confirmed', paymentStatus: 'paid' })).toBe(true);
  });

  it('an Instant Book does while its payment is going through', () => {
    expect(blocks({ status: 'pending', isInstantBook: true, paymentStatus: 'unpaid', expiresAt: later })).toBe(true);
  });

  it('…but not once the payment failed', () => {
    expect(blocks({ status: 'pending', isInstantBook: true, paymentStatus: 'unpaid', expiresAt: later, holdReleasedAt: earlier })).toBe(false);
  });

  it('…nor once its time ran out', () => {
    expect(blocks({ status: 'pending', isInstantBook: true, paymentStatus: 'unpaid', expiresAt: earlier })).toBe(false);
  });

  it('a request the host has not answered never does', () => {
    expect(blocks({ status: 'pending', isInstantBook: false, paymentStatus: 'unpaid', expiresAt: later })).toBe(false);
    expect(blocks({ status: 'pending', paymentStatus: 'unpaid' })).toBe(false);
  });

  it('a request the host accepted does while the guest still has time to pay', () => {
    expect(blocks({ status: 'confirmed', isInstantBook: false, paymentStatus: 'unpaid', expiresAt: later })).toBe(true);
    expect(blocks({ status: 'confirmed', isInstantBook: false, paymentStatus: 'unpaid', expiresAt: earlier })).toBe(false);
  });

  it('a confirmed stay with no deadline (cash, older bookings) does', () => {
    expect(blocks({ status: 'confirmed', paymentStatus: 'unpaid' })).toBe(true);
  });
});
