import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model, Types } from 'mongoose';
import { normalizeCmPhone } from '../checkout/momo.util';
import { ApplyShopDto, ItemOfferDto, KitOfferDto, PartActionDto, ShopFieldsDto, UpdateShopDto } from './dto/essentials.dto';
import { EssentialsService } from './essentials.service';
import { cityKey, slugify } from './essentials.util';
import { EssPayout, EssPayoutDocument } from './schemas/essentials.schema';

/** How long after delivery a shop still sees the customer's address and phone */
const CONTACT_AFTER_MS = 7 * 86_400_000;
const MAX_CODE_TRIES = 5;

/** Partner shops: apply, list kits and items, handle orders, see payouts */
@Injectable()
export class PartnerService {
  constructor(
    private readonly ess: EssentialsService,
    @InjectModel(EssPayout.name) private readonly payouts: Model<EssPayoutDocument>,
  ) {}

  private async myShop(userId: string) {
    return this.ess.shops.findOne({ ownerId: new Types.ObjectId(userId) }).sort({ createdAt: 1 });
  }

  private async approvedShop(userId: string) {
    const shop = await this.myShop(userId);
    if (!shop) throw new NotFoundException({ code: 'NO_SHOP', message: 'You don’t have a partner shop yet.' });
    if (shop.status !== 'approved') throw new ForbiddenException({ code: 'SHOP_NOT_APPROVED', message: 'Your shop is not approved yet.' });
    return shop;
  }

  /** Everything the shop owner sees about their own shop (documents included) */
  private ownView(s: any) {
    if (!s) return null;
    return {
      _id: String(s._id),
      name: s.name,
      slug: s.slug,
      country: s.country,
      city: s.city,
      address: s.address,
      location: s.location,
      phone: s.phone,
      whatsapp: s.whatsapp,
      about: s.about,
      logo: s.logo,
      photos: s.photos ?? [],
      documents: s.documents ?? [],
      payoutMethod: s.payoutMethod,
      zones: (s.zones ?? []).map((z: any) => ({ city: z.city, district: z.district, fee: z.fee, minutes: z.minutes })),
      minOrder: s.minOrder ?? 0,
      openingHours: s.openingHours,
      status: s.status,
      statusReason: s.statusReason,
      paused: !!s.paused,
      rating: Math.round((s.rating ?? 0) * 10) / 10,
      ratingCount: s.ratingCount ?? 0,
      deliveredCount: s.deliveredCount ?? 0,
      submittedAt: s.submittedAt,
      approvedAt: s.approvedAt,
    };
  }

  async getShop(userId: string) {
    return { shop: this.ownView(await this.myShop(userId)) };
  }

  private fields(dto: ShopFieldsDto): Record<string, any> {
    const out: Record<string, any> = {};
    for (const k of ['name', 'city', 'address', 'location', 'about', 'logo', 'photos', 'documents', 'minOrder', 'openingHours'] as const) {
      if ((dto as any)[k] !== undefined) out[k] = typeof (dto as any)[k] === 'string' ? (dto as any)[k].trim() : (dto as any)[k];
    }
    if (dto.phone !== undefined) out.phone = dto.phone.replace(/\s/g, '');
    if (dto.whatsapp !== undefined) out.whatsapp = dto.whatsapp.replace(/\s/g, '') || undefined;
    if (dto.zones) out.zones = dto.zones.map((z) => ({ city: z.city.trim(), cityKey: cityKey(z.city), district: z.district?.trim() || undefined, fee: z.fee, minutes: z.minutes }));
    if (dto.payoutMethod) {
      const local = normalizeCmPhone(dto.payoutMethod.number);
      if (!local) throw new BadRequestException({ code: 'BAD_PAYOUT_NUMBER', message: 'Enter a Cameroon Mobile Money number for payouts.' });
      out.payoutMethod = { provider: dto.payoutMethod.provider, number: local, name: dto.payoutMethod.name.trim() };
    }
    return out;
  }

