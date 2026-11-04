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
var BookingPaymentGateway_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.BookingPaymentGateway = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const booking_schema_1 = require("../bookings/schema/booking.schema");
const transaction_schema_1 = require("../payments/schemas/transaction.schema");
const payments_service_1 = require("../payments/services/payments.service");
const user_schema_1 = require("../users/schemas/user.schema");
const momo_util_1 = require("./momo.util");
const CLOSED = [booking_schema_1.BookingStatus.CANCELLED, booking_schema_1.BookingStatus.REJECTED, booking_schema_1.BookingStatus.COMPLETED, booking_schema_1.BookingStatus.NO_SHOW];
const MIN_TIME_LEFT_MS = 2 * 60_000;
let BookingPaymentGateway = BookingPaymentGateway_1 = class BookingPaymentGateway {
    bookings;
    transactions;
    users;
    paymentsService;
    logger = new common_1.Logger(BookingPaymentGateway_1.name);
    constructor(bookings, transactions, users, paymentsService) {
        this.bookings = bookings;
        this.transactions = transactions;
        this.users = users;
        this.paymentsService = paymentsService;
    }
    async getPayableBooking(bookingId, userId) {
        if (!(0, mongoose_2.isValidObjectId)(bookingId))
            throw new common_1.NotFoundException('Réservation introuvable.');
        const b = await this.bookings.findById(bookingId).lean();
        if (!b)
            throw new common_1.NotFoundException('Réservation introuvable.');
        if (String(b.guestId) !== String(userId)) {
            throw new common_1.ForbiddenException('Seul le voyageur de cette réservation peut la payer.');
        }
        if (b.paymentStatus === booking_schema_1.PaymentStatus.PAID) {
            throw new common_1.ConflictException({ code: 'ALREADY_PAID', message: 'Cette réservation est déjà payée.' });
        }
        if (CLOSED.includes(b.status)) {
            throw new common_1.BadRequestException({ code: 'BOOKING_CLOSED', message: 'Cette réservation ne peut plus être payée.' });
        }
        if (b.status === booking_schema_1.BookingStatus.PENDING && !b.isInstantBook) {
            throw new common_1.ConflictException({
                code: 'AWAITING_HOST',
                message: 'Votre hôte doit d’abord accepter la demande. Vous pourrez payer ensuite.',
            });
        }
        if (b.expiresAt && new Date(b.expiresAt).getTime() < Date.now() + MIN_TIME_LEFT_MS) {
            throw new common_1.BadRequestException({
                code: 'BOOKING_EXPIRED',
                message: 'Le délai de paiement de cette réservation est dépassé. Refaites une réservation.',
            });
        }
        if ((b.currency ?? 'XAF').toUpperCase() !== 'XAF') {
            throw new common_1.BadRequestException({ code: 'CURRENCY', message: 'Seuls les paiements en XAF sont pris en charge.' });
        }
        const amount = Math.round(Number(b.priceBreakdown?.totalAmount));
        if (!Number.isFinite(amount) || amount <= 0) {
            throw new common_1.BadRequestException({ code: 'NO_AMOUNT', message: 'Montant de la réservation introuvable.' });
        }
        const user = await this.users.findById(userId).select('name phoneNumber').lean();
        return {
            id: String(b._id),
            amount,
            customerName: user?.name || undefined,
            customerPhone: (0, momo_util_1.normalizeCmPhone)(user?.phoneNumber) ?? undefined,
            expiresAt: b.expiresAt ? new Date(b.expiresAt) : undefined,
        };
    }
    async markPaid(payment) {
        const booking = await this.bookings.findById(payment.bookingId).lean();
        if (!booking)
            return 'not_payable';
        if (booking.paymentStatus === booking_schema_1.PaymentStatus.PAID) {
            return booking.paymentReference === payment.merchantInvoiceId ? 'already_paid_same' : 'already_paid_other';
        }
        if (CLOSED.includes(booking.status))
            return 'not_payable';
        const paymentMethod = payment.method === 'card'
            ? transaction_schema_1.PaymentMethod.CARD
            : payment.operator === 'orange_money'
                ? transaction_schema_1.PaymentMethod.ORANGE_MONEY
                : transaction_schema_1.PaymentMethod.MTN_MOMO;
        const tx = await this.transactions.findOneAndUpdate({ flutterwaveTransactionId: payment.providerReference }, {
            $setOnInsert: {
                userId: payment.userId,
                bookingId: payment.bookingId,
                propertyId: booking.propertyId,
                amount: payment.amount,
                currency: transaction_schema_1.Currency.XAF,
                type: transaction_schema_1.TransactionType.BOOKING,
                status: transaction_schema_1.TransactionStatus.SUCCESS,
                paymentMethod,
                flutterwaveReference: payment.merchantInvoiceId,
                flutterwaveTransactionId: payment.providerReference,
                flutterwavePaymentLink: payment.payUrl,
                description: `Booking payment · ${booking.nights} night${booking.nights !== 1 ? 's' : ''}`,
                platformFee: 0,
                paymentProcessingFee: 0,
                netAmount: payment.amount,
                completedAt: payment.paidAt ?? new Date(),
                metadata: { bookingId: String(booking._id), checkoutPaymentId: payment.id, source: 'checkout' },
            },
        }, { upsert: true, new: true });
        await this.paymentsService.processSuccessfulPayment(tx);
        await this.bookings.updateOne({ _id: booking._id, paymentStatus: booking_schema_1.PaymentStatus.PAID }, { $unset: { expiresAt: 1 } });
        this.logger.log(`Booking ${booking._id} paid via checkout ${payment.id} (tx ${tx._id})`);
        return 'confirmed';
    }
};
exports.BookingPaymentGateway = BookingPaymentGateway;
exports.BookingPaymentGateway = BookingPaymentGateway = BookingPaymentGateway_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(booking_schema_1.Booking.name)),
    __param(1, (0, mongoose_1.InjectModel)(transaction_schema_1.Transaction.name)),
    __param(2, (0, mongoose_1.InjectModel)(user_schema_1.User.name)),
    __param(3, (0, common_1.Inject)((0, common_1.forwardRef)(() => payments_service_1.PaymentsService))),
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model,
        payments_service_1.PaymentsService])
], BookingPaymentGateway);
//# sourceMappingURL=booking-payment.gateway.js.map