import { PayoutStatus } from '../../bookings/schema/booking.schema';
import { checkInTimeOf, HostPayoutsService, payoutReleaseAt } from './host-payouts.service';

const ID = '507f1f77bcf86cd799439011';
const HOST = '507f1f77bcf86cd799439012';

function build(opts: { holdHours?: string; planHours?: number } = {}) {
  const bookingModel: any = {
    findOneAndUpdate: jest.fn(), updateOne: jest.fn(), find: jest.fn(),
    findById: jest.fn(() => ({ select: () => ({ lean: async () => ({ hostId: HOST }) }) })),
  };
  const wallet: any = {
    holdFunds: jest.fn().mockResolvedValue(undefined),
    dropHeldFunds: jest.fn().mockResolvedValue(undefined),
    releaseHeldFunds: jest.fn().mockResolvedValue(undefined),
  };
  const notifications: any = { create: jest.fn().mockResolvedValue(undefined) };
  const config: any = { get: () => opts.holdHours };
  const plans: any = opts.planHours !== undefined ? { payoutHoldHours: jest.fn().mockResolvedValue(opts.planHours) } : undefined;
  const service = new HostPayoutsService(bookingModel, wallet, notifications, config, plans);
  return { service, bookingModel, wallet, notifications };
}

const populated = (value: any) => ({ populate: jest.fn().mockResolvedValue(value) });

describe('payoutReleaseAt', () => {
  const checkIn = new Date('2026-12-10T00:00:00.000Z');

  it('counts from the check-in time (Cameroon time), not from midnight', () => {
    expect(payoutReleaseAt(checkIn, '15:30', 24).toISOString()).toBe('2026-12-11T14:30:00.000Z');
  });

  it('a check-in at midnight stays on its own day in Cameroon', () => {
    expect(payoutReleaseAt(checkIn, '00:00', 24).toISOString()).toBe('2026-12-10T23:00:00.000Z');
  });

  it('reads the time where the listing keeps it', () => {
    expect(checkInTimeOf({ shortTermAmenities: { checkInTime: '16:00' } })).toBe('16:00');
    expect(checkInTimeOf({ checkInTime: '16:00' })).toBeUndefined();
    expect(checkInTimeOf(null)).toBeUndefined();
  });

  it('uses 14:00 when the listing has no usable check-in time', () => {
    for (const time of [undefined, '', 'evening', '25:00']) {
      expect(payoutReleaseAt(checkIn, time, 24).toISOString()).toBe('2026-12-11T13:00:00.000Z');
    }
  });
});

