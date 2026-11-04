import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import * as crypto from 'crypto';

// ─────────────────────────────────────────────────────────────────────────────
// CamerPay REST client — https://camerpay.biz/docs/endpoints
// Base URL: https://camerpay.biz/api   ·   Auth: Authorization: Bearer <token>
// Methods:  orange_money | mtn_momo | stripe (cards + Apple/Google Pay on hosted page) | paypal
// Statuses: pending | processing | completed | failed | cancelled | refunded
// ─────────────────────────────────────────────────────────────────────────────

export type CamerPayMethod = 'orange_money' | 'mtn_momo' | 'stripe' | 'paypal';
export type CamerPayStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled' | 'refunded';

export interface CamerPayInitiateInput {
  amount: number; // XAF, integer
  paymentMethod: CamerPayMethod;
  merchantInvoiceId: string;
  callbackUrl: string; // https
  returnUrl: string; // https
  idempotencyKey: string;
  customerPhone?: string; // "+2376XXXXXXXX"
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

export type CamerPayErrorKind =
  | 'provider_unavailable' // operator / CamerPay down or timed out — retry later
  | 'provider_rejected' // operator refused (bad number, account issue…)
  | 'validation' // 422 — amount limits, bad phone…
  | 'auth' // 401 — token invalid/revoked (our config problem)
  | 'quota' // 402 — KYC ceiling or plan quota reached
  | 'not_found'
  | 'unknown';

export class CamerPayError extends Error {
  constructor(
    public readonly kind: CamerPayErrorKind,
    message: string,
    public readonly httpStatus?: number,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'CamerPayError';
  }
}

const TIMEOUT_PATTERN = /timed? ?out|cURL error 28|could not resolve|connection refused|ECONNRESET/i;

@Injectable()
export class CamerPayClient {
  private readonly logger = new Logger(CamerPayClient.name);
  private readonly http: AxiosInstance;
  private readonly apiToken: string;
  private readonly webhookSecret: string;
  private readonly isProduction: boolean;

