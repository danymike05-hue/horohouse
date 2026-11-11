import { BookingStatus, PaymentStatus } from '../bookings/schema/booking.schema';
import { BookingChangesService } from './booking-changes.service';
import { DateChangeStatus } from './schemas/booking-date-change.schema';

const BOOKING = '507f1f77bcf86cd799439031';
const CHANGE = '507f1f77bcf86cd799439032';
const GUEST = '507f1f77bcf86cd799439033';
const HOST = '507f1f77bcf86cd799439034';
const DAY = 86_400_000;

const stay = (over: any = {}) => ({
  _id: BOOKING,
  guestId: GUEST,
  hostId: HOST,
  propertyId: '507f1f77bcf86cd799439035',
  status: BookingStatus.CONFIRMED,
  paymentStatus: PaymentStatus.PAID,
  checkIn: new Date('2099-01-10T00:00:00Z'),
  checkOut: new Date('2099-01-13T00:00:00Z'),
  priceBreakdown: { totalAmount: 30000 },
  currency: 'XAF',
  ...over,
});

const changeDoc = (over: any = {}) => ({
  _id: CHANGE,
  bookingId: BOOKING,
  guestId: GUEST,
  hostId: HOST,
  checkIn: new Date('2099-02-01T00:00:00Z'),
  checkOut: new Date('2099-02-05T00:00:00Z'),
  nights: 4,
  priceBreakdown: { totalAmount: 40000 },
  amountDue: 0,
  refundAmount: 0,
  status: DateChangeStatus.PENDING,
  expiresAt: new Date(Date.now() + DAY),
  ...over,
});

function build(opts: { booking?: any; change?: any; newTotal?: number } = {}) {
  const booking = opts.booking ?? stay();
  const change = opts.change ?? changeDoc();
  const changeModel: any = {
    create: jest.fn(async (doc: any) => ({ _id: CHANGE, ...doc })),
    findById: jest.fn().mockResolvedValue(change),
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn().mockResolvedValue(change),
    findByIdAndUpdate: jest.fn().mockResolvedValue({ ...change, status: DateChangeStatus.APPLIED }),
    updateOne: jest.fn().mockResolvedValue(undefined),
    find: jest.fn(),
  };
  const bookingModel: any = {
    findById: jest.fn().mockResolvedValue(booking),
    updateOne: jest.fn().mockResolvedValue({ matchedCount: 1, modifiedCount: 1 }),
  };
  const propertyModel: any = {
    findById: jest.fn(() => ({ select: () => ({ lean: () => Promise.resolve({ title: 'Villa', checkInTime: '15:00' }) }) })),
  };
  const bookings: any = {
    quoteStayChange: jest.fn().mockResolvedValue({ nights: 4, priceBreakdown: { totalAmount: opts.newTotal ?? 40000 } }),
    refundForCheaperStay: jest.fn().mockResolvedValue(0),
  };
  const payments: any = {
    processBookingRefund: jest.fn().mockResolvedValue(true),
    recordDateChangePayment: jest.fn().mockResolvedValue(undefined),
    hostShareOf: (n: number) => n - Math.round(n * 0.1),
  };
  const payouts: any = {
    addToHold: jest.fn().mockResolvedValue(undefined),
    reschedule: jest.fn().mockResolvedValue(undefined),
  };
  const notifications: any = { create: jest.fn().mockResolvedValue(undefined), notifyAdmins: jest.fn().mockResolvedValue(undefined) };
  const coHosts: any = { isActive: jest.fn().mockResolvedValue(false), notifyCoHosts: jest.fn().mockResolvedValue(undefined) };
  const service = new BookingChangesService(changeModel, bookingModel, propertyModel, bookings, payments, payouts, notifications, coHosts);
  return { service, changeModel, bookingModel, bookings, payments, payouts, notifications, coHosts };
}

const dates = { bookingId: BOOKING, checkIn: '2099-02-01', checkOut: '2099-02-05' };
const payment = { amount: 10000, merchantInvoiceId: 'HH-1', paymentMethod: 'mtn_momo', checkoutPaymentId: 'p1', providerReference: 'uuid' };

