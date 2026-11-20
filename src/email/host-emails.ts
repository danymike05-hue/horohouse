/**
 * Emails to hosts about their bookings. Each kind returns the subject, a plain-text version
 * and the parts of the card; EmailService wraps them in the shared frame.
 */
import { esc, Parts } from './email-kit';

type T = (en: string, fr: string) => string;

export type HostEmailKind = 'request' | 'booked' | 'cancelled' | 'arrival' | 'date_change' | 'issue' | 'payout';

export interface HostBooking {
  bookingId: string;
  propertyTitle: string;
  propertyCity?: string;
  propertyImage?: string;
  guestName: string;
  guestPhone?: string;
  checkIn: Date;
  checkOut: Date;
  nights: number;
  adults: number;
  children?: number;
  guestNote?: string;
  currency: string;
  /** What the guest pays */
  total?: number;
  /** What the host receives */
  earnings?: number;
  checkInTime?: string;
  /** Request: answer before this */
  respondBy?: Date;
  instant?: boolean;
}

export interface HostEmailData extends Partial<HostBooking> {
  // booked
  availableOn?: Date;
  // cancelled
  refundAmount?: number;
  // date change
  newCheckIn?: Date;
  newCheckOut?: Date;
  priceDifference?: number;
  // issue
  category?: string;
  description?: string;
  payoutFrozen?: boolean;
  // payout
  amount?: number;
}

export interface HostEmail {
  subject: string;
  preheader: string;
  text: string;
  parts: Parts;
}

