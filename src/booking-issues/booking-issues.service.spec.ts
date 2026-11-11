import { BookingStatus, PaymentStatus } from '../bookings/schema/booking.schema';
import { BookingIssuesService, reportWindow } from './booking-issues.service';
import { IssueOutcome, IssueStatus } from './schemas/booking-issue.schema';

const ISSUE = '507f1f77bcf86cd799439021';
const BOOKING = '507f1f77bcf86cd799439022';
const GUEST = '507f1f77bcf86cd799439023';
const HOST = '507f1f77bcf86cd799439024';
const ADMIN = { _id: '507f1f77bcf86cd799439025', role: 'admin' };
const DAY = 86_400_000;

const stay = (over: any = {}) => ({
  _id: BOOKING,
  guestId: GUEST,
  hostId: HOST,
  propertyId: '507f1f77bcf86cd799439026',
  status: BookingStatus.CONFIRMED,
  paymentStatus: PaymentStatus.PAID,
  checkIn: new Date(Date.now() - DAY),
  checkOut: new Date(Date.now() + DAY),
  priceBreakdown: { totalAmount: 10000 },
  currency: 'XAF',
  ...over,
});

function build(booking: any = stay()) {
  const issueDoc: any = {
    _id: ISSUE, bookingId: BOOKING, hostId: HOST, payoutFrozen: true, status: IssueStatus.OPEN,
    save: jest.fn().mockResolvedValue(undefined),
  };
  const issueModel: any = {
    create: jest.fn().mockResolvedValue(issueDoc),
    findById: jest.fn().mockResolvedValue(issueDoc),
    findOneAndUpdate: jest.fn().mockResolvedValue(issueDoc),
    updateOne: jest.fn().mockResolvedValue(undefined),
  };
  const bookingModel: any = { findById: jest.fn().mockResolvedValue(booking), updateOne: jest.fn().mockResolvedValue(undefined) };
  const payments: any = {
    processBookingRefund: jest.fn().mockResolvedValue(true),
    // What's left before the refund, then after it
    refundableAmount: jest.fn().mockResolvedValue(10000),
  };
  const payouts: any = { freeze: jest.fn().mockResolvedValue(true), unfreeze: jest.fn().mockResolvedValue(undefined) };
  const notifications: any = { create: jest.fn().mockResolvedValue(undefined), notifyAdmins: jest.fn().mockResolvedValue(undefined) };
  const coHosts: any = { isActive: jest.fn().mockResolvedValue(false), notifyCoHosts: jest.fn().mockResolvedValue(undefined) };
  const service = new BookingIssuesService(issueModel, bookingModel, payments, payouts, notifications, coHosts);
  return { service, issueDoc, issueModel, bookingModel, payments, payouts, notifications, coHosts };
}

const report = { bookingId: BOOKING, category: 'cleanliness' as const, description: 'The room had not been cleaned at all.' };

describe('reportWindow', () => {
  const dates = { checkIn: new Date('2026-12-10T00:00:00Z'), checkOut: new Date('2026-12-12T00:00:00Z') };
  const paid = { status: BookingStatus.CONFIRMED, paymentStatus: PaymentStatus.PAID, ...dates } as any;

  it('opens on the check-in day and closes 72 hours after check-out', () => {
    expect(reportWindow(paid, Date.parse('2026-12-09T23:00:00Z'))?.isOpen).toBe(false);
    expect(reportWindow(paid, Date.parse('2026-12-10T00:00:00Z'))?.isOpen).toBe(true);
    expect(reportWindow(paid, Date.parse('2026-12-15T00:00:00Z'))?.isOpen).toBe(true);
    expect(reportWindow(paid, Date.parse('2026-12-15T00:00:01Z'))?.isOpen).toBe(false);
  });

  it('is closed for unpaid and cancelled bookings', () => {
    expect(reportWindow({ ...paid, paymentStatus: PaymentStatus.UNPAID })).toBeNull();
    expect(reportWindow({ ...paid, status: BookingStatus.CANCELLED })).toBeNull();
  });
});

