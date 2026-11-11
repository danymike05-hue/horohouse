// Admin follow-up of payments that need a human: money that arrived for a closed
// booking, a duplicate payment, or an amount that didn't match. Two sources are
// merged into one list:
//   • checkout_payments with needsReview (the in-app checkout)
//   • transactions with metadata.needsReview (the older payments flow)
//
// Each item can be refunded through CamerPay (one tap, with an atomic claim so it
// can never be refunded twice) or closed by hand ("refunded manually" / "no refund
// needed"). Who did what is stored on the item.
import { BadGatewayException, BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ModuleRef } from '@nestjs/core';
import { isValidObjectId, Model, Types } from 'mongoose';
import { CheckoutPayment, CheckoutPaymentDocument, ReviewResolution } from '../checkout/schemas/checkout-payment.schema';
import { Transaction, TransactionDocument, TransactionStatus, TransactionType } from '../payments/schemas/transaction.schema';
import { Booking, BookingDocument } from '../bookings/schema/booking.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { CamerPayService } from '../payments/services/camerpay.service';
import { NotificationsService } from '../notifications/notifications.service';

export type ReviewSource = 'checkout' | 'transaction';

export interface ReviewItem {
  id: string;
  source: ReviewSource;
  amount: number;
  currency: string;
  method: string | null;
  /** amount_mismatch | duplicate_payment | paid_after_booking_closed | paid_after_booking_cancelled | … */
  reasonCode: string;
  reasonDetail: string | null;
  state: 'open' | 'refunding' | 'resolved';
  resolution: ReviewResolution | null;
  refundAmount: number | null;
  note: string | null;
  reviewedByName: string | null;
  reviewedAt: string | null;
  error: string | null;
  createdAt: string | null;
  paidAt: string | null;
  /** Our reference (what to search for in the CamerPay dashboard) */
  reference: string | null;
  /** CamerPay can refund it from here (we have its transaction id) */
  canRefundOnline: boolean;
  booking: { id: string; status: string; paymentStatus: string | null; checkIn: string | null; checkOut: string | null; propertyTitle: string | null } | null;
  /** Subscription / boost payments (no booking) */
  purchase?: { purpose: string; label: string | null } | null;
  guest: { id: string; name: string | null; email: string | null; phone: string | null } | null;
}

const iso = (d?: Date | string | null) => (d ? new Date(d).toISOString() : null);
const splitReason = (r?: string | null) => {
  const raw = (r ?? '').trim();
  if (!raw) return { code: 'unknown', detail: null };
  const i = raw.indexOf(':');
  // "paid_after_booking_closed — refund or rebook" → code before the dash
  const code = (i > 0 ? raw.slice(0, i) : raw).split(/\s+—\s+|\s+-\s+/)[0].trim();
  const detail = i > 0 ? raw.slice(i + 1).trim() : raw.includes('—') ? raw.split('—').slice(1).join('—').trim() : null;
  return { code: code || 'unknown', detail: detail || null };
};

@Injectable()
export class AdminReviewService {
  private readonly logger = new Logger(AdminReviewService.name);

  constructor(
    @InjectModel(CheckoutPayment.name) private readonly checkouts: Model<CheckoutPaymentDocument>,
    @InjectModel(Transaction.name) private readonly transactions: Model<TransactionDocument>,
    @InjectModel(Booking.name) private readonly bookings: Model<BookingDocument>,
    @InjectModel(User.name) private readonly users: Model<UserDocument>,
    private readonly moduleRef: ModuleRef,
  ) {}

  // ── Lookups through ModuleRef (no new module imports needed) ──────────────
  private camerPay(): CamerPayService {
    const svc = this.moduleRef.get(CamerPayService, { strict: false });
    if (!svc) throw new BadGatewayException('CamerPay is not available on this server');
    return svc;
  }
  private notifications(): NotificationsService | null {
    try { return this.moduleRef.get(NotificationsService, { strict: false }); } catch { return null; }
  }

  // ════════════════════════════════════════════════════════════════════════
  // List
  // ════════════════════════════════════════════════════════════════════════

