"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var CamerPayService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CamerPayService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const axios_1 = require("axios");
const crypto = require("crypto");
let CamerPayService = CamerPayService_1 = class CamerPayService {
    configService;
    logger = new common_1.Logger(CamerPayService_1.name);
    axiosInstance;
    webhookSecret;
    constructor(configService) {
        this.configService = configService;
        const token = this.configService.get('CAMERPAY_API_TOKEN');
        this.webhookSecret =
            this.configService.get('CAMERPAY_WEBHOOK_SECRET') ?? '';
        this.axiosInstance = axios_1.default.create({
            baseURL: 'https://camerpay.biz',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            timeout: 30_000,
        });
        this.logger.log('CamerPay Service initialised → api.camerpay.biz');
    }
    async initializePayment(payload) {
        try {
            this.logger.log(`Initiating CamerPay payment: ${payload.merchant_invoice_id}`);
            const body = {
                amount: Math.round(payload.amount),
                currency: 'XAF',
                payment_method: payload.payment_method,
                merchant_invoice_id: payload.merchant_invoice_id,
                customer_phone: this.formatPhone(payload.customer_phone),
                merchant_callback_url: payload.callback_url,
                merchant_return_url: payload.return_url,
                source: 'api',
            };
            this.logger.log(`CamerPay request body: ${JSON.stringify(body)}`);
            const response = await this.axiosInstance.post('/api/payment/initiate', body);
            const data = response.data;
            this.logger.log(`CamerPay response: ${JSON.stringify(data)}`);
            const uuid = data.uuid ?? data.transaction_uuid;
            const checkoutUrl = data.checkout_url ?? data.pay_url ?? data.redirect_url ?? uuid;
            if (!uuid) {
                throw new common_1.BadRequestException(data.message || 'CamerPay did not return a valid UUID');
            }
            return {
                success: true,
                uuid,
                checkout_url: checkoutUrl,
                status: data.status ?? 'pending',
                _raw: data,
            };
        }
        catch (error) {
            this.logger.error(`CamerPay initializePayment error | status: ${error.response?.status} | ` +
                `data: ${JSON.stringify(error.response?.data)} | ` +
                `payment_method sent: ${payload.payment_method} | ` +
                `phone sent: ${this.formatPhone(payload.customer_phone)}`);
            throw new common_1.BadRequestException(error.response?.data?.message ||
                error.response?.data?.detail ||
                error.message ||
                'Failed to initiate payment with CamerPay');
        }
    }
    async verifyPayment(uuid) {
        try {
            this.logger.log(`Verifying CamerPay payment: ${uuid}`);
            const response = await this.axiosInstance.get(`/api/payment/${uuid}/status`);
            const d = response.data;
            return {
                uuid: d.uuid,
                status: d.status,
                amount: Number(d.amount ?? 0),
                currency: 'XAF',
                paid_at: d.paid_at,
            };
        }
        catch (error) {
            this.logger.error('CamerPay verifyPayment error:', error.response?.data || error.message);
            throw new common_1.BadRequestException('Failed to verify payment with CamerPay');
        }
    }
    verifyWebhookSignature(rawBody, signature) {
        if (!this.webhookSecret) {
            this.logger.warn('CAMERPAY_WEBHOOK_SECRET not set — skipping sig check');
            return true;
        }
        try {
            const expected = crypto
                .createHmac('sha256', this.webhookSecret)
                .update(rawBody)
                .digest('hex');
            return crypto.timingSafeEqual(Buffer.from(signature, 'utf8'), Buffer.from(expected, 'utf8'));
        }
        catch {
            return false;
        }
    }
    formatPhone(phone) {
        if (!phone)
            return '';
        let cleaned = phone.replace(/\s+/g, '').replace(/^\+/, '');
        if (cleaned.startsWith('237'))
            cleaned = cleaned.slice(3);
        else if (cleaned.startsWith('0'))
            cleaned = cleaned.slice(1);
        return cleaned;
    }
    detectOperatorFromPhone(phone) {
        const local = this.formatPhone(phone);
        const p2 = local.slice(0, 2);
        const p3 = parseInt(local.slice(0, 3), 10);
        if (p2 === '69')
            return 'orange_money';
        if (p3 >= 655 && p3 <= 659)
            return 'orange_money';
        if (p3 >= 685 && p3 <= 689)
            return 'orange_money';
        if (p2 === '67')
            return 'mtn_momo';
        if (p3 >= 650 && p3 <= 654)
            return 'mtn_momo';
        if (p3 >= 680 && p3 <= 684)
            return 'mtn_momo';
        this.logger.warn(`Could not detect MoMo operator for prefix: ${local.slice(0, 3)}`);
        return 'mtn_momo';
    }
    mapPaymentMethod(operator) {
        const m = (operator ?? '').toLowerCase();
        if (m.includes('orange'))
            return 'orange_money';
        return 'mtn_momo';
    }
    getPaymentLink(reference) {
        return reference;
    }
    async initiatePayout(_payload) {
        this.logger.warn('CamerPay payout not yet implemented');
        return { success: false };
    }
};
exports.CamerPayService = CamerPayService;
exports.CamerPayService = CamerPayService = CamerPayService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], CamerPayService);
//# sourceMappingURL=camerpay.service.js.map