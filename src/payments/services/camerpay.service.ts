import { Injectable, Logger, BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import * as crypto from 'crypto';

// ─────────────────────────────────────────────────────────────────────────────
// CamerPay (camerpay.biz) API wrapper
// Docs:     https://camerpay.biz/pages-docs-legacy
// Base URL: https://api.camerpay.biz
// Auth:     Authorization: Bearer <token>
// ─────────────────────────────────────────────────────────────────────────────

@Injectable()
export class CamerPayService {
  private readonly logger = new Logger(CamerPayService.name);
  private readonly axiosInstance: AxiosInstance;
  private readonly webhookSecret: string;

  constructor(private configService: ConfigService) {
    const token = this.configService.get<string>('CAMERPAY_API_TOKEN')!;
    this.webhookSecret =
      this.configService.get<string>('CAMERPAY_WEBHOOK_SECRET') ?? '';

    // ✅ Real CamerPay base URL — NOT campay.net
    // Fix base URL — no subdomain
    this.axiosInstance = axios.create({
      baseURL: 'https://camerpay.biz',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      timeout: 30_000,
    });

    this.logger.log('CamerPay Service initialised → api.camerpay.biz');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // POST /api/payment — create a hosted checkout session
  // Returns checkout_url to redirect the customer to
  // ─────────────────────────────────────────────────────────────────────────

async initializePayment(payload: {
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
}> {
  try {
    this.logger.log(
      `Initiating CamerPay payment: ${payload.merchant_invoice_id}`,
    );

    // Fix endpoint + field names to match dashboard curl example
    const body = {
      amount: Math.round(payload.amount),
      currency: 'XAF',
      payment_method: payload.payment_method,
      merchant_invoice_id: payload.merchant_invoice_id,
      customer_phone: this.formatPhone(payload.customer_phone),
      // ✅ correct field names from dashboard
      merchant_callback_url: payload.callback_url,
      merchant_return_url: payload.return_url,
      source: 'api',
    };

    // Log BEFORE the call — if CamerPay errors, we still know exactly what we sent
    this.logger.log(`CamerPay request body: ${JSON.stringify(body)}`);

    // ✅ correct endpoint: /api/payment/initiate
    const response = await this.axiosInstance.post('/api/payment/initiate', body);

    const data = response.data;
    this.logger.log(`CamerPay response: ${JSON.stringify(data)}`);

    // ✅ CamerPay returns transaction_uuid (not uuid), pay_url (not checkout_url)
    const uuid = data.uuid ?? data.transaction_uuid;
    const checkoutUrl = data.checkout_url ?? data.pay_url ?? data.redirect_url ?? uuid;

    if (!uuid) {
      throw new BadRequestException(
        data.message || 'CamerPay did not return a valid UUID',
      );
    }

    return {
      success: true,
      uuid,
      checkout_url: checkoutUrl,
      status: data.status ?? 'pending',
      _raw: data,
    };

  } catch (error: any) {
  const resData = error.response?.data;
  const rawMsg: string = resData?.message ?? error.message ?? '';

  this.logger.error(
    `CamerPay initializePayment error | status: ${error.response?.status} | ` +
    `data: ${JSON.stringify(resData)} | ` +
    `payment_method sent: ${payload.payment_method} | ` +
    `phone sent: ${this.formatPhone(payload.customer_phone)}`,
  );

  // Operator (Orange/MTN) unreachable, or our own call to CamerPay timed out
  const isProviderOutage =
    resData?.failure_code === 'PROVIDER_BUSINESS_ERROR' &&
    /timed out|cURL error 28|could not resolve|connection refused/i.test(rawMsg);
  const isOurTimeout = error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT';

  if (isProviderOutage || isOurTimeout) {
    const operator = payload.payment_method === 'orange_money' ? 'Orange Money' : 'MTN MoMo';
    throw new ServiceUnavailableException({
      code: 'PROVIDER_UNAVAILABLE',
      message: `${operator} est momentanément indisponible. Réessayez dans quelques minutes ou choisissez un autre moyen de paiement.`,
    });
  }

  throw new BadRequestException(
    resData?.message || resData?.detail || error.message || 'Failed to initiate payment with CamerPay',
  );
}
}

  // ─────────────────────────────────────────────────────────────────────────
  // GET /api/payment/{uuid}/status — poll payment status
  // ─────────────────────────────────────────────────────────────────────────

  async verifyPayment(uuid: string): Promise<{
    uuid: string;
    status: 'pending' | 'processing' | 'completed' | 'failed' | 'refunded' | 'cancelled';
    amount: number;
    currency: 'XAF';
    paid_at?: string;
  }> {
    try {
      this.logger.log(`Verifying CamerPay payment: ${uuid}`);

      // ✅ Correct endpoint: GET /api/payment/{uuid}/status
      const response = await this.axiosInstance.get(
        `/api/payment/${uuid}/status`,
      );
      const d = response.data;

      return {
        uuid: d.uuid,
        status: d.status,
        amount: Number(d.amount ?? 0),
        currency: 'XAF',
        paid_at: d.paid_at,
      };
    } catch (error: any) {
      this.logger.error(
        'CamerPay verifyPayment error:',
        error.response?.data || error.message,
      );
      throw new BadRequestException('Failed to verify payment with CamerPay');
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Webhook — header: X-CamerPay-Signature (HMAC-SHA256)
  // ─────────────────────────────────────────────────────────────────────────

  verifyWebhookSignature(rawBody: string, signature: string): boolean {
    if (!this.webhookSecret) {
      this.logger.warn('CAMERPAY_WEBHOOK_SECRET not set — skipping sig check');
      return true;
    }
    try {
      const expected = crypto
        .createHmac('sha256', this.webhookSecret)
        .update(rawBody)
        .digest('hex');
      return crypto.timingSafeEqual(
        Buffer.from(signature, 'utf8'),
        Buffer.from(expected, 'utf8'),
      );
    } catch {
      return false;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * CamerPay wants the local phone number WITHOUT the 237 country code.
   * "237699000000" → "699000000"
   * "+237699000000" → "699000000"
   * "699000000"     → "699000000"  (already correct)
   */
formatPhone(phone: string): string {
  if (!phone) return '';
  let cleaned = phone.replace(/\s+/g, '').replace(/^\+/, '');
  if (cleaned.startsWith('237')) cleaned = cleaned.slice(3);
  else if (cleaned.startsWith('0')) cleaned = cleaned.slice(1);
  return cleaned;
}

detectOperatorFromPhone(phone: string): 'orange_money' | 'mtn_momo' {
  const local = this.formatPhone(phone);
  const p2 = local.slice(0, 2);
  const p3 = parseInt(local.slice(0, 3), 10);
  if (p2 === '69') return 'orange_money';
  if (p3 >= 655 && p3 <= 659) return 'orange_money';
  if (p3 >= 685 && p3 <= 689) return 'orange_money';
  if (p2 === '67') return 'mtn_momo';
  if (p3 >= 650 && p3 <= 654) return 'mtn_momo';
  if (p3 >= 680 && p3 <= 684) return 'mtn_momo';
  this.logger.warn(`Could not detect MoMo operator for prefix: ${local.slice(0, 3)}`);
  return 'mtn_momo';
}

 
  mapPaymentMethod(operator: string): string {
    const m = (operator ?? '').toLowerCase();
    if (m.includes('orange')) return 'orange_money';
    return 'mtn_momo';
  }

  getPaymentLink(reference: string): string {
    return reference;
  }

  async initiatePayout(_payload: any): Promise<{
    [x: string]: unknown; success: boolean
  }> {
    this.logger.warn('CamerPay payout not yet implemented');
    return { success: false };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // POST /api/payment/{uuid}/refund — request a full or partial refund
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Initiates a refund for a completed CamerPay payment.
   *
   * @param uuid      The CamerPay transaction UUID (stored in flutterwaveTransactionId).
   * @param amount    Amount to refund in XAF (must be <= original captured amount).
   * @param reason    Human-readable reason shown in the CamerPay dashboard.
   *
   * TODO: Confirm the exact endpoint path and response shape by:
   *   1. Checking https://camerpay.biz/pages-docs-legacy under "Refunds".
   *   2. Running: curl -X POST https://camerpay.biz/api/payment/{uuid}/refund \
   *        -H "Authorization: Bearer <token>" \
   *        -H "Content-Type: application/json" \
   *        -d '{"amount": 5000, "currency": "XAF", "reason": "test"}'
   *
   * If CamerPay does NOT support programmatic refunds on this plan,
   * throw a BadRequestException here and process manually via the dashboard.
   */
  async refundPayment(
    uuid: string,
    amount: number,
    reason = 'Booking cancellation refund',
  ): Promise<{
    success: boolean;
    refundId?: string;
    status: string;
    _raw?: any;
  }> {
    try {
      this.logger.log(
        `Initiating CamerPay refund | uuid: ${uuid} | amount: ${amount} XAF | reason: ${reason}`,
      );

      const body = {
        amount: Math.round(amount),
        currency: 'XAF',
        reason,
      };

      this.logger.log(`CamerPay refund request body: ${JSON.stringify(body)}`);

      // Endpoint pattern mirrors GET /api/payment/{uuid}/status
      // Adjust path if CamerPay documentation shows a different route.
      const response = await this.axiosInstance.post(
        `/api/payment/${uuid}/refund`,
        body,
      );

      const data = response.data;
      this.logger.log(`CamerPay refund response: ${JSON.stringify(data)}`);

      return {
        success: true,
        refundId: data.refund_id ?? data.id ?? undefined,
        status: data.status ?? 'refunded',
        _raw: data,
      };
    } catch (error: any) {
      this.logger.error(
        `CamerPay refundPayment error | uuid: ${uuid} | status: ${error.response?.status} | ` +
          `data: ${JSON.stringify(error.response?.data)} | message: ${error.message}`,
      );
      throw new BadRequestException(
        error.response?.data?.message ||
          error.response?.data?.detail ||
          error.message ||
          'Failed to initiate refund with CamerPay',
      );
    }
  }
}