import { BadRequestException } from '@nestjs/common';
import { WalletService } from './wallet.service';

const TX = '507f1f77bcf86cd799439021';
const HOST = '507f1f77bcf86cd799439022';
const ADMIN = '507f1f77bcf86cd799439023';

function build() {
  const walletModel: any = { updateOne: jest.fn().mockResolvedValue({}) };
  const transactionModel: any = {
    findOneAndUpdate: jest.fn(),
    updateOne: jest.fn().mockResolvedValue({}),
  };
  const camerpay: any = {
    initiatePayout: jest.fn().mockResolvedValue({ success: false }),
  };
  const notifications: any = {
    create: jest.fn().mockResolvedValue(undefined),
    notifyAdmins: jest.fn().mockResolvedValue(undefined),
  };
  const service = new WalletService(
    walletModel,
    transactionModel,
    camerpay,
    notifications,
  );
  return { service, walletModel, transactionModel, camerpay, notifications };
}

const pendingTx = (over: any = {}) => ({
  _id: TX,
  userId: HOST,
  amount: 25000,
  status: 'success',
  flutterwaveReference: 'WD-abc',
  ...over,
});

describe('withdrawals sent by hand', () => {
  it('marks a waiting withdrawal sent and tells the host', async () => {
    const { service, transactionModel, notifications } = build();
    transactionModel.findOneAndUpdate.mockResolvedValue(pendingTx());
    await expect(
      service.adminMarkWithdrawalSent(TX, ADMIN, ' MP123 '),
    ).resolves.toEqual({ id: TX, status: 'success' });
    const [filter, update] = transactionModel.findOneAndUpdate.mock.calls[0];
    expect(filter).toMatchObject({ _id: TX, status: 'pending' });
    expect(update.$set['metadata.manual']).toMatchObject({
      action: 'sent',
      by: ADMIN,
      providerReference: 'MP123',
    });
    expect(notifications.create).toHaveBeenCalledTimes(1);
  });

  it('refuses one that is not waiting any more', async () => {
    const { service, transactionModel } = build();
    transactionModel.findOneAndUpdate.mockResolvedValue(null);
    await expect(
      service.adminMarkWithdrawalSent(TX, ADMIN),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.adminRefundWithdrawal(TX, ADMIN),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('gives the money back once, without counting it as new earnings', async () => {
    const { service, transactionModel, walletModel } = build();
    transactionModel.findOneAndUpdate.mockResolvedValue(
      pendingTx({ status: 'failed' }),
    );
    const credit = jest
      .spyOn(service, 'creditWallet')
      .mockResolvedValue({} as any);
    await service.adminRefundWithdrawal(TX, ADMIN, 'Number not registered');
    expect(credit).toHaveBeenCalledWith(
      HOST,
      25000,
      expect.any(String),
      'WD-abc-REFUND',
    );
    expect(walletModel.updateOne.mock.calls[0][1]).toEqual({
      $inc: { totalWithdrawn: -25000, totalEarned: -25000 },
    });
  });

  it('puts it back in the waiting list when the balance could not be credited', async () => {
    const { service, transactionModel } = build();
    transactionModel.findOneAndUpdate.mockResolvedValue(
      pendingTx({ status: 'failed' }),
    );
    jest.spyOn(service, 'creditWallet').mockRejectedValue(new Error('db down'));
    await expect(service.adminRefundWithdrawal(TX, ADMIN)).rejects.toThrow(
      'db down',
    );
    expect(transactionModel.updateOne.mock.calls[0][1].$set.status).toBe(
      'pending',
    );
  });
});

describe('automatic withdrawal', () => {
  const setup = (wallet: any, waiting = false) => {
    const b = build();
    b.walletModel.findOne = jest.fn(() => ({ lean: async () => wallet }));
    b.transactionModel.exists = jest.fn().mockResolvedValue(waiting ? { _id: 'x' } : null);
    const request = jest
      .spyOn(b.service, 'requestWithdrawal')
      .mockResolvedValue({} as any);
    return { ...b, request };
  };
  const base = {
    _id: 'w1',
    autoWithdrawal: true,
    autoWithdrawalThreshold: 20000,
    availableBalance: 31500,
    balance: 40000,
    mobileMoneyNumber: '+237 677 12 34 56',
    mobileMoneyProvider: 'MTN',
  };

  it('requests the whole withdrawable balance to the saved number once the threshold is reached', async () => {
    const { service, request } = setup(base);
    await expect(service.autoWithdrawIfDue(HOST)).resolves.toBe(true);
    expect(request).toHaveBeenCalledWith(
      HOST,
      31500,
      'mtn_momo',
      { phoneNumber: '677123456' },
      { auto: true },
    );
  });

  it('does nothing when off, under the threshold, or one is already waiting', async () => {
    for (const [wallet, waiting] of [
      [{ ...base, autoWithdrawal: false }, false],
      [{ ...base, availableBalance: 19999 }, false],
      [base, true],
    ] as [any, boolean][]) {
      const { service, request } = setup(wallet, waiting);
      await expect(service.autoWithdrawIfDue(HOST)).resolves.toBe(false);
      expect(request).not.toHaveBeenCalled();
    }
  });

  it('uses the bank account when there is no Mobile Money number', async () => {
    const { service, request } = setup({
      ...base,
      mobileMoneyNumber: undefined,
      bankAccountNumber: '1002003004',
      bankAccountName: 'Ada Host',
    });
    await service.autoWithdrawIfDue(HOST);
    expect(request.mock.calls[0][2]).toBe('bank_transfer');
  });

  it('asks the host for a payout method when there is none', async () => {
    const { service, request, notifications } = setup({
      ...base,
      mobileMoneyNumber: undefined,
    });
    await expect(service.autoWithdrawIfDue(HOST)).resolves.toBe(false);
    expect(request).not.toHaveBeenCalled();
    expect(notifications.create).toHaveBeenCalledTimes(1);
  });
});

describe('withdrawals go to the saved payout method only', () => {
  const wallet = (over: any = {}) => ({
    availableBalance: 50000,
    balance: 50000,
    mobileMoneyNumber: '677123456',
    mobileMoneyProvider: 'MTN',
    ...over,
  });
  const setup = (w: any) => {
    const b = build();
    jest.spyOn(b.service, 'getOrCreateWallet').mockResolvedValue(w);
    const debit = jest.spyOn(b.service, 'debitWallet').mockResolvedValue({} as any);
    return { ...b, debit };
  };
  const codeOf = async (p: Promise<any>) => {
    try {
      await p;
      return 'ok';
    } catch (e: any) {
      return e?.getResponse?.()?.code ?? e?.message;
    }
  };

  it('refuses when nothing is saved', async () => {
    const { service, debit } = setup(wallet({ mobileMoneyNumber: undefined }));
    expect(await codeOf(service.requestWithdrawal(HOST, 10000, 'mtn_momo', { phoneNumber: '677123456' }))).toBe('NO_PAYOUT_METHOD');
    expect(debit).not.toHaveBeenCalled();
  });

  it('refuses another number than the saved one', async () => {
    const { service, debit } = setup(wallet());
    expect(await codeOf(service.requestWithdrawal(HOST, 10000, 'mtn_momo', { phoneNumber: '+237 699 00 00 00' }))).toBe('USE_SAVED_METHOD');
    expect(debit).not.toHaveBeenCalled();
  });

  it('waits a day after the payout method changed', async () => {
    const { service, debit } = setup(wallet({ payoutMethodChangedAt: new Date(Date.now() - 3_600_000) }));
    expect(await codeOf(service.requestWithdrawal(HOST, 10000, 'mtn_momo', { phoneNumber: '677123456' }))).toBe('PAYOUT_METHOD_NEW');
    expect(debit).not.toHaveBeenCalled();
  });

  it('accepts the saved number, written any way', async () => {
    const { service, debit } = setup(wallet({ payoutMethodChangedAt: new Date(Date.now() - 2 * 86_400_000) }));
    await codeOf(service.requestWithdrawal(HOST, 10000, 'mtn_momo', { phoneNumber: '+237 6 77 12 34 56' }));
    expect(debit).toHaveBeenCalledWith(HOST, 10000, 'Withdrawal via mtn_momo', expect.stringMatching(/^WD-/), { availableOnly: true });
  });
});