  async list(state: 'open' | 'resolved' = 'open', limit = 50): Promise<{ items: ReviewItem[]; openCount: number }> {
    const max = Math.min(Math.max(1, limit), 200);
    const openCheckout = { needsReview: true };
    const openTx = { 'metadata.needsReview': true };
    const resolvedCheckout = { reviewState: 'resolved' };
    const resolvedTx = { 'metadata.review.state': 'resolved' };

    const [cps, txs, openC, openT] = await Promise.all([
      this.checkouts.find(state === 'open' ? openCheckout : resolvedCheckout)
        .sort(state === 'open' ? { createdAt: 1 } : { reviewedAt: -1 }).limit(max).lean().exec(),
      this.transactions.find(state === 'open' ? openTx : resolvedTx)
        .sort(state === 'open' ? { createdAt: 1 } : { 'metadata.review.at': -1 }).limit(max).lean().exec(),
      this.checkouts.countDocuments(openCheckout),
      this.transactions.countDocuments(openTx),
    ]);

    // Batch-load bookings and guests
    const bookingIds = [...cps.map((c: any) => c.bookingId), ...txs.map((t: any) => t.bookingId)].filter(Boolean);
    const bookings = bookingIds.length
      ? await this.bookings.find({ _id: { $in: bookingIds } })
          .select('status paymentStatus checkIn checkOut propertyId guestId')
          .populate('propertyId', 'title').lean().exec()
      : [];
    const bookingById = new Map(bookings.map((b: any) => [String(b._id), b]));
    const userIds = [...cps.map((c: any) => c.userId), ...txs.map((t: any) => t.userId)].filter(Boolean);
    const users = userIds.length
      ? await this.users.find({ _id: { $in: userIds } }).select('name email phoneNumber').lean().exec()
      : [];
    const userById = new Map(users.map((u: any) => [String(u._id), u]));

    const bookingView = (id: any) => {
      const b: any = id ? bookingById.get(String(id)) : null;
      return b ? {
        id: String(b._id), status: b.status, paymentStatus: b.paymentStatus ?? null,
        checkIn: iso(b.checkIn), checkOut: iso(b.checkOut), propertyTitle: b.propertyId?.title ?? null,
      } : null;
    };
    const guestView = (id: any) => {
      const u: any = id ? userById.get(String(id)) : null;
      return u ? { id: String(u._id), name: u.name ?? null, email: u.email ?? null, phone: u.phoneNumber ?? null } : null;
    };

    const items: ReviewItem[] = [
      ...cps.map((c: any): ReviewItem => {
        const r = splitReason(c.reviewReason);
        return {
          id: String(c._id), source: 'checkout', amount: c.amount, currency: c.currency ?? 'XAF',
          method: c.operator ?? c.method ?? null, reasonCode: r.code, reasonDetail: r.detail,
          state: c.reviewState === 'resolved' ? 'resolved' : c.reviewState === 'refunding' ? 'refunding' : 'open',
          resolution: c.reviewResolution ?? null, refundAmount: c.refundAmount ?? null, note: c.reviewNote ?? null,
          reviewedByName: c.reviewedByName ?? null, reviewedAt: iso(c.reviewedAt), error: c.reviewError ?? null,
          createdAt: iso(c.createdAt), paidAt: iso(c.paidAt), reference: c.merchantInvoiceId ?? null,
          canRefundOnline: !!c.providerReference && !c.refundedAt,
          booking: bookingView(c.bookingId), guest: guestView(c.userId),
          purchase: c.purpose && c.purpose !== 'booking' ? { purpose: c.purpose, label: c.purchase?.label ?? null } : null,
        };
      }),
      ...txs.map((t: any): ReviewItem => {
        const r = splitReason(t.metadata?.reviewReason);
        const rv = t.metadata?.review ?? {};
        return {
          id: String(t._id), source: 'transaction', amount: t.amount, currency: t.currency ?? 'XAF',
          method: t.paymentMethod ?? null, reasonCode: r.code, reasonDetail: r.detail,
          state: rv.state === 'resolved' ? 'resolved' : rv.state === 'refunding' ? 'refunding' : 'open',
          resolution: rv.resolution ?? null, refundAmount: rv.amount ?? null, note: rv.note ?? null,
          reviewedByName: rv.byName ?? null, reviewedAt: iso(rv.at), error: rv.error ?? null,
          createdAt: iso(t.createdAt), paidAt: iso(t.completedAt), reference: t.flutterwaveReference ?? null,
          canRefundOnline: !!t.flutterwaveTransactionId && t.status === TransactionStatus.SUCCESS,
          booking: bookingView(t.bookingId), guest: guestView(t.userId),
        };
      }),
    ];
    items.sort((a, b) => state === 'open'
      ? String(a.createdAt).localeCompare(String(b.createdAt))
      : String(b.reviewedAt).localeCompare(String(a.reviewedAt)));

    return { items: items.slice(0, max), openCount: openC + openT };
  }

