import { ConfigService } from '@nestjs/config';
export declare class CamerPayService {
    private configService;
    private readonly logger;
    private readonly axiosInstance;
    private readonly webhookSecret;
    constructor(configService: ConfigService);
    initializePayment(payload: {
        merchant_invoice_id: string;
        amount: number;
        currency: string;
        payment_method: string;
        customer_name: string;
        customer_phone: string;
        callback_url: string;
        return_url: string;
    }): Promise<{
        success: boolean;
        uuid: string;
        checkout_url: string;
        status: string;
        _raw?: any;
    }>;
    verifyPayment(uuid: string): Promise<{
        uuid: string;
        status: 'pending' | 'processing' | 'completed' | 'failed' | 'refunded' | 'cancelled';
        amount: number;
        currency: 'XAF';
        paid_at?: string;
    }>;
    verifyWebhookSignature(rawBody: string, signature: string): boolean;
    formatPhone(phone: string): string;
    detectOperatorFromPhone(phone: string): 'orange_money' | 'mtn_momo';
    mapPaymentMethod(operator: string): string;
    getPaymentLink(reference: string): string;
    initiatePayout(_payload: any): Promise<{
        [x: string]: unknown;
        success: boolean;
    }>;
}