  private async uniqueSlug(name: string, selfId?: string) {
    const base = slugify(name);
    for (let i = 0; i < 50; i++) {
      const slug = i ? `${base}-${i + 1}` : base;
      const taken: any = await this.ess.shops.findOne({ slug }).select('_id').lean();
      if (!taken || String(taken._id) === selfId) return slug;
    }
    return `${base}-${Date.now().toString(36)}`;
  }

  /** Apply (or keep editing the application). With an invite code, claims that shop */
  async apply(userId: string, dto: ApplyShopDto) {
    let shop = await this.myShop(userId);
    if (!shop && dto.inviteCode) {
      shop = await this.ess.shops.findOne({ inviteCode: dto.inviteCode.trim().toUpperCase(), status: 'invited', ownerId: { $exists: false } });
      if (!shop) throw new NotFoundException({ code: 'BAD_INVITE', message: 'This invite code doesn’t work. Check it with HoroHouse.' });
      shop.ownerId = new Types.ObjectId(userId);
      shop.inviteCode = undefined;
      shop.status = 'pending';
    }
    if (shop && (shop.status === 'approved' || shop.status === 'suspended')) {
      throw new ConflictException({ code: 'ALREADY_PARTNER', message: 'Your shop is already set up. Edit it from your shop screen.' });
    }
    const f = this.fields(dto);
    if (!shop) {
      if (!f.name || !f.city) throw new BadRequestException({ code: 'NAME_CITY', message: 'Add your shop’s name and city.' });
      shop = new this.ess.shops({ ownerId: new Types.ObjectId(userId), country: 'CM', status: 'pending', slug: await this.uniqueSlug(f.name), ...f });
    } else {
      if (f.name && f.name !== shop.name) f.slug = await this.uniqueSlug(f.name, String(shop._id));
      shop.set(f);
      if (shop.status === 'rejected' && dto.submit) shop.status = 'pending';
    }
    if (dto.submit) {
      const missing: string[] = [];
      if (!shop.name) missing.push('name');
      if (!shop.city) missing.push('city');
      if (!shop.address) missing.push('address');
      if (!shop.phone) missing.push('phone');
      if (!shop.zones?.length) missing.push('zones');
      if (!shop.payoutMethod?.number) missing.push('payout');
      if (!shop.photos?.length) missing.push('photo');
      if (!shop.documents?.some((d) => d.kind === 'id')) missing.push('id');
      if (missing.length) throw new UnprocessableEntityException({ code: 'APPLICATION_INCOMPLETE', message: 'Some details are missing.', missing });
      const first = !shop.submittedAt;
      shop.submittedAt = new Date();
      shop.statusReason = undefined;
      await shop.save();
      if (first || shop.status === 'pending') {
        await this.ess.notifications.notifyAdmins({
          title: 'New partner shop application',
          message: `${shop.name} (${shop.city}) applied to sell essential kits. Review it in Admin → Essentials.`,
          link: '/admin/essentials',
          metadata: { shopId: String(shop._id) },
        });
      }
    } else {
      await shop.save();
    }
    return { shop: this.ownView(shop) };
  }

  async updateShop(userId: string, dto: UpdateShopDto) {
    const shop = await this.myShop(userId);
    if (!shop) throw new NotFoundException({ code: 'NO_SHOP', message: 'You don’t have a partner shop yet.' });
    const f = this.fields(dto);
    if (f.name && f.name !== shop.name) f.slug = await this.uniqueSlug(f.name, String(shop._id));
    if (dto.paused !== undefined) f.paused = dto.paused;
    shop.set(f);
    await shop.save();
    return { shop: this.ownView(shop) };
  }

  // ── Kits ──────────────────────────────────────────────────────────────────

