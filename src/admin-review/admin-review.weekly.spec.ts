import { AdminReviewService } from './admin-review.service';

const chain = (rows: any[]) => ({ select: () => ({ lean: () => ({ exec: async () => rows }) }) });

function build(flagged: any[], flaggedOld: any[], withdrawals: any[]) {
  const checkouts: any = { find: jest.fn(() => chain(flagged)) };
  const transactions: any = {
    find: jest.fn((q: any) => chain(q.type ? withdrawals : flaggedOld)),
  };
  const notifyAdmins = jest.fn().mockResolvedValue(undefined);
  const moduleRef: any = { get: () => ({ notifyAdmins }) };
  const service = new AdminReviewService(checkouts, transactions, {} as any, {} as any, moduleRef);
  return { service, notifyAdmins };
}

describe('weekly money check', () => {
  it('reminds the team of flagged payments and withdrawals still waiting', async () => {
    const { service, notifyAdmins } = build([{ amount: 15000 }], [{ amount: 5000 }], [{ amount: 30000 }]);
    await expect(service.weeklyReminder()).resolves.toEqual({ flagged: 2, withdrawals: 1 });
    const msg = notifyAdmins.mock.calls[0][0].message as string;
    expect(msg).toContain('2 flagged payments');
    expect(msg).toContain('1 withdrawal');
  });

  it('stays quiet when nothing is waiting', async () => {
    const { service, notifyAdmins } = build([], [], []);
    await expect(service.weeklyReminder()).resolves.toEqual({ flagged: 0, withdrawals: 0 });
    expect(notifyAdmins).not.toHaveBeenCalled();
  });
});
