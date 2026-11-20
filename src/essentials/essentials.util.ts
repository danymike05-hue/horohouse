import { createHmac } from 'crypto';
import type { Lang2 } from './schemas/essentials.schema';

/** "Yaoundé " → "yaounde": cities are matched without accents or case */
export function cityKey(s: string | undefined | null): string {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase();
}

export function slugify(s: string): string {
  return cityKey(s).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'shop';
}

export const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * The 4-digit delivery code for one order part. Derived from a server secret, so it is
 * never stored: the student's screen shows it, the shop types it, the server recomputes it.
 */
export function deliveryCode(secret: string, partId: string): string {
  const h = createHmac('sha256', secret).update(`ess-delivery:${partId}`).digest('hex');
  return String(parseInt(h.slice(0, 8), 16) % 10000).padStart(4, '0');
}

export const both = (s: string): Lang2 => ({ en: s, fr: s });

/** Order number shown to people: "HK-7Q4M2X" */
export function orderNumber(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 6; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return `HK-${out}`;
}

export function inviteCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 8; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

export const round = (n: number) => Math.round(n);