describe('HostPayoutsService', () => {
  describe('hold', () => {
    const params = { bookingId: ID, hostId: HOST, amount: 9000, checkIn: new Date('2026-12-10T00:00:00Z') };

    it('puts the money in the pending balance', async () => {
      const { service, bookingModel, wallet } = build();
      bookingModel.findOneAndUpdate.mockResolvedValue({ _id: ID });
      await expect(service.hold(params)).resolves.toEqual(new Date('2026-12-11T13:00:00.000Z'));
      expect(wallet.holdFunds).toHaveBeenCalledWith(HOST, 9000);
    });

    it('holds nothing more on a repeated payment callback', async () => {
      const { service, bookingModel, wallet } = build();
      bookingModel.findOneAndUpdate.mockResolvedValue(null);
      await expect(service.hold(params)).resolves.toBeNull();
      expect(wallet.holdFunds).not.toHaveBeenCalled();
    });

    it('respects PAYOUT_HOLD_HOURS, including 0', async () => {
      const { service, bookingModel } = build({ holdHours: '0' });
      bookingModel.findOneAndUpdate.mockResolvedValue({ _id: ID });
      await expect(service.hold(params)).resolves.toEqual(new Date('2026-12-10T13:00:00.000Z'));
    });

    it('pays Pro and Elite hosts 12h after their listing\'s check-in time', async () => {
      const { service, bookingModel } = build({ planHours: 12 });
      bookingModel.findOneAndUpdate.mockResolvedValue({ _id: ID });
      await expect(service.hold({ ...params, checkInTime: '16:00' })).resolves.toEqual(new Date('2026-12-11T03:00:00.000Z'));
    });

    it('a new check-in date moves the wait with the same rules', async () => {
      const { service, bookingModel } = build({ planHours: 12 });
      await service.reschedule(ID, new Date('2026-12-20T00:00:00Z'), '16:00');
      expect(bookingModel.updateOne.mock.calls[0][1]).toEqual({ $set: { 'payout.releaseAt': new Date('2026-12-21T03:00:00.000Z') } });
    });
  });

  describe('release', () => {
    const booking = {
      hostId: HOST, nights: 2, currency: 'XAF', propertyId: { title: 'Villa' },
      payout: { status: PayoutStatus.RELEASED, amount: 9000 },
    };

    it('moves the money to the balance and tells the host', async () => {
      const { service, bookingModel, wallet, notifications } = build();
      bookingModel.findOneAndUpdate.mockReturnValue(populated(booking));
      await expect(service.release(ID)).resolves.toBe(true);
      expect(wallet.releaseHeldFunds).toHaveBeenCalledWith(HOST, 9000, expect.stringContaining('Villa'), `PAYOUT-${ID}`);
      expect(notifications.create).toHaveBeenCalledTimes(1);
    });

    it('does nothing when the money is frozen or already paid (claim finds nothing)', async () => {
      const { service, bookingModel, wallet } = build();
      bookingModel.findOneAndUpdate.mockReturnValue(populated(null));
      await expect(service.release(ID)).resolves.toBe(false);
      expect(wallet.releaseHeldFunds).not.toHaveBeenCalled();
    });

    it('goes back to held if the wallet update fails, so the job retries', async () => {
      const { service, bookingModel, wallet } = build();
      bookingModel.findOneAndUpdate.mockReturnValue(populated(booking));
      wallet.releaseHeldFunds.mockRejectedValue(new Error('db down'));
      await expect(service.release(ID)).rejects.toThrow('db down');
      expect(bookingModel.updateOne).toHaveBeenCalledWith(
        { _id: ID, 'payout.status': PayoutStatus.RELEASED },
        expect.objectContaining({ $set: { 'payout.status': PayoutStatus.HELD } }),
      );
    });

    it('a failed notification does not undo the payout', async () => {
      const { service, bookingModel, notifications } = build();
      bookingModel.findOneAndUpdate.mockReturnValue(populated(booking));
      notifications.create.mockRejectedValue(new Error('push down'));
      await expect(service.release(ID)).resolves.toBe(true);
      expect(bookingModel.updateOne).not.toHaveBeenCalled();
    });
  });

  describe('reduceHold', () => {
    it('reports false when nothing is held, so the caller debits the balance', async () => {
      const { service, bookingModel, wallet } = build();
      bookingModel.findOneAndUpdate.mockResolvedValue(null);
      await expect(service.reduceHold(ID, 4500, false)).resolves.toBe(false);
      expect(wallet.dropHeldFunds).not.toHaveBeenCalled();
    });

    it('partial refund drops only the refunded share', async () => {
      const { service, bookingModel, wallet } = build();
      bookingModel.findOneAndUpdate.mockResolvedValue({ hostId: HOST, payout: { amount: 9000 } });
      await expect(service.reduceHold(ID, 4500, false)).resolves.toBe(true);
      expect(wallet.dropHeldFunds).toHaveBeenCalledWith(HOST, 4500);
    });

    it('full refund drops everything held, whatever the rounding', async () => {
      const { service, bookingModel, wallet } = build();
      bookingModel.findOneAndUpdate.mockResolvedValue({ hostId: HOST, payout: { amount: 9001 } });
      await service.reduceHold(ID, 9000, true);
      expect(wallet.dropHeldFunds).toHaveBeenCalledWith(HOST, 9001);
    });

    it('never drops more than is held', async () => {
      const { service, bookingModel, wallet } = build();
      bookingModel.findOneAndUpdate.mockResolvedValue({ hostId: HOST, payout: { amount: 1000 } });
      await service.reduceHold(ID, 4500, false);
      expect(wallet.dropHeldFunds).toHaveBeenCalledWith(HOST, 1000);
    });
  });

  describe('unfreeze', () => {
    it('waits when the release date is still ahead', async () => {
      const { service, bookingModel, wallet } = build();
      bookingModel.findOneAndUpdate.mockResolvedValueOnce({ payout: { releaseAt: new Date(Date.now() + 3_600_000) } });
      await service.unfreeze(ID);
      expect(bookingModel.findOneAndUpdate).toHaveBeenCalledTimes(1);
      expect(wallet.releaseHeldFunds).not.toHaveBeenCalled();
    });

    it('pays right away when the date has passed', async () => {
      const { service, bookingModel, wallet } = build();
      bookingModel.findOneAndUpdate
        .mockResolvedValueOnce({ payout: { releaseAt: new Date(Date.now() - 1000) } })
        .mockReturnValueOnce(populated({
          hostId: HOST, nights: 1, propertyId: { title: 'Villa' },
          payout: { status: PayoutStatus.RELEASED, amount: 500 },
        }));
      await service.unfreeze(ID);
      expect(wallet.releaseHeldFunds).toHaveBeenCalledTimes(1);
    });
  });
});