describe('BookingChangesService', () => {
  describe('preview', () => {
    it('more expensive: the guest pays the difference', async () => {
      const { service } = build({ newTotal: 40000 });
      const quote = await service.preview({ _id: GUEST }, dates);
      expect(quote).toMatchObject({ difference: 10000, amountDue: 10000, refundAmount: 0 });
    });

    it('cheaper: the refund comes from the cancellation policy', async () => {
      const { service, bookings } = build({ newTotal: 20000 });
      bookings.refundForCheaperStay.mockResolvedValue(5000);
      const quote = await service.preview({ _id: GUEST }, dates);
      expect(bookings.refundForCheaperStay).toHaveBeenCalledWith(expect.anything(), 10000);
      expect(quote).toMatchObject({ difference: -10000, amountDue: 0, refundAmount: 5000 });
    });

    it('a difference too small to charge is waived', async () => {
      const { service } = build({ newTotal: 30050 });
      expect(await service.preview({ _id: GUEST }, dates)).toMatchObject({ difference: 50, amountDue: 0 });
    });

    it('only the guest, only on a paid and confirmed stay before check-in day', async () => {
      await expect(build().service.preview({ _id: HOST }, dates)).rejects.toThrow('Only the guest');
      const unpaid = build({ booking: stay({ paymentStatus: PaymentStatus.UNPAID }) });
      await expect(unpaid.service.preview({ _id: GUEST }, dates)).rejects.toThrow('paid, confirmed');
      const started = build({ booking: stay({ checkIn: new Date(Date.now() - DAY) }) });
      await expect(started.service.preview({ _id: GUEST }, dates)).rejects.toThrow('paid, confirmed');
    });

    it('refuses the dates it already has', async () => {
      const { service } = build();
      await expect(service.preview({ _id: GUEST }, { bookingId: BOOKING, checkIn: '2099-01-10', checkOut: '2099-01-13' })).rejects.toThrow('already your dates');
    });
  });

  describe('request', () => {
    it('saves the quote and tells the host; the booking is not touched', async () => {
      const { service, changeModel, bookingModel, notifications } = build();
      await service.request({ _id: GUEST }, dates);
      expect(changeModel.create).toHaveBeenCalledWith(expect.objectContaining({ amountDue: 10000, previousTotal: 30000 }));
      expect(bookingModel.updateOne).not.toHaveBeenCalled();
      expect(notifications.create).toHaveBeenCalledWith(expect.objectContaining({ userId: HOST }));
    });

    it('a second open request is a clear error', async () => {
      const { service, changeModel } = build();
      changeModel.create.mockRejectedValue(Object.assign(new Error('dup'), { code: 11000 }));
      await expect(service.request({ _id: GUEST }, dates)).rejects.toThrow('already have a date change');
    });
  });

  describe('accept', () => {
    it('same price: applies straight away and moves the payout date', async () => {
      const { service, bookingModel, payouts, payments } = build();
      await service.accept({ _id: HOST }, CHANGE);
      expect(payments.processBookingRefund).not.toHaveBeenCalled();
      expect(bookingModel.updateOne).toHaveBeenCalledWith(
        { _id: BOOKING, status: BookingStatus.CONFIRMED },
        { $set: expect.objectContaining({ nights: 4 }) },
      );
      expect(payouts.reschedule).toHaveBeenCalledWith(BOOKING, expect.any(Date), '15:00');
    });

    it('costs more: waits for payment, dates stay as they are', async () => {
      const change = changeDoc({ amountDue: 10000 });
      const { service, bookingModel, changeModel } = build({ change });
      await service.accept({ _id: HOST }, CHANGE);
      expect(changeModel.findOneAndUpdate).toHaveBeenCalledWith(
        expect.anything(),
        { $set: expect.objectContaining({ status: DateChangeStatus.AWAITING_PAYMENT }) },
        expect.anything(),
      );
      expect(bookingModel.updateOne).not.toHaveBeenCalled();
    });

    it('costs less: refunds first, then moves the dates', async () => {
      const { service, payments, bookingModel } = build({ change: changeDoc({ refundAmount: 5000 }) });
      await service.accept({ _id: HOST }, CHANGE);
      expect(payments.processBookingRefund).toHaveBeenCalledWith(BOOKING, 5000, 'Date change', 'date_change');
      expect(bookingModel.updateOne).toHaveBeenCalled();
    });

    it('failed refund: dates do not move and the request stays open', async () => {
      for (const fail of [(m: jest.Mock) => m.mockResolvedValue(false), (m: jest.Mock) => m.mockRejectedValue(new Error('down'))]) {
        const { service, payments, bookingModel, changeModel } = build({ change: changeDoc({ refundAmount: 5000 }) });
        fail(payments.processBookingRefund);
        await expect(service.accept({ _id: HOST }, CHANGE)).rejects.toThrow('did not go through');
        expect(bookingModel.updateOne).not.toHaveBeenCalled();
        expect(changeModel.updateOne).toHaveBeenCalledWith(expect.anything(), { $set: { status: DateChangeStatus.PENDING } });
      }
    });

    it('dates taken since the guest asked: refused with nothing changed', async () => {
      const { service, bookings, bookingModel } = build();
      bookings.quoteStayChange.mockRejectedValue(new Error('already booked'));
      await expect(service.accept({ _id: HOST }, CHANGE)).rejects.toThrow('already booked');
      expect(bookingModel.updateOne).not.toHaveBeenCalled();
    });

    it('only the host, only while it is waiting and not expired', async () => {
      await expect(build().service.accept({ _id: GUEST }, CHANGE)).rejects.toThrow('not your booking');
      const answered = build({ change: changeDoc({ status: DateChangeStatus.DECLINED }) });
      await expect(answered.service.accept({ _id: HOST }, CHANGE)).rejects.toThrow('already been answered');
      const late = build({ change: changeDoc({ expiresAt: new Date(Date.now() - 1000) }) });
      await expect(late.service.accept({ _id: HOST }, CHANGE)).rejects.toThrow('expired');
    });
  });

  describe('co-hosts', () => {
    const COHOST = '507f1f77bcf86cd799439036';

    it('can accept a change that moves no money back', async () => {
      const { service, coHosts, bookingModel } = build();
      coHosts.isActive.mockResolvedValue(true);
      await service.accept({ _id: COHOST }, CHANGE);
      expect(bookingModel.updateOne).toHaveBeenCalled();
    });

    it('cannot accept one that refunds the guest', async () => {
      const { service, coHosts, payments } = build({ change: changeDoc({ refundAmount: 5000 }) });
      coHosts.isActive.mockResolvedValue(true);
      await expect(service.accept({ _id: COHOST }, CHANGE)).rejects.toThrow('host has to accept');
      expect(payments.processBookingRefund).not.toHaveBeenCalled();
    });

    it('can decline', async () => {
      const { service, coHosts, changeModel } = build();
      coHosts.isActive.mockResolvedValue(true);
      await service.decline({ _id: COHOST }, CHANGE);
      expect(changeModel.findOneAndUpdate).toHaveBeenCalled();
    });
  });

  describe('applyPaid', () => {
    const waiting = () => changeDoc({ status: DateChangeStatus.AWAITING_PAYMENT, amountDue: 10000 });

    it('records the payment, holds the host share and moves the dates', async () => {
      const { service, payments, payouts, bookingModel } = build({ change: waiting() });
      await expect(service.applyPaid(CHANGE, payment)).resolves.toMatchObject({ ok: true });
      expect(payments.recordDateChangePayment).toHaveBeenCalledTimes(1);
      expect(payouts.addToHold).toHaveBeenCalledWith(expect.objectContaining({ amount: 9000, hostId: HOST }));
      expect(bookingModel.updateOne).toHaveBeenCalled();
    });

    it('a repeated webhook after it is applied changes nothing', async () => {
      const { service, payouts, payments } = build({ change: changeDoc({ status: DateChangeStatus.APPLIED }) });
      await expect(service.applyPaid(CHANGE, payment)).resolves.toMatchObject({ ok: true });
      expect(payments.recordDateChangePayment).not.toHaveBeenCalled();
      expect(payouts.addToHold).not.toHaveBeenCalled();
    });

    it('a retry after a crash does not hold the share twice', async () => {
      const { service, changeModel, payouts } = build({ change: waiting() });
      changeModel.findOneAndUpdate.mockResolvedValueOnce(waiting()).mockResolvedValueOnce(null);
      await service.applyPaid(CHANGE, payment);
      expect(payouts.addToHold).not.toHaveBeenCalled();
    });

    it('dates gone by the time the money lands: reports it, so checkout flags a refund', async () => {
      const { service, bookings, bookingModel, payments } = build({ change: waiting() });
      bookings.quoteStayChange.mockRejectedValue(new Error('already booked'));
      await expect(service.applyPaid(CHANGE, payment)).resolves.toEqual({ ok: false, reason: 'already booked' });
      expect(payments.recordDateChangePayment).not.toHaveBeenCalled();
      expect(bookingModel.updateOne).not.toHaveBeenCalled();
    });

    it('booking cancelled meanwhile: reports it', async () => {
      const { service } = build({ change: waiting(), booking: stay({ status: BookingStatus.CANCELLED }) });
      await expect(service.applyPaid(CHANGE, payment)).resolves.toMatchObject({ ok: false });
    });

    it('withdrawn request: reports it', async () => {
      const { service, changeModel } = build({ change: changeDoc({ status: DateChangeStatus.CANCELLED }) });
      changeModel.findOneAndUpdate.mockResolvedValue(null);
      await expect(service.applyPaid(CHANGE, payment)).resolves.toMatchObject({ ok: false });
    });
  });

  describe('payable', () => {
    it('only the guest, only while waiting for payment', async () => {
      const waiting = changeDoc({ status: DateChangeStatus.AWAITING_PAYMENT, amountDue: 10000 });
      await expect(build({ change: waiting }).service.payable(HOST, CHANGE)).rejects.toThrow('not your booking');
      await expect(build({ change: changeDoc({ amountDue: 10000 }) }).service.payable(GUEST, CHANGE)).rejects.toThrow('no longer waiting');
      await expect(build({ change: waiting }).service.payable(GUEST, CHANGE)).resolves.toMatchObject({ title: 'Villa' });
    });
  });
});