describe('BookingIssuesService', () => {
  describe('report', () => {
    it('freezes the payout and alerts the host and admins', async () => {
      const { service, payouts, notifications, issueDoc } = build();
      await service.report({ _id: GUEST }, report);
      expect(payouts.freeze).toHaveBeenCalledWith(BOOKING);
      expect(issueDoc.payoutFrozen).toBe(true);
      expect(notifications.create).toHaveBeenCalledWith(expect.objectContaining({ userId: HOST }));
      expect(notifications.notifyAdmins).toHaveBeenCalledTimes(1);
    });

    it('only the guest can report', async () => {
      const { service, payouts } = build();
      await expect(service.report({ _id: HOST }, report)).rejects.toThrow('Only the guest');
      expect(payouts.freeze).not.toHaveBeenCalled();
    });

    it('refuses before check-in day, so it cannot be used to freeze money early', async () => {
      const { service, payouts } = build(stay({ checkIn: new Date(Date.now() + 3 * DAY), checkOut: new Date(Date.now() + 5 * DAY) }));
      await expect(service.report({ _id: GUEST }, report)).rejects.toThrow('from your check-in day');
      expect(payouts.freeze).not.toHaveBeenCalled();
    });

    it('a second open report on the booking is a clear error', async () => {
      const { service, issueModel, payouts } = build();
      issueModel.create.mockRejectedValue(Object.assign(new Error('dup'), { code: 11000 }));
      await expect(service.report({ _id: GUEST }, report)).rejects.toThrow('already reported');
      expect(payouts.freeze).not.toHaveBeenCalled();
    });

    it('refuses photos that are not ours', async () => {
      const { service } = build();
      process.env.CLOUDINARY_CLOUD_NAME = 'demo';
      await expect(service.report({ _id: GUEST }, { ...report, photos: ['https://evil.test/a.jpg'] })).rejects.toThrow('photos');
    });
  });

  describe('resolve', () => {
    it('no refund: releases the payout, sends no money', async () => {
      const { service, payments, payouts, issueDoc } = build();
      await service.resolve(ADMIN, ISSUE, { outcome: IssueOutcome.NO_REFUND, note: 'Photos do not show it' });
      expect(payments.processBookingRefund).not.toHaveBeenCalled();
      expect(payouts.unfreeze).toHaveBeenCalledWith(BOOKING);
      expect(issueDoc.status).toBe(IssueStatus.RESOLVED);
      expect(issueDoc.active).toBe(false);
    });

    it('partial refund: refunds, keeps the stay going, releases the rest', async () => {
      const { service, payments, payouts, bookingModel } = build();
      await service.resolve(ADMIN, ISSUE, { outcome: IssueOutcome.REFUND, amount: 3000, note: 'One night' });
      expect(payments.processBookingRefund).toHaveBeenCalledWith(BOOKING, 3000, 'One night', 'stay_issue');
      expect(bookingModel.updateOne).not.toHaveBeenCalled();
      expect(payouts.unfreeze).toHaveBeenCalled();
    });

    it('full refund of a running stay ends the booking', async () => {
      const { service, payments, bookingModel } = build();
      payments.refundableAmount.mockResolvedValueOnce(10000).mockResolvedValueOnce(0);
      await service.resolve(ADMIN, ISSUE, { outcome: IssueOutcome.REFUND, note: 'Could not get in' });
      expect(payments.processBookingRefund).toHaveBeenCalledWith(BOOKING, 10000, 'Could not get in', 'stay_issue');
      expect(bookingModel.updateOne).toHaveBeenCalledWith(
        expect.anything(),
        { $set: expect.objectContaining({ status: BookingStatus.CANCELLED }) },
      );
    });

    it('failed refund: report goes back to open and the money stays frozen', async () => {
      const { service, payments, payouts, issueModel, issueDoc } = build();
      payments.processBookingRefund.mockRejectedValue(new Error('CamerPay down'));
      await expect(service.resolve(ADMIN, ISSUE, { outcome: IssueOutcome.REFUND, note: 'x y z' })).rejects.toThrow('CamerPay');
      expect(issueModel.updateOne).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ $set: { status: IssueStatus.OPEN } }));
      expect(payouts.unfreeze).not.toHaveBeenCalled();
      expect(issueDoc.save).not.toHaveBeenCalled();
    });

    it('refund that quietly did not happen is not reported as done', async () => {
      const { service, payments, payouts } = build();
      payments.processBookingRefund.mockResolvedValue(false);
      await expect(service.resolve(ADMIN, ISSUE, { outcome: IssueOutcome.REFUND, note: 'x y z' })).rejects.toThrow('did not go through');
      expect(payouts.unfreeze).not.toHaveBeenCalled();
    });

    it('two admins cannot decide the same report', async () => {
      const { service, payments, issueModel } = build();
      issueModel.findOneAndUpdate.mockResolvedValue(null);
      await expect(service.resolve(ADMIN, ISSUE, { outcome: IssueOutcome.REFUND, note: 'x y z' })).rejects.toThrow('already been decided');
      expect(payments.processBookingRefund).not.toHaveBeenCalled();
    });

    it('allows a second refund up to what is left', async () => {
      const { service, payments } = build(stay({ issueRefundAmount: 1000 }));
      payments.refundableAmount.mockResolvedValue(9000);
      await service.resolve(ADMIN, ISSUE, { outcome: IssueOutcome.REFUND, amount: 9000, note: 'The rest' });
      expect(payments.processBookingRefund).toHaveBeenCalledWith(BOOKING, 9000, 'The rest', 'stay_issue');
      const again = build();
      again.payments.refundableAmount.mockResolvedValue(9000);
      await expect(again.service.resolve(ADMIN, ISSUE, { outcome: IssueOutcome.REFUND, amount: 9001, note: 'x y z' })).rejects.toThrow('between');
    });

    it('refuses a refund above what was paid, or on an already refunded booking', async () => {
      const a = build();
      await expect(a.service.resolve(ADMIN, ISSUE, { outcome: IssueOutcome.REFUND, amount: 10001, note: 'x y z' })).rejects.toThrow('between');
      const b = build();
      b.payments.refundableAmount.mockResolvedValue(0);
      await expect(b.service.resolve(ADMIN, ISSUE, { outcome: IssueOutcome.REFUND, note: 'x y z' })).rejects.toThrow('already been refunded');
      const c = build(stay({ paymentStatus: PaymentStatus.REFUNDED }));
      await expect(c.service.resolve(ADMIN, ISSUE, { outcome: IssueOutcome.REFUND, note: 'x y z' })).rejects.toThrow('already been refunded');
    });
  });

  describe('co-hosts', () => {
    it('can see the report and reply, and hear about new ones', async () => {
      const { service, coHosts, issueDoc } = build();
      coHosts.isActive.mockResolvedValue(true);
      issueDoc.lean = undefined;
      await service.respond({ _id: ADMIN._id }, ISSUE, 'We fixed it');
      expect(issueDoc.hostResponse).toBe('We fixed it');
      await service.report({ _id: GUEST }, report);
      expect(coHosts.notifyCoHosts).toHaveBeenCalled();
    });
  });

  describe('respond', () => {
    it('only the host can reply, and only while it is open', async () => {
      const { service, issueDoc } = build();
      await expect(service.respond({ _id: GUEST }, ISSUE, 'hello')).rejects.toThrow('not your booking');
      issueDoc.status = IssueStatus.RESOLVED;
      await expect(service.respond({ _id: HOST }, ISSUE, 'hello')).rejects.toThrow('already been decided');
    });
  });
});