  constructor(config: ConfigService) {
    // Strip quotes, spaces, line breaks and invisible characters picked up when copying.
    const token = clean(config.get<string>('CAMERPAY_API_TOKEN'));
    if (!token) throw new Error('CAMERPAY_API_TOKEN is not set');
    if (!/^[\x21-\x7E]+$/.test(token)) {
      throw new Error('CAMERPAY_API_TOKEN contains invalid characters — retype it in .env');
    }
    this.apiToken = token;

    this.webhookSecret = clean(config.get<string>('CAMERPAY_WEBHOOK_SECRET'));
    this.isProduction = config.get<string>('NODE_ENV') === 'production';

    if (this.isProduction && !this.webhookSecret) {
      // Refuse to boot: without a secret anyone could forge "payment completed".
      throw new Error('CAMERPAY_WEBHOOK_SECRET must be set in production');
    }

    const baseURL = config.get<string>('CAMERPAY_BASE_URL') ?? 'https://camerpay.biz/api';
    this.http = axios.create({
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

  // ── POST /payment/initiate ────────────────────────────────────────────────
  async initiate(input: CamerPayInitiateInput): Promise<{ uuid: string; payUrl?: string; status: string }> {
    const body: Record<string, unknown> = {
      amount: Math.round(input.amount),
      currency: 'XAF',
      payment_method: input.paymentMethod,
      merchant_invoice_id: input.merchantInvoiceId,
      merchant_callback_url: input.callbackUrl,
      merchant_return_url: input.returnUrl,
      idempotency_key: input.idempotencyKey,
      source: 'horohouse-app',
    };
    if (input.customerPhone) body.customer_phone = input.customerPhone;
    if (input.customerName) body.customer_name = input.customerName;
    if (input.customerEmail) body.customer_email = input.customerEmail;

    // Never log the phone in full.
    this.logger.log(
      `initiate ${input.merchantInvoiceId} | ${input.paymentMethod} | ${body.amount} XAF | phone ${maskPhone(input.customerPhone)}`,
    );

    try {
      const { data } = await this.http.post('/payment/initiate', body);
      const uuid: string | undefined = data?.transaction_uuid ?? data?.uuid;
      if (!uuid) {
        throw new CamerPayError('unknown', data?.message ?? 'CamerPay returned no transaction UUID', 200, data);
      }
      return { uuid, payUrl: data?.pay_url ?? data?.redirect_url, status: data?.status ?? 'pending' };
    } catch (err) {
      throw this.toError(err, `initiate ${input.merchantInvoiceId}`);
    }
  }

  // ── GET /payment/{uuid}/status ────────────────────────────────────────────
  async getStatus(uuid: string): Promise<CamerPayTransaction> {
    try {
      const { data } = await this.http.get(`/payment/${encodeURIComponent(uuid)}/status`);
      // The docs nest the payload under `transaction`; tolerate a flat shape too.
      const t = data?.transaction ?? data ?? {};
      if (!t.status) throw new CamerPayError('unknown', 'CamerPay status response had no status', 200, data);
      return {
        uuid: t.uuid ?? uuid,
        status: String(t.status).toLowerCase() as CamerPayStatus,
        amount: Number(t.amount ?? 0),
        currency: String(t.currency ?? 'XAF').toUpperCase(),
        paymentMethod: t.payment_method,
        merchantInvoiceId: t.merchant_invoice_id,
        paidAt: t.paid_at,
        isSandbox: Boolean(t.is_sandbox),
      };
    } catch (err) {
      throw this.toError(err, `status ${uuid}`);
    }
  }

  // ── Webhook signature ─────────────────────────────────────────────────────
  /**
   * CamerPay's algorithm (official PHP SDK, src/Webhooks/Verifier.php):
   *   signature = hex( HMAC-SHA256( secret, uuid + "|" + invoice_id + "|" + status + "|" + amount ) )
   * sent in the X-CamerPay-Signature header (or a `signature` field in the body).
   * Returns the parsed payload when the signature is valid, otherwise null.
   */
  verifyWebhook(rawBody: Buffer, header: string | string[] | undefined): Record<string, any> | null {
    const payload = parseBody(rawBody);
    if (!payload) {
      this.logger.warn('Webhook body is neither JSON nor form data');
      return null;
    }
    if (!this.webhookSecret) {
      // Only reachable outside production (constructor refuses to boot otherwise).
      this.logger.warn('CAMERPAY_WEBHOOK_SECRET not set — accepting unsigned webhook (dev only)');
      return payload;
    }

    const headerValue = Array.isArray(header) ? header[0] : header;
    const provided = String(headerValue || payload.signature || '').trim().replace(/^sha256=/i, '').toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(provided)) return null;

    const uuid = String(payload.uuid ?? payload.transaction_uuid ?? '');
    const invoiceId = String(payload.invoice_id ?? payload.merchant_invoice_id ?? '');
    const status = String(payload.status ?? '');
    const candidates = amountVariants(payload.amount).map((amount) =>
      this.hmacHex(`${uuid}|${invoiceId}|${status}|${amount}`),
    );

    const ok = candidates.some((expected) => safeEqual(provided, expected));
    if (!ok && !this.isProduction) {
      this.diagnoseSignature(rawBody, payload, provided);
    }
    return ok ? payload : null;
  }

  /** Parse the webhook body without trusting it. */
  parseWebhook(rawBody: Buffer): Record<string, any> | null {
    return parseBody(rawBody);
  }

  private hmacHex(data: string): string {
    return crypto.createHmac('sha256', this.webhookSecret).update(data).digest('hex');
  }

  /** Dev only: tries likely key/data combinations and logs which one CamerPay used. Never logs secrets. */
  private diagnoseSignature(rawBody: Buffer, p: Record<string, any>, provided: string): void {
    const keys: Record<string, string | Buffer> = {
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
    const datas: Record<string, string | Buffer> = { rawBody };
    for (const [idName, id] of Object.entries(ids)) {
      for (const st of statuses) {
        for (const am of amounts) {
          datas[`${idName}|invoice_id|${st}|${am}`] = `${id}|${p.invoice_id}|${st}|${am}`;
          datas[`${idName}|invoice_id|${st}|${am}|currency`] = `${id}|${p.invoice_id}|${st}|${am}|${p.currency}`;
        }
      }
    }

    const bodySig = String(p.signature ?? '').toLowerCase();
    const targets: Record<string, string> = { header: provided };
    if (bodySig && bodySig !== provided) targets.bodySignature = bodySig;

    const matches: string[] = [];
    for (const [tName, target] of Object.entries(targets)) {
      for (const [kName, key] of Object.entries(keys)) {
        for (const [dName, data] of Object.entries(datas)) {
          if (crypto.createHmac('sha256', key).update(data).digest('hex') === target) {
            matches.push(`${tName} = HMAC(${kName}, ${dName})`);
          }
        }
      }
    }

    this.logger.warn(
      `Signature debug | header==body.signature: ${!targets.bodySignature} | ` +
        `status:"${p.status}" amount:${JSON.stringify(p.amount)} | keys ${Object.keys(p).join(',')} | ` +
        `secret ${this.webhookSecret.length} chars | ` +
        (matches.length ? `MATCH: ${matches.join(' ; ')}` : 'no combination matched'),
    );
  }

  // ── Error mapping ─────────────────────────────────────────────────────────
  private toError(err: any, context: string): CamerPayError {
    if (err instanceof CamerPayError) return err;

    const status: number | undefined = err?.response?.status;
    const data = err?.response?.data;
    const message: string = data?.message ?? data?.detail ?? err?.message ?? 'CamerPay error';

    this.logger.error(
      `CamerPay ${context} failed | http ${status ?? '-'} | ${message} | code ${data?.failure_code ?? '-'}` +
        (data?.errors ? ` | fields ${JSON.stringify(data.errors)}` : ''),
    );

    if (!err?.response) return new CamerPayError('provider_unavailable', message); // network / our timeout
    if (status === 401) return new CamerPayError('auth', message, status);
    if (status === 402) return new CamerPayError('quota', message, status, data);
    if (status === 404) return new CamerPayError('not_found', message, status);
    if (status === 422) return new CamerPayError('validation', message, status, data?.errors);
    if (status && status >= 500) return new CamerPayError('provider_unavailable', message, status);

    const failureCode = String(data?.failure_code ?? '');
    if (failureCode.startsWith('PROVIDER')) {
      return new CamerPayError(TIMEOUT_PATTERN.test(message) ? 'provider_unavailable' : 'provider_rejected', message, status, data);
    }
    return new CamerPayError('unknown', message, status, data);
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Removes quotes, whitespace and invisible characters picked up when copying secrets. */
function clean(value: string | undefined): string {
  return (value ?? '').replace(/[ ​-‍﻿\s"'“”‘’]/g, '');
}

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

/** JSON first, then application/x-www-form-urlencoded (what the PHP SDK reads via $_POST). */
function parseBody(raw: Buffer): Record<string, any> | null {
  const text = raw.toString('utf8').trim();
  if (!text) return null;
  try {
    const json = JSON.parse(text);
    return json && typeof json === 'object' ? json : null;
  } catch {
    const obj = Object.fromEntries(new URLSearchParams(text).entries());
    return Object.keys(obj).length ? obj : null;
  }
}

/** CamerPay signs amount as a string ("720.00"); if JSON turned it into 720, try both forms. */
function amountVariants(amount: unknown): string[] {
  if (amount === undefined || amount === null) return [''];
  const variants = new Set<string>([String(amount)]);
  const n = Number(amount);
  if (Number.isFinite(n)) {
    variants.add(String(n));
    variants.add(n.toFixed(2));
  }
  return [...variants];
}

export function maskPhone(phone?: string): string {
  if (!phone) return '-';
  const digits = phone.replace(/\D/g, '');
  return digits.length < 4 ? '***' : `***${digits.slice(-3)}`;
}