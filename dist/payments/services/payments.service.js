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
var PaymentsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentsService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const config_1 = require("@nestjs/config");
const camerpay_service_1 = require("./camerpay.service");
const wallet_service_1 = require("./wallet.service");
const transaction_schema_1 = require("../schemas/transaction.schema");
const booking_schema_1 = require("../../bookings/schema/booking.schema");
const notifications_service_1 = require("../../notifications/notifications.service");
const user_schema_1 = require("../../users/schemas/user.schema");
let PaymentsService = PaymentsService_1 = class PaymentsService {
    transactionModel;
    bookingModel;
    userModel;
    notificationsService;
    camerPayService;
    configService;
    walletService;
    logger = new common_1.Logger(PaymentsService_1.name);
    BOOKING_PLATFORM_FEE_RATE = 0.10;
    constructor(transactionModel, bookingModel, userModel, notificationsService, camerPayService, configService, walletService) {
        this.transactionModel = transactionModel;
        this.bookingModel = bookingModel;
        this.userModel = userModel;
        this.notificationsService = notificationsService;
        this.camerPayService = camerPayService;
        this.configService = configService;
        this.walletService = walletService;
    }
    resolveCustomerName(user, override) {
        if (override)
            return override;
        if (user.name)
            return user.name;
        const phone = user.phoneNumber;
        if (phone)
            return `User-${phone.slice(-4)}`;
        throw new common_1.BadRequestException('Your account has no name. Please complete your profile before making a payment.');
    }
    async initializePayment(dto, user) {
        try {
            this.logger.log(`Initializing payment for user ${user._id}: ${JSON.stringify(dto)}`);
            const txRef = this.generateTransactionReference(dto.type);
            const { platformFee, paymentProcessingFee, netAmount } = this.calculateFees(dto.amount, dto.paymentMethod);
            const transaction = new this.transactionModel({
                userId: user._id,
                amount: dto.amount,
                currency: dto.currency || transaction_schema_1.Currency.XAF,
                type: dto.type,
                status: transaction_schema_1.TransactionStatus.PENDING,
                paymentMethod: dto.paymentMethod,
                flutterwaveReference: txRef,
                propertyId: dto.propertyId ? new mongoose_2.Types.ObjectId(dto.propertyId) : undefined,
                description: dto.description || this.getTransactionDescription(dto),
                metadata: dto.metadata,
                platformFee,
                paymentProcessingFee,
                netAmount,
                customerName: dto.customerName || user.name,
                customerEmail: dto.customerEmail || user.email,
                customerPhone: dto.customerPhone || user.phoneNumber,
            });
            await transaction.save();
            const frontendUrl = this.configService.get('FRONTEND_URL') ?? '';
            const returnUrl = dto.redirectUrl ||
                (frontendUrl.includes('localhost')
                    ? 'https://horohouse.com/payment/callback'
                    : `${frontendUrl}/payment/callback`);
            const paymentMethod = this.toProviderMethod(dto.paymentMethod);
            const rawPhone = dto.customerPhone || user.phoneNumber || '';
            if (!rawPhone.trim()) {
                throw new common_1.BadRequestException('A phone number is required to pay. Please add your phone number in your profile settings.');
            }
            const camerPayResponse = await this.camerPayService.initializePayment({
                merchant_invoice_id: txRef,
                amount: dto.amount,
                currency: 'XAF',
                payment_method: paymentMethod,
                customer_name: this.resolveCustomerName(user, dto.customerName),
                customer_phone: this.camerPayService.formatPhone(rawPhone),
                callback_url: this.configService.get('CAMERPAY_WEBHOOK_URL') ??
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
        }
        catch (error) {
            this.logger.error('Initialize payment error:', error);
            throw error;
        }
    }
    async initiateBookingPayment(bookingId, user, selectedMethod, checkoutPhone) {
        this.logger.log(`Initiating booking payment | booking: ${bookingId} | user: ${user._id}`);
        const booking = await this.bookingModel
            .findById(bookingId)
            .populate('propertyId', 'title isInstantBookable')
            .exec();
        if (!booking)
            throw new common_1.NotFoundException('Booking not found');
        if (booking.guestId.toString() !== user._id.toString()) {
            throw new common_1.ForbiddenException('Only the booking guest can initiate payment');
        }
        if (booking.paymentStatus === booking_schema_1.PaymentStatus.PAID) {
            throw new common_1.BadRequestException('This booking has already been paid');
        }
        if ([booking_schema_1.BookingStatus.CANCELLED, booking_schema_1.BookingStatus.REJECTED].includes(booking.status)) {
            throw new common_1.BadRequestException('Cannot pay for a cancelled or rejected booking');
        }
        const existing = await this.transactionModel.findOne({
            bookingId: new mongoose_2.Types.ObjectId(bookingId),
            status: transaction_schema_1.TransactionStatus.PENDING,
        });
        if (existing?.flutterwavePaymentLink) {
            const isLegacyFlutterwave = existing.flutterwavePaymentLink.includes('flutterwave.com');
            if (!isLegacyFlutterwave) {
                this.logger.log(`Reusing pending transaction: ${existing._id}`);
                return {
                    transaction: existing,
                    paymentLink: existing.flutterwavePaymentLink,
                    txRef: existing.flutterwaveReference,
                };
            }
            else {
                this.logger.log(`Cancelling legacy flutterwave pending transaction: ${existing._id}`);
                existing.status = transaction_schema_1.TransactionStatus.FAILED;
                existing.failureReason = 'Superseded by new payment attempt';
                await existing.save();
            }
        }
        const txRef = this.generateTransactionReference(transaction_schema_1.TransactionType.BOOKING);
        const amount = booking.priceBreakdown.totalAmount;
        const currency = booking.currency ?? transaction_schema_1.Currency.XAF;
        const propertyTitle = booking.propertyId?.title ?? 'Property Booking';
        const rawPhone = checkoutPhone || user.phoneNumber || '';
        if (!rawPhone.trim()) {
            throw new common_1.BadRequestException('A phone number is required to pay. Please add your phone number in your profile settings.');
        }
        const formattedPhone = this.camerPayService.formatPhone(rawPhone);
        const detected = this.camerPayService.detectOperatorFromPhone(rawPhone);
        let providerMethod;
        let paymentMethodEnum;
        if (selectedMethod === transaction_schema_1.PaymentMethod.ORANGE_MONEY || selectedMethod === transaction_schema_1.PaymentMethod.MTN_MOMO) {
            providerMethod = selectedMethod === transaction_schema_1.PaymentMethod.ORANGE_MONEY ? 'orange_money' : 'mtn_momo';
            paymentMethodEnum = selectedMethod;
            if (providerMethod !== detected) {
                this.logger.warn(`User selected ${providerMethod} but phone prefix suggests ${detected} — proceeding with user's selection`);
            }
        }
        else {
            providerMethod = detected;
            paymentMethodEnum = detected === 'orange_money' ? transaction_schema_1.PaymentMethod.ORANGE_MONEY : transaction_schema_1.PaymentMethod.MTN_MOMO;
        }
        this.logger.log(`Payment method: ${providerMethod} (${selectedMethod ? 'user-selected' : 'auto-detected'}) | phone: ${formattedPhone}`);
        const { platformFee, paymentProcessingFee, netAmount } = this.calculateFees(amount, paymentMethodEnum);
        const transaction = new this.transactionModel({
            userId: user._id,
            bookingId: new mongoose_2.Types.ObjectId(bookingId),
            amount,
            currency,
            type: transaction_schema_1.TransactionType.BOOKING,
            status: transaction_schema_1.TransactionStatus.PENDING,
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
        const frontendUrl = this.configService.get('FRONTEND_URL') ?? '';
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
            callback_url: this.configService.get('CAMERPAY_WEBHOOK_URL') ??
                `${this.configService.get('BACKEND_URL')}/payments/webhook/camerpay`,
            return_url: returnUrl,
        });
        const paymentLink = camerPayResponse.checkout_url;
        transaction.flutterwavePaymentLink = paymentLink;
        transaction.flutterwaveTransactionId = camerPayResponse.uuid;
        transaction.paymentProviderResponse = camerPayResponse._raw;
        await transaction.save();
        await this.bookingModel.findByIdAndUpdate(bookingId, { paymentReference: txRef });
        this.logger.log(`Booking payment initiated | tx: ${transaction._id} | txRef: ${txRef} | ${amount} ${currency}`);
        return { transaction, paymentLink, txRef };
    }
    async verifyPayment(dto, user) {
        try {
            this.logger.log(`Verifying payment: ${dto.transactionId}`);
            const transaction = await this.transactionModel.findOne({
                _id: dto.transactionId,
                userId: user._id,
            });
            if (!transaction)
                throw new common_1.NotFoundException('Transaction not found');
            if (transaction.status === transaction_schema_1.TransactionStatus.SUCCESS)
                return transaction;
            const providerUuid = transaction.flutterwaveTransactionId || dto.flutterwaveReference;
            if (!providerUuid) {
                throw new common_1.BadRequestException('No CamerPay UUID found on transaction');
            }
            const statusResponse = await this.camerPayService.verifyPayment(providerUuid);
            if (statusResponse.status === 'completed' &&
                statusResponse.amount >= transaction.amount) {
                transaction.status = transaction_schema_1.TransactionStatus.SUCCESS;
                transaction.completedAt = new Date(statusResponse.paid_at ?? Date.now());
                transaction.paymentProviderResponse = statusResponse;
                await transaction.save();
                await this.processSuccessfulPayment(transaction);
                this.logger.log(`Payment verified successfully: ${transaction._id}`);
            }
            else if (statusResponse.status === 'failed') {
                transaction.status = transaction_schema_1.TransactionStatus.FAILED;
                transaction.failureReason = 'Payment failed on CamerPay';
                await transaction.save();
            }
            return transaction;
        }
        catch (error) {
            this.logger.error('Verify payment error:', error);
            throw error;
        }
    }
    async reconcileTransaction(transaction) {
        if (transaction.status === transaction_schema_1.TransactionStatus.SUCCESS)
            return 'unchanged';
        const providerUuid = transaction.flutterwaveTransactionId;
        if (!providerUuid)
            return 'unchanged';
        const statusResponse = await this.camerPayService.verifyPayment(providerUuid);
        if (statusResponse.status === 'completed' && statusResponse.amount >= transaction.amount) {
            transaction.status = transaction_schema_1.TransactionStatus.SUCCESS;
            transaction.completedAt = new Date(statusResponse.paid_at ?? Date.now());
            transaction.paymentProviderResponse = statusResponse;
            await transaction.save();
            await this.processSuccessfulPayment(transaction);
            this.logger.log(`Reconciliation: recovered stuck payment — tx: ${transaction._id}`);
            return 'success';
        }
        if (statusResponse.status === 'failed' || statusResponse.status === 'cancelled') {
            transaction.status = transaction_schema_1.TransactionStatus.FAILED;
            transaction.failureReason = 'Reconciliation: CamerPay reports failed/cancelled';
            transaction.paymentProviderResponse = statusResponse;
            await transaction.save();
            return 'failed';
        }
        return 'unchanged';
    }
    async handleWebhook(rawBody, signature) {
        try {
            const isValid = this.camerPayService.verifyWebhookSignature(rawBody, signature);
            if (!isValid) {
                this.logger.error('Invalid CamerPay webhook signature');
                throw new common_1.BadRequestException('Invalid webhook signature');
            }
            const payload = JSON.parse(rawBody);
            const { reference, status, amount, external_reference } = payload;
            this.logger.log(`CamPay webhook | reference: ${reference} | status: ${status}`);
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
                case 'SUCCESSFUL':
                    if (parseFloat(amount) < transaction.amount) {
                        this.logger.warn(`Underpayment on tx ${transaction._id}: expected ${transaction.amount}, got ${amount}`);
                        return;
                    }
                    if (transaction.status === transaction_schema_1.TransactionStatus.SUCCESS) {
                        this.logger.log(`Duplicate webhook — already successful: ${transaction._id}`);
                        return;
                    }
                    transaction.status = transaction_schema_1.TransactionStatus.SUCCESS;
                    transaction.completedAt = new Date(payload.datetime ?? Date.now());
                    transaction.flutterwaveTransactionId = reference;
                    transaction.paymentMethod = this.camerPayService.mapPaymentMethod(payload.operator ?? '');
                    transaction.paymentProviderResponse = payload;
                    await transaction.save();
                    await this.processSuccessfulPayment(transaction);
                    this.logger.log(`Webhook: payment SUCCESSFUL — tx: ${transaction._id}`);
                    break;
                case 'FAILED':
                    transaction.status = transaction_schema_1.TransactionStatus.FAILED;
                    transaction.failureReason = `CamPay status: FAILED`;
                    transaction.paymentProviderResponse = payload;
                    await transaction.save();
                    this.logger.log(`Webhook: payment FAILED — tx: ${transaction._id}`);
                    break;
                default:
                    this.logger.log(`Unhandled CamPay webhook status: ${status}`);
            }
        }
        catch (error) {
            this.logger.error('CamerPay webhook handling error:', error);
            throw error;
        }
    }
    async getTransactionByReference(txRef, userId) {
        this.logger.log(`Finding transaction by reference: ${txRef}`);
        const transaction = await this.transactionModel
            .findOne({ flutterwaveReference: txRef, userId: new mongoose_2.Types.ObjectId(userId) })
            .populate('propertyId', 'title images address')
            .populate('bookingId', 'checkIn checkOut nights priceBreakdown status')
            .populate('subscriptionId')
            .populate('boostId')
            .exec();
        if (!transaction)
            throw new common_1.NotFoundException('Transaction not found');
        return transaction;
    }
    async getUserTransactions(userId, query) {
        const { page = 1, limit = 20, status, type, paymentMethod, startDate, endDate } = query;
        const skip = (page - 1) * limit;
        const filter = { userId: new mongoose_2.Types.ObjectId(userId) };
        if (status)
            filter.status = status;
        if (type)
            filter.type = type;
        if (paymentMethod)
            filter.paymentMethod = paymentMethod;
        if (startDate || endDate) {
            filter.createdAt = {};
            if (startDate)
                filter.createdAt.$gte = new Date(startDate);
            if (endDate)
                filter.createdAt.$lte = new Date(endDate);
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
    async getAllTransactions(query) {
        const { page = 1, limit = 20, status, type, paymentMethod, startDate, endDate } = query;
        const skip = (page - 1) * limit;
        const filter = {};
        if (status)
            filter.status = status;
        if (type)
            filter.type = type;
        if (paymentMethod)
            filter.paymentMethod = paymentMethod;
        if (startDate || endDate) {
            filter.createdAt = {};
            if (startDate)
                filter.createdAt.$gte = new Date(startDate);
            if (endDate)
                filter.createdAt.$lte = new Date(endDate);
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
    async getTransactionById(transactionId, userId) {
        const transaction = await this.transactionModel
            .findOne({ _id: transactionId, userId: new mongoose_2.Types.ObjectId(userId) })
            .populate('propertyId', 'title images address')
            .populate('bookingId', 'checkIn checkOut nights priceBreakdown status paymentStatus')
            .populate('subscriptionId')
            .populate('boostId')
            .exec();
        if (!transaction)
            throw new common_1.NotFoundException('Transaction not found');
        return transaction;
    }
    async processSuccessfulPayment(transaction) {
        this.logger.log(`Processing successful payment: ${transaction._id} | type: ${transaction.type}`);
        switch (transaction.type) {
            case transaction_schema_1.TransactionType.BOOKING:
                await this.confirmBookingPayment(transaction);
                break;
            default:
                this.logger.log(`No post-payment action for type: ${transaction.type}`);
        }
    }
    async confirmBookingPayment(transaction) {
        if (!transaction.bookingId)
            return;
        const booking = await this.bookingModel
            .findById(transaction.bookingId)
            .populate('propertyId', 'isInstantBookable')
            .exec();
        if (!booking) {
            this.logger.error(`Booking not found for tx: ${transaction._id}`);
            return;
        }
        if (booking.paymentStatus === booking_schema_1.PaymentStatus.PAID) {
            this.logger.log(`Booking ${booking._id} already paid — skipping`);
            return;
        }
        const update = {
            paymentStatus: booking_schema_1.PaymentStatus.PAID,
            paymentReference: transaction.flutterwaveReference,
            paymentMethod: transaction.paymentMethod,
            paidAt: transaction.completedAt ?? new Date(),
        };
        update.expiresAt = undefined;
        const isInstantBookable = booking.propertyId?.isInstantBookable ?? false;
        if (isInstantBookable && booking.status === booking_schema_1.BookingStatus.PENDING) {
            update.status = booking_schema_1.BookingStatus.CONFIRMED;
            update.confirmedAt = new Date();
            update.isInstantBook = true;
            this.logger.log(`Auto-confirmed instant booking: ${booking._id}`);
        }
        await this.bookingModel.findByIdAndUpdate(booking._id, update);
        const totalPaid = booking.priceBreakdown.totalAmount;
        const platformCut = Math.round(totalPaid * this.BOOKING_PLATFORM_FEE_RATE);
        const hostPayout = totalPaid - platformCut;
        const hostIdStr = booking.hostId.toString();
        const currency = (booking.currency ?? 'XAF');
        const propertyTitle = booking.propertyId?.title ?? 'Property';
        const commissionDesc = `Booking income: ${propertyTitle} - ${booking.nights} night${booking.nights !== 1 ? 's' : ''} (net after ${this.BOOKING_PLATFORM_FEE_RATE * 100}% platform fee)`;
        const commissionTx = new this.transactionModel({
            userId: booking.hostId,
            bookingId: booking._id,
            propertyId: booking.propertyId,
            amount: hostPayout,
            currency,
            type: transaction_schema_1.TransactionType.COMMISSION,
            status: transaction_schema_1.TransactionStatus.SUCCESS,
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
        await this.walletService.creditWallet(hostIdStr, hostPayout, commissionDesc, transaction.flutterwaveReference ?? undefined, commissionTx._id);
        this.logger.log(`Host payout | host: ${hostIdStr} | payout: ${hostPayout} ${currency} | platform fee: ${platformCut}`);
        const guest = await this.userModel.findById(booking.guestId).select('name').lean();
        await this.notificationsService.notifyPaymentReceived(hostIdStr, {
            bookingId: booking._id.toString(),
            propertyTitle,
            guestName: guest?.name ?? 'A guest',
            amount: hostPayout,
            currency,
        });
    }
    generateTransactionReference(type) {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 8).toUpperCase();
        const typePrefix = type.substring(0, 3).toUpperCase();
        return `HH-${typePrefix}-${timestamp}-${random}`;
    }
    calculateFees(amount, paymentMethod) {
        let paymentProcessingFee = 0;
        switch (paymentMethod) {
            case transaction_schema_1.PaymentMethod.MTN_MOMO:
            case transaction_schema_1.PaymentMethod.ORANGE_MONEY:
                paymentProcessingFee = amount * 0.015;
                break;
            case transaction_schema_1.PaymentMethod.CARD:
                paymentProcessingFee = amount * 0.014 + 100;
                break;
            case transaction_schema_1.PaymentMethod.BANK_TRANSFER:
                paymentProcessingFee = amount * 0.01;
                break;
            default:
                paymentProcessingFee = 0;
        }
        const platformFee = 0;
        const netAmount = amount - platformFee - paymentProcessingFee;
        return { platformFee, paymentProcessingFee, netAmount };
    }
    getTransactionDescription(dto) {
        switch (dto.type) {
            case transaction_schema_1.TransactionType.SUBSCRIPTION: return `Subscription: ${dto.subscriptionPlan} (${dto.billingCycle})`;
            case transaction_schema_1.TransactionType.LISTING_FEE: return 'Property Listing Fee';
            case transaction_schema_1.TransactionType.BOOST_LISTING: return `Listing Boost: ${dto.boostType} (${dto.boostDuration}h)`;
            case transaction_schema_1.TransactionType.DIGITAL_SERVICE: return dto.description || 'Digital Service';
            default: return 'HoroHouse Payment';
        }
    }
    toProviderMethod(paymentMethod) {
        switch (paymentMethod) {
            case transaction_schema_1.PaymentMethod.ORANGE_MONEY: return 'orange_money';
            case transaction_schema_1.PaymentMethod.MTN_MOMO:
            default: return 'mtn_momo';
        }
    }
};
exports.PaymentsService = PaymentsService;
exports.PaymentsService = PaymentsService = PaymentsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(transaction_schema_1.Transaction.name)),
    __param(1, (0, mongoose_1.InjectModel)(booking_schema_1.Booking.name)),
    __param(2, (0, mongoose_1.InjectModel)(user_schema_1.User.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model,
        notifications_service_1.NotificationsService,
        camerpay_service_1.CamerPayService,
        config_1.ConfigService,
        wallet_service_1.WalletService])
], PaymentsService);
//# sourceMappingURL=payments.service.js.map