  // ════════════════════════════════════════════════════════════════════════
  // Refund through CamerPay
  // ════════════════════════════════════════════════════════════════════════

  async refund(source: ReviewSource, id: string, admin: any, amount?: number, note?: string): Promise<{ ok: true }> {
    this.check(source, id);
    const by = this.adminOf(admin);

    if (source === 'checkout') {
      // Claim it: only one refund can ever be in progress / done
      const claimed = await this.checkouts.findOneAndUpdate(
        { _id: id, needsReview: true, reviewState: { $nin: ['refunding', 'resolved'] }, refundedAt: { $exists: false } },
        { $set: { reviewState: 'refunding', reviewedBy: by.id, reviewedByName: by.name }, $unset: { reviewError: 1 } },
        { new: true },
      ).lean().exec();
      if (!claimed) throw new ConflictException('This payment is already being refunded or was handled');
      const value = this.refundValue(amount, claimed.amount);
      if (!claimed.providerReference) {
        await this.checkouts.updateOne({ _id: id }, { $set: { reviewState: 'open', reviewError: 'No CamerPay reference' } });
        throw new BadRequestException('No CamerPay reference on this payment. Refund it in CamerPay, then mark it as refunded manually.');
      }
      try {
        await this.camerPay().refundPayment(claimed.providerReference, value, note?.trim() || 'HoroHouse refund');
      } catch (e: any) {
        const msg = String(e?.message ?? e).slice(0, 300);
        await this.checkouts.updateOne({ _id: id }, { $set: { reviewState: 'open', reviewError: msg } });
        this.logger.error(`Admin refund failed for checkout payment ${id}: ${msg}`);
        throw new BadGatewayException(`CamerPay refused the refund: ${msg}`);
      }
      const now = new Date();
      await this.checkouts.updateOne({ _id: id }, {
        $set: {
          needsReview: false, reviewState: 'resolved', reviewResolution: 'refunded_camerpay',
          refundAmount: value, refundedAt: now, reviewedAt: now, reviewNote: note?.trim() || undefined,
        },
      });
      this.logger.log(`Checkout payment ${id} refunded ${value} XAF by admin ${by.id}`);
      await this.tellGuest(claimed.userId, claimed.bookingId, value, claimed.currency ?? 'XAF');
      return { ok: true };
    }

    // Older payments flow (transactions)
    const claimed = await this.transactions.findOneAndUpdate(
      {
        _id: id, 'metadata.needsReview': true, status: TransactionStatus.SUCCESS,
        'metadata.review.state': { $nin: ['refunding', 'resolved'] },
      },
      { $set: { 'metadata.review.state': 'refunding', 'metadata.review.by': by.id, 'metadata.review.byName': by.name }, $unset: { 'metadata.review.error': 1 } },
      { new: true },
    ).lean().exec();
    if (!claimed) throw new ConflictException('This payment is already being refunded or was handled');
    const value = this.refundValue(amount, claimed.amount);
    if (!claimed.flutterwaveTransactionId) {
      await this.transactions.updateOne({ _id: id }, { $set: { 'metadata.review.state': 'open', 'metadata.review.error': 'No CamerPay reference' } });
      throw new BadRequestException('No CamerPay reference on this payment. Refund it in CamerPay, then mark it as refunded manually.');
    }
    const reason = note?.trim() || 'HoroHouse refund';
    try {
      await this.camerPay().refundPayment(claimed.flutterwaveTransactionId, value, reason);
    } catch (e: any) {
      const msg = String(e?.message ?? e).slice(0, 300);
      await this.transactions.updateOne({ _id: id }, { $set: { 'metadata.review.state': 'open', 'metadata.review.error': msg } });
      this.logger.error(`Admin refund failed for transaction ${id}: ${msg}`);
      throw new BadGatewayException(`CamerPay refused the refund: ${msg}`);
    }
    const now = new Date();
    // Audit record of the money going back (the host was never paid for these,
    // so unlike a normal cancellation refund, no host wallet debit)
    const refundTx = await this.transactions.create({
      userId: claimed.userId, bookingId: claimed.bookingId, propertyId: claimed.propertyId,
      amount: value, currency: claimed.currency, type: TransactionType.REFUND, status: TransactionStatus.REFUNDED,
      paymentMethod: claimed.paymentMethod, flutterwaveReference: claimed.flutterwaveReference,
      refundedAt: now, refundReason: reason, refundTransactionId: claimed._id, completedAt: now,
      description: `Refund (admin): ${claimed.metadata?.reviewReason ?? 'payment review'}`,
      metadata: { originalTransactionId: String(claimed._id), refundedBy: by.id, refundedByName: by.name },
    });
    await this.transactions.updateOne({ _id: id }, {
      $set: {
        status: TransactionStatus.REFUNDED, refundedAt: now, refundReason: reason, refundTransactionId: refundTx._id,
        'metadata.needsReview': false, 'metadata.review.state': 'resolved', 'metadata.review.resolution': 'refunded_camerpay',
        'metadata.review.amount': value, 'metadata.review.at': now, ...(note?.trim() ? { 'metadata.review.note': note.trim() } : {}),
      },
    });
    this.logger.log(`Transaction ${id} refunded ${value} ${claimed.currency} by admin ${by.id}`);
    await this.tellGuest(claimed.userId, claimed.bookingId, value, claimed.currency ?? 'XAF');
    return { ok: true };
  }

