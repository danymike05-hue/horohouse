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
var CheckoutService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CheckoutService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const booking_payment_gateway_1 = require("./booking-payment.gateway");
const camerpay_client_1 = require("./camerpay.client");
const purchase_gateway_1 = require("./purchase.gateway");
const momo_util_1 = require("./momo.util");
const checkout_payment_schema_1 = require("./schemas/checkout-payment.schema");
const notifications_service_1 = require("../notifications/notifications.service");
const LIMITS = {
    mobile_money: { min: 100, max: 1_000_000 },
    card: { min: 350, max: 99_999_999 },
};
let CheckoutService = CheckoutService_1 = class CheckoutService {
    payments;
    camerpay;
    bookings;
    purchases;
    notifications;
    logger = new common_1.Logger(CheckoutService_1.name);
    publicApiUrl;
    momoTtlMs;
    cardTtlMs;
    returnSchemes;
    frontendUrl;
    defaultAppReturn;
    constructor(payments, camerpay, bookings, purchases, config, notifications) {
        this.payments = payments;
        this.camerpay = camerpay;
        this.bookings = bookings;
        this.purchases = purchases;
        this.notifications = notifications;
        this.publicApiUrl = (config.get('CHECKOUT_PUBLIC_API_URL') ?? config.get('BACKEND_URL') ?? '').replace(/\/+$/, '');
        if (!this.publicApiUrl.startsWith('https://')) {
            this.logger.warn(`CHECKOUT_PUBLIC_API_URL is "${this.publicApiUrl}". CamerPay needs public HTTPS callback/return URLs — use a tunnel in dev.`);
        }
        this.momoTtlMs = Number(config.get('CHECKOUT_MOMO_TTL_MINUTES') ?? 15) * 60_000;
        this.cardTtlMs = Number(config.get('CHECKOUT_CARD_TTL_MINUTES') ?? 30) * 60_000;
        this.returnSchemes = (config.get('CHECKOUT_RETURN_SCHEMES') ?? 'horohouse,exp,exps')
            .split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
        this.frontendUrl = config.get('FRONTEND_URL')?.replace(/\/+$/, '');
        this.defaultAppReturn = config.get('CHECKOUT_DEFAULT_APP_RETURN') ?? 'horohouse://payment/return';
    }
    async onModuleInit() {
        try {
            await this.payments.collection.dropIndex('one_pending_per_booking');
            this.logger.log('Dropped old index one_pending_per_booking (replaced by one_pending_per_booking_v2)');
        }
        catch {
        }
    }
    async quote(userId, dto) {
        return this.purchases.quoteView(userId, { ...dto, duration: dto.duration != null ? Number(dto.duration) : undefined });
    }
    resolveMomo(dto) {
        if (dto.method !== 'mobile_money')
            return {};
        let operator = dto.operator;
        const local = (0, momo_util_1.normalizeCmPhone)(dto.phone);
        if (!local)
            throw new common_1.UnprocessableEntityException({ code: 'INVALID_PHONE', message: 'Numéro Mobile Money invalide.' });
        const detected = (0, momo_util_1.detectOperator)(local);
        if (detected && operator && detected !== operator) {
            throw new common_1.UnprocessableEntityException({
                code: 'OPERATOR_MISMATCH',
                message: 'Ce numéro ne correspond pas à l’opérateur choisi.',
            });
        }
        operator = operator ?? detected ?? undefined;
        if (!operator)
            throw new common_1.UnprocessableEntityException({ code: 'OPERATOR_REQUIRED', message: 'Choisissez votre opérateur.' });
        return { phone: local, operator };
    }
    checkLimits(method, amount) {
        const limits = LIMITS[method];
        if (amount < limits.min || amount > limits.max) {
            throw new common_1.UnprocessableEntityException({
                code: 'AMOUNT_OUT_OF_RANGE',
                message: method === 'card'
                    ? `Le paiement par carte est possible de ${limits.min} à ${limits.max.toLocaleString('fr-FR')} XAF.`
                    : `Mobile Money accepte de ${limits.min} à ${limits.max.toLocaleString('fr-FR')} XAF.`,
            });
        }
    }
    async createPayment(userId, dto) {
        const purpose = dto.purpose ?? 'booking';
        if (purpose !== 'booking')
            return this.createPurchasePayment(userId, dto, purpose);
        if (dto.method === 'wallet' || dto.method === 'plan_credit') {
            throw new common_1.BadRequestException({ code: 'METHOD_NOT_ALLOWED', message: 'Ce moyen de paiement n’est pas disponible pour une réservation.' });
        }
        if (!dto.bookingId)
            throw new common_1.BadRequestException('bookingId requis');
        const booking = await this.bookings.getPayableBooking(dto.bookingId, userId);
        const { phone, operator } = this.resolveMomo(dto);
        const method = dto.method;
        this.checkLimits(method, booking.amount);
        const appReturnUrl = this.validateReturnUrl(dto.returnUrl);
        const bookingObjectId = new mongoose_2.Types.ObjectId(booking.id);
        const open = await this.payments.findOne({ bookingId: bookingObjectId, status: 'pending' });
        if (open) {
            const same = String(open.userId) === String(userId) &&
                open.method === dto.method &&
                open.operator === operator &&
                open.phone === phone &&
                open.amount === booking.amount &&
                open.providerReference &&
                open.expiresAt.getTime() > Date.now() + 60_000;
            if (same) {
                if (appReturnUrl && appReturnUrl !== open.appReturnUrl) {
                    await this.payments.updateOne({ _id: open._id }, { $set: { appReturnUrl } });
                    open.appReturnUrl = appReturnUrl;
                }
                return this.toView(open);
            }
            await this.payments.updateOne({ _id: open._id, status: 'pending' }, { $set: { status: 'failed', failedAt: new Date(), failureReason: 'superseded' } });
        }
        const _id = new mongoose_2.Types.ObjectId();
        let payment;
        try {
            payment = await this.payments.create({
                _id,
                bookingId: bookingObjectId,
                userId: new mongoose_2.Types.ObjectId(userId),
                method: dto.method,
                operator,
                phone,
                amount: booking.amount,
                currency: 'XAF',
                status: 'pending',
                merchantInvoiceId: `HH-${_id.toHexString()}`,
                appReturnUrl,
                expiresAt: this.computeExpiry(method, booking.expiresAt),
            });
        }
        catch (err) {
            if (err?.code === 11000) {
                throw new common_1.ConflictException({
                    code: 'PAYMENT_IN_PROGRESS',
                    message: 'Un paiement est déjà en cours pour cette réservation.',
                });
            }
            throw err;
        }
        try {
            const res = await this.camerpay.initiate({
                amount: payment.amount,
                paymentMethod: dto.method === 'card' ? 'stripe' : operator,
                merchantInvoiceId: payment.merchantInvoiceId,
                callbackUrl: `${this.publicApiUrl}/checkout/webhooks/camerpay`,
                returnUrl: `${this.publicApiUrl}/checkout/return?paymentId=${payment.id}`,
                idempotencyKey: payment.id,
                customerPhone: phone
                    ? (0, momo_util_1.toInternational)(phone)
                    : booking.customerPhone
                        ? (0, momo_util_1.toInternational)(booking.customerPhone)
                        : undefined,
                customerName: booking.customerName,
            });
            payment.providerReference = res.uuid;
            payment.providerStatus = res.status;
            payment.payUrl = res.payUrl;
            await payment.save();
            return this.toView(payment);
        }
        catch (err) {
            const reason = err instanceof camerpay_client_1.CamerPayError ? `initiate_${err.kind}` : 'initiate_error';
            await this.payments.updateOne({ _id: payment._id, status: 'pending' }, { $set: { status: 'failed', failedAt: new Date(), failureReason: reason } });
            throw this.toHttpError(err, dto.method === 'mobile_money' ? operator : undefined);
        }
    }
    async createPurchasePayment(userId, dto, purpose) {
        const q = await this.purchases.quote(userId, {
            purpose: purpose,
            planName: dto.planName,
            billingCycle: dto.billingCycle,
            propertyId: dto.propertyId,
            boostType: dto.boostType,
            duration: dto.duration != null ? Number(dto.duration) : undefined,
        });
        if (dto.method === 'wallet' || dto.method === 'plan_credit')
            return this.payInstantly(userId, dto, purpose, q);
        const method = dto.method;
        const { phone, operator } = this.resolveMomo(dto);
        this.checkLimits(method, q.amount);
        const appReturnUrl = this.validateReturnUrl(dto.returnUrl);
        const open = await this.payments.findOne({ purchaseKey: q.key, status: 'pending' });
        if (open) {
            const same = String(open.userId) === String(userId) &&
                open.method === method &&
                open.operator === operator &&
                open.phone === phone &&
                open.amount === q.amount &&
                this.samePurchase(open.purchase, q.purchase) &&
                open.providerReference &&
                open.expiresAt.getTime() > Date.now() + 60_000;
            if (same)
                return this.toView(open);
            await this.payments.updateOne({ _id: open._id, status: 'pending' }, { $set: { status: 'failed', failedAt: new Date(), failureReason: 'superseded' } });
        }
        const _id = new mongoose_2.Types.ObjectId();
        let payment;
        try {
            payment = await this.payments.create({
                _id,
                purpose,
                purchase: q.purchase,
                purchaseKey: q.key,
                userId: new mongoose_2.Types.ObjectId(userId),
                method,
                operator,
                phone,
                amount: q.amount,
                currency: 'XAF',
                status: 'pending',
                merchantInvoiceId: `HH-${_id.toHexString()}`,
                appReturnUrl,
                expiresAt: this.computeExpiry(method),
            });
        }
        catch (err) {
            if (err?.code === 11000) {
                throw new common_1.ConflictException({ code: 'PAYMENT_IN_PROGRESS', message: 'Un paiement est déjà en cours pour cet achat.' });
            }
            throw err;
        }
        try {
            const res = await this.camerpay.initiate({
                amount: payment.amount,
                paymentMethod: method === 'card' ? 'stripe' : operator,
                merchantInvoiceId: payment.merchantInvoiceId,
                callbackUrl: `${this.publicApiUrl}/checkout/webhooks/camerpay`,
                returnUrl: `${this.publicApiUrl}/checkout/return?paymentId=${payment.id}`,
                idempotencyKey: payment.id,
                customerPhone: phone ? (0, momo_util_1.toInternational)(phone) : q.customerPhone ? (0, momo_util_1.toInternational)(q.customerPhone) : undefined,
                customerName: q.customerName,
            });
            payment.providerReference = res.uuid;
            payment.providerStatus = res.status;
            payment.payUrl = res.payUrl;
            await payment.save();
            return this.toView(payment);
        }
        catch (err) {
            const reason = err instanceof camerpay_client_1.CamerPayError ? `initiate_${err.kind}` : 'initiate_error';
            await this.payments.updateOne({ _id: payment._id, status: 'pending' }, { $set: { status: 'failed', failedAt: new Date(), failureReason: reason } });
            throw this.toHttpError(err, method === 'mobile_money' ? operator : undefined);
        }
    }
    async payInstantly(userId, dto, purpose, q) {
        const method = dto.method;
        if (method === 'plan_credit' && purpose !== 'boost') {
            throw new common_1.BadRequestException({ code: 'METHOD_NOT_ALLOWED', message: 'Les boosts inclus ne servent qu’aux boosts.' });
        }
        const amount = method === 'plan_credit' ? 0 : q.amount;
        if (method === 'wallet' && !(amount > 0))
            throw new common_1.BadRequestException('Montant invalide');
        const _id = new mongoose_2.Types.ObjectId();
        let payment;
        try {
            payment = await this.payments.create({
                _id,
                purpose,
                purchase: q.purchase,
                purchaseKey: q.key,
                userId: new mongoose_2.Types.ObjectId(userId),
                method,
                amount,
                currency: 'XAF',
                status: 'pending',
                merchantInvoiceId: `HH-${_id.toHexString()}`,
                expiresAt: new Date(Date.now() + 5 * 60_000),
            });
        }
        catch (err) {
            if (err?.code === 11000) {
                throw new common_1.ConflictException({ code: 'PAYMENT_IN_PROGRESS', message: 'Un paiement est déjà en cours pour cet achat.' });
            }
            throw err;
        }
        const label = q.purchase.label ?? purpose;
        try {
            if (method === 'wallet') {
                await this.purchases.chargeWallet(userId, amount, label, payment.merchantInvoiceId);
            }
            else if (!(await this.purchases.usePlanBoost(userId))) {
                throw new common_1.UnprocessableEntityException({ code: 'NO_PLAN_BOOST', message: 'Vous n’avez plus de boost inclus ce mois-ci.' });
            }
        }
        catch (err) {
            await this.payments.updateOne({ _id: payment._id, status: 'pending' }, { $set: { status: 'failed', failedAt: new Date(), failureReason: method === 'wallet' ? 'wallet_declined' : 'no_plan_boost' } });
            throw err;
        }
        await this.payments.updateOne({ _id: payment._id }, { $set: { status: 'paid', paidAt: new Date(), providerStatus: method } });
        await this.fulfil(payment);
        return this.toView((await this.payments.findById(payment._id)));
    }
    samePurchase(a, b) {
        const k = (p) => [p?.planName, p?.billingCycle, p?.propertyId, p?.boostType, p?.duration].join('|');
        return k(a) === k(b);
    }
    async getPayment(userId, paymentId) {
        return this.toView(await this.findOwned(userId, paymentId));
    }
    async cancelPayment(userId, paymentId) {
        const p = await this.findOwned(userId, paymentId);
        const updated = await this.payments.findOneAndUpdate({ _id: p._id, status: 'pending' }, { $set: { status: 'failed', failedAt: new Date(), failureReason: 'cancelled_by_user' } }, { new: true });
        return this.toView(updated ?? p);
    }
    async handleWebhook(rawBody, signature) {
        if (!rawBody?.length)
            throw new common_1.BadRequestException('Missing raw body');
        let event = this.camerpay.verifyWebhook(rawBody, signature);
        if (!event) {
            if (process.env.CAMERPAY_WEBHOOK_SIGNATURE_MODE !== 'api-confirm') {
                this.logger.warn('Rejected CamerPay webhook: bad signature');
                throw new common_1.UnauthorizedException('Invalid signature');
            }
            event = this.camerpay.parseWebhook(rawBody);
            if (!event)
                throw new common_1.BadRequestException('Unreadable webhook body');
            this.logger.warn('Webhook signature not verified — confirming with CamerPay API');
        }
        const reference = event.uuid ?? event.transaction_uuid;
        const invoiceId = event.invoice_id ?? event.merchant_invoice_id;
        const or = [];
        if (reference)
            or.push({ providerReference: reference });
        if (invoiceId)
            or.push({ merchantInvoiceId: invoiceId });
        const payment = or.length ? await this.payments.findOne({ $or: or }) : null;
        if (!payment) {
            this.logger.warn(`Webhook for unknown payment | ref ${reference ?? '-'} | invoice ${invoiceId ?? '-'}`);
            return { received: true };
        }
        await this.payments.updateOne({ _id: payment._id }, { $set: { lastWebhookAt: new Date() } });
        const uuid = payment.providerReference ?? reference;
        if (!uuid)
            throw new common_1.ServiceUnavailableException('No provider reference yet');
        let tx;
        try {
            tx = await this.camerpay.getStatus(uuid);
        }
        catch (err) {
            throw new common_1.ServiceUnavailableException('Could not confirm status with CamerPay');
        }
        await this.applyProviderStatus(payment, tx);
        return { received: true };
    }
    async applyProviderStatus(payment, tx) {
        const now = new Date();
        switch (tx.status) {
            case 'completed': {
                if (tx.amount !== payment.amount || tx.currency !== 'XAF') {
                    await this.flag(payment, `amount_mismatch: expected ${payment.amount} XAF, got ${tx.amount} ${tx.currency}`);
                    return;
                }
                await this.payments.updateOne({ _id: payment._id, status: { $ne: 'paid' } }, { $set: { status: 'paid', paidAt: tx.paidAt ? new Date(tx.paidAt) : now, providerStatus: 'completed' } });
                await this.fulfil(payment);
                return;
            }
            case 'failed':
            case 'cancelled':
                await this.payments.updateOne({ _id: payment._id, status: 'pending' }, { $set: { status: 'failed', failedAt: now, failureReason: `provider_${tx.status}`, providerStatus: tx.status } });
                return;
            case 'refunded':
                await this.payments.updateOne({ _id: payment._id, refundedAt: { $exists: false } }, { $set: { refundedAt: now, providerStatus: 'refunded' } });
                return;
            default:
                await this.payments.updateOne({ _id: payment._id }, { $set: { providerStatus: tx.status } });
        }
    }
    async fulfil(payment) {
        const staleLock = new Date(Date.now() - 5 * 60_000);
        const claimed = await this.payments.findOneAndUpdate({
            _id: payment._id,
            status: 'paid',
            fulfilledAt: { $exists: false },
            $or: [{ fulfillingAt: { $exists: false } }, { fulfillingAt: { $lt: staleLock } }],
        }, { $set: { fulfillingAt: new Date() } }, { new: true });
        if (!claimed)
            return;
        if (claimed.purpose && claimed.purpose !== 'booking')
            return this.fulfilPurchase(claimed);
        let result;
        try {
            result = await this.bookings.markPaid(claimed);
        }
        catch (err) {
            await this.payments.updateOne({ _id: claimed._id }, { $unset: { fulfillingAt: 1 } });
            throw err;
        }
        if (result === 'already_paid_other') {
            await this.flag(claimed, 'duplicate_payment: booking already paid by another attempt — refund this one');
        }
        else if (result === 'not_payable') {
            await this.flag(claimed, 'paid_after_booking_closed — refund or rebook');
        }
        await this.payments.updateOne({ _id: claimed._id }, { $set: { fulfilledAt: new Date() }, $unset: { fulfillingAt: 1 } });
        this.logger.log(`Payment ${claimed.id} paid → booking ${claimed.bookingId}: ${result}`);
    }
    async fulfilPurchase(claimed) {
        const instant = claimed.method === 'wallet' || claimed.method === 'plan_credit';
        const save = async (purchase) => {
            await this.payments.updateOne({ _id: claimed._id }, { $set: { purchase } });
        };
        let outcome;
        try {
            outcome = await this.purchases.activate(claimed, save);
        }
        catch (err) {
            if (!instant) {
                await this.payments.updateOne({ _id: claimed._id }, { $unset: { fulfillingAt: 1 } });
                throw err;
            }
            outcome = { result: 'not_possible', purchase: claimed.purchase ?? {}, reason: String(err?.message ?? err) };
        }
        if (outcome.result === 'not_possible') {
            if (instant) {
                const label = outcome.purchase.label ?? claimed.purpose;
                if (claimed.method === 'wallet')
                    await this.purchases.refundWallet(String(claimed.userId), claimed.amount, label, claimed.merchantInvoiceId);
                else
                    await this.purchases.releasePlanBoost(String(claimed.userId));
                await this.payments.updateOne({ _id: claimed._id }, {
                    $set: { status: 'failed', failedAt: new Date(), failureReason: 'not_activated_refunded', refundedAt: new Date(), purchase: outcome.purchase },
                    $unset: { fulfillingAt: 1 },
                });
                this.logger.warn(`Instant ${claimed.purpose} ${claimed.id} could not be activated (${outcome.reason}); refunded`);
                return;
            }
            await this.flag(claimed, `paid_but_${claimed.purpose}_not_activated: ${outcome.reason} — refund the customer`);
        }
        await this.payments.updateOne({ _id: claimed._id }, { $set: { fulfilledAt: new Date(), purchase: outcome.purchase }, $unset: { fulfillingAt: 1 } });
        this.logger.log(`Payment ${claimed.id} paid → ${claimed.purpose}: ${outcome.result}`);
    }
    computeExpiry(method, bookingDeadline) {
        const ttl = Date.now() + (method === 'mobile_money' ? this.momoTtlMs : this.cardTtlMs);
        if (!bookingDeadline)
            return new Date(ttl);
        return new Date(Math.min(ttl, bookingDeadline.getTime() - 60_000));
    }
    async flag(payment, reason) {
        this.logger.error(`Payment ${payment.id} needs review: ${reason}`);
        const res = await this.payments.updateOne({ _id: payment._id, needsReview: { $ne: true }, reviewState: { $ne: 'resolved' } }, { $set: { needsReview: true, reviewReason: reason, reviewState: 'open' } });
        if (res.modifiedCount > 0) {
            const amount = `${Math.round(payment.amount).toLocaleString('fr-FR')} XAF`;
            await this.notifications?.notifyAdmins({
                title: 'Payment needs review',
                message: `${amount} for ${payment.bookingId ? `booking ${payment.bookingId}` : `${payment.purpose} "${payment.purchase?.label ?? ''}"`} (${payment.method}${payment.operator ? ` · ${payment.operator}` : ''}): ${reason}. Check it in CamerPay and refund the customer if needed.`,
                metadata: {
                    paymentId: payment.id,
                    ...(payment.bookingId ? { bookingId: String(payment.bookingId) } : { purpose: payment.purpose }),
                    reason,
                    amount: payment.amount,
                },
            });
        }
    }
    async expireOverdue(batchSize = 50) {
        const overdue = await this.payments
            .find({ status: 'pending', expiresAt: { $lte: new Date() }, needsReview: { $ne: true } })
            .limit(batchSize);
        let expired = 0;
        for (const p of overdue) {
            if (p.providerReference) {
                try {
                    const tx = await this.camerpay.getStatus(p.providerReference);
                    if (tx.status === 'completed') {
                        await this.flag(p, 'completed_at_provider_without_webhook');
                        continue;
                    }
                    if (tx.status === 'failed' || tx.status === 'cancelled') {
                        await this.applyProviderStatus(p, tx);
                        continue;
                    }
                }
                catch {
                }
            }
            const res = await this.payments.updateOne({ _id: p._id, status: 'pending' }, { $set: { status: 'expired', expiredAt: new Date(), failureReason: 'expired' } });
            expired += res.modifiedCount;
        }
        if (expired)
            this.logger.log(`Expired ${expired} unconfirmed payment(s)`);
        return expired;
    }
    async buildReturnRedirect(paymentId) {
        let target = this.defaultAppReturn;
        if (paymentId && (0, mongoose_2.isValidObjectId)(paymentId)) {
            const p = await this.payments.findById(paymentId).select('appReturnUrl').lean();
            if (p?.appReturnUrl)
                target = p.appReturnUrl;
        }
        const sep = target.includes('?') ? '&' : '?';
        return paymentId ? `${target}${sep}paymentId=${encodeURIComponent(paymentId)}` : target;
    }
    async findOwned(userId, paymentId) {
        if (!(0, mongoose_2.isValidObjectId)(paymentId))
            throw new common_1.NotFoundException('Paiement introuvable.');
        const p = await this.payments.findById(paymentId);
        if (!p)
            throw new common_1.NotFoundException('Paiement introuvable.');
        if (String(p.userId) !== String(userId))
            throw new common_1.ForbiddenException();
        return p;
    }
    validateReturnUrl(url) {
        if (!url)
            return undefined;
        const scheme = url.split(':')[0]?.toLowerCase();
        if (scheme && this.returnSchemes.includes(scheme))
            return url;
        if (this.frontendUrl && (url === this.frontendUrl || url.startsWith(`${this.frontendUrl}/`)))
            return url;
        throw new common_1.BadRequestException({ code: 'INVALID_RETURN_URL', message: 'URL de retour non autorisée.' });
    }
    toView(p) {
        const doc = p;
        const pu = doc.purchase;
        return {
            id: String(doc._id),
            purpose: doc.purpose ?? 'booking',
            bookingId: doc.bookingId ? String(doc.bookingId) : undefined,
            purchase: pu
                ? {
                    label: pu.label,
                    planName: pu.planName,
                    billingCycle: pu.billingCycle,
                    propertyId: pu.propertyId,
                    propertyTitle: pu.propertyTitle,
                    boostType: pu.boostType,
                    duration: pu.duration,
                    endsAt: pu.endsAt ? new Date(pu.endsAt).toISOString() : undefined,
                }
                : undefined,
            method: doc.method,
            operator: doc.operator,
            phoneMasked: doc.phone ? `6 •• •• ${doc.phone.slice(5, 7)} ${doc.phone.slice(7, 9)}` : undefined,
            amount: doc.amount,
            currency: 'XAF',
            status: doc.status,
            failureReason: doc.status === 'paid' ? undefined : doc.failureReason,
            payUrl: doc.status === 'pending' ? doc.payUrl : undefined,
            expiresAt: new Date(doc.expiresAt).toISOString(),
            createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : undefined,
            paidAt: doc.paidAt ? new Date(doc.paidAt).toISOString() : undefined,
        };
    }
    toHttpError(err, operator) {
        if (err instanceof common_1.HttpException)
            return err;
        const name = operator === 'orange_money' ? 'Orange Money' : operator === 'mtn_momo' ? 'MTN MoMo' : 'Le paiement par carte';
        if (!(err instanceof camerpay_client_1.CamerPayError)) {
            return new common_1.HttpException({ code: 'PAYMENT_ERROR', message: 'Le paiement n’a pas pu démarrer. Réessayez.' }, common_1.HttpStatus.BAD_GATEWAY);
        }
        switch (err.kind) {
            case 'provider_unavailable':
                return new common_1.ServiceUnavailableException({
                    code: 'PROVIDER_UNAVAILABLE',
                    message: `${name} est momentanément indisponible. Réessayez dans quelques minutes ou choisissez un autre moyen de paiement.`,
                });
            case 'provider_rejected':
                return new common_1.BadGatewayException({
                    code: 'PROVIDER_REJECTED',
                    message: `${name} a refusé la demande. Vérifiez le numéro ou essayez un autre moyen de paiement.`,
                });
            case 'validation':
                return new common_1.UnprocessableEntityException({ code: 'PROVIDER_VALIDATION', message: err.message });
            case 'quota':
                return new common_1.ServiceUnavailableException({
                    code: 'MERCHANT_LIMIT',
                    message: 'Ce moyen de paiement est temporairement indisponible. Essayez un autre moyen ou réessayez plus tard.',
                });
            case 'auth':
                return new common_1.BadGatewayException({ code: 'PAYMENT_CONFIG', message: 'Paiement indisponible pour le moment.' });
            default:
                return new common_1.BadGatewayException({ code: 'PAYMENT_ERROR', message: 'Le paiement n’a pas pu démarrer. Réessayez.' });
        }
    }
};
exports.CheckoutService = CheckoutService;
exports.CheckoutService = CheckoutService = CheckoutService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(checkout_payment_schema_1.CheckoutPayment.name)),
    __param(5, (0, common_1.Optional)()),
    __metadata("design:paramtypes", [mongoose_2.Model,
        camerpay_client_1.CamerPayClient,
        booking_payment_gateway_1.BookingPaymentGateway,
        purchase_gateway_1.PurchaseGateway,
        config_1.ConfigService,
        notifications_service_1.NotificationsService])
], CheckoutService);
//# sourceMappingURL=checkout.service.js.map