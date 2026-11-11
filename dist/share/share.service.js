"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ShareService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const QRCode = require("qrcode");
const property_schema_1 = require("../properties/schemas/property.schema");
const user_schema_1 = require("../users/schemas/user.schema");
const HOST_ROLES = [user_schema_1.UserRole.HOST, user_schema_1.UserRole.AGENT, user_schema_1.UserRole.LANDLORD];
const TEXT = {
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
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const titleCase = (s) => s.split(' ').map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w)).join(' ');
let ShareService = class ShareService {
    propertyModel;
    userModel;
    constructor(propertyModel, userModel) {
        this.propertyModel = propertyModel;
        this.userModel = userModel;
    }
    webBase() {
        return (process.env.PUBLIC_WEB_URL || 'https://horohouse.com').replace(/\/+$/, '');
    }
    apiBase() {
        return (process.env.API_URL || process.env.BACKEND_URL || 'https://horohouse.com/api').replace(/\/+$/, '');
    }
    async qr(text) {
        return QRCode.toDataURL(text, {
            errorCorrectionLevel: 'M',
            margin: 2,
            width: 720,
            color: { dark: '#222222', light: '#FFFFFF' },
        });
    }
    async qrSvg(text) {
        return QRCode.toString(text, { type: 'svg', errorCorrectionLevel: 'M', margin: 1, color: { dark: '#222222', light: '#FFFFFF' } });
    }
    async loadProperty(id) {
        if (!mongoose_2.Types.ObjectId.isValid(id))
            throw new common_1.NotFoundException('Listing not found');
        const p = await this.propertyModel
            .findById(id)
            .select('title city neighborhood images price listingType approvalStatus isActive')
            .lean()
            .exec();
        if (!p)
            throw new common_1.NotFoundException('Listing not found');
        return p;
    }
    async loadHost(id) {
        if (!mongoose_2.Types.ObjectId.isValid(id))
            throw new common_1.NotFoundException('Host not found');
        const u = await this.userModel
            .findById(id)
            .select('name profilePicture role hostProfile.operatingCity isActive')
            .lean()
            .exec();
        if (!u || u.isActive === false || (!HOST_ROLES.includes(u.role) && !u.hostProfile)) {
            throw new common_1.NotFoundException('Host not found');
        }
        return u;
    }
    async getPropertyShare(id, lang = 'en') {
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
            isLive: p.approvalStatus === property_schema_1.ApprovalStatus.APPROVED && p.isActive !== false,
        };
    }
    async getHostShare(id, lang = 'en') {
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
    async propertyPoster(id, lang = 'en') {
        const p = await this.loadProperty(id);
        const T = TEXT[lang];
        const link = `${this.webBase()}/property/${id}`;
        const unit = p.listingType === property_schema_1.ListingType.SHORT_TERM ? T.per_night : p.listingType === property_schema_1.ListingType.RENT ? T.per_month : '';
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
    async hostPoster(id, lang = 'en') {
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
    poster(o) {
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
};
exports.ShareService = ShareService;
exports.ShareService = ShareService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(property_schema_1.Property.name)),
    __param(1, (0, mongoose_1.InjectModel)(user_schema_1.User.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Model])
], ShareService);
//# sourceMappingURL=share.service.js.map