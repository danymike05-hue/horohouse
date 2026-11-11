import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
// Install once in the backend: npm i qrcode && npm i -D @types/qrcode
import * as QRCode from 'qrcode';
import { Property, PropertyDocument, ApprovalStatus, ListingType } from '../properties/schemas/property.schema';
import { User, UserDocument, UserRole } from '../users/schemas/user.schema';

type Lang = 'en' | 'fr';

export interface ShareInfo {
  kind: 'property' | 'host';
  id: string;
  title: string;
  subtitle: string;
  imageUrl: string | null;
  /** Link to share in messages */
  link: string;
  /** Same link with ?ref=qr, encoded in the QR code (so scans can be told apart later) */
  qrLink: string;
  /** PNG as a data URL, ready for <Image source={{ uri }}> */
  qrDataUrl: string;
  /** Printable poster (opens in the phone's browser) */
  posterUrl: string;
  /** false → guests can't open the link yet (listing waiting for approval or paused) */
  isLive: boolean;
}

const HOST_ROLES = [UserRole.HOST, UserRole.AGENT, UserRole.LANDLORD] as string[];

const TEXT: Record<Lang, Record<string, string>> = {
  en: {
    scan_listing: 'Scan to see availability and book',
    scan_host: 'Scan to see all my places',
    or_visit: 'Or visit',
    per_night: 'night',
    per_month: 'month',
    from: 'From',
    print: 'Print',
    host_on: 'Host on HoroHouse',
    pay: 'Pay safely with Mobile Money in the app',
  },
  fr: {
    scan_listing: 'Scannez pour voir les disponibilités et réserver',
    scan_host: 'Scannez pour voir tous mes logements',
    or_visit: 'Ou rendez-vous sur',
    per_night: 'nuit',
    per_month: 'mois',
    from: 'À partir de',
    print: 'Imprimer',
    host_on: 'Hôte sur HoroHouse',
    pay: 'Payez en toute sécurité par Mobile Money dans l’application',
  },
};

const esc = (v: unknown) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

const titleCase = (s: string) =>
  s.split(' ').map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w)).join(' ');

@Injectable()
export class ShareService {
  constructor(
    @InjectModel(Property.name) private readonly propertyModel: Model<PropertyDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  /** Public website that opens the app (or the web version) for a listing or host */
  private webBase(): string {
    return (process.env.PUBLIC_WEB_URL || 'https://horohouse.com').replace(/\/+$/, '');
  }

  private apiBase(): string {
    return (process.env.API_URL || process.env.BACKEND_URL || 'https://horohouse.com/api').replace(/\/+$/, '');
  }

  private async qr(text: string): Promise<string> {
    return QRCode.toDataURL(text, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 720,
      color: { dark: '#222222', light: '#FFFFFF' },
    });
  }

  private async qrSvg(text: string): Promise<string> {
    return QRCode.toString(text, { type: 'svg', errorCorrectionLevel: 'M', margin: 1, color: { dark: '#222222', light: '#FFFFFF' } });
  }

  private async loadProperty(id: string) {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException('Listing not found');
    const p: any = await this.propertyModel
      .findById(id)
      .select('title city neighborhood images price listingType approvalStatus isActive')
      .lean()
      .exec();
    if (!p) throw new NotFoundException('Listing not found');
    return p;
  }

  private async loadHost(id: string) {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException('Host not found');
    const u: any = await this.userModel
      .findById(id)
      .select('name profilePicture role hostProfile.operatingCity isActive')
      .lean()
      .exec();
    if (!u || u.isActive === false || (!HOST_ROLES.includes(u.role) && !u.hostProfile)) {
      throw new NotFoundException('Host not found');
    }
    return u;
  }

  async getPropertyShare(id: string, lang: Lang = 'en'): Promise<ShareInfo> {
    const p = await this.loadProperty(id);
    const link = `${this.webBase()}/property/${id}`;
    const qrLink = `${link}?ref=qr`;
    return {
      kind: 'property',
      id,
      title: p.title,
      subtitle: titleCase([p.neighborhood, p.city].filter(Boolean).join(', ')),
      imageUrl: p.images?.[0]?.url ?? null,
      link,
      qrLink,
      qrDataUrl: await this.qr(qrLink),
      posterUrl: `${this.apiBase()}/share/property/${id}/poster?lang=${lang}`,
      isLive: p.approvalStatus === ApprovalStatus.APPROVED && p.isActive !== false,
    };
  }

  async getHostShare(id: string, lang: Lang = 'en'): Promise<ShareInfo> {
    const u = await this.loadHost(id);
    const link = `${this.webBase()}/host/${id}`;
    const qrLink = `${link}?ref=qr`;
    return {
      kind: 'host',
      id,
      title: u.name || 'HoroHouse host',
      subtitle: u.hostProfile?.operatingCity ? titleCase(u.hostProfile.operatingCity) : TEXT[lang].host_on,
      imageUrl: u.profilePicture ?? null,
      link,
      qrLink,
      qrDataUrl: await this.qr(qrLink),
      posterUrl: `${this.apiBase()}/share/host/${id}/poster?lang=${lang}`,
      isLive: true,
    };
  }

