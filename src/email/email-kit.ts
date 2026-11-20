/**
 * The look of every HoroHouse email: a blue header with the white logo, one white card, and a
 * footer with help and settings links. Table-based with inline styles so it renders the same
 * in Gmail, Outlook and phone mail apps. Text from users (names, notes) must go through esc().
 */

export const BRAND_BLUE = '#155dfc';
export const TAGLINE = 'Votre toit, notre mission.';

export type Tone = 'blue' | 'green' | 'amber' | 'red' | 'gray';
const TONES: Record<Tone, { bg: string; fg: string }> = {
  blue: { bg: '#EAF1FF', fg: '#0B42C2' },
  green: { bg: '#E7F6EE', fg: '#0E7A4B' },
  amber: { bg: '#FFF4E0', fg: '#9A5B00' },
  red: { bg: '#FDECEA', fg: '#B42318' },
  gray: { bg: '#F1F3F5', fg: '#4A5565' },
};

const FONT = `-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif`;
const INK = '#101828';
const MUTED = '#5B6475';
const LINE = '#E7EAF0';

/** Escapes text that comes from people (names, notes, titles) */
export function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export interface Frame {
  brandName: string;
  logoUrl: string;
  /** Hidden first line most mail apps show next to the subject */
  preheader?: string;
  /** Why the person gets this email, under the card */
  reason?: string;
  links: { label: string; href: string }[];
}

export interface Parts {
  badge?: { text: string; tone: Tone };
  title: string;
  /** Already-safe HTML (use esc() for anything from people) */
  intro?: string;
  /** A listing or booking summary */
  card?: { heading?: string; sub?: string; image?: string; rows: [string, string][] };
  quote?: { label: string; text: string };
  money?: { rows: { label: string; value: string; strong?: boolean; tone?: Tone }[] };
  callout?: { tone: Tone; text: string };
  checklist?: { title: string; items: string[] };
  cta?: { href: string; label: string };
  secondary?: { href: string; label: string };
  outro?: string;
}

const p = (html: string, extra = '') =>
  `<p style="margin:0 0 14px;font-family:${FONT};font-size:15px;line-height:24px;color:${MUTED};${extra}">${html}</p>`;

function badge(b: NonNullable<Parts['badge']>): string {
  const c = TONES[b.tone];
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 14px;"><tr><td style="background:${c.bg};color:${c.fg};border-radius:999px;padding:6px 12px;font-family:${FONT};font-size:12px;font-weight:700;letter-spacing:.3px;">${b.text}</td></tr></table>`;
}

function card(c: NonNullable<Parts['card']>): string {
  const img = c.image
    ? `<tr><td style="padding:0;"><img src="${c.image}" width="520" alt="" style="display:block;width:100%;max-width:520px;height:auto;border-radius:12px 12px 0 0;border:0;" /></td></tr>`
    : '';
  const head = c.heading
    ? `<tr><td style="padding:16px 18px ${c.rows.length ? '4px' : '16px'};font-family:${FONT};">
         <div style="font-size:16px;font-weight:700;color:${INK};line-height:22px;">${c.heading}</div>
         ${c.sub ? `<div style="font-size:13px;color:${MUTED};margin-top:2px;">${c.sub}</div>` : ''}
       </td></tr>`
    : '';
  const rows = c.rows
    .map(
      ([k, v], i) => `<tr>
        <td style="padding:10px 18px;border-top:${i === 0 && !c.heading ? '0' : `1px solid ${LINE}`};font-family:${FONT};font-size:14px;color:${MUTED};width:42%;vertical-align:top;">${k}</td>
        <td style="padding:10px 18px;border-top:${i === 0 && !c.heading ? '0' : `1px solid ${LINE}`};font-family:${FONT};font-size:14px;color:${INK};font-weight:600;text-align:right;vertical-align:top;">${v}</td>
      </tr>`,
    )
    .join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 18px;border:1px solid ${LINE};border-radius:12px;border-collapse:separate;overflow:hidden;">${img}${head}${rows}</table>`;
}

function quote(q: NonNullable<Parts['quote']>): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px;"><tr>
    <td style="background:#F7F8FA;border-left:3px solid ${BRAND_BLUE};border-radius:0 10px 10px 0;padding:12px 16px;font-family:${FONT};">
      <div style="font-size:12px;font-weight:700;color:${MUTED};text-transform:uppercase;letter-spacing:.4px;margin-bottom:4px;">${q.label}</div>
      <div style="font-size:15px;line-height:22px;color:${INK};font-style:italic;">“${q.text}”</div>
    </td></tr></table>`;
}

function money(m: NonNullable<Parts['money']>): string {
  const rows = m.rows
    .map((r) => {
      const color = r.tone ? TONES[r.tone].fg : r.strong ? INK : MUTED;
      const size = r.strong ? '16px' : '14px';
      const weight = r.strong ? '800' : '500';
      const top = r.strong ? `border-top:1px solid ${LINE};padding-top:12px;` : '';
      return `<tr>
        <td style="padding:6px 0;${top}font-family:${FONT};font-size:${size};font-weight:${weight};color:${color};">${r.label}</td>
        <td style="padding:6px 0;${top}font-family:${FONT};font-size:${size};font-weight:${weight};color:${color};text-align:right;white-space:nowrap;">${r.value}</td>
      </tr>`;
    })
    .join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px;background:#F7F8FA;border-radius:12px;"><tr><td style="padding:12px 18px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table></td></tr></table>`;
}

