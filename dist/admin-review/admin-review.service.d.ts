import { ModuleRef } from '@nestjs/core';
import { Model } from 'mongoose';
import { CheckoutPaymentDocument, ReviewResolution } from '../checkout/schemas/checkout-payment.schema';
import { TransactionDocument } from '../payments/schemas/transaction.schema';
import { BookingDocument } from '../bookings/schema/booking.schema';
import { UserDocument } from '../users/schemas/user.schema';
export type ReviewSource = 'checkout' | 'transaction';
export interface ReviewItem {
    id: string;
    source: ReviewSource;
    amount: number;
    currency: string;
    method: string | null;
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
    reference: string | null;
    canRefundOnline: boolean;
    booking: {
        id: string;
        status: string;
        paymentStatus: string | null;
        checkIn: string | null;
        checkOut: string | null;
        propertyTitle: string | null;
    } | null;
    purchase?: {
        purpose: string;
        label: string | null;
    } | null;
    guest: {
        id: string;
        name: string | null;
        email: string | null;
        phone: string | null;
    } | null;
}
export declare class AdminReviewService {
    private readonly checkouts;
    private readonly transactions;
    private readonly bookings;
    private readonly users;
    private readonly moduleRef;
    private readonly logger;
    constructor(checkouts: Model<CheckoutPaymentDocument>, transactions: Model<TransactionDocument>, bookings: Model<BookingDocument>, users: Model<UserDocument>, moduleRef: ModuleRef);
    private camerPay;
    private notifications;
    list(state?: 'open' | 'resolved', limit?: number): Promise<{
        items: ReviewItem[];
        openCount: number;
    }>;
    refund(source: ReviewSource, id: string, admin: any, amount?: number, note?: string): Promise<{
        ok: true;
    }>;
    resolve(source: ReviewSource, id: string, admin: any, resolution: 'refunded_manually' | 'no_refund_needed', note?: string, amount?: number): Promise<{
        ok: true;
    }>;
    summary(days?: number): Promise<{
        days: number;
        paymentsToReview: number;
        pendingIdentities: number;
        platformCommission: number;
        hostPayouts: number;
        paidBookings: any;
        refundedTotal: number;
        refundCount: any;
    }>;
    private check;
    private adminOf;
    private refundValue;
    private tellGuest;
}
