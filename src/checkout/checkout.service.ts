import {
  BadRequestException,
  BadGatewayException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
  Optional,
  ServiceUnavailableException,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model, Types } from 'mongoose';
import { BookingPaymentGateway, FulfilmentResult } from './booking-payment.gateway';
import { CamerPayClient, CamerPayError, CamerPayTransaction } from './camerpay.client';
import { CheckoutQuoteQueryDto, CreateCheckoutPaymentDto } from './dto/create-checkout-payment.dto';
import { PurchaseGateway, PurchaseQuote, QuoteView } from './purchase.gateway';
import { detectOperator, normalizeCmPhone, toInternational } from './momo.util';
import {
  CheckoutPayment,
  CheckoutPaymentDocument,
  CheckoutPurchase,
  CheckoutPurpose,
  CheckoutStatus,
} from './schemas/checkout-payment.schema';
import { NotificationsService } from '../notifications/notifications.service';

/** CamerPay amount limits (XAF) — https://camerpay.biz/docs/endpoints */
const LIMITS = {
  mobile_money: { min: 100, max: 1_000_000 },
  card: { min: 350, max: 99_999_999 },
} as const;

export interface CheckoutPaymentView {
  id: string;
  purpose: CheckoutPurpose;
  bookingId?: string;
  /** Subscriptions / boosts: what was bought, and until when it runs once active */
  purchase?: {
    label?: string;
    planName?: string;
    billingCycle?: string;
    propertyId?: string;
    propertyTitle?: string;
    boostType?: string;
    duration?: number;
    endsAt?: string;
    changeId?: string;
    bookingId?: string;
    checkIn?: string;
    checkOut?: string;
  };
  method: 'mobile_money' | 'card' | 'wallet' | 'plan_credit';
  operator?: string;
  phoneMasked?: string;
  amount: number;
  currency: 'XAF';
  status: CheckoutStatus;
  failureReason?: string;
  payUrl?: string; // only while pending
  expiresAt: string;
  createdAt?: string;
  paidAt?: string;
}

@Injectable()
export class CheckoutService implements OnModuleInit {
  private readonly logger = new Logger(CheckoutService.name);
  private readonly publicApiUrl: string;
  private readonly momoTtlMs: number;
  private readonly cardTtlMs: number;
  private readonly returnSchemes: string[];
  private readonly frontendUrl?: string;
  private readonly defaultAppReturn: string;

  constructor(
    @InjectModel(CheckoutPayment.name) private readonly payments: Model<CheckoutPaymentDocument>,
    private readonly camerpay: CamerPayClient,
    private readonly bookings: BookingPaymentGateway,
    private readonly purchases: PurchaseGateway,
    config: ConfigService,
    // For admin alerts on payments that need a refund. Add NotificationsModule to
    // CheckoutModule's imports; without it, alerts are logged only.
    @Optional() private readonly notifications?: NotificationsService,
  ) {
    // Public HTTPS URL of this API including the global prefix, e.g. https://api.horohouse.com/api/v1
    this.publicApiUrl = (config.get<string>('CHECKOUT_PUBLIC_API_URL') ?? config.get<string>('BACKEND_URL') ?? '').replace(/\/+$/, '');
    if (!this.publicApiUrl.startsWith('https://')) {
      this.logger.warn(
        `CHECKOUT_PUBLIC_API_URL is "${this.publicApiUrl}". CamerPay needs public HTTPS callback/return URLs — use a tunnel in dev.`,
      );
    }
    this.momoTtlMs = Number(config.get('CHECKOUT_MOMO_TTL_MINUTES') ?? 15) * 60_000;
    this.cardTtlMs = Number(config.get('CHECKOUT_CARD_TTL_MINUTES') ?? 30) * 60_000;
    this.returnSchemes = (config.get<string>('CHECKOUT_RETURN_SCHEMES') ?? 'horohouse,exp,exps')
      .split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
    this.frontendUrl = config.get<string>('FRONTEND_URL')?.replace(/\/+$/, '');
    this.defaultAppReturn = config.get<string>('CHECKOUT_DEFAULT_APP_RETURN') ?? 'horohouse://payment/return';
  }

