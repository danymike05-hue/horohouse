import { ConfigService } from '@nestjs/config';
import { Model } from 'mongoose';
import { BookingPaymentGateway } from './booking-payment.gateway';
import { CamerPayClient } from './camerpay.client';
import { CreateCheckoutPaymentDto } from './dto/create-checkout-payment.dto';
import { CheckoutPaymentDocument, CheckoutStatus } from './schemas/checkout-payment.schema';
import { NotificationsService } from '../notifications/notifications.service';
export interface CheckoutPaymentView {
    id: string;
    bookingId: string;
    method: 'mobile_money' | 'card';
    operator?: string;
    phoneMasked?: string;
    amount: number;
    currency: 'XAF';
    status: CheckoutStatus;
    failureReason?: string;
    payUrl?: string;
    expiresAt: string;
    createdAt?: string;
    paidAt?: string;
}
export declare class CheckoutService {
    private readonly payments;
    private readonly camerpay;
    private readonly bookings;
    private readonly notifications?;
    private readonly logger;
    private readonly publicApiUrl;
    private readonly momoTtlMs;
    private readonly cardTtlMs;
    private readonly returnSchemes;
    private readonly frontendUrl?;
    private readonly defaultAppReturn;
    constructor(payments: Model<CheckoutPaymentDocument>, camerpay: CamerPayClient, bookings: BookingPaymentGateway, config: ConfigService, notifications?: NotificationsService | undefined);
    createPayment(userId: string, dto: CreateCheckoutPaymentDto): Promise<CheckoutPaymentView>;
    getPayment(userId: string, paymentId: string): Promise<CheckoutPaymentView>;
    cancelPayment(userId: string, paymentId: string): Promise<CheckoutPaymentView>;
    handleWebhook(rawBody: Buffer | undefined, signature: string | string[] | undefined): Promise<{
        received: true;
    }>;
    private applyProviderStatus;
    private fulfil;
    private computeExpiry;
    private flag;
    expireOverdue(batchSize?: number): Promise<number>;
    buildReturnRedirect(paymentId: string | undefined): Promise<string>;
    private findOwned;
    private validateReturnUrl;
    private toView;
    private toHttpError;
}
