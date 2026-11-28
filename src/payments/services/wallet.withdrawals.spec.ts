import { BadRequestException } from '@nestjs/common';
import { WalletService } from './wallet.service';

const TX = '507f1f77bcf86cd799439021';
const HOST = '507f1f77bcf86cd799439022';
const ADMIN = '507f1f77bcf86cd799439023';

function build() {
  const walletModel: any = { updateOne: jest.fn().mockResolvedValue({}) };
  const transactionModel: any = { findOneAndUpdate: jest.fn(), updateOne: jest.fn().mockResolvedValue({}) };
  const camerpay: any = { initiatePayout: jest.fn().mockResolvedValue({ success: false }) };
  const notifications: any = { create: jest.fn().mockResolvedValue(undefined), notifyAdmins: jest.fn().mockResolvedValue(undefined) };
  const service = new WalletService(walletModel, transactionModel, camerpay, notifications);
  return { service, walletModel, transactionModel, camerpay, notifications };
}

const pendingTx = (over: any = {}) => ({
  _id: TX, userId: HOST, amount: 25000, status: 'success', flutterwaveReference: 'WD-abc', ...over,
});

describe('withdrawals sent by hand', () => {
  it('marks a waiting withdrawal sent and tells the host', async () => {
    const { service, transactionModel, notifications } = build();
    transactionModel.findOneAndUpdate.mockResolvedValue(pendingTx());
    await expect(service.adminMarkWithdrawalSent(TX, ADMIN, ' MP123 ')).resolves.toEqual({ id: TX, status: 'success' });
    const [filter, update] = transactionModel.findOneAndUpdate.mock.calls[0];
    expect(filter).toMatchObject({ _id: TX, status: 'pending' });
    expect(update.$set['metadata.manual']).toMatchObject({ action: 'sent', by: ADMIN, providerReference: 'MP123' });
    expect(notifications.create).toHaveBeenCalledTimes(1);
  });

  it('refuses one that is not waiting any more', async () => {
    const { service, transactionModel } = build();
    transactionModel.findOneAndUpdate.mockResolvedValue(null);
    await expect(service.adminMarkWithdrawalSent(TX, ADMIN)).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.adminRefundWithdrawal(TX, ADMIN)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('gives the money back once, without counting it as new earnings', async () => {
    const { service, transactionModel, walletModel } = build();
    transactionModel.findOneAndUpdate.mockResolvedValue(pendingTx({ status: 'failed' }));
    const credit = jest.spyOn(service, 'creditWallet').mockResolvedValue({} as any);
    await service.adminRefundWithdrawal(TX, ADMIN, 'Number not registered');
    expect(credit).toHaveBeenCalledWith(HOST, 25000, expect.any(String), 'WD-abc-REFUND');
    expect(walletModel.updateOne.mock.calls[0][1]).toEqual({ $inc: { totalWithdrawn: -25000, totalEarned: -25000 } });
  });

  it('puts it back in the waiting list when the balance could not be credited', async () => {
    const { service, transactionModel } = build();
    transactionModel.findOneAndUpdate.mockResolvedValue(pendingTx({ status: 'failed' }));
    jest.spyOn(service, 'creditWallet').mockRejectedValue(new Error('db down'));
    await expect(service.adminRefundWithdrawal(TX, ADMIN)).rejects.toThrow('db down');
    expect(transactionModel.updateOne.mock.calls[0][1].$set.status).toBe('pending');
  });
});
