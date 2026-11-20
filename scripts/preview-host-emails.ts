/**
 * Writes sample host emails (made-up booking) to one HTML file, to check the design:
 *   TS_NODE_TRANSPILE_ONLY=1 npx ts-node scripts/preview-host-emails.ts out.html
 */
import { writeFileSync } from 'fs';
import { body, frame } from '../src/email/email-kit';
import { hostEmail, HostEmailKind } from '../src/email/host-emails';

const out = process.argv[2] ?? 'host-emails-preview.html';
const site = 'https://horohouse.com';
const day = (n: number) => new Date(Date.now() + n * 86_400_000);
const sample = {
  bookingId: 'b123',
  propertyTitle: 'Bright studio near Ngoa-Ekellé',
  propertyCity: 'Yaoundé',
  guestName: 'Amina Nkemdirim',
  guestPhone: '+237 6 77 12 34 56',
  checkIn: day(1),
  checkOut: day(4),
  nights: 3,
  adults: 2,
  children: 1,
  guestNote: 'We arrive by bus around 3 pm. Is there parking nearby?',
  currency: 'XAF',
  total: 96000,
  earnings: 84000,
  checkInTime: '14:00',
  respondBy: day(2),
  availableOn: day(2),
  refundAmount: 48000,
  newCheckIn: day(8),
  newCheckOut: day(11),
  priceDifference: 6000,
  category: 'not_as_described',
  description: 'The water heater does not work and the Wi-Fi password is wrong.',
  payoutFrozen: true,
  amount: 84000,
};
const links = { booking: `${site}/en/dashboard/host/bookings/b123`, bookings: `${site}/en/dashboard/host/bookings`, earnings: `${site}/en/dashboard/earnings`, calendar: `${site}/en/dashboard/host/calendar` };
const kinds: HostEmailKind[] = ['request', 'booked', 'cancelled', 'arrival', 'date_change', 'issue', 'payout'];

const blocks: string[] = [];
for (const fr of [false, true]) {
  const t = (en: string, frText: string) => (fr ? frText : en);
  for (const k of fr ? (['booked'] as HostEmailKind[]) : kinds) {
    const m = hostEmail(k, sample, { t, fr, name: 'Paul', links });
    const html = frame({
      brandName: 'HoroHouse',
      logoUrl: `${site}/logoHoroHouseWhite.png`,
      preheader: m.preheader,
      reason: t('You get this email because you host on HoroHouse.', 'Vous recevez cet e-mail car vous êtes hôte sur HoroHouse.'),
      links: [{ label: t('Help centre', 'Centre d’aide'), href: '#' }, { label: t('My bookings', 'Mes réservations'), href: '#' }, { label: t('Contact us', 'Nous contacter'), href: '#' }],
    }, body(m.parts));
    blocks.push(`<section style="margin:0 0 40px;"><div style="font:600 13px Arial;color:#555;padding:8px 14px;">${fr ? 'FR' : 'EN'} · ${k} — Subject: ${m.subject}</div><iframe style="width:100%;height:1150px;border:1px solid #ddd;border-radius:8px;background:#fff" srcdoc="${html.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}"></iframe></section>`);
  }
}
writeFileSync(out, `<!doctype html><html><head><meta charset="utf-8"><title>Host emails preview</title></head><body style="margin:0;padding:20px;background:#e9ecf1;max-width:720px;margin:auto">${blocks.join('')}</body></html>`);
console.log(`Wrote ${out}`);
