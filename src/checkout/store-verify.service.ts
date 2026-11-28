// Checks an in-app purchase directly with Apple or Google before anything is switched on.
// The phone only says "I bought X"; this asks the store whether that is true, for which
// product, for which HoroHouse account, and whether it was refunded.
//
// Settings (.env of the API) — see STORE-BILLING-SETUP.md:
//   Apple:  APPLE_IAP_ISSUER_ID, APPLE_IAP_KEY_ID, APPLE_IAP_PRIVATE_KEY (the .p8 text), APPLE_BUNDLE_ID
//   Google: GOOGLE_PLAY_SERVICE_ACCOUNT_JSON (the service account key, as one line), GOOGLE_PLAY_PACKAGE_NAME
import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

export type StorePlatform = 'ios' | 'android';

export interface VerifiedStorePurchase {
  platform: StorePlatform;
  /** Apple transaction id / Google order id: one purchase, used once */
  reference: string;
  productId: string;
  /** The HoroHouse account the purchase was made for (see accountTokenFor) */
  accountToken?: string;
  /** Apple: Production or Sandbox; Google: test purchases have no orderId prefix GPA */
  environment?: string;
  /** What the buyer paid, as the store reports it (Apple only) */
  price?: { amount: number; currency: string };
}

export class StorePurchaseRejected extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
  }
}

const b64url = (b: Buffer | string) => Buffer.from(b).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');

/**
 * The account a purchase is tied to, from the HoroHouse user id. Apple wants a UUID
 * (appAccountToken), Google any string up to 64 characters (obfuscatedAccountId); both
 * come back with the purchase, so a receipt can't be reused by another account.
 * The app computes the same value (app/utils/store-products.ts).
 */
