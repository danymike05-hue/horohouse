import { RawBodyRequest } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { FastifyRequest } from 'fastify';
import { CheckoutService } from './checkout.service';
import { CreateCheckoutPaymentDto } from './dto/create-checkout-payment.dto';
export declare class CheckoutController {
    private readonly checkout;
    private readonly signatureHeader;
    constructor(checkout: CheckoutService, config: ConfigService);
    create(req: any, dto: CreateCheckoutPaymentDto): Promise<import("./checkout.service").CheckoutPaymentView>;
    get(req: any, id: string): Promise<import("./checkout.service").CheckoutPaymentView>;
    cancel(req: any, id: string): Promise<import("./checkout.service").CheckoutPaymentView>;
    webhook(req: RawBodyRequest<FastifyRequest>, headers: Record<string, string | string[] | undefined>): Promise<{
        received: true;
    }>;
    returnFromProvider(paymentId?: string): Promise<{
        url: string;
        statusCode: number;
    }>;
}
