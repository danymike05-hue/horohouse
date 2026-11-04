import type { CheckoutMethod, MomoOperator } from '../schemas/checkout-payment.schema';
export declare class CreateCheckoutPaymentDto {
    bookingId: string;
    method: CheckoutMethod;
    operator?: MomoOperator;
    phone?: string;
    returnUrl?: string;
}
