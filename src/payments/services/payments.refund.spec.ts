import { PaymentStatus } from '../../bookings/schema/booking.schema';
import { TransactionStatus } from '../schemas/transaction.schema';
import { PaymentsService } from './payments.service';

const BOOKING = '507f1f77bcf86cd799439041';

type Tx = { _id: string; amount: number; refundedAmount?: number; status: string; flutterwaveTransactionId?: string; flutterwaveReference?: string; paymentMethod?: string };

const paidTx = (id: string, amount: number, over: Partial<Tx> = {}): Tx => ({
  _id: id, amount, status: TransactionStatus.SUCCESS, flutterwaveTransactionId: `uuid-${id}`, ...over,
});

function build(txs: Tx[], bookingOver: any = {}) {
  const booking = {
    _id: BOOKING, guestId: 'guest', hostId: { toString: () => 'host' }, propertyId: { title: 'Villa' },
    paymentStatus: PaymentStatus.PAID, currency: 'XAF', priceBreakdown: { totalAmount: 10000 }, ...bookingOver,
  };
  const transactionModel: any = {
    find: jest.fn(() => ({ sort: () => Promise.resolve(txs.filter((t) => t.status === TransactionStatus.SUCCESS)) })),
    updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
    create: jest.fn(async (doc: any) => ({ _id: 'refund-tx', ...doc })),
    findByIdAndUpdate: jest.fn().mockResolvedValue(undefined),
  };
  const bookingModel: any = {
    findById: jest.fn(() => ({ populate: () => ({ exec: () => Promise.resolve(booking) }) })),
    findByIdAndUpdate: jest.fn().mockResolvedValue(undefined),
  };
  const notifications: any = { notifyAdmins: jest.fn().mockResolvedValue(undefined), notifyRefundProcessed: jest.fn().mockResolvedValue(undefined) };
  const camerPay: any = { refundPayment: jest.fn().mockResolvedValue({ success: true }) };
  const wallet: any = { debitWallet: jest.fn().mockResolvedValue(undefined) };
  const payouts: any = { reduceHold: jest.fn().mockResolvedValue(true) };
  const service = new PaymentsService(transactionModel, bookingModel, {} as any, notifications, camerPay, { get: () => undefined } as any, wallet, payouts, {} as any);
  return { service, transactionModel, bookingModel, notifications, camerPay, wallet, payouts };
}

