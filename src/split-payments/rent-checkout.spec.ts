import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { SplitPaymentsService } from './split-payments.service';
import { SplitPaymentStatus, TenantShareStatus } from './schemas/split-payment.schema';

// Tenants paying their own rent share through checkout (card or Mobile Money)
const LANDLORD = new Types.ObjectId().toString();
const TENANT_A = new Types.ObjectId().toString();
const TENANT_B = new Types.ObjectId().toString();
const STRANGER = new Types.ObjectId().toString();

function makeCycle(over: Partial<{ status: SplitPaymentStatus; aStatus: TenantShareStatus; aPaid: number }> = {}) {
  const cycle: any = {
    _id: new Types.ObjectId(),
    landlordUserId: new Types.ObjectId(LANDLORD),
    leaseId: 'lease1',
    propertyId: { title: 'Studio Bastos' },
    cycleLabel: 'December 2026',
    totalRent: 200_000,
    totalCollected: over.aPaid ?? 0,
    status: over.status ?? SplitPaymentStatus.PENDING,
    tenantShares: [
      { tenantUserId: new Types.ObjectId(TENANT_A), tenantName: 'Awa', amountDue: 100_000, amountPaid: over.aPaid ?? 0, status: over.aStatus ?? TenantShareStatus.UNPAID, dueDate: new Date() },
      { tenantUserId: new Types.ObjectId(TENANT_B), tenantName: 'Ben', amountDue: 100_000, amountPaid: 0, status: TenantShareStatus.UNPAID, dueDate: new Date() },
    ],
    markModified: jest.fn(),
    save: jest.fn().mockResolvedValue(undefined),
  };
  return cycle;
}

function build(cycle: any, requesterRole = 'landlord') {
  const query = (value: any) => ({ populate: () => ({ exec: () => Promise.resolve(value) }), exec: () => Promise.resolve(value) });
  const model: any = { findById: jest.fn(() => query(cycle)) };
  const users: any = { findById: jest.fn(() => ({ select: () => ({ exec: () => Promise.resolve({ role: requesterRole }) }) })) };
  const notifications: any = { create: jest.fn().mockResolvedValue(undefined) };
  const service = new SplitPaymentsService(model, users, notifications, {} as any);
  return { service, notifications };
}

describe('Rent paid by the tenant through checkout', () => {
  it('quotes what the tenant still owes, with the home and month as the label', async () => {
    const { service } = build(makeCycle({ aPaid: 30_000 }));
    const q = await service.payableShare('64b000000000000000000001', TENANT_A);
    expect(q).toEqual({ amount: 70_000, label: 'Studio Bastos · December 2026', leaseId: 'lease1' });
  });

  it('refuses someone who is not a tenant of the cycle (as if it did not exist)', async () => {
    const { service } = build(makeCycle());
    await expect(service.payableShare('64b000000000000000000001', STRANGER)).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.payableShare('64b000000000000000000001', LANDLORD)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('refuses a share that is already paid, waived, or a cycle already paid out', async () => {
    for (const c of [makeCycle({ aStatus: TenantShareStatus.PAID }), makeCycle({ aStatus: TenantShareStatus.WAIVED }), makeCycle({ status: SplitPaymentStatus.DISBURSED })]) {
      const { service } = build(c);
      await expect(service.payableShare('64b000000000000000000001', TENANT_A)).rejects.toBeInstanceOf(ConflictException);
    }
  });

  it('marks the share paid, updates the cycle and tells the landlord', async () => {
    const cycle = makeCycle();
    const { service, notifications } = build(cycle);
    const r = await service.markSharePaidFromCheckout(String(cycle._id), TENANT_A, { amount: 100_000, checkoutPaymentId: 'pay1', method: 'card' });
    expect(r).toBe('activated');
    const a = cycle.tenantShares[0];
    expect(a.status).toBe(TenantShareStatus.PAID);
    expect(a.amountPaid).toBe(100_000);
    expect(a.checkoutPaymentId).toBe('pay1');
    expect(a.paymentMethod).toBe('card');
    expect(cycle.totalCollected).toBe(100_000);
    expect(cycle.status).toBe(SplitPaymentStatus.PARTIAL);
    expect(cycle.save).toHaveBeenCalled();
    expect(notifications.create).toHaveBeenCalledWith(expect.objectContaining({ userId: LANDLORD }));
  });

  it('completes the cycle when the last tenant pays', async () => {
    const cycle = makeCycle();
    cycle.tenantShares[1].status = TenantShareStatus.PAID;
    cycle.tenantShares[1].amountPaid = 100_000;
    const { service, notifications } = build(cycle);
    await service.markSharePaidFromCheckout(String(cycle._id), TENANT_A, { amount: 100_000, checkoutPaymentId: 'pay1' });
    expect(cycle.status).toBe(SplitPaymentStatus.COMPLETE);
    expect(cycle.totalCollected).toBe(200_000);
    expect(notifications.create).toHaveBeenCalledTimes(2);
  });

  it('is safe when the webhook arrives twice for the same payment', async () => {
    const cycle = makeCycle();
    const { service } = build(cycle);
    await service.markSharePaidFromCheckout(String(cycle._id), TENANT_A, { amount: 100_000, checkoutPaymentId: 'pay1' });
    const again = await service.markSharePaidFromCheckout(String(cycle._id), TENANT_A, { amount: 100_000, checkoutPaymentId: 'pay1' });
    expect(again).toBe('already_done');
    expect(cycle.tenantShares[0].amountPaid).toBe(100_000);
  });

  it('reports not_possible (so checkout flags a refund) when the share was settled another way', async () => {
    const cycle = makeCycle({ aStatus: TenantShareStatus.PAID, aPaid: 100_000 });
    const { service } = build(cycle);
    const r = await service.markSharePaidFromCheckout(String(cycle._id), TENANT_A, { amount: 100_000, checkoutPaymentId: 'pay2' });
    expect(r).toBe('not_possible');
    expect(cycle.tenantShares[0].amountPaid).toBe(100_000);
    expect(cycle.save).not.toHaveBeenCalled();
  });
});

describe('Recording a rent payment by hand', () => {
  it('is refused for a landlord account that does not own the cycle', async () => {
    const { service } = build(makeCycle(), 'landlord');
    await expect(
      service.recordPayment('64b000000000000000000001', { tenantUserId: TENANT_A, amountPaid: 100_000 } as any, STRANGER),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('works for the cycle owner', async () => {
    const cycle = makeCycle();
    const { service } = build(cycle, 'landlord');
    await service.recordPayment(String(cycle._id), { tenantUserId: TENANT_A, amountPaid: 100_000 } as any, LANDLORD);
    expect(cycle.tenantShares[0].status).toBe(TenantShareStatus.PAID);
  });
});
