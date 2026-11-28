// The unsubscribe link in newsletter emails carries a token signed for that email address,
// so nobody can unsubscribe someone else by typing their address.
import * as crypto from 'crypto';

function secret(): string {
  return process.env.NEWSLETTER_SECRET || process.env.JWT_SECRET || '';
}

export function unsubscribeToken(email: string): string {
  return crypto
    .createHmac('sha256', secret())
    .update(`unsubscribe:${String(email).trim().toLowerCase()}`)
    .digest('hex');
}

export function isValidUnsubscribeToken(email: string, token: string): boolean {
  if (!secret() || typeof email !== 'string' || typeof token !== 'string')
    return false;
  const a = Buffer.from(unsubscribeToken(email));
  const b = Buffer.from(token);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
