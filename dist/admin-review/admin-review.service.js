"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var AdminReviewService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminReviewService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const core_1 = require("@nestjs/core");
const mongoose_2 = require("mongoose");
const checkout_payment_schema_1 = require("../checkout/schemas/checkout-payment.schema");
const transaction_schema_1 = require("../payments/schemas/transaction.schema");
const booking_schema_1 = require("../bookings/schema/booking.schema");
const user_schema_1 = require("../users/schemas/user.schema");
const camerpay_service_1 = require("../payments/services/camerpay.service");
const notifications_service_1 = require("../notifications/notifications.service");
const iso = (d) => (d ? new Date(d).toISOString() : null);
const splitReason = (r) => {
    const raw = (r ?? '').trim();
    if (!raw)
        return { code: 'unknown', detail: null };
    const i = raw.indexOf(':');
    const code = (i > 0 ? raw.slice(0, i) : raw).split(/\s+—\s+|\s+-\s+/)[0].trim();
    const detail = i > 0 ? raw.slice(i + 1).trim() : raw.includes('—') ? raw.split('—').slice(1).join('—').trim() : null;
    return { code: code || 'unknown', detail: detail || null };
};
let AdminReviewService = AdminReviewService_1 = class AdminReviewService {
    checkouts;
    transactions;
    bookings;
    users;
    moduleRef;
    logger = new common_1.Logger(AdminReviewService_1.name);
    constructor(checkouts, transactions, bookings, users, moduleRef) {
        this.checkouts = checkouts;
        this.transactions = transactions;
        this.bookings = bookings;
        this.users = users;
        this.moduleRef = moduleRef;
    }
    camerPay() {
        const svc = this.moduleRef.get(camerpay_service_1.CamerPayService, { strict: false });
        if (!svc)
            throw new common_1.BadGatewayException('CamerPay is not available on this server');
        return svc;
    }
    notifications() {
        try {
            return this.moduleRef.get(notifications_service_1.NotificationsService, { strict: false });
        }
        catch {
            return null;
        }
    }
    async list(state = 'open', limit = 50) {
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
        const bookingIds = [...cps.map((c) => c.bookingId), ...txs.map((t) => t.bookingId)].filter(Boolean);
        const bookings = bookingIds.length
            ? await this.bookings.find({ _id: { $in: bookingIds } })
                .select('status paymentStatus checkIn checkOut propertyId guestId')
                .populate('propertyId', 'title').lean().exec()
            : [];
        const bookingById = new Map(bookings.map((b) => [String(b._id), b]));
        const userIds = [...cps.map((c) => c.userId), ...txs.map((t) => t.userId)].filter(Boolean);
        const users = userIds.length
            ? await this.users.find({ _id: { $in: userIds } }).select('name email phoneNumber').lean().exec()
            : [];
        const userById = new Map(users.map((u) => [String(u._id), u]));
        const bookingView = (id) => {
            const b = id ? bookingById.get(String(id)) : null;
            return b ? {
                id: String(b._id), status: b.status, paymentStatus: b.paymentStatus ?? null,
                checkIn: iso(b.checkIn), checkOut: iso(b.checkOut), propertyTitle: b.propertyId?.title ?? null,
            } : null;
        };
        const guestView = (id) => {
            const u = id ? userById.get(String(id)) : null;
            return u ? { id: String(u._id), name: u.name ?? null, email: u.email ?? null, phone: u.phoneNumber ?? null } : null;
        };
        const items = [
            ...cps.map((c) => {
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
            ...txs.map((t) => {
                const r = splitReason(t.metadata?.reviewReason);
                const rv = t.metadata?.review ?? {};
                return {
                    id: String(t._id), source: 'transaction', amount: t.amount, currency: t.currency ?? 'XAF',
                    method: t.paymentMethod ?? null, reasonCode: r.code, reasonDetail: r.detail,
                    state: rv.state === 'resolved' ? 'resolved' : rv.state === 'refunding' ? 'refunding' : 'open',
                    resolution: rv.resolution ?? null, refundAmount: rv.amount ?? null, note: rv.note ?? null,
                    reviewedByName: rv.byName ?? null, reviewedAt: iso(rv.at), error: rv.error ?? null,
                    createdAt: iso(t.createdAt), paidAt: iso(t.completedAt), reference: t.flutterwaveReference ?? null,
                    canRefundOnline: !!t.flutterwaveTransactionId && t.status === transaction_schema_1.TransactionStatus.SUCCESS,
                    booking: bookingView(t.bookingId), guest: guestView(t.userId),
                };
            }),
        ];
        items.sort((a, b) => state === 'open'
            ? String(a.createdAt).localeCompare(String(b.createdAt))
            : String(b.reviewedAt).localeCompare(String(a.reviewedAt)));
        return { items: items.slice(0, max), openCount: openC + openT };
    }
    async refund(source, id, admin, amount, note) {
        this.check(source, id);
        const by = this.adminOf(admin);
        if (source === 'checkout') {
            const claimed = await this.checkouts.findOneAndUpdate({ _id: id, needsReview: true, reviewState: { $nin: ['refunding', 'resolved'] }, refundedAt: { $exists: false } }, { $set: { reviewState: 'refunding', reviewedBy: by.id, reviewedByName: by.name }, $unset: { reviewError: 1 } }, { new: true }).lean().exec();
            if (!claimed)
                throw new common_1.ConflictException('This payment is already being refunded or was handled');
            const value = this.refundValue(amount, claimed.amount);
            if (!claimed.providerReference) {
                await this.checkouts.updateOne({ _id: id }, { $set: { reviewState: 'open', reviewError: 'No CamerPay reference' } });
                throw new common_1.BadRequestException('No CamerPay reference on this payment. Refund it in CamerPay, then mark it as refunded manually.');
            }
            try {
                await this.camerPay().refundPayment(claimed.providerReference, value, note?.trim() || 'HoroHouse refund');
            }
            catch (e) {
                const msg = String(e?.message ?? e).slice(0, 300);
                await this.checkouts.updateOne({ _id: id }, { $set: { reviewState: 'open', reviewError: msg } });
                this.logger.error(`Admin refund failed for checkout payment ${id}: ${msg}`);
                throw new common_1.BadGatewayException(`CamerPay refused the refund: ${msg}`);
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
        const claimed = await this.transactions.findOneAndUpdate({
            _id: id, 'metadata.needsReview': true, status: transaction_schema_1.TransactionStatus.SUCCESS,
            'metadata.review.state': { $nin: ['refunding', 'resolved'] },
        }, { $set: { 'metadata.review.state': 'refunding', 'metadata.review.by': by.id, 'metadata.review.byName': by.name }, $unset: { 'metadata.review.error': 1 } }, { new: true }).lean().exec();
        if (!claimed)
            throw new common_1.ConflictException('This payment is already being refunded or was handled');
        const value = this.refundValue(amount, claimed.amount);
        if (!claimed.flutterwaveTransactionId) {
            await this.transactions.updateOne({ _id: id }, { $set: { 'metadata.review.state': 'open', 'metadata.review.error': 'No CamerPay reference' } });
            throw new common_1.BadRequestException('No CamerPay reference on this payment. Refund it in CamerPay, then mark it as refunded manually.');
        }
        const reason = note?.trim() || 'HoroHouse refund';
        try {
            await this.camerPay().refundPayment(claimed.flutterwaveTransactionId, value, reason);
        }
        catch (e) {
            const msg = String(e?.message ?? e).slice(0, 300);
            await this.transactions.updateOne({ _id: id }, { $set: { 'metadata.review.state': 'open', 'metadata.review.error': msg } });
            this.logger.error(`Admin refund failed for transaction ${id}: ${msg}`);
            throw new common_1.BadGatewayException(`CamerPay refused the refund: ${msg}`);
        }
        const now = new Date();
        const refundTx = await this.transactions.create({
            userId: claimed.userId, bookingId: claimed.bookingId, propertyId: claimed.propertyId,
            amount: value, currency: claimed.currency, type: transaction_schema_1.TransactionType.REFUND, status: transaction_schema_1.TransactionStatus.REFUNDED,
            paymentMethod: claimed.paymentMethod, flutterwaveReference: claimed.flutterwaveReference,
            refundedAt: now, refundReason: reason, refundTransactionId: claimed._id, completedAt: now,
            description: `Refund (admin): ${claimed.metadata?.reviewReason ?? 'payment review'}`,
            metadata: { originalTransactionId: String(claimed._id), refundedBy: by.id, refundedByName: by.name },
        });
        await this.transactions.updateOne({ _id: id }, {
            $set: {
                status: transaction_schema_1.TransactionStatus.REFUNDED, refundedAt: now, refundReason: reason, refundTransactionId: refundTx._id,
                'metadata.needsReview': false, 'metadata.review.state': 'resolved', 'metadata.review.resolution': 'refunded_camerpay',
                'metadata.review.amount': value, 'metadata.review.at': now, ...(note?.trim() ? { 'metadata.review.note': note.trim() } : {}),
            },
        });
        this.logger.log(`Transaction ${id} refunded ${value} ${claimed.currency} by admin ${by.id}`);
        await this.tellGuest(claimed.userId, claimed.bookingId, value, claimed.currency ?? 'XAF');
        return { ok: true };
    }
    async resolve(source, id, admin, resolution, note, amount) {
        this.check(source, id);
        const by = this.adminOf(admin);
        const now = new Date();
        if (resolution === 'refunded_manually' && !(Number(amount) > 0)) {
            throw new common_1.BadRequestException('Enter the amount you refunded');
        }
        if (resolution === 'no_refund_needed' && !note?.trim()) {
            throw new common_1.BadRequestException('Say why no refund is needed');
        }
        if (source === 'checkout') {
            const res = await this.checkouts.updateOne({ _id: id, reviewState: { $ne: 'resolved' }, $or: [{ needsReview: true }, { reviewState: 'refunding' }] }, {
                $set: {
                    needsReview: false, reviewState: 'resolved', reviewResolution: resolution,
                    reviewedBy: by.id, reviewedByName: by.name, reviewedAt: now,
                    ...(note?.trim() ? { reviewNote: note.trim().slice(0, 300) } : {}),
                    ...(resolution === 'refunded_manually' ? { refundAmount: Math.round(Number(amount)), refundedAt: now } : {}),
                },
                $unset: { reviewError: 1 },
            });
            if (!res.matchedCount)
                throw new common_1.ConflictException('This payment was already handled');
            return { ok: true };
        }
        const res = await this.transactions.updateOne({ _id: id, 'metadata.review.state': { $ne: 'resolved' }, $or: [{ 'metadata.needsReview': true }, { 'metadata.review.state': 'refunding' }] }, {
            $set: {
                'metadata.needsReview': false, 'metadata.review.state': 'resolved', 'metadata.review.resolution': resolution,
                'metadata.review.by': by.id, 'metadata.review.byName': by.name, 'metadata.review.at': now,
                ...(note?.trim() ? { 'metadata.review.note': note.trim().slice(0, 300) } : {}),
                ...(resolution === 'refunded_manually'
                    ? { 'metadata.review.amount': Math.round(Number(amount)), status: transaction_schema_1.TransactionStatus.REFUNDED, refundedAt: now, refundReason: note?.trim() || 'Refunded manually' }
                    : {}),
            },
            $unset: { 'metadata.review.error': 1 },
        });
        if (!res.matchedCount)
            throw new common_1.ConflictException('This payment was already handled');
        return { ok: true };
    }
    async summary(days = 30) {
        const since = new Date(Date.now() - Math.min(Math.max(1, days), 366) * 86_400_000);
        const [openC, openT, pendingIds, commissionAgg, refundAgg] = await Promise.all([
            this.checkouts.countDocuments({ needsReview: true }),
            this.transactions.countDocuments({ 'metadata.needsReview': true }),
            this.users.countDocuments({ 'identityVerification.status': 'pending' }),
            this.transactions.aggregate([
                { $match: { type: transaction_schema_1.TransactionType.COMMISSION, status: transaction_schema_1.TransactionStatus.SUCCESS, createdAt: { $gte: since } } },
                { $group: { _id: null, fees: { $sum: { $ifNull: ['$platformFee', 0] } }, hostPayouts: { $sum: '$amount' }, count: { $sum: 1 } } },
            ]),
            this.transactions.aggregate([
                { $match: { type: transaction_schema_1.TransactionType.REFUND, createdAt: { $gte: since } } },
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
    check(source, id) {
        if (source !== 'checkout' && source !== 'transaction')
            throw new common_1.BadRequestException('Unknown payment source');
        if (!(0, mongoose_2.isValidObjectId)(id))
            throw new common_1.BadRequestException('Invalid payment id');
    }
    adminOf(admin) {
        const raw = admin?.userId ?? admin?._id ?? admin?.id ?? admin?.sub;
        if (!raw || !(0, mongoose_2.isValidObjectId)(String(raw)))
            throw new common_1.BadRequestException('Unknown admin');
        return { id: new mongoose_2.Types.ObjectId(String(raw)), name: String(admin?.name ?? admin?.email ?? 'Admin').slice(0, 80) };
    }
    refundValue(requested, paid) {
        const value = requested == null ? paid : Math.round(Number(requested));
        if (!(value > 0))
            throw new common_1.BadRequestException('Refund amount must be more than 0');
        if (value > paid)
            throw new common_1.BadRequestException(`Refund can't be more than the ${paid} paid`);
        return value;
    }
    async tellGuest(userId, bookingId, amount, currency) {
        const n = this.notifications();
        if (!n || !userId)
            return;
        try {
            let propertyTitle = 'your booking';
            if (bookingId) {
                const b = await this.bookings.findById(bookingId).populate('propertyId', 'title').lean().exec();
                propertyTitle = b?.propertyId?.title ?? propertyTitle;
            }
            await n.notifyRefundProcessed(String(userId), { bookingId: String(bookingId ?? ''), propertyTitle, amount, currency });
        }
        catch (e) {
            this.logger.warn(`Refund notification failed: ${e?.message}`);
        }
    }
};
exports.AdminReviewService = AdminReviewService;
exports.AdminReviewService = AdminReviewService = AdminReviewService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(checkout_payment_schema_1.CheckoutPayment.name)),
    __param(1, (0, mongoose_1.InjectModel)(transaction_schema_1.Transaction.name)),
    __param(2, (0, mongoose_1.InjectModel)(booking_schema_1.Booking.name)),
    __param(3, (0, mongoose_1.InjectModel)(user_schema_1.User.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model,
        core_1.ModuleRef])
], AdminReviewService);
//# sourceMappingURL=admin-review.service.js.map