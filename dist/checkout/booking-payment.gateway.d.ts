import { Model } from 'mongoose';
import { BookingDocument } from '../bookings/schema/booking.schema';
import { TransactionDocument } from '../payments/schemas/transaction.schema';
import { PaymentsService } from '../payments/services/payments.service';
import { UserDocument } from '../users/schemas/user.schema';
import type { CheckoutPaymentDocument } from './schemas/checkout-payment.schema';
export interface PayableBooking {
    id: string;
    amount: number;
    customerName?: string;
    customerPhone?: string;
    expiresAt?: Date;
}
export type FulfilmentResult = 'confirmed' | 'already_paid_same' | 'already_paid_other' | 'not_payable';
export declare class BookingPaymentGateway {
    private readonly bookings;
    private readonly transactions;
    private readonly users;
    private readonly paymentsService;
    private readonly logger;
    constructor(bookings: Model<BookingDocument>, transactions: Model<TransactionDocument>, users: Model<UserDocument>, paymentsService: PaymentsService);
    getPayableBooking(bookingId: string, userId: string): Promise<PayableBooking>;
    markPaid(payment: CheckoutPaymentDocument): Promise<FulfilmentResult>;
}
