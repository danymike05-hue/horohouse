import { Injectable, Logger, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import * as jwt from 'jsonwebtoken';

const APPLE = 'https://appleid.apple.com';
const KEYS_TTL_MS = 6 * 60 * 60 * 1000;
/** A key id we don't know may be a new Apple key: look again, but not for every bad token */
const KEYS_RETRY_MS = 60 * 1000;

export interface AppleIdentity {
  /** Apple's id for this person in our app (the same on every device) */
  appleId: string;
  /** Their email, or the private relay address when they hide it */
  email?: string;
  emailVerified: boolean;
}

/**
 * Checks what the iPhone sends after "Sign in with Apple".
 *
 * Optional settings (APPLE_TEAM_ID, APPLE_KEY_ID, APPLE_PRIVATE_KEY from a "Sign in with Apple"
 * key): only used to tell Apple when an account is deleted. Sign-in works without them.
 * APPLE_BUNDLE_ID defaults to the app's own id.
 */
@Injectable()
export class AppleAuth {
  private readonly logger = new Logger(AppleAuth.name);
  private keys: { at: number; list: any[] } = { at: 0, list: [] };

  constructor(private readonly config: ConfigService) {}

  private get bundleId() {
    return this.config.get<string>('APPLE_BUNDLE_ID') || 'com.horohouse.app';
  }

  private async fetchKeys(): Promise<any[]> {
    const res = await fetch(`${APPLE}/auth/keys`, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`Apple keys: ${res.status}`);
    return ((await res.json()) as any).keys ?? [];
  }

  private async publicKey(kid: string): Promise<crypto.KeyObject> {
    const find = () => this.keys.list.find((k) => k.kid === kid);
    const age = Date.now() - this.keys.at;
    if (age > KEYS_TTL_MS || (!find() && age > KEYS_RETRY_MS)) {
      try {
        this.keys = { at: Date.now(), list: await this.fetchKeys() };
      } catch (e: any) {
        this.logger.warn(`Could not load Apple's keys: ${e?.message}`);
        // Old keys are still good; with none at all, nobody can be checked
        if (!find()) throw new ServiceUnavailableException('Apple sign-in is not available right now');
      }
    }
    const jwk = find();
    if (!jwk) throw new UnauthorizedException('Apple sign-in could not be checked');
    return crypto.createPublicKey({ key: jwk, format: 'jwk' } as any);
  }

  /** `nonce` is the app's secret: Apple signed its SHA-256, so a token taken from elsewhere is useless */
  async verify(identityToken: string, nonce: string): Promise<AppleIdentity> {
    const kid = (jwt.decode(identityToken, { complete: true }) as any)?.header?.kid;
    if (!kid) throw new UnauthorizedException('Apple sign-in could not be checked');
    const key = await this.publicKey(kid);

    let claims: any;
    try {
      claims = jwt.verify(identityToken, key as any, { algorithms: ['RS256'], issuer: APPLE, audience: this.bundleId });
    } catch (e: any) {
      this.logger.warn(`Apple token refused: ${e?.message}`);
      throw new UnauthorizedException('Apple sign-in could not be checked');
    }
    const hashed = crypto.createHash('sha256').update(nonce).digest('hex');
    if (!claims.sub || claims.nonce !== hashed) {
      throw new UnauthorizedException('Apple sign-in could not be checked');
    }
    return {
      appleId: String(claims.sub),
      email: claims.email ? String(claims.email).trim().toLowerCase() : undefined,
      // Apple sends a boolean or the text "true"
      emailVerified: claims.email_verified === true || claims.email_verified === 'true',
    };
  }

  // ── Telling Apple when an account is deleted ──────────────────────────────

  private clientSecret(): string | null {
    const team = this.config.get<string>('APPLE_TEAM_ID');
    const kid = this.config.get<string>('APPLE_KEY_ID');
    const key = this.config.get<string>('APPLE_PRIVATE_KEY');
    if (!team || !kid || !key) return null;
    return jwt.sign({}, key.replace(/\\n/g, '\n'), {
      algorithm: 'ES256', keyid: kid, issuer: team, subject: this.bundleId, audience: APPLE, expiresIn: '5m',
    });
  }

  private async post(path: string, form: Record<string, string>): Promise<any> {
    const res = await fetch(`${APPLE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(form).toString(),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`Apple ${path}: ${res.status}`);
    return res.json().catch(() => ({}));
  }

  /** The token needed later to revoke. Null when not set up or refused: never blocks a sign-in. */
  async refreshTokenFor(authorizationCode?: string): Promise<string | null> {
    try {
      const secret = this.clientSecret();
      if (!secret || !authorizationCode) return null;
      const r = await this.post('/auth/token', {
        client_id: this.bundleId, client_secret: secret, code: authorizationCode, grant_type: 'authorization_code',
      });
      return r?.refresh_token ?? null;
    } catch (e: any) {
      this.logger.warn(`No Apple token kept: ${e?.message}`);
      return null;
    }
  }

  /** Removes HoroHouse from the person's Apple account. Best effort. */
  async revoke(refreshToken: string): Promise<boolean> {
    try {
      const secret = this.clientSecret();
      if (!secret) return false;
      await this.post('/auth/revoke', {
        client_id: this.bundleId, client_secret: secret, token: refreshToken, token_type_hint: 'refresh_token',
      });
      return true;
    } catch (e: any) {
      this.logger.warn(`Apple access not revoked: ${e?.message}`);
      return false;
    }
  }
}