export function hostEmail(kind: HostEmailKind, d: HostEmailData, ctx: { t: T; fr: boolean; name: string; links: { booking: string; bookings: string; earnings: string; calendar: string } }): HostEmail {
  const { t, fr } = ctx;
  const money = (n?: number) => `${Math.round(n ?? 0).toLocaleString(fr ? 'fr-FR' : 'en-US').replace(/ /g, ' ')} ${d.currency ?? 'XAF'}`;
  const day = (x?: Date) => (x ? new Date(x).toLocaleDateString(fr ? 'fr-FR' : 'en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Africa/Douala' }) : '—');
  const guest = esc(d.guestName || t('Your guest', 'Votre voyageur'));
  const listing = esc(d.propertyTitle || t('your listing', 'votre logement'));
  const hello = ctx.name ? t(`Hi ${esc(ctx.name)},`, `Bonjour ${esc(ctx.name)},`) : t('Hi,', 'Bonjour,');
  const people = () => {
    const a = d.adults ?? 1;
    const c = d.children ?? 0;
    const ad = t(`${a} adult${a > 1 ? 's' : ''}`, `${a} adulte${a > 1 ? 's' : ''}`);
    return c ? `${ad}, ${t(`${c} child${c > 1 ? 'ren' : ''}`, `${c} enfant${c > 1 ? 's' : ''}`)}` : ad;
  };
  const nights = (n?: number) => t(`${n ?? 0} night${n === 1 ? '' : 's'}`, `${n ?? 0} nuit${n === 1 ? '' : 's'}`);
  const stayRows = (): [string, string][] => [
    [t('Guest', 'Voyageur'), guest],
    [t('Check-in', 'Arrivée'), `${day(d.checkIn)}${d.checkInTime ? ` · ${esc(d.checkInTime)}` : ''}`],
    [t('Check-out', 'Départ'), day(d.checkOut)],
    [t('Length', 'Durée'), nights(d.nights)],
    [t('Guests', 'Voyageurs'), people()],
  ];
  const stayCard = (rows = stayRows()) => ({
    heading: listing,
    sub: d.propertyCity ? esc(d.propertyCity) : undefined,
    image: d.propertyImage,
    rows,
  });
  const note = d.guestNote?.trim() ? { label: t(`Message from ${guest}`, `Message de ${guest}`), text: esc(d.guestNote.trim()) } : undefined;

  switch (kind) {
    case 'request': {
      const by = d.respondBy ? day(d.respondBy) : '';
      return {
        subject: t(`New booking request from ${d.guestName} · ${d.propertyTitle}`, `Nouvelle demande de ${d.guestName} · ${d.propertyTitle}`),
        preheader: t(`${d.guestName} wants to stay ${nights(d.nights)}. Accept or decline${by ? ` before ${by}` : ''}.`, `${d.guestName} souhaite séjourner ${nights(d.nights)}. Acceptez ou refusez${by ? ` avant le ${by}` : ''}.`),
        text: t(
          `${d.guestName} requested to book ${d.propertyTitle} from ${day(d.checkIn)} to ${day(d.checkOut)}. Respond here: ${ctx.links.booking}`,
          `${d.guestName} souhaite réserver ${d.propertyTitle} du ${day(d.checkIn)} au ${day(d.checkOut)}. Répondez ici : ${ctx.links.booking}`,
        ),
        parts: {
          badge: { text: t('Action needed', 'Action requise'), tone: 'amber' },
          title: t('You have a new booking request', 'Vous avez une nouvelle demande de réservation'),
          intro: `${hello} ${t(`<strong>${guest}</strong> would like to stay at <strong>${listing}</strong>.`, `<strong>${guest}</strong> souhaite séjourner à <strong>${listing}</strong>.`)}`,
          card: stayCard(),
          quote: note,
          money: d.total
            ? { rows: [
                { label: t('Guest pays', 'Le voyageur paie'), value: money(d.total) },
                ...(d.earnings ? [{ label: t('You earn', 'Vous recevez'), value: money(d.earnings), strong: true, tone: 'green' as const }] : []),
              ] }
            : undefined,
          callout: { tone: 'amber', text: by
            ? t(`Please accept or decline before <strong>${by}</strong>. If you don't answer, the request expires and the guest books elsewhere.`, `Acceptez ou refusez avant le <strong>${by}</strong>. Sans réponse, la demande expire et le voyageur réserve ailleurs.`)
            : t('Please accept or decline soon. Quick answers help your listing rank higher.', 'Acceptez ou refusez rapidement. Des réponses rapides font remonter votre annonce.') },
          cta: { href: ctx.links.booking, label: t('Review the request', 'Voir la demande') },
          outro: t('Tip: hosts who answer within an hour get more bookings.', 'Astuce : les hôtes qui répondent dans l’heure reçoivent plus de réservations.'),
        },
      };
    }
    case 'booked': {
      const when = d.availableOn ? day(d.availableOn) : '';
      return {
        subject: t(`New booking confirmed · ${d.guestName} · ${day(d.checkIn)}`, `Nouvelle réservation confirmée · ${d.guestName} · ${day(d.checkIn)}`),
        preheader: t(`${d.guestName} paid for ${nights(d.nights)} at ${d.propertyTitle}.`, `${d.guestName} a payé ${nights(d.nights)} à ${d.propertyTitle}.`),
        text: t(
          `${d.guestName} booked ${d.propertyTitle} from ${day(d.checkIn)} to ${day(d.checkOut)} and paid. Details: ${ctx.links.booking}`,
          `${d.guestName} a réservé ${d.propertyTitle} du ${day(d.checkIn)} au ${day(d.checkOut)} et a payé. Détails : ${ctx.links.booking}`,
        ),
        parts: {
          badge: { text: t('Confirmed and paid', 'Confirmée et payée'), tone: 'green' },
          title: t(`You're booked! ${guest} is coming`, `Réservation confirmée ! ${guest} arrive bientôt`),
          intro: `${hello} ${t(`Good news: <strong>${guest}</strong> booked <strong>${listing}</strong> and the payment went through.`, `Bonne nouvelle : <strong>${guest}</strong> a réservé <strong>${listing}</strong> et le paiement est passé.`)}`,
          card: stayCard(),
          quote: note,
          money: { rows: [
            ...(d.total ? [{ label: t('Guest paid', 'Le voyageur a payé'), value: money(d.total) }] : []),
            { label: t('Your earnings', 'Vos revenus'), value: money(d.earnings ?? d.amount), strong: true, tone: 'green' as const },
          ] },
          callout: { tone: 'blue', text: when
            ? t(`Your earnings are held safely and can be withdrawn from <strong>${when}</strong>, about a day after check-in.`, `Vos revenus sont gardés en sécurité et pourront être retirés à partir du <strong>${when}</strong>, environ un jour après l’arrivée.`)
            : t('Your earnings are held safely and released about a day after check-in.', 'Vos revenus sont gardés en sécurité et versés environ un jour après l’arrivée.') },
          checklist: { title: t('Before they arrive', 'Avant leur arrivée'), items: [
            t('Send a short welcome message with directions', 'Envoyez un petit message de bienvenue avec l’itinéraire'),
            t('Check your check-in guide is up to date', 'Vérifiez que votre guide d’arrivée est à jour'),
            t('Prepare clean linen and towels', 'Préparez des draps et serviettes propres'),
          ] },
          cta: { href: ctx.links.booking, label: t('View the booking', 'Voir la réservation') },
          secondary: { href: ctx.links.calendar, label: t('Open my calendar', 'Ouvrir mon calendrier') },
        },
      };
    }
    case 'cancelled':
      return {
        subject: t(`Booking cancelled · ${d.guestName} · ${day(d.checkIn)}`, `Réservation annulée · ${d.guestName} · ${day(d.checkIn)}`),
        preheader: t(`${d.guestName} cancelled. Your calendar is open again for these dates.`, `${d.guestName} a annulé. Votre calendrier est de nouveau libre pour ces dates.`),
        text: t(`${d.guestName} cancelled their booking at ${d.propertyTitle} (${day(d.checkIn)} to ${day(d.checkOut)}).`, `${d.guestName} a annulé sa réservation à ${d.propertyTitle} (${day(d.checkIn)} au ${day(d.checkOut)}).`),
        parts: {
          badge: { text: t('Cancelled by the guest', 'Annulée par le voyageur'), tone: 'red' },
          title: t('A booking was cancelled', 'Une réservation a été annulée'),
          intro: `${hello} ${t(`<strong>${guest}</strong> cancelled their stay at <strong>${listing}</strong>.`, `<strong>${guest}</strong> a annulé son séjour à <strong>${listing}</strong>.`)}`,
          card: stayCard(stayRows().slice(0, 4)),
          money: d.refundAmount != null
            ? { rows: [{ label: t('Refunded to the guest', 'Remboursé au voyageur'), value: money(d.refundAmount) }] }
            : undefined,
          callout: { tone: 'blue', text: t('These dates are open again on your calendar, so other guests can book them. Any amount kept under your cancellation policy is paid to you as usual.', 'Ces dates sont de nouveau disponibles dans votre calendrier. Le montant conservé selon votre politique d’annulation vous est versé comme d’habitude.') },
          cta: { href: ctx.links.calendar, label: t('Open my calendar', 'Ouvrir mon calendrier') },
          secondary: { href: ctx.links.booking, label: t('See the booking', 'Voir la réservation') },
        },
      };
    case 'arrival':
      return {
        subject: t(`${d.guestName} arrives tomorrow · ${d.propertyTitle}`, `${d.guestName} arrive demain · ${d.propertyTitle}`),
        preheader: t(`Check-in ${day(d.checkIn)}${d.checkInTime ? ` at ${d.checkInTime}` : ''}. Here's what to get ready.`, `Arrivée le ${day(d.checkIn)}${d.checkInTime ? ` à ${d.checkInTime}` : ''}. Voici quoi préparer.`),
        text: t(`${d.guestName} checks in at ${d.propertyTitle} tomorrow.`, `${d.guestName} arrive demain à ${d.propertyTitle}.`),
        parts: {
          badge: { text: t('Arriving tomorrow', 'Arrivée demain'), tone: 'blue' },
          title: t(`Get ready for ${guest}`, `Préparez l’arrivée de ${guest}`),
          intro: `${hello} ${t(`<strong>${guest}</strong> checks in at <strong>${listing}</strong> tomorrow.`, `<strong>${guest}</strong> arrive demain à <strong>${listing}</strong>.`)}`,
          card: stayCard([...stayRows(), ...(d.guestPhone ? [[t('Phone', 'Téléphone'), esc(d.guestPhone)] as [string, string]] : [])]),
          checklist: { title: t('Quick checklist', 'Petite liste'), items: [
            t('Clean the place and air it out', 'Faites le ménage et aérez'),
            t('Fresh linen, towels, soap and toilet paper', 'Draps, serviettes, savon et papier toilette propres'),
            t('Check water, power and Wi-Fi', 'Vérifiez l’eau, l’électricité et le Wi-Fi'),
            t('Send the guest your arrival instructions', 'Envoyez vos instructions d’arrivée au voyageur'),
          ] },
          cta: { href: ctx.links.booking, label: t('View the booking', 'Voir la réservation') },
        },
      };
    case 'date_change':
      return {
        subject: t(`${d.guestName} asks to change dates · ${d.propertyTitle}`, `${d.guestName} demande à changer de dates · ${d.propertyTitle}`),
        preheader: t('Accept or decline within 48 hours. The booking stays as it is until you answer.', 'Acceptez ou refusez sous 48 heures. La réservation ne change pas sans votre réponse.'),
        text: t(`${d.guestName} would like to move their stay to ${day(d.newCheckIn)} – ${day(d.newCheckOut)}. Answer: ${ctx.links.booking}`, `${d.guestName} souhaite déplacer son séjour au ${day(d.newCheckIn)} – ${day(d.newCheckOut)}. Répondre : ${ctx.links.booking}`),
        parts: {
          badge: { text: t('Action needed', 'Action requise'), tone: 'amber' },
          title: t('A guest wants to change their dates', 'Un voyageur souhaite changer ses dates'),
          intro: `${hello} ${t(`<strong>${guest}</strong> asked to move their stay at <strong>${listing}</strong>.`, `<strong>${guest}</strong> souhaite déplacer son séjour à <strong>${listing}</strong>.`)}`,
          card: { heading: listing, rows: [
            [t('Current dates', 'Dates actuelles'), `${day(d.checkIn)} → ${day(d.checkOut)}`],
            [t('New dates', 'Nouvelles dates'), `<span style="color:#0B42C2;">${day(d.newCheckIn)} → ${day(d.newCheckOut)}</span>`],
          ] },
          money: d.priceDifference
            ? { rows: [{ label: d.priceDifference > 0 ? t('Guest pays extra', 'Le voyageur paie en plus') : t('Refunded to the guest', 'Remboursé au voyageur'), value: money(Math.abs(d.priceDifference)), strong: true }] }
            : undefined,
          callout: { tone: 'amber', text: t('Please answer within <strong>48 hours</strong>. Nothing changes until you accept.', 'Répondez sous <strong>48 heures</strong>. Rien ne change tant que vous n’acceptez pas.') },
          cta: { href: ctx.links.booking, label: t('Review the change', 'Voir la demande') },
        },
      };
    case 'issue':
      return {
        subject: t(`A guest reported a problem · ${d.propertyTitle}`, `Un voyageur a signalé un problème · ${d.propertyTitle}`),
        preheader: t('Add your side so we can resolve it quickly.', 'Donnez votre version pour que nous puissions régler cela vite.'),
        text: t(`${d.guestName} reported a problem with their stay at ${d.propertyTitle}. Add your side: ${ctx.links.booking}`, `${d.guestName} a signalé un problème avec son séjour à ${d.propertyTitle}. Donnez votre version : ${ctx.links.booking}`),
        parts: {
          badge: { text: t('Needs your answer', 'Votre réponse est attendue'), tone: 'red' },
          title: t('A guest reported a problem', 'Un voyageur a signalé un problème'),
          intro: `${hello} ${t(`<strong>${guest}</strong> reported a problem with their stay at <strong>${listing}</strong>.`, `<strong>${guest}</strong> a signalé un problème avec son séjour à <strong>${listing}</strong>.`)}`,
          card: { heading: listing, rows: [
            [t('Guest', 'Voyageur'), guest],
            [t('Stay', 'Séjour'), `${day(d.checkIn)} → ${day(d.checkOut)}`],
            ...(d.category ? [[t('Problem', 'Problème'), esc(d.category.replace(/_/g, ' '))] as [string, string]] : []),
          ] },
          quote: d.description?.trim() ? { label: t('What the guest said', 'Ce que dit le voyageur'), text: esc(d.description.trim()) } : undefined,
          callout: d.payoutFrozen
            ? { tone: 'amber', text: t('Your payout for this stay is on hold until our team reviews it. Adding your side with photos helps us decide fairly and quickly.', 'Votre versement pour ce séjour est bloqué le temps que notre équipe examine le cas. Votre version, avec des photos, nous aide à trancher vite et équitablement.') }
            : { tone: 'blue', text: t('Adding your side with photos helps us resolve this fairly.', 'Votre version, avec des photos, nous aide à régler cela équitablement.') },
          cta: { href: ctx.links.booking, label: t('Add my side', 'Donner ma version') },
        },
      };
    case 'payout':
      return {
        subject: t(`${money(d.amount)} is ready to withdraw`, `${money(d.amount)} disponibles au retrait`),
        preheader: t(`Earnings from ${d.guestName ? `${d.guestName}'s stay at ` : ''}${d.propertyTitle} are now in your wallet.`, `Les revenus du séjour ${d.guestName ? `de ${d.guestName} ` : ''}à ${d.propertyTitle} sont dans votre portefeuille.`),
        text: t(`${money(d.amount)} from your booking at ${d.propertyTitle} can now be withdrawn: ${ctx.links.earnings}`, `${money(d.amount)} de votre réservation à ${d.propertyTitle} peuvent être retirés : ${ctx.links.earnings}`),
        parts: {
          badge: { text: t('Earnings released', 'Revenus disponibles'), tone: 'green' },
          title: t('Your earnings are ready', 'Vos revenus sont disponibles'),
          intro: `${hello} ${t(`The money from <strong>${listing}</strong> is now in your HoroHouse wallet.`, `L’argent de <strong>${listing}</strong> est maintenant dans votre portefeuille HoroHouse.`)}`,
          card: { heading: listing, rows: [
            ...(d.guestName ? [[t('Guest', 'Voyageur'), guest] as [string, string]] : []),
            ...(d.checkIn ? [[t('Stay', 'Séjour'), `${day(d.checkIn)} → ${day(d.checkOut)}`] as [string, string]] : []),
          ] },
          money: { rows: [{ label: t('Available to withdraw', 'Disponible au retrait'), value: money(d.amount), strong: true, tone: 'green' }] },
          cta: { href: ctx.links.earnings, label: t('Withdraw to Mobile Money', 'Retirer sur Mobile Money') },
        },
      };
  }
}