  // ════════════════════════════════════════════════════════════════════════
  // Close by hand
  // ════════════════════════════════════════════════════════════════════════

  async resolve(source: ReviewSource, id: string, admin: any, resolution: 'refunded_manually' | 'no_refund_needed', note?: string, amount?: number): Promise<{ ok: true }> {
    this.check(source, id);
    const by = this.adminOf(admin);
    const now = new Date();
    if (resolution === 'refunded_manually' && !(Number(amount) > 0)) {
      throw new BadRequestException('Enter the amount you refunded');
    }
    if (resolution === 'no_refund_needed' && !note?.trim()) {
      throw new BadRequestException('Say why no refund is needed');
    }

    if (source === 'checkout') {
      const res = await this.checkouts.updateOne(
        // "refunding" is allowed too: if a CamerPay call hung, the admin checks
        // CamerPay and closes it here
        { _id: id, reviewState: { $ne: 'resolved' }, $or: [{ needsReview: true }, { reviewState: 'refunding' }] },
        {
          $set: {
            needsReview: false, reviewState: 'resolved', reviewResolution: resolution,
            reviewedBy: by.id, reviewedByName: by.name, reviewedAt: now,
            ...(note?.trim() ? { reviewNote: note.trim().slice(0, 300) } : {}),
            ...(resolution === 'refunded_manually' ? { refundAmount: Math.round(Number(amount)), refundedAt: now } : {}),
          },
          $unset: { reviewError: 1 },
        },
      );
      if (!res.matchedCount) throw new ConflictException('This payment was already handled');
      return { ok: true };
    }

    const res = await this.transactions.updateOne(
      { _id: id, 'metadata.review.state': { $ne: 'resolved' }, $or: [{ 'metadata.needsReview': true }, { 'metadata.review.state': 'refunding' }] },
      {
        $set: {
          'metadata.needsReview': false, 'metadata.review.state': 'resolved', 'metadata.review.resolution': resolution,
          'metadata.review.by': by.id, 'metadata.review.byName': by.name, 'metadata.review.at': now,
          ...(note?.trim() ? { 'metadata.review.note': note.trim().slice(0, 300) } : {}),
          ...(resolution === 'refunded_manually'
            ? { 'metadata.review.amount': Math.round(Number(amount)), status: TransactionStatus.REFUNDED, refundedAt: now, refundReason: note?.trim() || 'Refunded manually' }
            : {}),
        },
        $unset: { 'metadata.review.error': 1 },
      },
    );
    if (!res.matchedCount) throw new ConflictException('This payment was already handled');
    return { ok: true };
  }