  async templates(userId: string) {
    const shop = await this.approvedShop(userId);
    const [tpls, offers] = await Promise.all([
      this.ess.templates.find({ country: shop.country, isActive: true }).sort({ order: 1 }).lean(),
      this.ess.kitOffers.find({ shopId: shop._id }).lean(),
    ]);
    const types = await this.ess.itemTypes.find({ key: { $in: tpls.flatMap((t: any) => t.lines.map((l: any) => l.itemTypeKey)) } }).lean();
    const tByKey = new Map(types.map((t: any) => [t.key, t]));
    return tpls.map((t: any) => {
      const o: any = offers.find((x) => String(x.templateId) === String(t._id));
      return {
        _id: String(t._id),
        key: t.key,
        name: t.name,
        icon: t.icon,
        lines: t.lines.map((l: any) => ({ ...l, name: (tByKey.get(l.itemTypeKey) as any)?.name, icon: (tByKey.get(l.itemTypeKey) as any)?.icon })),
        options: t.options,
        offer: o
          ? { _id: String(o._id), price: o.price, optionPrices: o.optionPrices ?? {}, removeDiscounts: o.removeDiscounts ?? {}, photos: o.photos ?? [], available: o.available, prepHours: o.prepHours }
          : null,
      };
    });
  }

  async putKitOffer(userId: string, templateId: string, dto: KitOfferDto) {
    const shop = await this.approvedShop(userId);
    if (!isValidObjectId(templateId)) throw new NotFoundException('Kit not found');
    const t: any = await this.ess.templates.findOne({ _id: templateId, country: shop.country }).lean();
    if (!t) throw new NotFoundException('Kit not found');
    const clean = (o?: Record<string, number>) =>
      Object.fromEntries(Object.entries(o ?? {}).filter(([, v]) => Number.isFinite(Number(v)) && Number(v) >= 0).map(([k, v]) => [k, Math.round(Number(v))]));
    const removeDiscounts = clean(dto.removeDiscounts);
    const sumCuts = Object.values(removeDiscounts).reduce((n, v) => n + v, 0);
    if (sumCuts > dto.price) throw new BadRequestException({ code: 'CUTS_TOO_BIG', message: 'Price cuts for removed items can’t add up to more than the kit price.' });
    await this.ess.kitOffers.updateOne(
      { shopId: shop._id, templateId: t._id },
      {
        $set: {
          price: dto.price,
          optionPrices: clean(dto.optionPrices),
          removeDiscounts,
          ...(dto.photos ? { photos: dto.photos } : {}),
          available: dto.available ?? true,
          prepHours: dto.prepHours ?? 24,
        },
      },
      { upsert: true },
    );
    return this.templates(userId);
  }

  async removeKitOffer(userId: string, templateId: string) {
    const shop = await this.approvedShop(userId);
    if (isValidObjectId(templateId)) await this.ess.kitOffers.deleteOne({ shopId: shop._id, templateId: new Types.ObjectId(templateId) });
    return this.templates(userId);
  }

  // ── Items ─────────────────────────────────────────────────────────────────

  async itemTypes() {
    const types = await this.ess.itemTypes.find().sort({ category: 1, order: 1 }).lean();
    return types.map((t: any) => ({ key: t.key, name: t.name, category: t.category, icon: t.icon, size: t.size, electrical: t.electrical }));
  }

  async myItems(userId: string) {
    const shop = await this.approvedShop(userId);
    const items = await this.ess.itemOffers.find({ shopId: shop._id }).sort({ updatedAt: -1 }).lean();
    const types = await this.ess.itemTypes.find({ key: { $in: items.map((i) => i.itemTypeKey) } }).lean();
    const byKey = new Map(types.map((t: any) => [t.key, t]));
    return items.map((i: any) => ({ ...i, _id: String(i._id), shopId: undefined, type: byKey.get(i.itemTypeKey) ? { name: (byKey.get(i.itemTypeKey) as any).name, icon: (byKey.get(i.itemTypeKey) as any).icon } : null }));
  }

  async createItem(userId: string, dto: ItemOfferDto) {
    const shop = await this.approvedShop(userId);
    if (!dto.itemTypeKey || !dto.title?.trim() || dto.price == null) {
      throw new BadRequestException({ code: 'ITEM_FIELDS', message: 'Pick the kind of item, and add a title and a price.' });
    }
    if (!(await this.ess.itemTypes.exists({ key: dto.itemTypeKey }))) throw new BadRequestException({ code: 'BAD_TYPE', message: 'Unknown kind of item.' });
    const count = await this.ess.itemOffers.countDocuments({ shopId: shop._id });
    if (count >= 500) throw new UnprocessableEntityException({ code: 'TOO_MANY', message: 'You reached the 500 items limit.' });
    await this.ess.itemOffers.create({ ...this.itemFields(dto), shopId: shop._id });
    return this.myItems(userId);
  }

