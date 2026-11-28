// Trust & safety: spots a chat message that moves a guest and host off HoroHouse before a
// booking is paid (phone numbers, email, WhatsApp, "pay me by MoMo"). Paying outside the app
// is where most rental scams happen: no refund, no help if the home isn't real.
// The message is still sent; both people see a safety banner, and repeat senders are shown
// to the team.

export type OffPlatformReason = 'phone' | 'email' | 'whatsapp' | 'pay_outside';

const EMAIL = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;
const WHATSAPP = /\b(whats?\s?app|watsap+|whatsap+|wa\.me|wsp)\b/i;
const PAY_OUTSIDE = new RegExp(
  [
    '\\bmomo\\b',
    'mobile\\s?money',
    'orange\\s?money',
    'mtn\\s?money',
    'airtel\\s?money',
    'western\\s?union',
    'money\\s?gram',
    'pay\\s+(me\\s+)?(directly|outside|off\\s+the\\s+app|by\\s+transfer)',
    'outside\\s+(the\\s+)?(app|horohouse)',
    'pa(y|i)(e|er|ez)?[\\s-]+(moi\\s+)?(directement|en\\s+direct|hors)',
    'paiement\\s+direct',
    'hors\\s+(de\\s+)?(l[\'’]\\s?app(lication)?|horohouse)',
    'en\\s+dehors\\s+(de\\s+)?(l[\'’]\\s?app(lication)?|horohouse)',
  ].join('|'),
  'i',
);

/**
 * A Cameroon number (9 digits starting with 6 or 2, with or without +237 / 00237) or any
 * international number starting with "+", allowing spaces, dots and dashes (+237 6 99 12 34 56).
 * Prices ("650 000 000 FCFA") are left alone.
 */
function hasPhoneNumber(text: string): boolean {
  const re = /\+?\d[\d\s.\-()]{7,}\d/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const run = m[0];
    const after = text.slice(m.index + run.length).trimStart().toLowerCase();
    if (/^(f\b|fcfa|cfa|xaf|frs?\b|francs?)/.test(after)) continue;
    let d = run.replace(/\D/g, '');
    if (d.startsWith('00')) d = d.slice(2);
    if (d.length === 12 && d.startsWith('237')) d = d.slice(3);
    if (d.length === 9 && /^[62]/.test(d)) return true;
    if (run.startsWith('+') && d.length >= 10 && d.length <= 15) return true;
  }
  return false;
}

/** Why this message looks like it takes the conversation or the payment outside HoroHouse */
export function offPlatformReason(text?: string | null): OffPlatformReason | null {
  if (!text) return null;
  const t = String(text);
  if (PAY_OUTSIDE.test(t)) return 'pay_outside';
  if (WHATSAPP.test(t)) return 'whatsapp';
  if (EMAIL.test(t)) return 'email';
  if (hasPhoneNumber(t)) return 'phone';
  return null;
}

/** This many flagged messages from one person in 30 days alerts the team */
export const OFF_PLATFORM_ALERT_AT = 3;