export function accountTokenFor(userId: string): string {
  const h = crypto.createHash('sha256').update(`horohouse:${userId}`).digest('hex');
  // UUID shape, version 5 / RFC 4122 variant bits
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-${((parseInt(h[16], 16) & 0x3) | 0x8).toString(16)}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

@Injectable()
export class StoreVerifyService {
  private readonly logger = new Logger(StoreVerifyService.name);
  private googleToken: { value: string; until: number } | null = null;

  constructor(private readonly config: ConfigService) {}

  isConfigured(platform: StorePlatform): boolean {
    return platform === 'ios'
      ? !!(this.config.get('APPLE_IAP_ISSUER_ID') && this.config.get('APPLE_IAP_KEY_ID') && this.config.get('APPLE_IAP_PRIVATE_KEY'))
      : !!this.config.get('GOOGLE_PLAY_SERVICE_ACCOUNT_JSON');
  }

  async verify(platform: StorePlatform, productId: string, proof: string): Promise<VerifiedStorePurchase> {
    if (!this.isConfigured(platform)) {
      throw new ServiceUnavailableException({
        code: 'STORE_BILLING_NOT_SET_UP',
        message: platform === 'ios' ? 'Apple purchases aren’t set up on the server yet.' : 'Google Play purchases aren’t set up on the server yet.',
      });
    }
    return platform === 'ios' ? this.verifyApple(productId, proof) : this.verifyGoogle(productId, proof);
  }

  /** Google: a consumable can be bought again only once consumed (after it's switched on) */
  async consumeGoogle(productId: string, purchaseToken: string): Promise<void> {
    const pkg = this.googlePackage();
    const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(pkg)}/purchases/products/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(purchaseToken)}:consume`;
    const res = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${await this.googleAccessToken()}` } });
    if (!res.ok && res.status !== 400) {
      // 400 = already consumed; anything else is retried by the app's next launch
      this.logger.warn(`Google consume failed (${res.status}) for ${productId}`);
    }
  }

  // ── Apple: App Store Server API ────────────────────────────────────────────

  private appleJwt(): string {
    const now = Math.floor(Date.now() / 1000);
    const header = { alg: 'ES256', kid: this.config.get<string>('APPLE_IAP_KEY_ID'), typ: 'JWT' };
    const payload = {
      iss: this.config.get<string>('APPLE_IAP_ISSUER_ID'),
      iat: now,
      exp: now + 20 * 60,
      aud: 'appstoreconnect-v1',
      bid: this.appleBundle(),
    };
    const data = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
    const key = String(this.config.get<string>('APPLE_IAP_PRIVATE_KEY')).replace(/\\n/g, '\n');
    const sig = crypto.sign('sha256', Buffer.from(data), { key, dsaEncoding: 'ieee-p1363' });
    return `${data}.${b64url(sig)}`;
  }

  private appleBundle(): string {
    return this.config.get<string>('APPLE_BUNDLE_ID') || 'com.horohouse.app';
  }

  private async verifyApple(productId: string, transactionId: string): Promise<VerifiedStorePurchase> {
    if (!/^\d{1,30}$/.test(transactionId)) throw new StorePurchaseRejected('BAD_PROOF', 'Invalid Apple transaction id.');
    const jwt = this.appleJwt();
    // Production first; TestFlight and sandbox purchases are only known to the sandbox
    let body: any = null;
    for (const host of ['https://api.storekit.itunes.apple.com', 'https://api.storekit-sandbox.itunes.apple.com']) {
      const res = await fetch(`${host}/inApps/v1/transactions/${transactionId}`, { headers: { Authorization: `Bearer ${jwt}` } });
      if (res.status === 404) continue;
      if (!res.ok) throw new ServiceUnavailableException('Could not reach Apple to check the purchase. Try again.');
      body = await res.json();
      break;
    }
    if (!body?.signedTransactionInfo) throw new StorePurchaseRejected('NOT_FOUND', 'Apple doesn’t know this purchase.');
    // Signed by Apple and received from Apple over HTTPS: the payload is read as is
    const tx = JSON.parse(Buffer.from(String(body.signedTransactionInfo).split('.')[1], 'base64url').toString('utf8'));
    if (tx.bundleId !== this.appleBundle()) throw new StorePurchaseRejected('WRONG_APP', 'This purchase is for another app.');
    if (tx.productId !== productId) throw new StorePurchaseRejected('WRONG_PRODUCT', 'This purchase is for another product.');
    if (tx.revocationDate) throw new StorePurchaseRejected('REFUNDED', 'This purchase was refunded.');
    return {
      platform: 'ios',
      reference: `apple:${tx.transactionId}`,
      productId: tx.productId,
      accountToken: tx.appAccountToken ? String(tx.appAccountToken).toLowerCase() : undefined,
      environment: tx.environment,
      price: typeof tx.price === 'number' && tx.currency ? { amount: tx.price / 1000, currency: tx.currency } : undefined,
    };
  }

  // ── Google: Play Developer API ─────────────────────────────────────────────

  private googlePackage(): string {
    return this.config.get<string>('GOOGLE_PLAY_PACKAGE_NAME') || 'com.horohouse.app';
  }

  private async googleAccessToken(): Promise<string> {
    if (this.googleToken && this.googleToken.until > Date.now() + 60_000) return this.googleToken.value;
    let account: any;
    try {
      account = JSON.parse(String(this.config.get<string>('GOOGLE_PLAY_SERVICE_ACCOUNT_JSON')));
    } catch {
      throw new ServiceUnavailableException('GOOGLE_PLAY_SERVICE_ACCOUNT_JSON is not valid JSON');
    }
    const now = Math.floor(Date.now() / 1000);
    const tokenUri = account.token_uri || 'https://oauth2.googleapis.com/token';
    const claim = {
      iss: account.client_email,
      scope: 'https://www.googleapis.com/auth/androidpublisher',
      aud: tokenUri,
      iat: now,
      exp: now + 3600,
    };
    const data = `${b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${b64url(JSON.stringify(claim))}`;
    const sig = crypto.sign('sha256', Buffer.from(data), String(account.private_key).replace(/\\n/g, '\n'));
    const res = await fetch(tokenUri, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${data}.${b64url(sig)}` }).toString(),
    });
    if (!res.ok) throw new ServiceUnavailableException('Could not sign in to Google Play to check the purchase.');
    const json: any = await res.json();
    this.googleToken = { value: json.access_token, until: Date.now() + (Number(json.expires_in) || 3600) * 1000 };
    return this.googleToken.value;
  }

  private async verifyGoogle(productId: string, purchaseToken: string): Promise<VerifiedStorePurchase> {
    if (!purchaseToken || purchaseToken.length > 4096) throw new StorePurchaseRejected('BAD_PROOF', 'Invalid Google purchase token.');
    const pkg = this.googlePackage();
    const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(pkg)}/purchases/products/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(purchaseToken)}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${await this.googleAccessToken()}` } });
    if (res.status === 404 || res.status === 400) throw new StorePurchaseRejected('NOT_FOUND', 'Google doesn’t know this purchase.');
    if (!res.ok) throw new ServiceUnavailableException('Could not reach Google Play to check the purchase. Try again.');
    const p: any = await res.json();
    // 0 purchased, 1 cancelled, 2 pending (e.g. paid in cash at a shop, not yet received)
    if (p.purchaseState === 2) throw new StorePurchaseRejected('PENDING', 'The payment isn’t complete yet.');
    if (p.purchaseState !== 0) throw new StorePurchaseRejected('CANCELLED', 'This purchase was cancelled.');
    return {
      platform: 'android',
      reference: `google:${p.orderId || crypto.createHash('sha256').update(purchaseToken).digest('hex')}`,
      productId,
      accountToken: p.obfuscatedExternalAccountId ? String(p.obfuscatedExternalAccountId).toLowerCase() : undefined,
      environment: p.purchaseType === 0 ? 'Test' : 'Production',
    };
  }
}