  private itemFields(dto: ItemOfferDto) {
    const out: Record<string, any> = {};
    for (const k of ['itemTypeKey', 'title', 'brand', 'description', 'price', 'options', 'photos', 'stock', 'warrantyDays', 'assembly', 'isActive'] as const) {
      const v = (dto as any)[k];
      if (v !== undefined) out[k] = typeof v === 'string' ? v.trim() : v;
    }
    return out;
  }

  async updateItem(userId: string, id: string, dto: ItemOfferDto) {
    const shop = await this.approvedShop(userId);
    if (!isValidObjectId(id)) throw new NotFoundException('Item not found');
    if (dto.itemTypeKey && !(await this.ess.itemTypes.exists({ key: dto.itemTypeKey }))) throw new BadRequestException({ code: 'BAD_TYPE', message: 'Unknown kind of item.' });
    const r = await this.ess.itemOffers.updateOne({ _id: id, shopId: shop._id }, { $set: this.itemFields(dto) });
    if (!r.matchedCount) throw new NotFoundException('Item not found');
    return this.myItems(userId);
  }

  async deleteItem(userId: string, id: string) {
    const shop = await this.approvedShop(userId);
    if (isValidObjectId(id)) await this.ess.itemOffers.deleteOne({ _id: id, shopId: shop._id });
    return this.myItems(userId);
  }

  // ── Orders ────────────────────────────────────────────────────────────────

  /** Only this shop's part of each order; contact details only while it is live */
  private partView(o: any, p: any) {
    const now = Date.now();
    const contact = ['accepted', 'packed', 'out'].includes(p.status) || (p.deliveredAt && now - new Date(p.deliveredAt).getTime() < CONTACT_AFTER_MS);
    return {
      orderId: String(o._id),
      partId: String(p._id),
      number: o.number,
      status: p.status,
      lines: p.lines,
      subtotal: p.subtotal,
      deliveryFee: p.deliveryFee,
      commission: p.commission,
      net: p.net,
      timeline: p.timeline,
      paidAt: o.payment?.paidAt,
      delivery: {
        city: o.delivery.city,
        district: o.delivery.district,
        date: o.delivery.date,
        slot: o.delivery.slot,
        ...(contact ? { address: o.delivery.address, note: o.delivery.note } : {}),
      },
      recipient: contact ? o.recipient : { name: String(o.recipient?.name ?? '').split(' ')[0] },
      cancelReason: p.cancelReason,
      dispute: p.dispute ? { reason: p.dispute.reason, text: p.dispute.text, photos: p.dispute.photos, status: p.dispute.status, decision: p.dispute.decision, note: p.dispute.note } : undefined,
      rating: p.rating,
      review: p.review,
      payout: { status: p.payout?.status, releaseAt: p.payout?.releaseAt },
      codeLocked: !!p.codeLocked,
    };
  }

  async orders(userId: string, tab: 'new' | 'active' | 'done' = 'new') {
    const shop = await this.approvedShop(userId).catch(async (e) => {
      // Suspended shops still finish their open orders
      const s = await this.myShop(userId);
      if (s?.status === 'suspended') return s;
      throw e;
    });
    const statuses = tab === 'new' ? ['placed'] : tab === 'active' ? ['accepted', 'packed', 'out'] : ['delivered', 'cancelled', 'disputed'];
    const list = await this.ess.orders
      .find({ status: { $in: ['paid', 'closed'] }, parts: { $elemMatch: { shopId: shop._id, status: { $in: statuses } } } })
      .sort(tab === 'done' ? { updatedAt: -1 } : { 'delivery.date': 1, createdAt: 1 })
      .limit(100)
      .lean();
    const counts = await this.ess.orders.aggregate([
      { $match: { status: 'paid', 'parts.shopId': shop._id } },
      { $unwind: '$parts' },
      { $match: { 'parts.shopId': shop._id } },
      { $group: { _id: '$parts.status', n: { $sum: 1 } } },
    ]);
    const c = Object.fromEntries(counts.map((x: any) => [x._id, x.n]));
    return {
      counts: { new: c.placed ?? 0, active: (c.accepted ?? 0) + (c.packed ?? 0) + (c.out ?? 0) },
      orders: list.flatMap((o: any) => o.parts.filter((p: any) => String(p.shopId) === String(shop._id) && statuses.includes(p.status)).map((p: any) => this.partView(o, p))),
    };
  }