function callout(c: NonNullable<Parts['callout']>): string {
  const t = TONES[c.tone];
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px;"><tr>
    <td style="background:${t.bg};border-radius:12px;padding:12px 16px;font-family:${FONT};font-size:14px;line-height:21px;color:${t.fg};">${c.text}</td>
  </tr></table>`;
}

function checklist(c: NonNullable<Parts['checklist']>): string {
  const items = c.items
    .map((i) => `<tr><td style="padding:4px 10px 4px 0;vertical-align:top;font-family:${FONT};font-size:14px;color:#0E7A4B;font-weight:700;">✓</td><td style="padding:4px 0;font-family:${FONT};font-size:14px;line-height:21px;color:${INK};">${i}</td></tr>`)
    .join('');
  return `<div style="font-family:${FONT};font-size:14px;font-weight:700;color:${INK};margin:4px 0 6px;">${c.title}</div>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 18px;">${items}</table>`;
}

export function button(href: string, label: string, color = BRAND_BLUE): string {
  // A bulletproof-ish button: the table cell carries the colour for Outlook
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:6px 0 10px;"><tr>
    <td style="background:${color};border-radius:999px;">
      <a href="${href}" style="display:inline-block;padding:14px 28px;font-family:${FONT};font-size:15px;font-weight:700;color:#FFFFFF;text-decoration:none;border-radius:999px;">${label}</a>
    </td></tr></table>`;
}

/** The inside of the card, from parts */
export function body(x: Parts): string {
  return [
    x.badge ? badge(x.badge) : '',
    `<h1 style="margin:0 0 12px;font-family:${FONT};font-size:24px;line-height:31px;font-weight:800;color:${INK};letter-spacing:-.3px;">${x.title}</h1>`,
    x.intro ? p(x.intro) : '',
    x.card ? card(x.card) : '',
    x.quote ? quote(x.quote) : '',
    x.money ? money(x.money) : '',
    x.callout ? callout(x.callout) : '',
    x.checklist ? checklist(x.checklist) : '',
    x.cta ? button(x.cta.href, x.cta.label) : '',
    x.secondary ? `<div style="margin:0 0 6px;"><a href="${x.secondary.href}" style="font-family:${FONT};font-size:14px;font-weight:600;color:${BRAND_BLUE};text-decoration:underline;">${x.secondary.label}</a></div>` : '',
    x.outro ? p(x.outro, 'margin-top:12px;') : '',
  ].join('');
}

/** The whole email around an already-built body */
export function frame(f: Frame, inner: string): string {
  const pre = f.preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:#F4F6FA;opacity:0;">${esc(f.preheader)}${'&nbsp;&zwnj;'.repeat(40)}</div>`
    : '';
  const links = f.links.map((l) => `<a href="${l.href}" style="color:${MUTED};text-decoration:underline;">${l.label}</a>`).join('&nbsp;&nbsp;·&nbsp;&nbsp;');
  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${esc(f.brandName)}</title></head>
<body style="margin:0;padding:0;background:#F4F6FA;">
${pre}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F6FA;">
  <tr><td align="center" style="padding:28px 14px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;">
      <tr><td style="background:${BRAND_BLUE};border-radius:18px 18px 0 0;padding:22px 28px;">
        <img src="${f.logoUrl}" width="150" alt="${esc(f.brandName)}" style="display:block;border:0;width:150px;height:auto;color:#FFFFFF;font-family:${FONT};font-size:22px;font-weight:800;" />
      </td></tr>
      <tr><td style="background:#FFFFFF;border-radius:0 0 18px 18px;padding:30px 28px 26px;">${inner}</td></tr>
      <tr><td style="padding:22px 12px 0;text-align:center;font-family:${FONT};font-size:12px;line-height:19px;color:${MUTED};">
        ${f.reason ? `${f.reason}<br/>` : ''}
        ${links ? `<div style="margin:8px 0;">${links}</div>` : ''}
        <div style="margin-top:8px;"><span style="color:${BRAND_BLUE};font-weight:700;">${esc(f.brandName)}</span> · ${TAGLINE}</div>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}