describe('processBookingRefund', () => {
  it('a partial refund leaves the payment open for another one', async () => {
    const { service, transactionModel, camerPay, bookingModel } = build([paidTx('a', 10000)]);
    await expect(service.processBookingRefund(BOOKING, 3000, 'one night', 'stay_issue')).resolves.toBe(true);
    expect(camerPay.refundPayment).toHaveBeenCalledWith('uuid-a', 3000, 'one night');
    expect(transactionModel.updateOne).toHaveBeenCalledWith(expect.objectContaining({ _id: 'a' }), { $inc: { refundedAmount: 3000 } });
    const update = transactionModel.findByIdAndUpdate.mock.calls[0][1];
    expect(update.status).toBeUndefined();
    expect(bookingModel.findByIdAndUpdate).toHaveBeenCalledWith(BOOKING, { $inc: { issueRefundAmount: 3000 } });
  });

  it('counts what was already refunded, and refuses more than is left', async () => {
    const { service, camerPay, notifications } = build([paidTx('a', 10000, { refundedAmount: 8000 })]);
    await expect(service.processBookingRefund(BOOKING, 3000, 'too much', 'stay_issue')).resolves.toBe(false);
    expect(camerPay.refundPayment).not.toHaveBeenCalled();
    expect(notifications.notifyAdmins).toHaveBeenCalledTimes(1);
  });

  it('the last of the money marks the payment refunded and the booking refunded', async () => {
    const { service, transactionModel, bookingModel, payouts } = build([paidTx('a', 10000, { refundedAmount: 8000 })]);
    await service.processBookingRefund(BOOKING, 2000, 'rest', 'stay_issue');
    expect(transactionModel.findByIdAndUpdate.mock.calls[0][1].status).toBe(TransactionStatus.REFUNDED);
    expect(bookingModel.findByIdAndUpdate).toHaveBeenCalledWith(BOOKING, expect.objectContaining({ paymentStatus: PaymentStatus.REFUNDED }));
    expect(payouts.reduceHold).toHaveBeenCalledWith(BOOKING, 1800, true);
  });

  it('splits across payments, newest first, each with its own CamerPay reference', async () => {
    const { service, camerPay } = build([paidTx('topup', 2000), paidTx('first', 10000)]);
    await service.processBookingRefund(BOOKING, 5000, 'split', 'stay_issue');
    expect(camerPay.refundPayment).toHaveBeenNthCalledWith(1, 'uuid-topup', 2000, 'split');
    expect(camerPay.refundPayment).toHaveBeenNthCalledWith(2, 'uuid-first', 3000, 'split');
  });

  it('a date change keeps the booking paid and leaves cancellation details alone', async () => {
    const { service, bookingModel, payouts } = build([paidTx('a', 10000)]);
    await service.processBookingRefund(BOOKING, 4000, 'Date change', 'date_change');
    expect(bookingModel.findByIdAndUpdate).toHaveBeenCalledWith(BOOKING, {});
    expect(payouts.reduceHold).toHaveBeenCalledWith(BOOKING, 3600, false);
  });

  it('a cancellation sets PARTIAL / processed as before', async () => {
    const { service, bookingModel } = build([paidTx('a', 10000)]);
    await service.processBookingRefund(BOOKING, 5000);
    expect(bookingModel.findByIdAndUpdate).toHaveBeenCalledWith(BOOKING, {
      paymentStatus: PaymentStatus.PARTIAL,
      'cancellation.refundStatus': 'processed',
    });
  });

  it('a cancellation refund that already worked never pays again', async () => {
    const { service, camerPay } = build([paidTx('a', 10000, { refundedAmount: 5000 })], { cancellation: { refundStatus: 'processed' } });
    await expect(service.processBookingRefund(BOOKING, 5000)).resolves.toBe(false);
    expect(camerPay.refundPayment).not.toHaveBeenCalled();
  });

  it('another refund got there first: the claim fails and no money is sent', async () => {
    const { service, transactionModel, camerPay } = build([paidTx('a', 10000)]);
    transactionModel.updateOne.mockResolvedValue({ modifiedCount: 0 });
    await expect(service.processBookingRefund(BOOKING, 5000, 'x', 'stay_issue')).rejects.toThrow('same time');
    expect(camerPay.refundPayment).not.toHaveBeenCalled();
  });

  it('CamerPay refuses: the claim is given back and the host is untouched', async () => {
    const { service, transactionModel, camerPay, payouts, wallet } = build([paidTx('a', 10000)]);
    camerPay.refundPayment.mockRejectedValue(new Error('refused'));
    await expect(service.processBookingRefund(BOOKING, 5000, 'x', 'stay_issue')).rejects.toThrow('refused');
    expect(transactionModel.updateOne).toHaveBeenLastCalledWith({ _id: 'a' }, { $inc: { refundedAmount: -5000 } });
    expect(payouts.reduceHold).not.toHaveBeenCalled();
    expect(wallet.debitWallet).not.toHaveBeenCalled();
  });

  it('second payment refused: only what was sent counts, and admins hear about the rest', async () => {
    const { service, camerPay, payouts, notifications, bookingModel } = build([paidTx('topup', 2000), paidTx('first', 10000)]);
    camerPay.refundPayment.mockResolvedValueOnce({ success: true }).mockRejectedValueOnce(new Error('refused'));
    await expect(service.processBookingRefund(BOOKING, 5000, 'x', 'stay_issue')).resolves.toBe(false);
    expect(payouts.reduceHold).toHaveBeenCalledWith(BOOKING, 1800, false);
    expect(bookingModel.findByIdAndUpdate).toHaveBeenCalledWith(BOOKING, { $inc: { issueRefundAmount: 2000 } });
    expect(notifications.notifyAdmins).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('3000') }));
  });

  it('money sent but a later write fails: still reported as refunded, so nobody retries it', async () => {
    const { service, transactionModel } = build([paidTx('a', 10000)]);
    transactionModel.create.mockRejectedValue(new Error('db down'));
    await expect(service.processBookingRefund(BOOKING, 5000, 'x', 'stay_issue')).resolves.toBe(true);
  });

  it('nothing held: it comes from the host balance', async () => {
    const { service, payouts, wallet } = build([paidTx('a', 10000)]);
    payouts.reduceHold.mockResolvedValue(false);
    await service.processBookingRefund(BOOKING, 5000, 'x', 'stay_issue');
    expect(wallet.debitWallet).toHaveBeenCalledWith('host', 4500, expect.any(String), undefined);
  });
});

describe('adminRefundBooking', () => {
  it('no longer reports success when no money was sent', async () => {
    const { service, bookingModel } = build([]);
    bookingModel.findById = jest.fn(() => ({
      exec: () => Promise.resolve({ priceBreakdown: { totalAmount: 100 } }),
      populate: () => ({ exec: () => Promise.resolve({ paymentStatus: PaymentStatus.REFUNDED }) }),
    }));
    await expect(service.adminRefundBooking(BOOKING, 100)).rejects.toThrow('did not go through');
  });
});