  // ════════════════════════════════════════════════════════════════════════
  // Dashboard numbers
  // ════════════════════════════════════════════════════════════════════════

  /** Real figures for the admin dashboard (last `days` days) */
  async summary(days = 30) {
    const since = new Date(Date.now() - Math.min(Math.max(1, days), 366) * 86_400_000);
    const [openC, openT, pendingIds, commissionAgg, refundAgg] = await Promise.all([
      this.checkouts.countDocuments({ needsReview: true }),
      this.transactions.countDocuments({ 'metadata.needsReview': true }),
      this.users.countDocuments({ 'identityVerification.status': 'pending' }),
      // The 10% kept on each paid booking is recorded on the host's COMMISSION transaction
      this.transactions.aggregate([
        { $match: { type: TransactionType.COMMISSION, status: TransactionStatus.SUCCESS, createdAt: { $gte: since } } },
        { $group: { _id: null, fees: { $sum: { $ifNull: ['$platformFee', 0] } }, hostPayouts: { $sum: '$amount' }, count: { $sum: 1 } } },
      ]),
      this.transactions.aggregate([
        { $match: { type: TransactionType.REFUND, createdAt: { $gte: since } } },
        { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
      ]),
    ]);
    const c = commissionAgg[0] ?? { fees: 0, hostPayouts: 0, count: 0 };
    const r = refundAgg[0] ?? { total: 0, count: 0 };
    return {
      days,
      paymentsToReview: openC + openT,
      pendingIdentities: pendingIds,
      platformCommission: Math.round(c.fees),
      hostPayouts: Math.round(c.hostPayouts),
      paidBookings: c.count,
      refundedTotal: Math.round(r.total),
      refundCount: r.count,
    };
  }

  // ── helpers ───────────────────────────────────────────────────────────────

  private check(source: string, id: string) {
    if (source !== 'checkout' && source !== 'transaction') throw new BadRequestException('Unknown payment source');
    if (!isValidObjectId(id)) throw new BadRequestException('Invalid payment id');
  }

  private adminOf(admin: any): { id: Types.ObjectId; name: string } {
    const raw = admin?.userId ?? admin?._id ?? admin?.id ?? admin?.sub;
    if (!raw || !isValidObjectId(String(raw))) throw new BadRequestException('Unknown admin');
    return { id: new Types.ObjectId(String(raw)), name: String(admin?.name ?? admin?.email ?? 'Admin').slice(0, 80) };
  }

  /** Full refund by default; a partial one can't exceed what was paid */
  private refundValue(requested: number | undefined, paid: number): number {
    const value = requested == null ? paid : Math.round(Number(requested));
    if (!(value > 0)) throw new BadRequestException('Refund amount must be more than 0');
    if (value > paid) throw new BadRequestException(`Refund can't be more than the ${paid} paid`);
    return value;
  }

  private async tellGuest(userId: any, bookingId: any, amount: number, currency: string) {
    const n = this.notifications();
    if (!n || !userId) return;
    try {
      let propertyTitle = 'your booking';
      if (bookingId) {
        const b: any = await this.bookings.findById(bookingId).populate('propertyId', 'title').lean().exec();
        propertyTitle = b?.propertyId?.title ?? propertyTitle;
      }
      await n.notifyRefundProcessed(String(userId), { bookingId: String(bookingId ?? ''), propertyTitle, amount, currency } as any);
    } catch (e: any) {
      this.logger.warn(`Refund notification failed: ${e?.message}`);
    }
  }
}