  /** The old one-pending-per-booking index treated every subscription/boost row as the same "null" booking */
  async onModuleInit(): Promise<void> {
    try {
      await this.payments.collection.dropIndex('one_pending_per_booking');
      this.logger.log('Dropped old index one_pending_per_booking (replaced by one_pending_per_booking_v2)');
    } catch {
      // already gone
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Create / resume
  // ───────────────────────────────────────────────────────────────────────────

  /** Price and payment options for a subscription / boost (payment screen) */
  async quote(userId: string, dto: CheckoutQuoteQueryDto): Promise<QuoteView> {
    return this.purchases.quoteView(userId, { ...dto, duration: dto.duration != null ? Number(dto.duration) : undefined });
  }

  /** Mobile Money: validate number + operator server-side. */
  private resolveMomo(dto: CreateCheckoutPaymentDto): { phone?: string; operator?: CreateCheckoutPaymentDto['operator'] } {
    if (dto.method !== 'mobile_money') return {};
    let operator = dto.operator;
    const local = normalizeCmPhone(dto.phone);
    if (!local) throw new UnprocessableEntityException({ code: 'INVALID_PHONE', message: 'Numéro Mobile Money invalide.' });
    const detected = detectOperator(local);
    if (detected && operator && detected !== operator) {
      throw new UnprocessableEntityException({
        code: 'OPERATOR_MISMATCH',
        message: 'Ce numéro ne correspond pas à l’opérateur choisi.',
      });
    }
    operator = operator ?? detected ?? undefined;
    if (!operator) throw new UnprocessableEntityException({ code: 'OPERATOR_REQUIRED', message: 'Choisissez votre opérateur.' });
    return { phone: local, operator };
  }

  private checkLimits(method: 'mobile_money' | 'card', amount: number) {
    const limits = LIMITS[method];
    if (amount < limits.min || amount > limits.max) {
      throw new UnprocessableEntityException({
        code: 'AMOUNT_OUT_OF_RANGE',
        message:
          method === 'card'
            ? `Le paiement par carte est possible de ${limits.min} à ${limits.max.toLocaleString('fr-FR')} XAF.`
            : `Mobile Money accepte de ${limits.min} à ${limits.max.toLocaleString('fr-FR')} XAF.`,
      });
    }
  }

  async createPayment(userId: string, dto: CreateCheckoutPaymentDto): Promise<CheckoutPaymentView> {
    const purpose: CheckoutPurpose = dto.purpose ?? 'booking';
    if (purpose !== 'booking') return this.createPurchasePayment(userId, dto, purpose);
    if (dto.method === 'wallet' || dto.method === 'plan_credit') {
      throw new BadRequestException({ code: 'METHOD_NOT_ALLOWED', message: 'Ce moyen de paiement n’est pas disponible pour une réservation.' });
    }
    if (!dto.bookingId) throw new BadRequestException('bookingId requis');
    const booking = await this.bookings.getPayableBooking(dto.bookingId, userId);

    const { phone, operator } = this.resolveMomo(dto);

    const method = dto.method as 'mobile_money' | 'card';
    this.checkLimits(method, booking.amount);

    const appReturnUrl = this.validateReturnUrl(dto.returnUrl);
    const bookingObjectId = new Types.ObjectId(booking.id);

    // Resume an identical, still-valid attempt (user went back, app restarted…)
    const open = await this.payments.findOne({ bookingId: bookingObjectId, status: 'pending' });
    if (open) {
      const same =
        String(open.userId) === String(userId) &&
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
      // Different method/number: retire the old attempt. If it still gets paid later,
      // the webhook marks it paid and flags the duplicate for a refund.
      await this.payments.updateOne(
        { _id: open._id, status: 'pending' },
        { $set: { status: 'failed', failedAt: new Date(), failureReason: 'superseded' } },
      );
    }

    const _id = new Types.ObjectId();
    let payment: CheckoutPaymentDocument;
    try {
      payment = await this.payments.create({
        _id,
        bookingId: bookingObjectId,
        userId: new Types.ObjectId(userId),
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
    } catch (err: any) {
      if (err?.code === 11000) {
        throw new ConflictException({
          code: 'PAYMENT_IN_PROGRESS',
          message: 'Un paiement est déjà en cours pour cette réservation.',
        });
      }
      throw err;
    }

    try {
      const res = await this.camerpay.initiate({
        amount: payment.amount,
        paymentMethod: dto.method === 'card' ? 'stripe' : operator!,
        merchantInvoiceId: payment.merchantInvoiceId,
        callbackUrl: `${this.publicApiUrl}/checkout/webhooks/camerpay`,
        returnUrl: `${this.publicApiUrl}/checkout/return?paymentId=${payment.id}`,
        idempotencyKey: payment.id,
        customerPhone: phone
          ? toInternational(phone)
          : booking.customerPhone
            ? toInternational(booking.customerPhone)
            : undefined,
        customerName: booking.customerName,
      });
      payment.providerReference = res.uuid;
      payment.providerStatus = res.status;
      payment.payUrl = res.payUrl;
      await payment.save();
      return this.toView(payment);
    } catch (err) {
      const reason = err instanceof CamerPayError ? `initiate_${err.kind}` : 'initiate_error';
      await this.payments.updateOne(
        { _id: payment._id, status: 'pending' },
        { $set: { status: 'failed', failedAt: new Date(), failureReason: reason } },
      );
      throw this.toHttpError(err, dto.method === 'mobile_money' ? operator : undefined);
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Subscriptions / boosts
  // ───────────────────────────────────────────────────────────────────────────

  private async createPurchasePayment(
    userId: string,
    dto: CreateCheckoutPaymentDto,
    purpose: CheckoutPurpose,
  ): Promise<CheckoutPaymentView> {
    const q = await this.purchases.quote(userId, {
      purpose: purpose as 'subscription' | 'boost' | 'date_change',
      changeId: dto.changeId,
      planName: dto.planName,
      billingCycle: dto.billingCycle,
      propertyId: dto.propertyId,
      boostType: dto.boostType,
      duration: dto.duration != null ? Number(dto.duration) : undefined,
    });

    // A date-change payment has to be refundable through CamerPay like the rest of the booking.
    if (purpose === 'date_change' && (dto.method === 'wallet' || dto.method === 'plan_credit')) {
      throw new BadRequestException({ code: 'METHOD_NOT_ALLOWED', message: 'Choisissez Mobile Money ou la carte pour ce paiement.' });
    }
    if (dto.method === 'wallet' || dto.method === 'plan_credit') return this.payInstantly(userId, dto, purpose, q);

    const method = dto.method;
    const { phone, operator } = this.resolveMomo(dto);
    this.checkLimits(method, q.amount);
    const appReturnUrl = this.validateReturnUrl(dto.returnUrl);

    // Resume an identical, still-valid attempt
    const open = await this.payments.findOne({ purchaseKey: q.key, status: 'pending' });
    if (open) {
      const same =
        String(open.userId) === String(userId) &&
        open.method === method &&
        open.operator === operator &&
        open.phone === phone &&
        open.amount === q.amount &&
        this.samePurchase(open.purchase, q.purchase) &&
        open.providerReference &&
        open.expiresAt.getTime() > Date.now() + 60_000;
      if (same) return this.toView(open);
      await this.payments.updateOne(
        { _id: open._id, status: 'pending' },
        { $set: { status: 'failed', failedAt: new Date(), failureReason: 'superseded' } },
      );
    }

    const _id = new Types.ObjectId();
    let payment: CheckoutPaymentDocument;
    try {
      payment = await this.payments.create({
        _id,
        purpose,
        purchase: q.purchase,
        purchaseKey: q.key,
        userId: new Types.ObjectId(userId),
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
    } catch (err: any) {
      if (err?.code === 11000) {
        throw new ConflictException({ code: 'PAYMENT_IN_PROGRESS', message: 'Un paiement est déjà en cours pour cet achat.' });
      }
      throw err;
    }

    try {
      const res = await this.camerpay.initiate({
        amount: payment.amount,
        paymentMethod: method === 'card' ? 'stripe' : operator!,
        merchantInvoiceId: payment.merchantInvoiceId,
        callbackUrl: `${this.publicApiUrl}/checkout/webhooks/camerpay`,
        returnUrl: `${this.publicApiUrl}/checkout/return?paymentId=${payment.id}`,
        idempotencyKey: payment.id,
        customerPhone: phone ? toInternational(phone) : q.customerPhone ? toInternational(q.customerPhone) : undefined,
        customerName: q.customerName,
      });
      payment.providerReference = res.uuid;
      payment.providerStatus = res.status;
      payment.payUrl = res.payUrl;
      await payment.save();
      return this.toView(payment);
    } catch (err) {
      const reason = err instanceof CamerPayError ? `initiate_${err.kind}` : 'initiate_error';
      await this.payments.updateOne(
        { _id: payment._id, status: 'pending' },
        { $set: { status: 'failed', failedAt: new Date(), failureReason: reason } },
      );
      throw this.toHttpError(err, method === 'mobile_money' ? operator : undefined);
    }
  }

  /** Wallet balance or a free plan boost: no CamerPay, paid and activated right away */
  private async payInstantly(
    userId: string,
    dto: CreateCheckoutPaymentDto,
    purpose: CheckoutPurpose,
    q: PurchaseQuote,
  ): Promise<CheckoutPaymentView> {
    const method = dto.method as 'wallet' | 'plan_credit';
    if (method === 'plan_credit' && purpose !== 'boost') {
      throw new BadRequestException({ code: 'METHOD_NOT_ALLOWED', message: 'Les boosts inclus ne servent qu’aux boosts.' });
    }
    const amount = method === 'plan_credit' ? 0 : q.amount;
    if (method === 'wallet' && !(amount > 0)) throw new BadRequestException('Montant invalide');

    const _id = new Types.ObjectId();
    let payment: CheckoutPaymentDocument;
    try {
      // The pending row holds the per-purchase lock while we charge
      payment = await this.payments.create({
        _id,
        purpose,
        purchase: q.purchase,
        purchaseKey: q.key,
        userId: new Types.ObjectId(userId),
        method,
        amount,
        currency: 'XAF',
        status: 'pending',
        merchantInvoiceId: `HH-${_id.toHexString()}`,
        expiresAt: new Date(Date.now() + 5 * 60_000),
      });
    } catch (err: any) {
      if (err?.code === 11000) {
        throw new ConflictException({ code: 'PAYMENT_IN_PROGRESS', message: 'Un paiement est déjà en cours pour cet achat.' });
      }
      throw err;
    }

    const label = q.purchase.label ?? purpose;
    try {
      if (method === 'wallet') {
        await this.purchases.chargeWallet(userId, amount, label, payment.merchantInvoiceId);
      } else if (!(await this.purchases.usePlanBoost(userId))) {
        throw new UnprocessableEntityException({ code: 'NO_PLAN_BOOST', message: 'Vous n’avez plus de boost inclus ce mois-ci.' });
      }
    } catch (err) {
      await this.payments.updateOne(
        { _id: payment._id, status: 'pending' },
        { $set: { status: 'failed', failedAt: new Date(), failureReason: method === 'wallet' ? 'wallet_declined' : 'no_plan_boost' } },
      );
      throw err;
    }

    await this.payments.updateOne({ _id: payment._id }, { $set: { status: 'paid', paidAt: new Date(), providerStatus: method } });
    await this.fulfil(payment);
    return this.toView((await this.payments.findById(payment._id))!);
  }

  private samePurchase(a?: CheckoutPurchase, b?: CheckoutPurchase): boolean {
    const k = (p?: CheckoutPurchase) => [p?.planName, p?.billingCycle, p?.propertyId, p?.boostType, p?.duration].join('|');
    return k(a) === k(b);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Read / cancel
  // ───────────────────────────────────────────────────────────────────────────

  /** Reads our DB only. Never marks anything paid. */
  async getPayment(userId: string, paymentId: string): Promise<CheckoutPaymentView> {
    return this.toView(await this.findOwned(userId, paymentId));
  }

  async cancelPayment(userId: string, paymentId: string): Promise<CheckoutPaymentView> {
    const p = await this.findOwned(userId, paymentId);
    const updated = await this.payments.findOneAndUpdate(
      { _id: p._id, status: 'pending' },
      { $set: { status: 'failed', failedAt: new Date(), failureReason: 'cancelled_by_user' } },
      { new: true },
    );
    // If the customer still approves the push afterwards, the webhook will mark it paid.
    return this.toView(updated ?? p);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Webhook — the ONLY path that sets status "paid"
  // ───────────────────────────────────────────────────────────────────────────

  async handleWebhook(rawBody: Buffer | undefined, signature: string | string[] | undefined): Promise<{ received: true }> {
    if (!rawBody?.length) throw new BadRequestException('Missing raw body');
        let event = this.camerpay.verifyWebhook(rawBody, signature);
    if (!event) {
      if (process.env.CAMERPAY_WEBHOOK_SIGNATURE_MODE !== 'api-confirm') {
        this.logger.warn('Rejected CamerPay webhook: bad signature');
        throw new UnauthorizedException('Invalid signature');
      }
      // Signature unverified: the webhook is only a trigger. Status and amount below come
      // from CamerPay's API (our own token), never from this body.
      event = this.camerpay.parseWebhook(rawBody);
      if (!event) throw new BadRequestException('Unreadable webhook body');
      this.logger.warn('Webhook signature not verified — confirming with CamerPay API');
    }

    // CamerPay payload: { uuid, invoice_id, status, amount, signature, … }
    const reference: string | undefined = event.uuid ?? event.transaction_uuid;
    const invoiceId: string | undefined = event.invoice_id ?? event.merchant_invoice_id;
    const or: Record<string, string>[] = [];
    if (reference) or.push({ providerReference: reference });
    if (invoiceId) or.push({ merchantInvoiceId: invoiceId });
    const payment = or.length ? await this.payments.findOne({ $or: or }) : null;
    if (!payment) {
      // Not ours (or another environment's). 200 so CamerPay stops retrying.
      this.logger.warn(`Webhook for unknown payment | ref ${reference ?? '-'} | invoice ${invoiceId ?? '-'}`);
      return { received: true };
    }

    await this.payments.updateOne({ _id: payment._id }, { $set: { lastWebhookAt: new Date() } });

    // Defence in depth: the signed webhook is the trigger, but the status we act on is
    // re-read from CamerPay's API. If CamerPay is unreachable we throw → 5xx → they retry.
    const uuid = payment.providerReference ?? reference;
    if (!uuid) throw new ServiceUnavailableException('No provider reference yet');
    let tx: CamerPayTransaction;
    try {
      tx = await this.camerpay.getStatus(uuid);
    } catch (err) {
      throw new ServiceUnavailableException('Could not confirm status with CamerPay');
    }

    await this.applyProviderStatus(payment, tx);
    return { received: true };
  }

  /**
   * Applies an authoritative CamerPay status. Every write is conditional on the current
   * state, so replays and concurrent deliveries are no-ops (idempotent).
   */
  private async applyProviderStatus(payment: CheckoutPaymentDocument, tx: CamerPayTransaction): Promise<void> {
    const now = new Date();

    switch (tx.status) {
      case 'completed': {
        if (tx.amount !== payment.amount || tx.currency !== 'XAF') {
          await this.flag(payment, `amount_mismatch: expected ${payment.amount} XAF, got ${tx.amount} ${tx.currency}`);
          return;
        }
        // pending | failed | expired → paid. A late success still wins: the money moved.
        await this.payments.updateOne(
          { _id: payment._id, status: { $ne: 'paid' } },
          { $set: { status: 'paid', paidAt: tx.paidAt ? new Date(tx.paidAt) : now, providerStatus: 'completed' } },
        );
        await this.fulfil(payment);
        return;
      }
      case 'failed':
      case 'cancelled':
        await this.payments.updateOne(
          { _id: payment._id, status: 'pending' },
          { $set: { status: 'failed', failedAt: now, failureReason: `provider_${tx.status}`, providerStatus: tx.status } },
        );
        return;
      case 'refunded':
        await this.payments.updateOne(
          { _id: payment._id, refundedAt: { $exists: false } },
          { $set: { refundedAt: now, providerStatus: 'refunded' } },
        );
        return;
      default: // pending | processing
        await this.payments.updateOne({ _id: payment._id }, { $set: { providerStatus: tx.status } });
    }
  }

  /**
   * Confirms the booking once per payment. A lock (fulfillingAt) stops two concurrent
   * webhooks from both crediting the host wallet; fulfilledAt makes it retry-safe.
   */
  private async fulfil(payment: CheckoutPaymentDocument): Promise<void> {
    const staleLock = new Date(Date.now() - 5 * 60_000);
    const claimed = await this.payments.findOneAndUpdate(
      {
        _id: payment._id,
        status: 'paid',
        fulfilledAt: { $exists: false },
        $or: [{ fulfillingAt: { $exists: false } }, { fulfillingAt: { $lt: staleLock } }],
      },
      { $set: { fulfillingAt: new Date() } },
      { new: true },
    );
    if (!claimed) return; // already fulfilled, or another delivery is doing it right now

    if (claimed.purpose && claimed.purpose !== 'booking') return this.fulfilPurchase(claimed);

    let result: FulfilmentResult;
    try {
      result = await this.bookings.markPaid(claimed);
    } catch (err) {
      // Release the lock; the error bubbles up → webhook 5xx → CamerPay retries.
      await this.payments.updateOne({ _id: claimed._id }, { $unset: { fulfillingAt: 1 } });
      throw err;
    }

    if (result === 'already_paid_other') {
      await this.flag(claimed, 'duplicate_payment: booking already paid by another attempt — refund this one');
    } else if (result === 'not_payable') {
      await this.flag(claimed, 'paid_after_booking_closed — refund or rebook');
    }
    await this.payments.updateOne(
      { _id: claimed._id },
      { $set: { fulfilledAt: new Date() }, $unset: { fulfillingAt: 1 } },
    );
    this.logger.log(`Payment ${claimed.id} paid → booking ${claimed.bookingId}: ${result}`);
  }

  /** Subscription / boost: switch it on. Runs under the same lock as bookings. */
  private async fulfilPurchase(claimed: CheckoutPaymentDocument): Promise<void> {
    const instant = claimed.method === 'wallet' || claimed.method === 'plan_credit';
    const save = async (purchase: CheckoutPurchase) => {
      await this.payments.updateOne({ _id: claimed._id }, { $set: { purchase } });
    };
    let outcome: Awaited<ReturnType<PurchaseGateway['activate']>>;
    try {
      outcome = await this.purchases.activate(claimed, save);
    } catch (err: any) {
      if (!instant) {
        // Webhook path: release the lock, 5xx → CamerPay retries
        await this.payments.updateOne({ _id: claimed._id }, { $unset: { fulfillingAt: 1 } });
        throw err;
      }
      outcome = { result: 'not_possible', purchase: claimed.purchase ?? {}, reason: String(err?.message ?? err) };
    }

    if (outcome.result === 'not_possible') {
      if (instant) {
        // Nothing went through CamerPay: give it straight back
        const label = outcome.purchase.label ?? claimed.purpose;
        if (claimed.method === 'wallet') await this.purchases.refundWallet(String(claimed.userId), claimed.amount, label, claimed.merchantInvoiceId);
        else await this.purchases.releasePlanBoost(String(claimed.userId));
        await this.payments.updateOne(
          { _id: claimed._id },
          {
            $set: { status: 'failed', failedAt: new Date(), failureReason: 'not_activated_refunded', refundedAt: new Date(), purchase: outcome.purchase },
            $unset: { fulfillingAt: 1 },
          },
        );
        this.logger.warn(`Instant ${claimed.purpose} ${claimed.id} could not be activated (${outcome.reason}); refunded`);
        return;
      }
      await this.flag(claimed, `paid_but_${claimed.purpose}_not_activated: ${outcome.reason} — refund the customer`);
    }

    await this.payments.updateOne(
      { _id: claimed._id },
      { $set: { fulfilledAt: new Date(), purchase: outcome.purchase }, $unset: { fulfillingAt: 1 } },
    );
    this.logger.log(`Payment ${claimed.id} paid → ${claimed.purpose}: ${outcome.result}`);
  }

  /** Our TTL, but never past the booking's own payment deadline. */
  private computeExpiry(method: 'mobile_money' | 'card', bookingDeadline?: Date): Date {
    const ttl = Date.now() + (method === 'mobile_money' ? this.momoTtlMs : this.cardTtlMs);
    if (!bookingDeadline) return new Date(ttl);
    return new Date(Math.min(ttl, bookingDeadline.getTime() - 60_000));
  }

  private async flag(payment: CheckoutPaymentDocument, reason: string) {
    this.logger.error(`Payment ${payment.id} needs review: ${reason}`);
    // Alert once, when the payment is first flagged (webhooks retry).
    // Once an admin has resolved it (refunded, or no refund needed), a late
    // webhook retry must not put it back in the review list.
    const res = await this.payments.updateOne(
      { _id: payment._id, needsReview: { $ne: true }, reviewState: { $ne: 'resolved' } },
      { $set: { needsReview: true, reviewReason: reason, reviewState: 'open' } },
    );
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

  // ───────────────────────────────────────────────────────────────────────────
  // Expiry job
  // ───────────────────────────────────────────────────────────────────────────

  /** Expires overdue pending payments. Never marks paid (only the webhook does). */
  async expireOverdue(batchSize = 50): Promise<number> {
    const overdue = await this.payments
      .find({ status: 'pending', expiresAt: { $lte: new Date() }, needsReview: { $ne: true } })
      .limit(batchSize);

    let expired = 0;
    for (const p of overdue) {
      if (p.providerReference) {
        try {
          const tx = await this.camerpay.getStatus(p.providerReference);
          if (tx.status === 'completed') {
            // Paid at CamerPay but no webhook yet: keep it pending (never expire money that
            // moved) and flag it so someone checks the webhook delivery.
            await this.flag(p, 'completed_at_provider_without_webhook');
            continue;
          }
          if (tx.status === 'failed' || tx.status === 'cancelled') {
            await this.applyProviderStatus(p, tx);
            continue;
          }
        } catch {
          // CamerPay unreachable: expire anyway — a later webhook can still upgrade to paid.
        }
      }
      const res = await this.payments.updateOne(
        { _id: p._id, status: 'pending' },
        { $set: { status: 'expired', expiredAt: new Date(), failureReason: 'expired' } },
      );
      expired += res.modifiedCount;
    }
    if (expired) this.logger.log(`Expired ${expired} unconfirmed payment(s)`);
    return expired;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Return redirect (hosted page → app)
  // ───────────────────────────────────────────────────────────────────────────

  async buildReturnRedirect(paymentId: string | undefined): Promise<string> {
    let target = this.defaultAppReturn;
    if (paymentId && isValidObjectId(paymentId)) {
      const p = await this.payments.findById(paymentId).select('appReturnUrl').lean();
      if (p?.appReturnUrl) target = p.appReturnUrl;
    }
    const sep = target.includes('?') ? '&' : '?';
    return paymentId ? `${target}${sep}paymentId=${encodeURIComponent(paymentId)}` : target;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Helpers
  // ───────────────────────────────────────────────────────────────────────────

  private async findOwned(userId: string, paymentId: string): Promise<CheckoutPaymentDocument> {
    if (!isValidObjectId(paymentId)) throw new NotFoundException('Paiement introuvable.');
    const p = await this.payments.findById(paymentId);
    if (!p) throw new NotFoundException('Paiement introuvable.');
    if (String(p.userId) !== String(userId)) throw new ForbiddenException();
    return p;
  }

  /** Only app deep links (allowlisted schemes) or our own web frontend — no open redirect. */
  private validateReturnUrl(url?: string): string | undefined {
    if (!url) return undefined;
    const scheme = url.split(':')[0]?.toLowerCase();
    if (scheme && this.returnSchemes.includes(scheme)) return url;
    if (this.frontendUrl && (url === this.frontendUrl || url.startsWith(`${this.frontendUrl}/`))) return url;
    throw new BadRequestException({ code: 'INVALID_RETURN_URL', message: 'URL de retour non autorisée.' });
  }

  private toView(p: CheckoutPaymentDocument | CheckoutPayment & { _id: Types.ObjectId }): CheckoutPaymentView {
    const doc = p as any;
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
            changeId: pu.changeId,
            bookingId: pu.bookingId,
            checkIn: pu.checkIn ? new Date(pu.checkIn).toISOString() : undefined,
            checkOut: pu.checkOut ? new Date(pu.checkOut).toISOString() : undefined,
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

  private toHttpError(err: unknown, operator?: string): HttpException {
    if (err instanceof HttpException) return err;
    const name = operator === 'orange_money' ? 'Orange Money' : operator === 'mtn_momo' ? 'MTN MoMo' : 'Le paiement par carte';
    if (!(err instanceof CamerPayError)) {
      return new HttpException({ code: 'PAYMENT_ERROR', message: 'Le paiement n’a pas pu démarrer. Réessayez.' }, HttpStatus.BAD_GATEWAY);
    }
    switch (err.kind) {
      case 'provider_unavailable':
        return new ServiceUnavailableException({
          code: 'PROVIDER_UNAVAILABLE',
          message: `${name} est momentanément indisponible. Réessayez dans quelques minutes ou choisissez un autre moyen de paiement.`,
        });
      case 'provider_rejected':
        return new BadGatewayException({
          code: 'PROVIDER_REJECTED',
          message: `${name} a refusé la demande. Vérifiez le numéro ou essayez un autre moyen de paiement.`,
        });
      case 'validation':
        return new UnprocessableEntityException({ code: 'PROVIDER_VALIDATION', message: err.message });
      case 'quota':
        return new ServiceUnavailableException({
          code: 'MERCHANT_LIMIT',
          message: 'Ce moyen de paiement est temporairement indisponible. Essayez un autre moyen ou réessayez plus tard.',
        });
      case 'auth':
        return new BadGatewayException({ code: 'PAYMENT_CONFIG', message: 'Paiement indisponible pour le moment.' });
      default:
        return new BadGatewayException({ code: 'PAYMENT_ERROR', message: 'Le paiement n’a pas pu démarrer. Réessayez.' });
    }
  }
}
