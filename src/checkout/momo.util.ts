import type { MomoOperator } from './schemas/checkout-payment.schema';

/**
 * "+237 6 99 12 34 56" / "237699123456" / "0699123456" / "699123456" → "699123456".
 * Returns null if it isn't a 9-digit Cameroonian mobile number starting with 6.
 */
export function normalizeCmPhone(input: string | undefined | null): string | null {
  if (!input) return null;
  let d = input.replace(/\D/g, '');
  if (d.startsWith('237') && d.length === 12) d = d.slice(3);
  if (d.startsWith('0') && d.length === 10) d = d.slice(1);
  return /^6\d{8}$/.test(d) ? d : null;
}

/**
 * Operator from prefix — only for ranges we're sure of. Returns null when unsure
 * (e.g. 68x, ported numbers): the customer's explicit choice then wins.
 * Keep this identical to mobile/utils/momo.ts.
 */
export function detectOperator(local: string): MomoOperator | null {
  if (local.length < 3) return null;
  const p2 = local.slice(0, 2);
  const p3 = Number(local.slice(0, 3));
  if (p2 === '67' || (p3 >= 650 && p3 <= 654)) return 'mtn_momo';
  if (p2 === '69' || (p3 >= 655 && p3 <= 659)) return 'orange_money';
  return null;
}

export const toInternational = (local: string) => `+237${local}`;