  async propertyPoster(id: string, lang: Lang = 'en'): Promise<string> {
    const p = await this.loadProperty(id);
    const T = TEXT[lang];
    const link = `${this.webBase()}/property/${id}`;
    const unit = p.listingType === ListingType.SHORT_TERM ? T.per_night : p.listingType === ListingType.RENT ? T.per_month : '';
    const price = Number(p.price) > 0
      ? `${T.from} ${Math.round(Number(p.price)).toLocaleString('fr-FR')} FCFA${unit ? ` / ${unit}` : ''}`
      : '';
    return this.poster({
      lang,
      title: p.title,
      subtitle: titleCase([p.neighborhood, p.city].filter(Boolean).join(', ')),
      imageUrl: p.images?.[0]?.url ?? null,
      roundImage: false,
      price,
      scanText: T.scan_listing,
      link,
      svg: await this.qrSvg(`${link}?ref=qr`),
    });
  }

  async hostPoster(id: string, lang: Lang = 'en'): Promise<string> {
    const u = await this.loadHost(id);
    const T = TEXT[lang];
    const link = `${this.webBase()}/host/${id}`;
    return this.poster({
      lang,
      title: u.name || 'HoroHouse',
      subtitle: u.hostProfile?.operatingCity ? titleCase(u.hostProfile.operatingCity) : T.host_on,
      imageUrl: u.profilePicture ?? null,
      roundImage: true,
      price: '',
      scanText: T.scan_host,
      link,
      svg: await this.qrSvg(`${link}?ref=qr`),
    });
  }

  /** One printable A4 / phone-friendly page. Everything inline; only the photo is remote. */
  private poster(o: {
    lang: Lang; title: string; subtitle: string; imageUrl: string | null; roundImage: boolean;
    price: string; scanText: string; link: string; svg: string;
  }): string {
    const T = TEXT[o.lang];
    const shortLink = o.link.replace(/^https?:\/\//, '');
    const img = o.imageUrl && /^https:\/\//.test(o.imageUrl)
      ? `<img class="photo${o.roundImage ? ' round' : ''}" src="${esc(o.imageUrl)}" alt="">`
      : '';
    return `<!doctype html>
<html lang="${o.lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(o.title)} · HoroHouse</title>
<style>
  :root { --ink:#222; --muted:#6a6a6a; --brand:#1779f8; --line:#e6e6e6; }
  * { box-sizing:border-box; }
  body { margin:0; background:#f4f4f4; color:var(--ink); font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif; }
  .sheet { max-width:620px; width:calc(100% - 32px); margin:24px auto; background:#fff; border-radius:24px; padding:40px 36px; text-align:center; box-shadow:0 8px 30px rgba(0,0,0,.08); }
  .brand { font-weight:800; font-size:22px; letter-spacing:-.3px; color:var(--brand); margin-bottom:24px; }
  .photo { width:100%; max-height:260px; object-fit:cover; border-radius:16px; margin-bottom:22px; }
  .photo.round { width:120px; height:120px; border-radius:60px; }
  h1 { font-size:28px; line-height:1.2; margin:0 0 6px; letter-spacing:-.4px; }
  .sub { color:var(--muted); font-size:16px; margin:0 0 4px; }
  .price { font-weight:700; font-size:18px; margin:10px 0 0; }
  .qr { width:300px; max-width:80%; margin:28px auto 10px; padding:14px; border:1px solid var(--line); border-radius:20px; }
  .qr svg { width:100%; height:auto; display:block; }
  .scan { font-weight:700; font-size:18px; margin:6px 0 4px; }
  .link { color:var(--muted); font-size:14px; word-break:break-all; }
  .pay { margin-top:22px; padding-top:18px; border-top:1px solid var(--line); color:var(--muted); font-size:13px; }
  .print { display:inline-block; margin:0 auto 32px; padding:14px 28px; border:0; border-radius:12px; background:var(--ink); color:#fff; font-weight:700; font-size:16px; }
  .actions { text-align:center; }
  @media print {
    body { background:#fff; }
    .sheet { box-shadow:none; margin:0 auto; border-radius:0; }
    .actions { display:none; }
  }
</style>
</head>
<body>
  <div class="sheet">
    <div class="brand">HoroHouse</div>
    ${img}
    <h1>${esc(o.title)}</h1>
    ${o.subtitle ? `<p class="sub">${esc(o.subtitle)}</p>` : ''}
    ${o.price ? `<p class="price">${esc(o.price)}</p>` : ''}
    <div class="qr">${o.svg}</div>
    <p class="scan">${esc(o.scanText)}</p>
    <p class="link">${esc(T.or_visit)} ${esc(shortLink)}</p>
    <p class="pay">${esc(T.pay)}</p>
  </div>
  <div class="actions"><button class="print" onclick="window.print()">${esc(T.print)}</button></div>
</body>
</html>`;
  }
}
