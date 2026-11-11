import type { CheckoutMethod, CheckoutPurpose, MomoOperator } from '../schemas/checkout-payment.schema';
export declare class CreateCheckoutPaymentDto {
    purpose?: CheckoutPurpose;
    bookingId?: string;
    planName?: string;
    billingCycle?: 'monthly' | 'quarterly' | 'yearly';
    propertyId?: string;
    boostType?: string;
    duration?: number;
    method: CheckoutMethod;
    operator?: MomoOperator;
    phone?: string;
    returnUrl?: string;
}
export declare class CheckoutQuoteQueryDto {
    purpose: 'subscription' | 'boost';
    planName?: string;
    billingCycle?: 'monthly' | 'quarterly' | 'yearly';
    propertyId?: string;
    boostType?: string;
    duration?: number;
}
