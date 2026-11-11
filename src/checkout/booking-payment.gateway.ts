import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  forwardRef,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model, Types } from 'mongoose';
import { Booking, BookingDocument, BookingStatus, PaymentStatus } from '../bookings/schema/booking.schema';
import {
  Currency,
  PaymentMethod,
  Transaction,
  TransactionDocument,
  TransactionStatus,
  TransactionType,
} from '../payments/schemas/transaction.schema';
import { PaymentsService } from '../payments/services/payments.service';
import { User, UserDocument } from '../users/schemas/user.schema';
import { normalizeCmPhone } from './momo.util';
import type { CheckoutPaymentDocument } from './schemas/checkout-payment.schema';

const CLOSED: string[] = [BookingStatus.CANCELLED, BookingStatus.REJECTED, BookingStatus.COMPLETED, BookingStatus.NO_SHOW];
/** Don't start a payment the booking's own deadline would cut off. */
const MIN_TIME_LEFT_MS = 2 * 60_000;

export interface PayableBooking {
  id: string;
  amount: number;
  customerName?: string;
  /** Profile phone (9 local digits), used for card payments. */
  customerPhone?: string;
  /** Booking payment deadline (instant book: 30 min; host-accepted: 24 h). */
  expiresAt?: Date;
}

export type FulfilmentResult = 'confirmed' | 'already_paid_same' | 'already_paid_other' | 'not_payable';

/**
 * The bridge between checkout and your existing booking/payments code.
 * Fulfilment goes through PaymentsService.processSuccessfulPayment so the host commission
 * transaction, wallet credit, instant-book confirmation and notifications all stay as they are,
 * and processBookingRefund still finds the SUCCESS transaction it refunds against.
 */
@Injectable()
export class BookingPaymentGateway {
  private readonly logger = new Logger(BookingPaymentGateway.name);

  constructor(
    @InjectModel(Booking.name) private readonly bookings: Model<BookingDocument>,
    @InjectModel(Transaction.name) private readonly transactions: Model<TransactionDocument>,
    @InjectModel(User.name) private readonly users: Model<UserDocument>,
    @Inject(forwardRef(() => PaymentsService)) private readonly paymentsService: PaymentsService,
  ) {}

  async getPayableBooking(bookingId: string, userId: string): Promise<PayableBooking> {
    if (!isValidObjectId(bookingId)) throw new NotFoundException('Réservation introuvable.');
    const b = await this.bookings.findById(bookingId).lean();
    if (!b) throw new NotFoundException('Réservation introuvable.');

    if (String(b.guestId) !== String(userId)) {
      throw new ForbiddenException('Seul le voyageur de cette réservation peut la payer.');
    }
    if (b.paymentStatus === PaymentStatus.PAID) {
      throw new ConflictException({ code: 'ALREADY_PAID', message: 'Cette réservation est déjà payée.' });
    }
    if (CLOSED.includes(b.status)) {
      throw new BadRequestException({ code: 'BOOKING_CLOSED', message: 'Cette réservation ne peut plus être payée.' });
    }
    // Request-to-book: the guest pays only after the host accepts (same rule as the booking screen).
    if (b.status === BookingStatus.PENDING && !b.isInstantBook) {
      throw new ConflictException({
        code: 'AWAITING_HOST',
        message: 'Votre hôte doit d’abord accepter la demande. Vous pourrez payer ensuite.',
      });
    }
    if (b.expiresAt && new Date(b.expiresAt).getTime() < Date.now() + MIN_TIME_LEFT_MS) {
      throw new BadRequestException({
        code: 'BOOKING_EXPIRED',
        message: 'Le délai de paiement de cette réservation est dépassé. Refaites une réservation.',
      });
    }
    if ((b.currency ?? 'XAF').toUpperCase() !== 'XAF') {
      throw new BadRequestException({ code: 'CURRENCY', message: 'Seuls les paiements en XAF sont pris en charge.' });
    }

    const amount = Math.round(Number(b.priceBreakdown?.totalAmount));
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException({ code: 'NO_AMOUNT', message: 'Montant de la réservation introuvable.' });
    }

    const user = await this.users.findById(userId).select('name phoneNumber').lean();
    return {
      id: String(b._id),
      amount,
      customerName: (user as any)?.name || undefined,
      customerPhone: normalizeCmPhone((user as any)?.phoneNumber) ?? undefined,
      expiresAt: b.expiresAt ? new Date(b.expiresAt) : undefined,
    };
  }

  /**
   * Called once per paid checkout payment (the service holds a lock around it).
   * Throws on DB errors so the webhook returns 5xx and CamerPay retries.
   */
  async markPaid(payment: CheckoutPaymentDocument): Promise<FulfilmentResult> {
    const booking = await this.bookings.findById(payment.bookingId).lean();
    if (!booking) return 'not_payable';

    if (booking.paymentStatus === PaymentStatus.PAID) {
      return booking.paymentReference === payment.merchantInvoiceId ? 'already_paid_same' : 'already_paid_other';
    }
    if (CLOSED.includes(booking.status)) return 'not_payable';

    const paymentMethod =
      payment.method === 'card'
        ? PaymentMethod.CARD
        : payment.operator === 'orange_money'
          ? PaymentMethod.ORANGE_MONEY
          : PaymentMethod.MTN_MOMO;

    // Upsert keyed by the CamerPay UUID → a retry never creates a second transaction.
    const tx = await this.transactions.findOneAndUpdate(
      { flutterwaveTransactionId: payment.providerReference },
      {
        $setOnInsert: {
          userId: payment.userId,
          bookingId: payment.bookingId,
          propertyId: booking.propertyId,
          amount: payment.amount,
          currency: Currency.XAF,
          type: TransactionType.BOOKING,
          status: TransactionStatus.SUCCESS,
          paymentMethod,
          flutterwaveReference: payment.merchantInvoiceId, // becomes booking.paymentReference
          flutterwaveTransactionId: payment.providerReference,
          flutterwavePaymentLink: payment.payUrl,
          description: `Booking payment · ${booking.nights} night${booking.nights !== 1 ? 's' : ''}`,
          platformFee: 0,
          paymentProcessingFee: 0,
          netAmount: payment.amount,
          completedAt: payment.paidAt ?? new Date(),
          metadata: { bookingId: String(booking._id), checkoutPaymentId: payment.id, source: 'checkout' },
        },
      },
      { upsert: true, new: true },
    );

    // Existing logic: paymentStatus=paid, instant-book → confirmed, commission tx,
    // host wallet credit, host notification.
    await this.paymentsService.processSuccessfulPayment(tx);

    // Make sure the booking scheduler can't auto-cancel a paid booking.
    await this.bookings.updateOne({ _id: booking._id, paymentStatus: PaymentStatus.PAID }, { $unset: { expiresAt: 1 } });

    this.logger.log(`Booking ${booking._id} paid via checkout ${payment.id} (tx ${tx._id})`);
    return 'confirmed';
  }
}
