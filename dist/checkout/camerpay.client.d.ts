import { ConfigService } from '@nestjs/config';
export type CamerPayMethod = 'orange_money' | 'mtn_momo' | 'stripe' | 'paypal';
export type CamerPayStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled' | 'refunded';
export interface CamerPayInitiateInput {
    amount: number;
    paymentMethod: CamerPayMethod;
    merchantInvoiceId: string;
    callbackUrl: string;
    returnUrl: string;
    idempotencyKey: string;
    customerPhone?: string;
    customerName?: string;
    customerEmail?: string;
}
export interface CamerPayTransaction {
    uuid: string;
    status: CamerPayStatus;
    amount: number;
    currency: string;
    paymentMethod?: string;
    merchantInvoiceId?: string;
    paidAt?: string;
    isSandbox?: boolean;
}
export type CamerPayErrorKind = 'provider_unavailable' | 'provider_rejected' | 'validation' | 'auth' | 'quota' | 'not_found' | 'unknown';
export declare class CamerPayError extends Error {
    readonly kind: CamerPayErrorKind;
    readonly httpStatus?: number | undefined;
    readonly details?: unknown | undefined;
    constructor(kind: CamerPayErrorKind, message: string, httpStatus?: number | undefined, details?: unknown | undefined);
}
export declare class CamerPayClient {
    private readonly logger;
    private readonly http;
    private readonly apiToken;
    private readonly webhookSecret;
    private readonly isProduction;
    constructor(config: ConfigService);
    initiate(input: CamerPayInitiateInput): Promise<{
        uuid: string;
        payUrl?: string;
        status: string;
    }>;
    getStatus(uuid: string): Promise<CamerPayTransaction>;
    verifyWebhook(rawBody: Buffer, header: string | string[] | undefined): Record<string, any> | null;
    parseWebhook(rawBody: Buffer): Record<string, any> | null;
    private hmacHex;
    private diagnoseSignature;
    private toError;
}
export declare function maskPhone(phone?: string): string;