  async act(userId: string, partId: string, action: 'accept' | 'decline' | 'packed' | 'out' | 'delivered', dto: PartActionDto) {
    const shop = await this.myShop(userId);
    if (!shop || !['approved', 'suspended'].includes(shop.status)) throw new ForbiddenException('Not your order');
    const { o, p } = await this.ess.orderWithPart(partId);
    if (String(p.shopId) !== String(shop._id)) throw new ForbiddenException('Not your order');
    if (action === 'accept') await this.ess.step(o, p, ['placed'], 'accepted');
    else if (action === 'packed') await this.ess.step(o, p, ['accepted'], 'packed');
    else if (action === 'out') await this.ess.step(o, p, ['accepted', 'packed'], 'out');
    else if (action === 'decline') {
      await this.ess.cancelPart(o, p, 'shop', dto.reason?.trim() || 'Declined by the shop', ['placed', 'accepted']);
    } else {
      if (p.codeLocked) throw new ForbiddenException({ code: 'CODE_LOCKED', message: 'Too many wrong codes. HoroHouse will contact you.' });
      if (!dto.code || !this.ess.checkCode(String(p._id), dto.code)) {
        const tries = (p.codeTries ?? 0) + 1;
        const locked = tries >= MAX_CODE_TRIES;
        await this.ess.orders.updateOne({ _id: o._id, 'parts._id': p._id }, { $set: { 'parts.$.codeTries': tries, ...(locked ? { 'parts.$.codeLocked': true } : {}) } });
        if (locked) {
          await this.ess.notifications.notifyAdmins({
            title: 'Delivery code locked',
            message: `${shop.name} typed ${MAX_CODE_TRIES} wrong codes for order ${o.number}. Check with the student and the shop.`,
            link: '/admin/essentials',
            metadata: { orderId: String(o._id), partId: String(p._id) },
          });
        }
        throw new BadRequestException({ code: 'WRONG_CODE', message: locked ? 'Too many wrong codes. HoroHouse will contact you.' : `Wrong code. ${MAX_CODE_TRIES - tries} tries left.` });
      }
      await this.ess.markDelivered(o, p, 'shop');
    }
    const fresh: any = await this.ess.orders.findById(o._id).lean();
    return this.partView(fresh, fresh.parts.find((x: any) => String(x._id) === String(p._id)));
  }

  // ── Money ─────────────────────────────────────────────────────────────────

  async money(userId: string) {
    const shop = await this.myShop(userId);
    if (!shop) throw new NotFoundException({ code: 'NO_SHOP', message: 'You don’t have a partner shop yet.' });
    const sums = await this.ess.orders.aggregate([
      { $match: { 'parts.shopId': shop._id } },
      { $unwind: '$parts' },
      { $match: { 'parts.shopId': shop._id, 'parts.payout.status': { $in: ['held', 'ready', 'paid'] } } },
      { $group: { _id: '$parts.payout.status', net: { $sum: '$parts.net' }, n: { $sum: 1 } } },
    ]);
    const s = Object.fromEntries(sums.map((x: any) => [x._id, { net: x.net, count: x.n }]));
    const payouts = await this.payouts.find({ shopId: shop._id }).sort({ sentAt: -1 }).limit(50).lean();
    return {
      held: s.held ?? { net: 0, count: 0 },
      ready: s.ready ?? { net: 0, count: 0 },
      paid: s.paid ?? { net: 0, count: 0 },
      payoutMethod: shop.payoutMethod,
      payouts: payouts.map((p: any) => ({ _id: String(p._id), gross: p.gross, commission: p.commission, net: p.net, reference: p.reference, sentAt: p.sentAt, orders: p.parts.length })),
    };
  }
}
