import {
  Injectable, Logger, NotFoundException,
  BadRequestException, ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { CamerPayService } from './camerpay.service';
import { WalletService } from './wallet.service';

import {
  Transaction, TransactionDocument,
  TransactionType, TransactionStatus, PaymentMethod, Currency,
} from '../schemas/transaction.schema';
import {
  Booking, BookingDocument,
  BookingStatus, PaymentStatus,
} from '../../bookings/schema/booking.schema';
import { InitializePaymentDto, VerifyPaymentDto, TransactionQueryDto } from '../dto/payment.dto';
import { NotificationsService } from '../../notifications/notifications.service';
import { User, UserDocument } from '../../users/schemas/user.schema';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  /** Platform fee taken from each booking payout (10%) */
  private readonly BOOKING_PLATFORM_FEE_RATE = 0.10;

  constructor(
    @InjectModel(Transaction.name) private transactionModel: Model<TransactionDocument>,
    @InjectModel(Booking.name) private bookingModel: Model<BookingDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private readonly notificationsService: NotificationsService,
    // ✅ Swapped: CamerPayService replaces FlutterwaveService
    private camerPayService: CamerPayService,
    private configService: ConfigService,
    private walletService: WalletService,
  ) { }

  // ════════════════════════════════════════════════════════════════════════
  // PRIVATE: resolve customer name (CamerPay requires name, not email)
  // ════════════════════════════════════════════════════════════════════════

  private resolveCustomerName(user: User, override?: string | null): string {
    if (override) return override;
    if (user.name) return user.name;
    // Fallback: derive from phone number
    const phone = (user as any).phoneNumber;
    if (phone) return `User-${phone.slice(-4)}`;
    throw new BadRequestException(
      'Your account has no name. Please complete your profile before making a payment.',
    );
  }

  // ════════════════════════════════════════════════════════════════════════
  // initializePayment
  // ════════════════════════════════════════════════════════════════════════

  async initializePayment(
  dto: InitializePaymentDto,
  user: User,
): Promise<{ transaction: TransactionDocument; paymentLink: string }> {
  try {
    this.logger.log(`Initializing payment for user ${user._id}: ${JSON.stringify(dto)}`);

    const txRef = this.generateTransactionReference(dto.type);
    const { platformFee, paymentProcessingFee, netAmount } = this.calculateFees(
      dto.amount,
      dto.paymentMethod,
    );

    const transaction = new this.transactionModel({
      userId: user._id,
      amount: dto.amount,
      currency: dto.currency || Currency.XAF,
      type: dto.type,
      status: TransactionStatus.PENDING,
      paymentMethod: dto.paymentMethod,
      flutterwaveReference: txRef,
      propertyId: dto.propertyId ? new Types.ObjectId(dto.propertyId) : undefined,
      description: dto.description || this.getTransactionDescription(dto),
      metadata: dto.metadata,
      platformFee,
      paymentProcessingFee,
      netAmount,
      customerName: dto.customerName || user.name,
      customerEmail: dto.customerEmail || user.email,
      customerPhone: dto.customerPhone || (user as any).phoneNumber,
    });

    await transaction.save();

    // ✅ CamerPay rejects localhost return URLs — always use production frontend
    const frontendUrl = this.configService.get<string>('FRONTEND_URL') ?? '';
    const returnUrl = dto.redirectUrl ||
      (frontendUrl.includes('localhost')
        ? 'https://horohouse.com/payment/callback'
        : `${frontendUrl}/payment/callback`);

    const paymentMethod = this.toProviderMethod(dto.paymentMethod);

    // Guard: CamerPay requires a valid phone number
    const rawPhone: string = dto.customerPhone || (user as any).phoneNumber || '';
    if (!rawPhone.trim()) {
      throw new BadRequestException(
        'A phone number is required to pay. Please add your phone number in your profile settings.',
      );
    }

    const camerPayResponse = await this.camerPayService.initializePayment({
      merchant_invoice_id: txRef,
      amount: dto.amount,
      currency: 'XAF',
      payment_method: paymentMethod,
      customer_name: this.resolveCustomerName(user, dto.customerName),
      customer_phone: this.camerPayService.formatPhone(rawPhone),
      callback_url:
        this.configService.get<string>('CAMERPAY_WEBHOOK_URL') ??
        `${this.configService.get('BACKEND_URL')}/payments/webhook/camerpay`,
      return_url: returnUrl,
    });

    const paymentLink = camerPayResponse.checkout_url;
    transaction.flutterwavePaymentLink = paymentLink;
    transaction.flutterwaveTransactionId = camerPayResponse.uuid;
    transaction.paymentProviderResponse = camerPayResponse._raw;
    await transaction.save();

    this.logger.log(`Payment initialized: ${transaction._id}, Link: ${paymentLink}`);
    return { transaction, paymentLink };
  } catch (error) {
    this.logger.error('Initialize payment error:', error);
    throw error;
  }
}

  // ════════════════════════════════════════════════════════════════════════
  // initiateBookingPayment
  // ════════════════════════════════════════════════════════════════════════

async initiateBookingPayment(
  bookingId: string,
  user: User,
  selectedMethod?: PaymentMethod,
  checkoutPhone?: string,
): Promise<{ transaction: TransactionDocument; paymentLink: string; txRef: string }> {
  this.logger.log(`Initiating booking payment | booking: ${bookingId} | user: ${user._id}`);

  const booking = await this.bookingModel
    .findById(bookingId)
    .populate('propertyId', 'title isInstantBookable')
    .exec();

  if (!booking) throw new NotFoundException('Booking not found');

  if (booking.guestId.toString() !== (user._id as any).toString()) {
    throw new ForbiddenException('Only the booking guest can initiate payment');
  }
  if (booking.paymentStatus === PaymentStatus.PAID) {
    throw new BadRequestException('This booking has already been paid');
  }
  if ([BookingStatus.CANCELLED, BookingStatus.REJECTED].includes(booking.status)) {
    throw new BadRequestException('Cannot pay for a cancelled or rejected booking');
  }

  const existing = await this.transactionModel.findOne({
    bookingId: new Types.ObjectId(bookingId),
    status: TransactionStatus.PENDING,
  });

  if (existing?.flutterwavePaymentLink) {
    const isLegacyFlutterwave = existing.flutterwavePaymentLink.includes('flutterwave.com');
    if (!isLegacyFlutterwave) {
      this.logger.log(`Reusing pending transaction: ${existing._id}`);
      return {
        transaction: existing,
        paymentLink: existing.flutterwavePaymentLink,
        txRef: existing.flutterwaveReference!,
      };
    } else {
      this.logger.log(`Cancelling legacy flutterwave pending transaction: ${existing._id}`);
      existing.status = TransactionStatus.FAILED;
      existing.failureReason = 'Superseded by new payment attempt';
      await existing.save();
    }
  }

  const txRef = this.generateTransactionReference(TransactionType.BOOKING);
  const amount = booking.priceBreakdown.totalAmount;
  const currency = (booking.currency as Currency) ?? Currency.XAF;
  const propertyTitle = (booking.propertyId as any)?.title ?? 'Property Booking';

  const rawPhone: string = checkoutPhone || (user as any).phoneNumber || '';
  if (!rawPhone.trim()) {
    throw new BadRequestException(
      'A phone number is required to pay. Please add your phone number in your profile settings.',
    );
  }
  const formattedPhone = this.camerPayService.formatPhone(rawPhone);
  const detected = this.camerPayService.detectOperatorFromPhone(rawPhone);

  let providerMethod: 'orange_money' | 'mtn_momo';
  let paymentMethodEnum: PaymentMethod;

  if (selectedMethod === PaymentMethod.ORANGE_MONEY || selectedMethod === PaymentMethod.MTN_MOMO) {
    providerMethod = selectedMethod === PaymentMethod.ORANGE_MONEY ? 'orange_money' : 'mtn_momo';
    paymentMethodEnum = selectedMethod;
    if (providerMethod !== detected) {
      this.logger.warn(
        `User selected ${providerMethod} but phone prefix suggests ${detected} — proceeding with user's selection`,
      );
    }
  } else {
    providerMethod = detected;
    paymentMethodEnum = detected === 'orange_money' ? PaymentMethod.ORANGE_MONEY : PaymentMethod.MTN_MOMO;
  }

  this.logger.log(
    `Payment method: ${providerMethod} (${selectedMethod ? 'user-selected' : 'auto-detected'}) | phone: ${formattedPhone}`,
  );

  const { platformFee, paymentProcessingFee, netAmount } = this.calculateFees(amount, paymentMethodEnum);

  const transaction = new this.transactionModel({
    userId: user._id,
    bookingId: new Types.ObjectId(bookingId),
    amount,
    currency,
    type: TransactionType.BOOKING,
    status: TransactionStatus.PENDING,
    paymentMethod: paymentMethodEnum,
    flutterwaveReference: txRef,
    description: `Booking payment: ${propertyTitle} · ${booking.nights} night${booking.nights !== 1 ? 's' : ''}`,
    platformFee,
    paymentProcessingFee,
    netAmount,
    customerName: user.name,
    customerEmail: user.email,
    customerPhone: formattedPhone,
    metadata: {
      bookingId,
      propertyTitle,
      checkIn: booking.checkIn.toISOString(),
      checkOut: booking.checkOut.toISOString(),
      nights: booking.nights,
    },
  });

  await transaction.save();

  const frontendUrl = this.configService.get<string>('FRONTEND_URL') ?? '';
  const returnUrl = frontendUrl.includes('localhost')
    ? `https://horohouse.com/dashboard/bookings/${bookingId}/payment-callback`
    : `${frontendUrl}/dashboard/bookings/${bookingId}/payment-callback`;

  const camerPayResponse = await this.camerPayService.initializePayment({
    merchant_invoice_id: txRef,
    amount,
    currency: 'XAF',
    payment_method: providerMethod,
    customer_name: user.name ?? 'Guest',
    customer_phone: formattedPhone,
    callback_url:
      this.configService.get<string>('CAMERPAY_WEBHOOK_URL') ??
      `${this.configService.get('BACKEND_URL')}/payments/webhook/camerpay`,
    return_url: returnUrl,
  });

  const paymentLink = camerPayResponse.checkout_url;
  transaction.flutterwavePaymentLink = paymentLink;
  transaction.flutterwaveTransactionId = camerPayResponse.uuid;
  transaction.paymentProviderResponse = camerPayResponse._raw;
  await transaction.save();

  await this.bookingModel.findByIdAndUpdate(bookingId, { paymentReference: txRef });

  this.logger.log(
    `Booking payment initiated | tx: ${transaction._id} | txRef: ${txRef} | ${amount} ${currency}`,
  );

  return { transaction, paymentLink, txRef };
}

  // ════════════════════════════════════════════════════════════════════════
  // verifyPayment — polls CamerPay by stored UUID
  // ════════════════════════════════════════════════════════════════════════

  async verifyPayment(dto: VerifyPaymentDto, user: User): Promise<Transaction> {
    try {
      this.logger.log(`Verifying payment: ${dto.transactionId}`);

      const transaction = await this.transactionModel.findOne({
        _id: dto.transactionId,
        userId: user._id,
      });

      if (!transaction) throw new NotFoundException('Transaction not found');
      if (transaction.status === TransactionStatus.SUCCESS) return transaction;

      // ✅ flutterwaveTransactionId now stores the CamerPay UUID
      const providerUuid =
        transaction.flutterwaveTransactionId || dto.flutterwaveReference;

      if (!providerUuid) {
        throw new BadRequestException('No CamerPay UUID found on transaction');
      }

      const statusResponse = await this.camerPayService.verifyPayment(providerUuid);

      if (
        statusResponse.status === 'completed' &&
        statusResponse.amount >= transaction.amount
      ) {
        transaction.status = TransactionStatus.SUCCESS;
        transaction.completedAt = new Date(statusResponse.paid_at ?? Date.now());
        transaction.paymentProviderResponse = statusResponse;
        await transaction.save();
        await this.processSuccessfulPayment(transaction);
        this.logger.log(`Payment verified successfully: ${transaction._id}`);
      } else if (statusResponse.status === 'failed') {
        transaction.status = TransactionStatus.FAILED;
        transaction.failureReason = 'Payment failed on CamerPay';
        await transaction.save();
      }

      return transaction;
    } catch (error) {
      this.logger.error('Verify payment error:', error);
      throw error;
    }
  }

  // ════════════════════════════════════════════════════════════════════════
// reconcileTransaction — used by the background reconciliation cron.
// Same logic as verifyPayment(), but no user/ownership check, since it's
// triggered by the system, not a user-initiated poll.
// ════════════════════════════════════════════════════════════════════════

async reconcileTransaction(transaction: TransactionDocument): Promise<'success' | 'failed' | 'unchanged'> {
  if (transaction.status === TransactionStatus.SUCCESS) return 'unchanged';

  const providerUuid = transaction.flutterwaveTransactionId;
  if (!providerUuid) return 'unchanged';

  const statusResponse = await this.camerPayService.verifyPayment(providerUuid);

  if (statusResponse.status === 'completed' && statusResponse.amount >= transaction.amount) {
    transaction.status = TransactionStatus.SUCCESS;
    transaction.completedAt = new Date(statusResponse.paid_at ?? Date.now());
    transaction.paymentProviderResponse = statusResponse;
    await transaction.save();
    await this.processSuccessfulPayment(transaction);
    this.logger.log(`Reconciliation: recovered stuck payment — tx: ${transaction._id}`);
    return 'success';
  }

  if (statusResponse.status === 'failed' || statusResponse.status === 'cancelled') {
    transaction.status = TransactionStatus.FAILED;
    transaction.failureReason = 'Reconciliation: CamerPay reports failed/cancelled';
    transaction.paymentProviderResponse = statusResponse;
    await transaction.save();
    return 'failed';
  }

  return 'unchanged';
}

  // ════════════════════════════════════════════════════════════════════════
  // handleWebhook — CamerPay sends POST to your callback_url
  // ════════════════════════════════════════════════════════════════════════

  async handleWebhook(rawBody: string, signature: string): Promise<void> {
    try {
      // ✅ CamerPay HMAC-SHA256 over raw body string
      const isValid = this.camerPayService.verifyWebhookSignature(rawBody, signature);
      if (!isValid) {
        this.logger.error('Invalid CamerPay webhook signature');
        throw new BadRequestException('Invalid webhook signature');
      }

      const payload = JSON.parse(rawBody);
      // CamPay webhook body:
      // { reference, status: 'SUCCESSFUL'|'FAILED'|'PENDING', amount, currency,
      //   external_reference, operator, operator_reference, datetime }
      const { reference, status, amount, external_reference } = payload;

      this.logger.log(`CamPay webhook | reference: ${reference} | status: ${status}`);

      // Look up by our internal txRef (external_reference) OR by stored uuid (reference)
      const transaction = await this.transactionModel.findOne({
        $or: [
          { flutterwaveReference: external_reference },
          { flutterwaveTransactionId: reference },
        ],
      });

      if (!transaction) {
        this.logger.warn(`No transaction for CamPay reference: ${reference}`);
        return;
      }

      switch (status) {
        case 'SUCCESSFUL': {
          if (parseFloat(amount) < transaction.amount) {
            this.logger.warn(
              `Underpayment on tx ${transaction._id}: expected ${transaction.amount}, got ${amount}`,
            );
            return;
          }
          // ✅ Atomic guard — prevents double-processing on concurrent webhook delivery
          const confirmed = await this.transactionModel.findOneAndUpdate(
            { _id: transaction._id, status: { $ne: TransactionStatus.SUCCESS } },
            {
              $set: {
                status: TransactionStatus.SUCCESS,
                completedAt: new Date(payload.datetime ?? Date.now()),
                flutterwaveTransactionId: reference,
                paymentMethod: this.camerPayService.mapPaymentMethod(payload.operator ?? '') as PaymentMethod,
                paymentProviderResponse: payload,
              },
            },
            { new: true },
          );
          if (!confirmed) {
            this.logger.log(`Duplicate webhook — already successful: ${transaction._id}`);
            return;
          }
          await this.processSuccessfulPayment(confirmed);
          this.logger.log(`Webhook: payment SUCCESSFUL — tx: ${transaction._id}`);
          break;
        }

        case 'FAILED':
          transaction.status = TransactionStatus.FAILED;
          transaction.failureReason = `CamPay status: FAILED`;
          transaction.paymentProviderResponse = payload;
          await transaction.save();
          this.logger.log(`Webhook: payment FAILED — tx: ${transaction._id}`);
          break;

        case 'REFUNDED': {
          // Fired when a refund is processed via the CamerPay merchant dashboard
          // (rather than through the programmatic API). Keeps our records in sync.
          const alreadyRefunded = transaction.status === TransactionStatus.REFUNDED;
          if (alreadyRefunded) {
            this.logger.log(`Duplicate REFUNDED webhook — tx: ${transaction._id}`);
            return;
          }
          transaction.status = TransactionStatus.REFUNDED;
          transaction.refundedAt = new Date(payload.datetime ?? Date.now());
          transaction.paymentProviderResponse = payload;
          await transaction.save();

          // Sync the booking payment status if this transaction is linked to one
          if (transaction.bookingId) {
            await this.bookingModel.findByIdAndUpdate(transaction.bookingId, {
              paymentStatus: PaymentStatus.REFUNDED,
              'cancellation.refundStatus': 'processed',
            });
          }
          this.logger.log(`Webhook: payment REFUNDED — tx: ${transaction._id}`);
          break;
        }

        default:
          this.logger.log(`Unhandled CamPay webhook status: ${status}`);
      }
    } catch (error) {
      this.logger.error('CamerPay webhook handling error:', error);
      throw error;
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  // Queries — unchanged logic, no provider dependency
  // ════════════════════════════════════════════════════════════════════════

  async getTransactionByReference(txRef: string, userId: string): Promise<Transaction> {
    this.logger.log(`Finding transaction by reference: ${txRef}`);
    const transaction = await this.transactionModel
      .findOne({ flutterwaveReference: txRef, userId: new Types.ObjectId(userId) })
      .populate('propertyId', 'title images address')
      .populate('bookingId', 'checkIn checkOut nights priceBreakdown status')
      .populate('subscriptionId')
      .populate('boostId')
      .exec();
    if (!transaction) throw new NotFoundException('Transaction not found');
    return transaction;
  }

  async getUserTransactions(
    userId: string,
    query: TransactionQueryDto,
  ): Promise<{ transactions: Transaction[]; total: number; page: number; totalPages: number }> {
    const { page = 1, limit = 20, status, type, paymentMethod, startDate, endDate } = query;
    const skip = (page - 1) * limit;
    const filter: any = { userId: new Types.ObjectId(userId) };

    if (status) filter.status = status;
    if (type) filter.type = type;
    if (paymentMethod) filter.paymentMethod = paymentMethod;
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const [transactions, total] = await Promise.all([
      this.transactionModel
        .find(filter)
        .populate('propertyId', 'title images address')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.transactionModel.countDocuments(filter),
    ]);

    return { transactions, total, page, totalPages: Math.ceil(total / limit) };
  }

  async getAllTransactions(
    query: TransactionQueryDto,
  ): Promise<{ transactions: Transaction[]; total: number; page: number; totalPages: number }> {
    const { page = 1, limit = 20, status, type, paymentMethod, startDate, endDate } = query;
    const skip = (page - 1) * limit;
    const filter: any = {};

    if (status) filter.status = status;
    if (type) filter.type = type;
    if (paymentMethod) filter.paymentMethod = paymentMethod;
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const [transactions, total] = await Promise.all([
      this.transactionModel
        .find(filter)
        .populate('userId', 'name email _id phoneNumber')
        .populate('propertyId', 'title')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.transactionModel.countDocuments(filter),
    ]);

    return { transactions, total, page, totalPages: Math.ceil(total / limit) };
  }

  async getTransactionById(transactionId: string, userId: string): Promise<Transaction> {
    const transaction = await this.transactionModel
      .findOne({ _id: transactionId, userId: new Types.ObjectId(userId) })
      .populate('propertyId', 'title images address')
      .populate('bookingId', 'checkIn checkOut nights priceBreakdown status paymentStatus')
      .populate('subscriptionId')
      .populate('boostId')
      .exec();
    if (!transaction) throw new NotFoundException('Transaction not found');
    return transaction;
  }

  // ════════════════════════════════════════════════════════════════════════
  // PRIVATE HELPERS
  // ════════════════════════════════════════════════════════════════════════

  async processSuccessfulPayment(transaction: TransactionDocument): Promise<void> {
    this.logger.log(
      `Processing successful payment: ${transaction._id} | type: ${transaction.type}`,
    );

    switch (transaction.type) {
      case TransactionType.BOOKING:
        await this.confirmBookingPayment(transaction);
        break;
      default:
        this.logger.log(`No post-payment action for type: ${transaction.type}`);
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  // processBookingRefund — called by BookingsService.cancelBooking()
  // ════════════════════════════════════════════════════════════════════════

  /**
   * Executes a full or partial refund for a cancelled booking.
   *
   * Steps:
   *  1. Load booking + original SUCCESS transaction.
   *  2. Idempotency guard (skip if already REFUNDED).
   *  3. Call CamerPay refund API.
   *  4. Create a REFUND transaction record for the audit trail.
   *  5. Update booking.paymentStatus (REFUNDED or PARTIAL).
   *  6. Update booking.cancellation.refundStatus = 'processed'.
   *  7. Debit host wallet for the portion they received (90% of refundAmount).
   *  8. Send guest notification.
   *
   * On failure: sets refundStatus = 'failed', logs for support, does NOT debit wallet.
   */
  async processBookingRefund(
    bookingId: string,
    refundAmount: number,
    reason?: string,
  ): Promise<void> {
    this.logger.log(
      `processBookingRefund | bookingId: ${bookingId} | amount: ${refundAmount} XAF`,
    );

    // ── 1. Load booking ───────────────────────────────────────────────────────
    const booking = await this.bookingModel
      .findById(bookingId)
      .populate('propertyId', 'title')
      .exec();

    if (!booking) {
      this.logger.error(`processBookingRefund: Booking ${bookingId} not found`);
      return;
    }

    // ── 2. Idempotency guard ──────────────────────────────────────────────────
    if (booking.paymentStatus === PaymentStatus.REFUNDED) {
      this.logger.log(`Booking ${bookingId} already refunded — skipping`);
      return;
    }

    // ── 3. Find the original SUCCESS transaction ──────────────────────────────
    const originalTx = await this.transactionModel.findOne({
      bookingId: booking._id,
      status: TransactionStatus.SUCCESS,
      type: TransactionType.BOOKING,
    });

    if (!originalTx) {
      this.logger.error(
        `processBookingRefund: No SUCCESS transaction found for booking ${bookingId}`,
      );
      await this.bookingModel.findByIdAndUpdate(bookingId, {
        'cancellation.refundStatus': 'failed',
      });
      return;
    }

    const providerUuid = originalTx.flutterwaveTransactionId;
    if (!providerUuid) {
      this.logger.error(
        `processBookingRefund: No CamerPay UUID on transaction ${originalTx._id}`,
      );
      await this.bookingModel.findByIdAndUpdate(bookingId, {
        'cancellation.refundStatus': 'failed',
      });
      return;
    }

    // ── 4. Validate refund amount ─────────────────────────────────────────────
    const maxRefundable = booking.priceBreakdown.totalAmount;
    if (refundAmount > maxRefundable) {
      this.logger.error(
        `processBookingRefund: refundAmount ${refundAmount} exceeds original payment ` +
          `${maxRefundable} for booking ${bookingId}`,
      );
      await this.bookingModel.findByIdAndUpdate(bookingId, {
        'cancellation.refundStatus': 'failed',
      });
      return;
    }

    const isFullRefund = refundAmount >= maxRefundable;
    const currency = (booking.currency ?? 'XAF') as Currency;
    const propertyTitle = (booking.propertyId as any)?.title ?? 'Property';
    const refundReason = reason ?? 'Booking cancellation';

    // ── 5. Call CamerPay ──────────────────────────────────────────────────────
    try {
      await this.camerPayService.refundPayment(providerUuid, refundAmount, refundReason);
    } catch (err: any) {
      this.logger.error(
        `processBookingRefund: CamerPay refund FAILED for booking ${bookingId}: ${err.message}`,
      );
      await this.bookingModel.findByIdAndUpdate(bookingId, {
        'cancellation.refundStatus': 'failed',
      });
      // Re-throw so cancelBooking() can surface the error to the caller
      throw err;
    }

    // ── 6. Create REFUND transaction record ───────────────────────────────────
    const refundTx = new this.transactionModel({
      userId: booking.guestId,
      bookingId: booking._id,
      propertyId: booking.propertyId,
      amount: refundAmount,
      currency,
      type: TransactionType.REFUND,
      status: TransactionStatus.REFUNDED,
      paymentMethod: originalTx.paymentMethod,
      flutterwaveReference: originalTx.flutterwaveReference,
      refundedAt: new Date(),
      refundReason,
      refundTransactionId: originalTx._id as Types.ObjectId,
      description: `Refund: ${propertyTitle} booking cancellation`,
      completedAt: new Date(),
      metadata: {
        originalTransactionId: originalTx._id.toString(),
        bookingId,
        propertyTitle,
        isFullRefund,
        originalAmount: maxRefundable,
        refundAmount,
      },
    });
    await refundTx.save();

    // Mark the original transaction as refunded
    await this.transactionModel.findByIdAndUpdate(originalTx._id, {
      status: TransactionStatus.REFUNDED,
      refundedAt: new Date(),
      refundReason,
      refundTransactionId: refundTx._id as Types.ObjectId,
    });

    // ── 7. Update booking statuses ────────────────────────────────────────────
    await this.bookingModel.findByIdAndUpdate(bookingId, {
      paymentStatus: isFullRefund ? PaymentStatus.REFUNDED : PaymentStatus.PARTIAL,
      'cancellation.refundStatus': 'processed',
    });

    // ── 8. Debit host wallet (only the portion they were paid = 90%) ──────────
    const hostPaidPortion = Math.round(refundAmount * (1 - this.BOOKING_PLATFORM_FEE_RATE));
    try {
      await this.walletService.debitWallet(
        booking.hostId.toString(),
        hostPaidPortion,
        `Refund deducted: ${propertyTitle} booking cancellation`,
        originalTx.flutterwaveReference ?? undefined,
      );
      this.logger.log(
        `Host wallet debited: ${booking.hostId} — ${hostPaidPortion} XAF (refund recovery)`,
      );
    } catch (walletErr: any) {
      // Non-fatal: the refund to the guest already succeeded.
      // Log prominently — an admin must manually recover funds from the host.
      this.logger.error(
        `processBookingRefund: Host wallet debit FAILED for booking ${bookingId} ` +
          `(host: ${booking.hostId}, amount: ${hostPaidPortion} XAF). ` +
          `Manual recovery required. Error: ${walletErr.message}`,
      );
    }

    // ── 9. Notify guest ───────────────────────────────────────────────────────
    try {
      await this.notificationsService.notifyRefundProcessed(booking.guestId.toString(), {
        bookingId,
        propertyTitle,
        amount: refundAmount,
        currency,
      });
    } catch (notifErr: any) {
      this.logger.warn(
        `processBookingRefund: Notification failed for booking ${bookingId}: ${notifErr.message}`,
      );
    }

    this.logger.log(
      `processBookingRefund DONE | booking: ${bookingId} | refund: ${refundAmount} ${currency} | ` +
        `host debit: ${hostPaidPortion} ${currency}`,
    );
  }

  /**
   * Admin-initiated refund or retry for a booking.
   * Allows admins to retry a failed refund or manually issue a full/partial refund.
   */
  async adminRefundBooking(
    bookingId: string,
    amount?: number,
    reason?: string,
  ): Promise<{ success: boolean; message: string; refundAmount: number }> {
    const booking = await this.bookingModel.findById(bookingId).exec();
    if (!booking) {
      throw new NotFoundException(`Booking with ID ${bookingId} not found`);
    }

    const refundAmount =
      amount ??
      booking.cancellation?.refundAmount ??
      booking.priceBreakdown?.totalAmount;

    if (!refundAmount || refundAmount <= 0) {
      throw new BadRequestException('Refund amount must be greater than 0');
    }

    await this.processBookingRefund(
      bookingId,
      refundAmount,
      reason ?? 'Admin initiated refund',
    );

    return {
      success: true,
      message: `Refund of ${refundAmount} ${booking.currency ?? 'XAF'} processed successfully`,
      refundAmount,
    };
  }


  private async confirmBookingPayment(transaction: TransactionDocument): Promise<void> {
    if (!transaction.bookingId) return;

    const booking = await this.bookingModel
      .findById(transaction.bookingId)
      .populate('propertyId', 'isInstantBookable')
      .exec();

    if (!booking) {
      this.logger.error(`Booking not found for tx: ${transaction._id}`);
      return;
    }

    if (booking.paymentStatus === PaymentStatus.PAID) {
      this.logger.log(`Booking ${booking._id} already paid — skipping`);
      return;
    }

    const update: Partial<BookingDocument> = {
      paymentStatus: PaymentStatus.PAID,
      paymentReference: transaction.flutterwaveReference,
      paymentMethod: transaction.paymentMethod,
      paidAt: transaction.completedAt ?? new Date(),
    };

    // Paid, so no more expiration
    update.expiresAt = undefined;

    const isInstantBookable = (booking.propertyId as any)?.isInstantBookable ?? false;
    if (isInstantBookable && booking.status === BookingStatus.PENDING) {
      update.status = BookingStatus.CONFIRMED;
      update.confirmedAt = new Date();
      update.isInstantBook = true;
      this.logger.log(`Auto-confirmed instant booking: ${booking._id}`);
    }

    await this.bookingModel.findByIdAndUpdate(booking._id, update);

    const totalPaid = booking.priceBreakdown.totalAmount;
    const platformCut = Math.round(totalPaid * this.BOOKING_PLATFORM_FEE_RATE);
    const hostPayout = totalPaid - platformCut;
    const hostIdStr = booking.hostId.toString();
    const currency = (booking.currency ?? 'XAF') as Currency;
    const propertyTitle = (booking.propertyId as any)?.title ?? 'Property';

    const commissionDesc = `Booking income: ${propertyTitle} - ${booking.nights} night${booking.nights !== 1 ? 's' : ''} (net after ${this.BOOKING_PLATFORM_FEE_RATE * 100}% platform fee)`;

    const commissionTx = new this.transactionModel({
      userId: booking.hostId,
      bookingId: booking._id,
      propertyId: booking.propertyId,
      amount: hostPayout,
      currency,
      type: TransactionType.COMMISSION,
      status: TransactionStatus.SUCCESS,
      paymentMethod: transaction.paymentMethod,
      flutterwaveReference: transaction.flutterwaveReference,
      description: commissionDesc,
      platformFee: platformCut,
      paymentProcessingFee: 0,
      netAmount: hostPayout,
      completedAt: new Date(),
      metadata: {
        bookingId: booking._id.toString(),
        guestTotalPaid: totalPaid,
        platformFee: platformCut,
        hostPayout,
        checkIn: booking.checkIn.toISOString(),
        checkOut: booking.checkOut.toISOString(),
      },
    });
    await commissionTx.save();

    await this.walletService.creditWallet(
      hostIdStr,
      hostPayout,
      commissionDesc,
      transaction.flutterwaveReference ?? undefined,
      commissionTx._id as Types.ObjectId,
    );

    this.logger.log(
      `Host payout | host: ${hostIdStr} | payout: ${hostPayout} ${currency} | platform fee: ${platformCut}`,
    );

    const guest = await this.userModel.findById(booking.guestId).select('name').lean();
    await this.notificationsService.notifyPaymentReceived(hostIdStr, {
      bookingId: booking._id.toString(),
      propertyTitle,
      guestName: (guest as any)?.name ?? 'A guest',
      amount: hostPayout,
      currency,
    });
  }

  private generateTransactionReference(type: TransactionType): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    const typePrefix = type.substring(0, 3).toUpperCase();
    return `HH-${typePrefix}-${timestamp}-${random}`;
  }

  private calculateFees(
    amount: number,
    paymentMethod: PaymentMethod,
  ): { platformFee: number; paymentProcessingFee: number; netAmount: number } {
    let paymentProcessingFee = 0;
    switch (paymentMethod) {
      case PaymentMethod.MTN_MOMO:
      case PaymentMethod.ORANGE_MONEY:
        // CamerPay: 1.5% on Business plan (adjust to match your plan)
        paymentProcessingFee = amount * 0.015;
        break;
      case PaymentMethod.CARD:
        paymentProcessingFee = amount * 0.014 + 100;
        break;
      case PaymentMethod.BANK_TRANSFER:
        paymentProcessingFee = amount * 0.01;
        break;
      default:
        paymentProcessingFee = 0;
    }
    const platformFee = 0;
    const netAmount = amount - platformFee - paymentProcessingFee;
    return { platformFee, paymentProcessingFee, netAmount };
  }

  private getTransactionDescription(dto: InitializePaymentDto): string {
    switch (dto.type) {
      case TransactionType.SUBSCRIPTION: return `Subscription: ${dto.subscriptionPlan} (${dto.billingCycle})`;
      case TransactionType.LISTING_FEE: return 'Property Listing Fee';
      case TransactionType.BOOST_LISTING: return `Listing Boost: ${dto.boostType} (${dto.boostDuration}h)`;
      case TransactionType.DIGITAL_SERVICE: return dto.description || 'Digital Service';
      default: return 'HoroHouse Payment';
    }
  }

  /**
   * Maps our PaymentMethod enum to a CamerPay payment_method string.
   * Falls back to mtn_momo when method is generic (CARD, BANK_TRANSFER)
   * because CamerPay is Mobile Money-first; card support goes via Stripe separately.
   */
  private toProviderMethod(paymentMethod: PaymentMethod): string {
    switch (paymentMethod) {
      case PaymentMethod.ORANGE_MONEY: return 'orange_money';
      case PaymentMethod.MTN_MOMO:
      default:                         return 'mtn_momo';
    }
  }
}