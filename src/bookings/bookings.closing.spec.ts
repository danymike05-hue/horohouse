// How a booking ends without a stay: the host declines it, or a deadline passes. The guest must
// be told which, and a decline must never overwrite a booking that closed or was paid meanwhile.
import { Types } from 'mongoose';
import { BookingsService } from './bookings.service';
import { BookingStatus, CancelledBy, PaymentStatus } from './schema/booking.schema';
import { NotificationsService } from '../notifications/notifications.service';

const id = () => new Types.ObjectId();
const exec = (v: any) => ({ exec: () => Promise.resolve(v) });
const HOST = id();

function booking(extra: any = {}) {
  return {
    _id: id(), hostId: HOST, guestId: id(), propertyId: id(), status: BookingStatus.PENDING,
    paymentStatus: PaymentStatus.UNPAID, isInstantBook: false,
    checkIn: new Date('2027-01-10'), checkOut: new Date('2027-01-12'), ...extra,
  };
}

function build(b: any, { stillOpen = true } = {}) {
  const lean = (v: any) => ({ select: () => ({ lean: () => Promise.resolve(v) }) });
  const svc: any = Object.create(BookingsService.prototype);
  svc.logger = { log: () => undefined, warn: () => undefined };
  svc.bookingModel = {
    findOneAndUpdate: jest.fn((_f: any, u: any) => exec(stillOpen ? { ...b, ...u } : null)),
    find: () => ({ select: () => ({ limit: () => ({ lean: () => exec([b]) }) }) }),
    updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
  };
  svc.findBookingOrThrow = async () => b;
  svc.propertyModel = { findById: () => lean({ title: 'Villa' }) };
  svc.userModel = { findById: () => lean({ name: 'Awa' }) };
  svc.promoCodes = { giveBack: jest.fn().mockResolvedValue(undefined) };
  svc.notificationsService = { notifyBookingRejected: jest.fn(), notifyBookingCancelled: jest.fn(), notifyBookingExpired: jest.fn() };
  return svc;
}

describe('declining a request', () => {
  it('is saved as the host’s, with their reason', async () => {
    const b = booking();
    const svc = build(b);
    await svc.rejectBooking(String(b._id), { reason: ' Not free ' }, { _id: HOST, name: 'Paul' });
    const [filter, update] = svc.bookingModel.findOneAndUpdate.mock.calls[0];
    expect(filter).toMatchObject({ status: BookingStatus.PENDING, paymentStatus: { $ne: PaymentStatus.PAID } });
    expect(update.status).toBe(BookingStatus.REJECTED);
    expect(update.cancellation).toMatchObject({ cancelledBy: CancelledBy.HOST, reason: 'Not free' });
    expect(svc.notificationsService.notifyBookingRejected).toHaveBeenCalled();
  });

  it('is refused, and nobody is told, when the booking closed meanwhile', async () => {
    const b = booking();
    const svc = build(b, { stillOpen: false });
    await expect(svc.rejectBooking(String(b._id), {}, { _id: HOST, name: 'Paul' })).rejects.toThrow('has closed');
    expect(svc.notificationsService.notifyBookingRejected).not.toHaveBeenCalled();
  });
});

describe('a deadline that passes', () => {
  it.each([
    [{ isInstantBook: true }, 'payment_timeout'],
    [{}, 'host_did_not_respond'],
    [{ status: BookingStatus.CONFIRMED }, 'payment_not_received_after_acceptance'],
  ])('%o is %s, and never "the host cancelled"', async (extra, reason) => {
    const svc = build(booking(extra));
    await svc.expireOverdueBookings();
    expect(svc.bookingModel.updateOne.mock.calls[0][1].$set.cancellation).toMatchObject({ cancelledBy: CancelledBy.SYSTEM, reason });
    expect(svc.notificationsService.notifyBookingExpired).toHaveBeenCalledWith(expect.objectContaining({ reason }));
    expect(svc.notificationsService.notifyBookingCancelled).not.toHaveBeenCalled();
  });

  it('tells the host too, except about an instant booking they never heard of', async () => {
    const svc: any = Object.create(NotificationsService.prototype);
    svc.create = jest.fn().mockResolvedValue(undefined);
    const p = { guestId: 'g', hostId: 'h', bookingId: 'b', propertyId: 'p', propertyTitle: 'Villa', guestName: 'Awa', checkIn: '2027-01-10', checkOut: '2027-01-12' };
    await svc.notifyBookingExpired({ ...p, reason: 'payment_timeout' });
    expect(svc.create.mock.calls.map((c: any) => c[0].userId)).toEqual(['g']);
    svc.create.mockClear();
    await svc.notifyBookingExpired({ ...p, reason: 'host_did_not_respond' });
    expect(svc.create.mock.calls.map((c: any) => c[0].userId)).toEqual(['g', 'h']);
  });
});
