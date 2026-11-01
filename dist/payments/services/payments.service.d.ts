import { Model } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { CamerPayService } from './camerpay.service';
import { WalletService } from './wallet.service';
import { Transaction, TransactionDocument, PaymentMethod } from '../schemas/transaction.schema';
import { BookingDocument } from '../../bookings/schema/booking.schema';
import { InitializePaymentDto, VerifyPaymentDto, TransactionQueryDto } from '../dto/payment.dto';
import { NotificationsService } from '../../notifications/notifications.service';
import { User, UserDocument } from '../../users/schemas/user.schema';
export declare class PaymentsService {
    private transactionModel;
    private bookingModel;
    private userModel;
    private readonly notificationsService;
    private camerPayService;
    private configService;
    private walletService;
    private readonly logger;
    private readonly BOOKING_PLATFORM_FEE_RATE;
    constructor(transactionModel: Model<TransactionDocument>, bookingModel: Model<BookingDocument>, userModel: Model<UserDocument>, notificationsService: NotificationsService, camerPayService: CamerPayService, configService: ConfigService, walletService: WalletService);
    private resolveCustomerName;
    initializePayment(dto: InitializePaymentDto, user: User): Promise<{
        transaction: TransactionDocument;
        paymentLink: string;
    }>;
    initiateBookingPayment(bookingId: string, user: User, selectedMethod?: PaymentMethod, checkoutPhone?: string): Promise<{
        transaction: TransactionDocument;
        paymentLink: string;
        txRef: string;
    }>;
    verifyPayment(dto: VerifyPaymentDto, user: User): Promise<Transaction>;
    reconcileTransaction(transaction: TransactionDocument): Promise<'success' | 'failed' | 'unchanged'>;
    handleWebhook(rawBody: string, signature: string): Promise<void>;
    getTransactionByReference(txRef: string, userId: string): Promise<Transaction>;
    getUserTransactions(userId: string, query: TransactionQueryDto): Promise<{
        transactions: Transaction[];
        total: number;
        page: number;
        totalPages: number;
    }>;
    getAllTransactions(query: TransactionQueryDto): Promise<{
        transactions: Transaction[];
        total: number;
        page: number;
        totalPages: number;
    }>;
    getTransactionById(transactionId: string, userId: string): Promise<Transaction>;
    processSuccessfulPayment(transaction: TransactionDocument): Promise<void>;
    private confirmBookingPayment;
    private generateTransactionReference;
    private calculateFees;
    private getTransactionDescription;
    private toProviderMethod;
}
