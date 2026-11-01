import { TransactionType, PaymentMethod, Currency } from '../schemas/transaction.schema';
import { BillingCycle } from '../schemas/transaction.schema';
import { BoostType } from '../schemas/listing-boost.schema';
export declare class InitializePaymentDto {
    type: TransactionType;
    amount: number;
    currency?: Currency;
    paymentMethod: PaymentMethod;
    propertyId?: string;
    subscriptionPlan?: string;
    billingCycle?: BillingCycle;
    boostType?: BoostType;
    boostDuration?: number;
    description?: string;
    metadata?: Record<string, any>;
    redirectUrl?: string;
    customerEmail?: string;
    customerPhone?: string;
    customerName?: string;
}
export declare class VerifyPaymentDto {
    transactionId: string;
    flutterwaveReference?: string;
}
export declare class CreateSubscriptionDto {
    planName: string;
    billingCycle: BillingCycle;
    discountCode?: string;
    paymentMethod?: PaymentMethod;
}
export declare class CreateListingBoostDto {
    propertyId: string;
    boostType: BoostType;
    duration: number;
    metadata?: Record<string, any>;
}
export declare class CancelSubscriptionDto {
    reason: string;
    feedback?: string;
    cancelImmediately?: boolean;
}
export declare class WithdrawFundsDto {
    amount: number;
    withdrawalMethod: PaymentMethod;
    accountNumber?: string;
    accountName?: string;
    bankCode?: string;
}
export declare class InitiateBookingPaymentDto {
    paymentMethod?: PaymentMethod;
    phone?: string;
}
export declare class FlutterwaveWebhookDto {
    event: string;
    data: {
        id: number;
        tx_ref: string;
        flw_ref: string;
        device_fingerprint: string;
        amount: number;
        currency: string;
        charged_amount: number;
        app_fee: number;
        merchant_fee: number;
        processor_response: string;
        auth_model: string;
        ip: string;
        narration: string;
        status: string;
        payment_type: string;
        created_at: string;
        account_id: number;
        customer: {
            id: number;
            name: string;
            phone_number: string;
            email: string;
            created_at: string;
        };
        [key: string]: any;
    };
}
export declare class TransactionQueryDto {
    status?: string;
    type?: string;
    paymentMethod?: string;
    page?: number;
    limit?: number;
    startDate?: string;
    endDate?: string;
}
