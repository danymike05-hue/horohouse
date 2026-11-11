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
var CamerPayClient_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CamerPayClient = exports.CamerPayError = void 0;
exports.maskPhone = maskPhone;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const axios_1 = require("axios");
const crypto = require("crypto");
class CamerPayError extends Error {
    kind;
    httpStatus;
    details;
    constructor(kind, message, httpStatus, details) {
        super(message);
        this.kind = kind;
        this.httpStatus = httpStatus;
        this.details = details;
        this.name = 'CamerPayError';
    }
}
exports.CamerPayError = CamerPayError;
const TIMEOUT_PATTERN = /timed? ?out|cURL error 28|could not resolve|connection refused|ECONNRESET/i;
let CamerPayClient = CamerPayClient_1 = class CamerPayClient {
    logger = new common_1.Logger(CamerPayClient_1.name);
    http;
    apiToken;
    webhookSecret;
    isProduction;
    constructor(config) {
        const token = clean(config.get('CAMERPAY_API_TOKEN'));
        if (!token)
            throw new Error('CAMERPAY_API_TOKEN is not set');
        if (!/^[\x21-\x7E]+$/.test(token)) {
            throw new Error('CAMERPAY_API_TOKEN contains invalid characters — retype it in .env');
        }
        this.apiToken = token;
        this.webhookSecret = clean(config.get('CAMERPAY_WEBHOOK_SECRET'));
        this.isProduction = config.get('NODE_ENV') === 'production';
        if (this.isProduction && !this.webhookSecret) {
            throw new Error('CAMERPAY_WEBHOOK_SECRET must be set in production');
        }
        const baseURL = config.get('CAMERPAY_BASE_URL') ?? 'https://camerpay.biz/api';
        this.http = axios_1.default.create({
            baseURL,
            timeout: 30_000,
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
                Accept: 'application/json',
            },
        });
        this.logger.log(`CamerPay client ready → ${baseURL}`);
    }
    async initiate(input) {
        const body = {
            amount: Math.round(input.amount),
            currency: 'XAF',
            payment_method: input.paymentMethod,
            merchant_invoice_id: input.merchantInvoiceId,
            merchant_callback_url: input.callbackUrl,
            merchant_return_url: input.returnUrl,
            idempotency_key: input.idempotencyKey,
            source: 'horohouse-app',
        };
        if (input.customerPhone)
            body.customer_phone = input.customerPhone;
        if (input.customerName)
            body.customer_name = input.customerName;
        if (input.customerEmail)
            body.customer_email = input.customerEmail;
        this.logger.log(`initiate ${input.merchantInvoiceId} | ${input.paymentMethod} | ${body.amount} XAF | phone ${maskPhone(input.customerPhone)}`);
        try {
            const { data } = await this.http.post('/payment/initiate', body);
            const uuid = data?.transaction_uuid ?? data?.uuid;
            if (!uuid) {
                throw new CamerPayError('unknown', data?.message ?? 'CamerPay returned no transaction UUID', 200, data);
            }
            return { uuid, payUrl: data?.pay_url ?? data?.redirect_url, status: data?.status ?? 'pending' };
        }
        catch (err) {
            throw this.toError(err, `initiate ${input.merchantInvoiceId}`);
        }
    }
    async getStatus(uuid) {
        try {
            const { data } = await this.http.get(`/payment/${encodeURIComponent(uuid)}/status`);
            const t = data?.transaction ?? data ?? {};
            if (!t.status)
                throw new CamerPayError('unknown', 'CamerPay status response had no status', 200, data);
            return {
                uuid: t.uuid ?? uuid,
                status: String(t.status).toLowerCase(),
                amount: Number(t.amount ?? 0),
                currency: String(t.currency ?? 'XAF').toUpperCase(),
                paymentMethod: t.payment_method,
                merchantInvoiceId: t.merchant_invoice_id,
                paidAt: t.paid_at,
                isSandbox: Boolean(t.is_sandbox),
            };
        }
        catch (err) {
            throw this.toError(err, `status ${uuid}`);
        }
    }
    verifyWebhook(rawBody, header) {
        const payload = parseBody(rawBody);
        if (!payload) {
            this.logger.warn('Webhook body is neither JSON nor form data');
            return null;
        }
        if (!this.webhookSecret) {
            this.logger.warn('CAMERPAY_WEBHOOK_SECRET not set — accepting unsigned webhook (dev only)');
            return payload;
        }
        const headerValue = Array.isArray(header) ? header[0] : header;
        const provided = String(headerValue || payload.signature || '').trim().replace(/^sha256=/i, '').toLowerCase();
        if (!/^[0-9a-f]{64}$/.test(provided))
            return null;
        const uuid = String(payload.uuid ?? payload.transaction_uuid ?? '');
        const invoiceId = String(payload.invoice_id ?? payload.merchant_invoice_id ?? '');
        const status = String(payload.status ?? '');
        const candidates = amountVariants(payload.amount).map((amount) => this.hmacHex(`${uuid}|${invoiceId}|${status}|${amount}`));
        const ok = candidates.some((expected) => safeEqual(provided, expected));
        if (!ok && !this.isProduction) {
            this.diagnoseSignature(rawBody, payload, provided);
        }
        return ok ? payload : null;
    }
    parseWebhook(rawBody) {
        return parseBody(rawBody);
    }
    hmacHex(data) {
        return crypto.createHmac('sha256', this.webhookSecret).update(data).digest('hex');
    }
    diagnoseSignature(rawBody, p, provided) {
        const keys = {
            webhookSecret: this.webhookSecret,
            apiToken: this.apiToken,
            apiTokenAfterPipe: this.apiToken.split('|').pop() ?? '',
        };
        if (/^[0-9a-f]+$/i.test(this.webhookSecret) && this.webhookSecret.length % 2 === 0) {
            keys.webhookSecretHexBytes = Buffer.from(this.webhookSecret, 'hex');
        }
        const ids = { uuid: String(p.uuid ?? ''), transaction_uuid: String(p.transaction_uuid ?? '') };
        const statuses = [...new Set([String(p.status ?? ''), String(p.status ?? '').toUpperCase()])];
        const amounts = amountVariants(p.amount);
        const datas = { rawBody };
        for (const [idName, id] of Object.entries(ids)) {
            for (const st of statuses) {
                for (const am of amounts) {
                    datas[`${idName}|invoice_id|${st}|${am}`] = `${id}|${p.invoice_id}|${st}|${am}`;
                    datas[`${idName}|invoice_id|${st}|${am}|currency`] = `${id}|${p.invoice_id}|${st}|${am}|${p.currency}`;
                }
            }
        }
        const bodySig = String(p.signature ?? '').toLowerCase();
        const targets = { header: provided };
        if (bodySig && bodySig !== provided)
            targets.bodySignature = bodySig;
        const matches = [];
        for (const [tName, target] of Object.entries(targets)) {
            for (const [kName, key] of Object.entries(keys)) {
                for (const [dName, data] of Object.entries(datas)) {
                    if (crypto.createHmac('sha256', key).update(data).digest('hex') === target) {
                        matches.push(`${tName} = HMAC(${kName}, ${dName})`);
                    }
                }
            }
        }
        this.logger.warn(`Signature debug | header==body.signature: ${!targets.bodySignature} | ` +
            `status:"${p.status}" amount:${JSON.stringify(p.amount)} | keys ${Object.keys(p).join(',')} | ` +
            `secret ${this.webhookSecret.length} chars | ` +
            (matches.length ? `MATCH: ${matches.join(' ; ')}` : 'no combination matched'));
    }
    toError(err, context) {
        if (err instanceof CamerPayError)
            return err;
        const status = err?.response?.status;
        const data = err?.response?.data;
        const message = data?.message ?? data?.detail ?? err?.message ?? 'CamerPay error';
        this.logger.error(`CamerPay ${context} failed | http ${status ?? '-'} | ${message} | code ${data?.failure_code ?? '-'}` +
            (data?.errors ? ` | fields ${JSON.stringify(data.errors)}` : ''));
        if (!err?.response)
            return new CamerPayError('provider_unavailable', message);
        if (status === 401)
            return new CamerPayError('auth', message, status);
        if (status === 402)
            return new CamerPayError('quota', message, status, data);
        if (status === 404)
            return new CamerPayError('not_found', message, status);
        if (status === 422)
            return new CamerPayError('validation', message, status, data?.errors);
        if (status && status >= 500)
            return new CamerPayError('provider_unavailable', message, status);
        const failureCode = String(data?.failure_code ?? '');
        if (failureCode.startsWith('PROVIDER')) {
            return new CamerPayError(TIMEOUT_PATTERN.test(message) ? 'provider_unavailable' : 'provider_rejected', message, status, data);
        }
        return new CamerPayError('unknown', message, status, data);
    }
};
exports.CamerPayClient = CamerPayClient;
exports.CamerPayClient = CamerPayClient = CamerPayClient_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], CamerPayClient);
function clean(value) {
    return (value ?? '').replace(/[ ​-‍﻿\s"'“”‘’]/g, '');
}
function safeEqual(a, b) {
    const x = Buffer.from(a);
    const y = Buffer.from(b);
    return x.length === y.length && crypto.timingSafeEqual(x, y);
}
function parseBody(raw) {
    const text = raw.toString('utf8').trim();
    if (!text)
        return null;
    try {
        const json = JSON.parse(text);
        return json && typeof json === 'object' ? json : null;
    }
    catch {
        const obj = Object.fromEntries(new URLSearchParams(text).entries());
        return Object.keys(obj).length ? obj : null;
    }
}
function amountVariants(amount) {
    if (amount === undefined || amount === null)
        return [''];
    const variants = new Set([String(amount)]);
    const n = Number(amount);
    if (Number.isFinite(n)) {
        variants.add(String(n));
        variants.add(n.toFixed(2));
    }
    return [...variants];
}
function maskPhone(phone) {
    if (!phone)
        return '-';
    const digits = phone.replace(/\D/g, '');
    return digits.length < 4 ? '***' : `***${digits.slice(-3)}`;
}
//# sourceMappingURL=camerpay.client.js.map