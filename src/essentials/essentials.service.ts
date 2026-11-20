import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ModuleRef } from '@nestjs/core';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model, Types } from 'mongoose';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/schemas/notification.schema';
import { CamerPayService } from '../payments/services/camerpay.service';
import { User, UserDocument } from '../users/schemas/user.schema';
import { DigitalLease, LeaseStatus } from '../digital-lease/schemas/digital-lease.schema';
import { Property } from '../properties/schemas/property.schema';
import { CreateOrderDto, DisputeDto, ItemsQueryDto, PutCartDto, RateDto } from './dto/essentials.dto';
import { both, cityKey, deliveryCode, escapeRegex, orderNumber, round } from './essentials.util';
import {
  CartLine,
  EssCart,
  EssCartDocument,
  EssInterest,
  EssInterestDocument,
  EssItemOffer,
  EssItemOfferDocument,
  EssItemType,
  EssItemTypeDocument,
  EssKitOffer,
  EssKitOfferDocument,
  EssKitTemplate,
  EssKitTemplateDocument,
  EssMarket,
  EssMarketDocument,
  EssOrder,
  EssOrderDocument,
  EssShop,
  EssShopDocument,
  Lang2,
  OrderLine,
  OrderPart,
  PartStatus,
} from './schemas/essentials.schema';
import { CM_ITEM_TYPES, CM_KITS, CM_MARKET } from './seed/catalogue';

const COUNTRY = 'CM';
const ORDER_TTL_MS = 30 * 60_000;
/** Parts still moving: the shop sees the address and phone */
const LIVE: PartStatus[] = ['accepted', 'packed', 'out'];

export type Problem = 'gone' | 'stock' | 'no_delivery' | 'min_order';

export interface PricedLine extends CartLine {
  index: number;
  shopId?: string;
  ok: boolean;
  problem?: Problem;
  line?: OrderLine;
  stock?: number;
}

/**
 * Students: catalogue, cart, orders. Also the shared order steps (delivered, cancel with
 * refund, notifications) that the shop and admin services call.
 */
@Injectable()
export class EssentialsService implements OnModuleInit {
  private readonly logger = new Logger(EssentialsService.name);
  private readonly codeSecret: string;

  constructor(
    @InjectModel(EssMarket.name) readonly markets: Model<EssMarketDocument>,
    @InjectModel(EssItemType.name) readonly itemTypes: Model<EssItemTypeDocument>,
    @InjectModel(EssKitTemplate.name) readonly templates: Model<EssKitTemplateDocument>,
    @InjectModel(EssShop.name) readonly shops: Model<EssShopDocument>,
    @InjectModel(EssKitOffer.name) readonly kitOffers: Model<EssKitOfferDocument>,
    @InjectModel(EssItemOffer.name) readonly itemOffers: Model<EssItemOfferDocument>,
    @InjectModel(EssCart.name) readonly carts: Model<EssCartDocument>,
    @InjectModel(EssOrder.name) readonly orders: Model<EssOrderDocument>,
    @InjectModel(EssInterest.name) readonly interest: Model<EssInterestDocument>,
    @InjectModel(User.name) readonly users: Model<UserDocument>,
    @InjectModel(DigitalLease.name) private readonly leases: Model<any>,
    @InjectModel(Property.name) private readonly properties: Model<any>,
    readonly notifications: NotificationsService,
    private readonly moduleRef: ModuleRef,
    config: ConfigService,
  ) {
    this.codeSecret = config.get<string>('ESSENTIALS_CODE_SECRET') || config.get<string>('JWT_SECRET') || 'horohouse-essentials';
  }

  // ════════════════════════════════════════════════════════════════════════
  // Starting catalogue (written once; admin edits are never overwritten)
  // ════════════════════════════════════════════════════════════════════════

  async onModuleInit(): Promise<void> {
    try {
      await this.markets.updateOne({ country: COUNTRY }, { $setOnInsert: CM_MARKET }, { upsert: true });
      await this.itemTypes.bulkWrite(
        CM_ITEM_TYPES.map((t) => ({ updateOne: { filter: { key: t.key }, update: { $setOnInsert: t }, upsert: true } })),
      );
      await this.templates.bulkWrite(
        CM_KITS.map((k) => ({
          updateOne: { filter: { country: COUNTRY, key: k.key }, update: { $setOnInsert: { ...k, country: COUNTRY, isActive: true } }, upsert: true },
        })),
      );
    } catch (err: any) {
      this.logger.error(`Essentials catalogue seed failed: ${err?.message ?? err}`);
    }
  }

  async market(country = COUNTRY): Promise<EssMarket> {
    const m = await this.markets.findOne({ country }).lean();
    return (m as any) ?? (CM_MARKET as any);
  }

  // ════════════════════════════════════════════════════════════════════════
  // Shared views
  // ════════════════════════════════════════════════════════════════════════

  zoneFor(shop: any, city: string) {
    const key = cityKey(city);
    const zones = (shop?.zones ?? []).filter((z: any) => (z.cityKey ?? cityKey(z.city)) === key);
    if (!zones.length) return null;
    // District zones come later; the cheapest city-wide zone is the fee for now
    return zones.reduce((a: any, b: any) => (b.fee < a.fee ? b : a));
  }

  shopCard(shop: any, city?: string) {
    const zone = city ? this.zoneFor(shop, city) : null;
    return {
      _id: String(shop._id),
      name: shop.name,
      slug: shop.slug,
      logo: shop.logo,
      photo: shop.photos?.[0],
      city: shop.city,
      rating: Math.round((shop.rating ?? 0) * 10) / 10,
      ratingCount: shop.ratingCount ?? 0,
      deliveredCount: shop.deliveredCount ?? 0,
      verified: shop.status === 'approved',
      minOrder: shop.minOrder ?? 0,
      delivery: zone ? { fee: zone.fee, minutes: zone.minutes } : null,
    };
  }

  /** Approved, open shops that deliver to this city */
  async shopsIn(city: string): Promise<any[]> {
    const key = cityKey(city);
    if (!key) return [];
    return this.shops.find({ status: 'approved', paused: { $ne: true }, 'zones.cityKey': key }).lean();
  }

  /** Delivery city: the student's lease, else their profile */
  async defaultCity(userId: string): Promise<string> {
    const lease = await this.currentLease(userId);
    if (lease?.city) return lease.city;
    const u: any = await this.users.findById(userId).select('city').lean();
    if (u?.city) return u.city;
    return 'Yaoundé';
  }

  private async currentLease(userId: string): Promise<{ leaseId: string; city: string; address: string; district?: string; start?: Date } | null> {
    if (!isValidObjectId(userId)) return null;
    const lease: any = await this.leases
      .findOne({ 'tenants.tenantUserId': new Types.ObjectId(userId), status: { $in: [LeaseStatus.ACTIVE, LeaseStatus.PENDING_TENANT] } })
      .sort({ leaseStart: -1 })
      .select('propertyId leaseStart')
      .lean();
    if (!lease) return null;
    const p: any = await this.properties.findById(lease.propertyId).select('city address neighborhood').lean();
    if (!p) return null;
    return { leaseId: String(lease._id), city: p.city, address: p.address, district: p.neighborhood, start: lease.leaseStart };
  }

  /** Checkout prefill: lease address and move-in date, name and phone */
  async deliveryDefaults(userId: string) {
    const [lease, u] = await Promise.all([this.currentLease(userId), this.users.findById(userId).select('name phoneNumber city').lean() as any]);
    const today = new Date().toISOString().slice(0, 10);
    const start = lease?.start ? new Date(lease.start).toISOString().slice(0, 10) : undefined;
    const phone = /^\+?\d{8,15}$/.test(u?.phoneNumber ?? '') ? u.phoneNumber : '';
    return {
      name: u?.name ?? '',
      phone,
      address: lease?.address ?? '',
      district: lease?.district ?? '',
      city: lease?.city ?? u?.city ?? '',
      date: start && start > today ? start : undefined,
      leaseId: lease?.leaseId,
    };
  }

  // ════════════════════════════════════════════════════════════════════════
  // Catalogue for students
  // ════════════════════════════════════════════════════════════════════════

  async home(userId: string, cityIn?: string) {
    const city = cityIn?.trim() || (await this.defaultCity(userId));
    const [market, shops, templates, types, cart, approvedCities] = await Promise.all([
      this.market(),
      this.shopsIn(city),
      this.templates.find({ country: COUNTRY, isActive: true }).sort({ order: 1 }).lean(),
      this.itemTypes.find().sort({ order: 1 }).lean(),
      this.carts.findOne({ userId: new Types.ObjectId(userId) }).lean(),
      this.shops.distinct('zones.city', { status: 'approved', paused: { $ne: true } }),
    ]);
    const shopIds = shops.map((s) => s._id);
    const [kitOffers, itemCounts] = await Promise.all([
      this.kitOffers.find({ shopId: { $in: shopIds }, available: true }).select('templateId price shopId photos').lean(),
      this.itemOffers.aggregate([
        { $match: { shopId: { $in: shopIds }, isActive: true, stock: { $gt: 0 } } },
        { $group: { _id: '$itemTypeKey', n: { $sum: 1 } } },
      ]),
    ]);
    const typeByKey = new Map(types.map((t: any) => [t.key, t]));
    const catCount: Record<string, number> = {};
    for (const r of itemCounts) {
      const t: any = typeByKey.get(r._id);
      if (t) catCount[t.category] = (catCount[t.category] ?? 0) + r.n;
    }
    const kits = templates.map((t: any) => {
      const offers = kitOffers.filter((o) => String(o.templateId) === String(t._id));
      return {
        _id: String(t._id),
        key: t.key,
        name: t.name,
        description: t.description,
        icon: t.icon,
        image: t.image ?? offers.find((o) => o.photos?.length)?.photos?.[0],
        itemCount: (t.lines ?? []).reduce((n: number, l: any) => n + (l.qty ?? 1), 0),
        fromPrice: offers.length ? Math.min(...offers.map((o) => o.price)) : null,
        shopCount: offers.length,
        // The kit made of the others, for less
        bestValue: t.key === 'arrival',
      };
    });
    const known = new Map<string, string>();
    for (const c of [...(market.cities ?? []), ...(approvedCities as string[])]) if (c && !known.has(cityKey(c))) known.set(cityKey(c), c);
    const liveKeys = new Set((approvedCities as string[]).map(cityKey));
    const popular = types.filter((t: any) => itemCounts.some((r) => r._id === t.key)).slice(0, 12);
    // A few real items from shops here: best rated shops first, then the cheapest
    const shopById = new Map(shops.map((s) => [String(s._id), s]));
    const someItems = await this.itemOffers.find({ shopId: { $in: shopIds }, isActive: true, stock: { $gt: 0 } }).sort({ updatedAt: -1 }).limit(40).lean();
    const popularItems = someItems
      .map((o) => this.itemCard(o, typeByKey.get(o.itemTypeKey), shopById.get(String(o.shopId)), city))
      .sort((a, b) => b.shop.rating - a.shop.rating || a.price - b.price)
      .slice(0, 6);
    // The order the student is waiting for, pinned on top
    const live: any = await this.orders
      .findOne({ userId: new Types.ObjectId(userId), status: 'paid', 'parts.status': { $in: ['placed', ...LIVE] } })
      .sort({ createdAt: -1 })
      .lean();
    const livePart: any = live?.parts.find((p: any) => ['placed', ...LIVE].includes(p.status));
    const activeOrder = live && livePart
      ? {
          _id: String(live._id),
          number: live.number,
          status: livePart.status,
          shopName: livePart.shopName,
          iconKey: livePart.lines?.[0]?.iconKey,
          code: livePart.status !== 'placed' ? deliveryCode(this.codeSecret, String(livePart._id)) : undefined,
        }
      : null;
    return {
      city,
      currency: market.currency,
      serviceFee: market.serviceFee,
      cities: [...known.values()].map((name) => ({ name, live: liveKeys.has(cityKey(name)) })),
      shopCount: shops.length,
      kits,
      categories: ['bedroom', 'kitchen', 'cleaning', 'furniture', 'study', 'bathroom'].map((key) => ({ key, count: catCount[key] ?? 0 })),
      popular: popular.map((t: any) => ({ key: t.key, name: t.name, icon: t.icon })),
      popularItems,
      activeOrder,
      cartCount: (cart?.lines ?? []).reduce((n, l) => n + (l.qty ?? 1), 0),
      wanted: !!(await this.interest.exists({ userId: new Types.ObjectId(userId), city: cityKey(city) })),
    };
  }

  async kitTemplateOffers(templateId: string, city: string) {
    if (!isValidObjectId(templateId)) throw new NotFoundException('Kit not found');
    const t: any = await this.templates.findById(templateId).lean();
    if (!t) throw new NotFoundException('Kit not found');
    const shops = await this.shopsIn(city);
    const byId = new Map(shops.map((s) => [String(s._id), s]));
    const offers = await this.kitOffers.find({ templateId: t._id, shopId: { $in: shops.map((s) => s._id) }, available: true }).sort({ price: 1 }).lean();
    return {
      template: await this.templateView(t),
      offers: offers.map((o) => ({ _id: String(o._id), price: o.price, photos: o.photos ?? [], prepHours: o.prepHours, shop: this.shopCard(byId.get(String(o.shopId)), city) })),
    };
  }

  private async templateView(t: any, offer?: any) {
    const types = await this.itemTypes.find({ key: { $in: (t.lines ?? []).map((l: any) => l.itemTypeKey) } }).lean();
    const byKey = new Map(types.map((x: any) => [x.key, x]));
    return {
      _id: String(t._id),
      key: t.key,
      name: t.name,
      description: t.description,
      icon: t.icon,
      image: t.image,
      lines: (t.lines ?? []).map((l: any) => {
        const it: any = byKey.get(l.itemTypeKey);
        return {
          itemTypeKey: l.itemTypeKey,
          name: it?.name ?? both(l.itemTypeKey),
          icon: it?.icon ?? '📦',
          qty: l.qty,
          removable: !!l.removable,
          discount: offer ? Number(offer.removeDiscounts?.[l.itemTypeKey] ?? 0) : 0,
          electrical: !!it?.electrical,
        };
      }),
      options: (t.options ?? []).map((o: any) => ({
        key: o.key,
        label: o.label,
        values: o.values.map((v: any) => ({ key: v.key, label: v.label, extra: offer ? Number(offer.optionPrices?.[`${o.key}:${v.key}`] ?? 0) : 0 })),
      })),
    };
  }

  async kitOffer(id: string, city: string) {
    if (!isValidObjectId(id)) throw new NotFoundException('Kit not found');
    const offer: any = await this.kitOffers.findById(id).lean();
    if (!offer) throw new NotFoundException('Kit not found');
    const [t, shop] = await Promise.all([this.templates.findById(offer.templateId).lean(), this.shops.findById(offer.shopId).lean()]);
    if (!t || !shop || shop.status !== 'approved') throw new NotFoundException('Kit not found');
    const here = await this.shopsIn(city);
    const others = await this.kitOffers.countDocuments({ templateId: offer.templateId, available: true, shopId: { $in: here.map((s) => s._id).filter((x) => String(x) !== String(shop._id)) } });
    const addOns = await this.itemOffers.find({ shopId: shop._id, isActive: true, stock: { $gt: 0 } }).sort({ price: 1 }).limit(8).lean();
    const addTypes = await this.typeMap(addOns.map((a) => a.itemTypeKey));
    // What each line costs bought on its own: this shop's price, else the cheapest shop here
    const keys = (t.lines ?? []).map((l: any) => l.itemTypeKey);
    const singles = await this.itemOffers
      .find({ itemTypeKey: { $in: keys }, isActive: true, stock: { $gt: 0 }, shopId: { $in: here.map((s) => s._id) } })
      .select('itemTypeKey price shopId')
      .lean();
    const alone = new Map<string, number>();
    for (const k of keys) {
      const mine = singles.filter((x) => x.itemTypeKey === k && String(x.shopId) === String(shop._id));
      const pool = mine.length ? mine : singles.filter((x) => x.itemTypeKey === k);
      if (pool.length) alone.set(k, Math.min(...pool.map((x) => x.price)));
    }
    const template = await this.templateView(t, offer);
    template.lines = template.lines.map((l: any) => ({ ...l, alonePrice: alone.get(l.itemTypeKey) ?? null }));
    return {
      _id: String(offer._id),
      price: offer.price,
      photos: offer.photos ?? [],
      available: offer.available && !shop.paused,
      prepHours: offer.prepHours,
      template,
      shop: this.shopCard(shop, city),
      otherShops: others,
      addOns: addOns.map((a) => this.itemCard(a, addTypes.get(a.itemTypeKey), shop, city)),
    };
  }

  private async typeMap(keys: string[]) {
    const types = await this.itemTypes.find({ key: { $in: [...new Set(keys)] } }).lean();
    return new Map(types.map((t: any) => [t.key, t]));
  }

  private itemCard(o: any, type: any, shop: any, city: string) {
    return {
      _id: String(o._id),
      itemTypeKey: o.itemTypeKey,
      typeName: type?.name ?? both(o.itemTypeKey),
      icon: type?.icon ?? '📦',
      size: type?.size ?? 'small',
      electrical: !!type?.electrical,
      title: o.title,
      brand: o.brand,
      price: o.price,
      photo: o.photos?.[0],
      stock: o.stock,
      // Listed in the last three weeks
      isNew: !!o.createdAt && Date.now() - new Date(o.createdAt).getTime() < 21 * 86_400_000,
      // Colour choices, for the dots on the card
      colours: (o.options ?? [])
        .filter((op: any) => /colou?r|couleur/i.test(String(op.label ?? '')))
        .flatMap((op: any) => (op.values ?? []).map((v: any) => String(v.label)))
        .slice(0, 4),
      shop: this.shopCard(shop, city),
    };
  }

  async items(q: ItemsQueryDto) {
    const city = q.city?.trim() || 'Yaoundé';
    const shops = await this.shopsIn(city);
    const byId = new Map(shops.map((s) => [String(s._id), s]));
    const filter: any = { shopId: { $in: shops.map((s) => s._id) }, isActive: true, stock: { $gt: 0 } };
    const typeFilter: any = {};
    if (q.category) typeFilter.category = q.category;
    const text = q.q?.trim();
    if (text) {
      const rx = new RegExp(escapeRegex(cityKey(text)), 'i');
      const rxRaw = new RegExp(escapeRegex(text), 'i');
      typeFilter.$or = [{ 'name.en': rxRaw }, { 'name.fr': rxRaw }, { 'keywords.en': rxRaw }, { 'keywords.fr': rxRaw }, { key: rx }];
    }
    let typeKeys: string[] | null = null;
    if (q.category || text) typeKeys = (await this.itemTypes.find(typeFilter).select('key').lean()).map((t: any) => t.key);
    if (text) {
      const rxRaw = new RegExp(escapeRegex(text), 'i');
      filter.$or = [{ itemTypeKey: { $in: typeKeys ?? [] } }, { title: rxRaw }, { brand: rxRaw }];
      if (q.category) {
        const inCat = (await this.itemTypes.find({ category: q.category }).select('key').lean()).map((t: any) => t.key);
        filter.itemTypeKey = { $in: inCat };
      }
    } else if (typeKeys) {
      filter.itemTypeKey = { $in: typeKeys };
    }
    if (q.maxPrice) filter.price = { $lte: Number(q.maxPrice) };
    const offers = await this.itemOffers.find(filter).limit(120).lean();
    const types = await this.typeMap(offers.map((o) => o.itemTypeKey));
    let cards = offers.map((o) => this.itemCard(o, types.get(o.itemTypeKey), byId.get(String(o.shopId)), city));
    if (q.sort === 'rating') cards = cards.sort((a, b) => b.shop.rating - a.shop.rating || a.price - b.price);
    else if (q.sort === 'fast') cards = cards.sort((a, b) => (a.shop.delivery?.minutes ?? 1e9) - (b.shop.delivery?.minutes ?? 1e9) || a.price - b.price);
    else cards = cards.sort((a, b) => a.price - b.price);
    return { city, items: cards.slice(0, 60) };
  }

  async itemOffer(id: string, city: string) {
    if (!isValidObjectId(id)) throw new NotFoundException('Item not found');
    const o: any = await this.itemOffers.findById(id).lean();
    if (!o) throw new NotFoundException('Item not found');
    const [shop, type] = await Promise.all([this.shops.findById(o.shopId).lean(), this.itemTypes.findOne({ key: o.itemTypeKey }).lean()]);
    if (!shop || shop.status !== 'approved') throw new NotFoundException('Item not found');
    const here = await this.shopsIn(city);
    const byId = new Map(here.map((s) => [String(s._id), s]));
    const others = await this.itemOffers
      .find({ itemTypeKey: o.itemTypeKey, isActive: true, stock: { $gt: 0 }, _id: { $ne: o._id }, shopId: { $in: here.map((s) => s._id) } })
      .sort({ price: 1 })
      .limit(6)
      .lean();
    return {
      ...this.itemCard(o, type, shop, city),
      description: o.description,
      photos: o.photos ?? [],
      options: o.options ?? [],
      warrantyDays: o.warrantyDays,
      assembly: !!o.assembly,
      available: o.isActive && o.stock > 0 && !shop.paused,
      others: others.map((x) => this.itemCard(x, type, byId.get(String(x.shopId)), city)),
      // Only said when other shops here sell it too
      lowest: others.length > 0 && others.every((x) => x.price >= o.price),
      together: await this.boughtWith(o, type, shop, city),
    };
  }

  /** Other items from the same shop, same kind of room first: one delivery for both */
  private async boughtWith(o: any, type: any, shop: any, city: string) {
    const list = await this.itemOffers
      .find({ shopId: shop._id, isActive: true, stock: { $gt: 0 }, _id: { $ne: o._id }, itemTypeKey: { $ne: o.itemTypeKey } })
      .limit(30)
      .lean();
    const types = await this.typeMap(list.map((x) => x.itemTypeKey));
    const cat = type?.category;
    return list
      .sort((a, b) => Number((types.get(b.itemTypeKey) as any)?.category === cat) - Number((types.get(a.itemTypeKey) as any)?.category === cat) || a.price - b.price)
      .slice(0, 6)
      .map((x) => this.itemCard(x, types.get(x.itemTypeKey), shop, city));
  }

  async itemTypeOffers(key: string, city: string) {
    const type: any = await this.itemTypes.findOne({ key }).lean();
    if (!type) throw new NotFoundException('Item not found');
    const shops = await this.shopsIn(city);
    const byId = new Map(shops.map((s) => [String(s._id), s]));
    const offers = await this.itemOffers.find({ itemTypeKey: key, isActive: true, stock: { $gt: 0 }, shopId: { $in: shops.map((s) => s._id) } }).sort({ price: 1 }).lean();
    return { type: { key: type.key, name: type.name, icon: type.icon }, items: offers.map((o) => this.itemCard(o, type, byId.get(String(o.shopId)), city)) };
  }

  async shopPage(slug: string, city: string) {
    const shop: any = await this.shops.findOne({ slug, status: 'approved' }).lean();
    if (!shop) throw new NotFoundException('Shop not found');
    const [kits, items, reviews] = await Promise.all([
      this.kitOffers.find({ shopId: shop._id, available: true }).lean(),
      this.itemOffers.find({ shopId: shop._id, isActive: true, stock: { $gt: 0 } }).sort({ price: 1 }).limit(60).lean(),
      this.orders.aggregate([
        { $match: { 'parts.shopId': shop._id } },
        { $unwind: '$parts' },
        { $match: { 'parts.shopId': shop._id, 'parts.rating': { $gte: 1 } } },
        { $sort: { 'parts.ratedAt': -1 } },
        { $limit: 20 },
        { $project: { rating: '$parts.rating', review: '$parts.review', at: { $ifNull: ['$parts.ratedAt', { $ifNull: ['$parts.deliveredAt', '$updatedAt'] }] }, name: '$recipient.name' } },
      ]),
    ]);
    const tpls = await this.templates.find({ _id: { $in: kits.map((k) => k.templateId) } }).lean();
    const tById = new Map(tpls.map((t: any) => [String(t._id), t]));
    const types = await this.typeMap(items.map((i) => i.itemTypeKey));
    return {
      shop: { ...this.shopCard(shop, city), about: shop.about, photos: shop.photos ?? [], openingHours: shop.openingHours, address: shop.address, zones: (shop.zones ?? []).map((z: any) => ({ city: z.city, fee: z.fee, minutes: z.minutes })) },
      kits: kits
        .filter((k) => tById.get(String(k.templateId)))
        .map((k) => {
          const t: any = tById.get(String(k.templateId));
          return { _id: String(k._id), key: t.key, name: t.name, icon: t.icon, price: k.price, photo: k.photos?.[0] ?? t.image };
        }),
      items: items.map((i) => this.itemCard(i, types.get(i.itemTypeKey), shop, city)),
      // First names only
      reviews: reviews.map((r: any) => ({ rating: r.rating, review: r.review, at: r.at, name: String(r.name ?? '').split(' ')[0] })),
    };
  }

  async addInterest(userId: string, city: string) {
    await this.interest.updateOne(
      { userId: new Types.ObjectId(userId), city: cityKey(city) },
      { $setOnInsert: { userId: new Types.ObjectId(userId), city: cityKey(city) } },
      { upsert: true },
    );
    return { ok: true };
  }

  // ════════════════════════════════════════════════════════════════════════
  // Cart
  // ════════════════════════════════════════════════════════════════════════

  async getCart(userId: string) {
    const cart: any = await this.carts.findOne({ userId: new Types.ObjectId(userId) }).lean();
    const city = cart?.city || (await this.defaultCity(userId));
    return this.cartView(city, cart?.lines ?? []);
  }

  async putCart(userId: string, dto: PutCartDto) {
    // Same offer with the same choices = one line
    const merged: CartLine[] = [];
    for (const l of dto.lines) {
      const same = merged.find(
        (m) => m.kind === l.kind && m.offerId === l.offerId && JSON.stringify(m.options ?? {}) === JSON.stringify(l.options ?? {}) && JSON.stringify([...(m.removed ?? [])].sort()) === JSON.stringify([...(l.removed ?? [])].sort()),
      );
      if (same) same.qty = Math.min(20, same.qty + l.qty);
      else merged.push({ kind: l.kind, offerId: l.offerId, qty: l.qty, options: l.options ?? {}, removed: l.removed ?? [] });
    }
    await this.carts.updateOne(
      { userId: new Types.ObjectId(userId) },
      { $set: { city: dto.city.trim(), lines: merged } },
      { upsert: true },
    );
    return this.cartView(dto.city.trim(), merged);
  }

  /** Prices every line from the offers as they are now */
  async priceLines(city: string, lines: CartLine[]): Promise<PricedLine[]> {
    const kitIds = lines.filter((l) => l.kind === 'kit' && isValidObjectId(l.offerId)).map((l) => new Types.ObjectId(l.offerId));
    const itemIds = lines.filter((l) => l.kind === 'item' && isValidObjectId(l.offerId)).map((l) => new Types.ObjectId(l.offerId));
    const [kits, items] = await Promise.all([this.kitOffers.find({ _id: { $in: kitIds } }).lean(), this.itemOffers.find({ _id: { $in: itemIds } }).lean()]);
    const tpls = await this.templates.find({ _id: { $in: kits.map((k) => k.templateId) } }).lean();
    const shops = await this.shops.find({ _id: { $in: [...kits, ...items].map((o) => o.shopId) } }).lean();
    const allTypeKeys = [...items.map((i) => i.itemTypeKey), ...tpls.flatMap((t: any) => t.lines.map((l: any) => l.itemTypeKey))];
    const types = await this.typeMap(allTypeKeys);
    const kitById = new Map(kits.map((k) => [String(k._id), k]));
    const itemById = new Map(items.map((i) => [String(i._id), i]));
    const tById = new Map(tpls.map((t: any) => [String(t._id), t]));
    const shopById = new Map(shops.map((s) => [String(s._id), s]));
    const name = (key: string): Lang2 => (types.get(key) as any)?.name ?? both(key);

    return lines.map((l, index): PricedLine => {
      const qty = Math.max(1, Math.min(20, Number(l.qty) || 1));
      if (l.kind === 'kit') {
        const o: any = kitById.get(l.offerId);
        const t: any = o && tById.get(String(o.templateId));
        const shop: any = o && shopById.get(String(o.shopId));
        if (!o || !t || !shop || !o.available || !t.isActive || shop.status !== 'approved' || shop.paused) return { ...l, qty, index, ok: false, problem: 'gone', shopId: shop ? String(shop._id) : undefined };
        let unit = o.price;
        const choices: Lang2[] = [];
        for (const opt of t.options ?? []) {
          const val = opt.values.find((v: any) => v.key === l.options?.[opt.key]) ?? opt.values[0];
          if (!val) continue;
          unit += Number(o.optionPrices?.[`${opt.key}:${val.key}`] ?? 0);
          choices.push({ en: `${opt.label.en}: ${val.label.en}`, fr: `${opt.label.fr} : ${val.label.fr}` });
        }
        const removable = new Set((t.lines ?? []).filter((x: any) => x.removable).map((x: any) => x.itemTypeKey));
        const removed = [...new Set((l.removed ?? []).filter((k) => removable.has(k)))];
        for (const k of removed) unit -= Number(o.removeDiscounts?.[k] ?? 0);
        unit = Math.max(0, round(unit));
        const contents = (t.lines ?? [])
          .filter((x: any) => !removed.includes(x.itemTypeKey))
          .map((x: any) => ({ en: `${x.qty} × ${name(x.itemTypeKey).en}`, fr: `${x.qty} × ${name(x.itemTypeKey).fr}` }));
        const problem: Problem | undefined = this.zoneFor(shop, city) ? undefined : 'no_delivery';
        return {
          ...l, qty, removed, index, shopId: String(shop._id), ok: !problem, problem,
          line: { kind: 'kit', offerId: String(o._id), name: t.name, icon: t.icon, iconKey: `kit:${t.key}`, photo: o.photos?.[0] ?? t.image, unitPrice: unit, qty, total: unit * qty, choices, removed: removed.map(name), contents },
        };
      }
      const o: any = itemById.get(l.offerId);
      const shop: any = o && shopById.get(String(o.shopId));
      const type: any = o && types.get(o.itemTypeKey);
      if (!o || !shop || !o.isActive || shop.status !== 'approved' || shop.paused) return { ...l, qty, index, ok: false, problem: 'gone', shopId: shop ? String(shop._id) : undefined };
      let unit = o.price;
      const choices: Lang2[] = [];
      for (const opt of o.options ?? []) {
        const val = opt.values.find((v: any) => v.key === l.options?.[opt.key]) ?? opt.values[0];
        if (!val) continue;
        unit += Number(val.extra ?? 0);
        choices.push(both(`${opt.label}: ${val.label}`));
      }
      unit = round(unit);
      const problem: Problem | undefined = o.stock < qty ? 'stock' : !this.zoneFor(shop, city) ? 'no_delivery' : undefined;
      return {
        ...l, qty, index, shopId: String(shop._id), ok: !problem, problem, stock: o.stock,
        line: { kind: 'item', offerId: String(o._id), name: both(o.title), icon: type?.icon, iconKey: o.itemTypeKey, photo: o.photos?.[0], unitPrice: unit, qty, total: unit * qty, choices, removed: [], warrantyDays: o.warrantyDays },
      };
    });
  }

  async cartView(city: string, lines: CartLine[]) {
    const [market, priced] = await Promise.all([this.market(), this.priceLines(city, lines)]);
    const shopIds = [...new Set(priced.map((p) => p.shopId).filter(Boolean))] as string[];
    const shops = await this.shops.find({ _id: { $in: shopIds.map((s) => new Types.ObjectId(s)) } }).lean();
    const groups = shops.map((shop: any) => {
      const mine = priced.filter((p) => p.shopId === String(shop._id));
      const okLines = mine.filter((p) => p.ok);
      const subtotal = okLines.reduce((n, p) => n + (p.line?.total ?? 0), 0);
      const zone = this.zoneFor(shop, city);
      const belowMin = okLines.length > 0 && subtotal < (shop.minOrder ?? 0);
      return {
        shop: this.shopCard(shop, city),
        // Keys (removed) for sending the cart back; names (removedNames) for showing it
        lines: mine.map((p) => ({ ...(p.line ?? {}), index: p.index, kind: p.kind, offerId: p.offerId, qty: p.qty, options: p.options ?? {}, removed: p.removed ?? [], removedNames: p.line?.removed ?? [], ok: p.ok, problem: p.problem, stock: p.stock })),
        subtotal,
        deliveryFee: okLines.length && zone ? zone.fee : 0,
        belowMin,
      };
    });
    // Lines whose shop is gone entirely
    const orphans = priced.filter((p) => !p.shopId).map((p) => ({ index: p.index, kind: p.kind, offerId: p.offerId, qty: p.qty, ok: false, problem: 'gone' as Problem }));
    const subtotal = groups.reduce((n, g) => n + g.subtotal, 0);
    const deliveryFees = groups.reduce((n, g) => n + g.deliveryFee, 0);
    const serviceFee = subtotal > 0 ? market.serviceFee : 0;
    const canOrder = subtotal > 0 && priced.every((p) => p.ok) && !groups.some((g) => g.belowMin);
    return {
      city,
      currency: market.currency,
      groups,
      orphans,
      count: priced.reduce((n, p) => n + p.qty, 0),
      subtotal,
      deliveryFees,
      serviceFee,
      total: subtotal + deliveryFees + serviceFee,
      canOrder,
    };
  }

  // ════════════════════════════════════════════════════════════════════════
  // Orders (student)
  // ════════════════════════════════════════════════════════════════════════

  async createOrder(userId: string, dto: CreateOrderDto) {
    const cart: any = await this.carts.findOne({ userId: new Types.ObjectId(userId) }).lean();
    if (!cart?.lines?.length) throw new UnprocessableEntityException({ code: 'CART_EMPTY', message: 'Your cart is empty.' });
    const city = cart.city;
    const view = await this.cartView(city, cart.lines);
    if (!view.canOrder) throw new UnprocessableEntityException({ code: 'CART_PROBLEM', message: 'Some items in your cart need a change before ordering.' });

    const today = new Date().toISOString().slice(0, 10);
    const latest = new Date(Date.now() + 60 * 86_400_000).toISOString().slice(0, 10);
    if (dto.date < today || dto.date > latest) throw new BadRequestException({ code: 'BAD_DATE', message: 'Pick a delivery date in the next 60 days.' });

    const u: any = await this.users.findById(userId).select('name phoneNumber').lean();
    const forSomeone = !!dto.recipientName?.trim() || !!dto.recipientPhone?.trim();
    const phone = (dto.recipientPhone?.trim() || (/^\+?\d{8,15}$/.test(u?.phoneNumber ?? '') ? u.phoneNumber : '')).replace(/\s/g, '');
    if (!phone) throw new BadRequestException({ code: 'PHONE_NEEDED', message: 'Add a phone number so the shop can call on delivery.' });

    const market = await this.market();
    const priced = await this.priceLines(city, cart.lines);
    const parts: OrderPart[] = view.groups.map((g) => {
      const lines = priced.filter((p) => p.shopId === g.shop._id && p.ok).map((p) => p.line!);
      const subtotal = lines.reduce((n, l) => n + l.total, 0);
      const commission = round((subtotal * market.commissionPct) / 100);
      return {
        _id: new Types.ObjectId(),
        shopId: new Types.ObjectId(g.shop._id),
        shopName: g.shop.name,
        lines,
        subtotal,
        deliveryFee: g.deliveryFee,
        commission,
        net: subtotal - commission + g.deliveryFee,
        status: 'placed',
        timeline: [],
        codeTries: 0,
        payout: { status: 'none' },
      };
    });

    // An older unpaid order from this cart is replaced
    await this.orders.updateMany({ userId: new Types.ObjectId(userId), status: 'pending_payment' }, { $set: { status: 'expired' } });

    const order = await this.orders.create({
      number: orderNumber(),
      userId: new Types.ObjectId(userId),
      recipient: { name: (dto.recipientName?.trim() || u?.name || '').slice(0, 80), phone, forSomeoneElse: forSomeone },
      country: COUNTRY,
      currency: market.currency,
      delivery: { address: dto.address.trim(), city, district: dto.district?.trim(), date: dto.date, slot: dto.slot, note: dto.note?.trim(), leaseId: dto.leaseId },
      parts,
      subtotal: view.subtotal,
      deliveryFees: view.deliveryFees,
      serviceFee: view.serviceFee,
      total: view.total,
      commission: parts.reduce((n, p) => n + p.commission, 0),
      status: 'pending_payment',
      expiresAt: new Date(Date.now() + ORDER_TTL_MS),
    });
    return { _id: String(order._id), number: order.number, total: order.total, currency: order.currency, expiresAt: order.expiresAt };
  }

  /** For checkout: what this order costs (never trusted from the app) */
  async payable(userId: string, orderId: string): Promise<{ amount: number; label: string; number: string }> {
    if (!isValidObjectId(orderId)) throw new BadRequestException('Invalid order');
    const o: any = await this.orders.findById(orderId).lean();
    if (!o || String(o.userId) !== String(userId)) throw new NotFoundException('Order not found');
    if (o.status === 'paid' || o.status === 'closed') throw new ConflictException({ code: 'ALREADY_PAID', message: 'This order is already paid.' });
    if (o.status !== 'pending_payment' || new Date(o.expiresAt).getTime() < Date.now()) {
      throw new UnprocessableEntityException({ code: 'ORDER_EXPIRED', message: 'This order expired. Place it again from your cart.' });
    }
    return { amount: o.total, label: `Essentials ${o.number}`, number: o.number };
  }

  /**
   * Called once by checkout when the money arrived. A late payment on an expired order still
   * goes through: the money moved, so the order is placed.
   */
  async markPaid(orderId: string, info: { checkoutPaymentId: string; providerReference?: string; method?: string; paidAt?: Date }): Promise<'activated' | 'already_done' | 'not_possible'> {
    const now = info.paidAt ?? new Date();
    const o = await this.orders.findOneAndUpdate(
      { _id: orderId, status: { $in: ['pending_payment', 'expired'] } },
      {
        $set: { status: 'paid', payment: { checkoutPaymentId: info.checkoutPaymentId, providerReference: info.providerReference, method: info.method, paidAt: now } },
        $push: { 'parts.$[].timeline': { status: 'placed', at: now } },
      },
      { new: true },
    );
    if (!o) {
      const existing: any = await this.orders.findById(orderId).select('status').lean();
      return existing && (existing.status === 'paid' || existing.status === 'closed') ? 'already_done' : 'not_possible';
    }
    // Stock, cart, notices: none of these may undo the payment
    try {
      for (const part of o.parts) {
        for (const l of part.lines) {
          if (l.kind !== 'item') continue;
          const r = await this.itemOffers.updateOne({ _id: l.offerId, stock: { $gte: l.qty } }, { $inc: { stock: -l.qty } });
          if (!r.modifiedCount) await this.itemOffers.updateOne({ _id: l.offerId }, { $set: { stock: 0 } });
        }
      }
      const paidIds = new Set(o.parts.flatMap((p) => p.lines.map((l) => l.offerId)));
      const cart: any = await this.carts.findOne({ userId: o.userId }).lean();
      if (cart) await this.carts.updateOne({ _id: cart._id }, { $set: { lines: cart.lines.filter((l: CartLine) => !paidIds.has(l.offerId)) } });
      const market = await this.market();
      for (const part of o.parts) {
        const shop: any = await this.shops.findById(part.shopId).select('ownerId').lean();
        if (shop?.ownerId) {
          await this.notify(String(shop.ownerId), '/essentials/partner',
            { title: 'New order', message: `Order ${o.number}: ${this.money(part.subtotal)} for ${o.delivery.date}. Accept it within ${market.acceptHours} hours.` },
            { title: 'Nouvelle commande', message: `Commande ${o.number} : ${this.money(part.subtotal)} pour le ${o.delivery.date}. Acceptez-la dans les ${market.acceptHours} heures.` },
            { orderId: String(o._id), partId: String(part._id) });
        }
      }
      await this.notify(String(o.userId), `/essentials/orders/${o._id}`,
        { title: 'Order placed', message: `We sent order ${o.number} to the shop. You’ll hear from us when they accept it.` },
        { title: 'Commande passée', message: `La commande ${o.number} est envoyée à la boutique. Nous vous prévenons dès qu’elle l’accepte.` },
        { orderId: String(o._id) });
    } catch (err: any) {
      this.logger.error(`Order ${o.number} paid, follow-up failed: ${err?.message ?? err}`);
    }
    return 'activated';
  }

  private money(n: number) {
    return `${Math.round(n).toLocaleString('fr-FR')} FCFA`;
  }

  async myOrders(userId: string) {
    const list = await this.orders
      .find({ userId: new Types.ObjectId(userId), status: { $in: ['paid', 'closed', 'pending_payment'] } })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    return list.map((o: any) => ({
      _id: String(o._id),
      number: o.number,
      status: o.status,
      total: o.total,
      currency: o.currency,
      createdAt: o.createdAt,
      date: o.delivery?.date,
      icons: o.parts.flatMap((p: any) => p.lines.map((l: any) => l.iconKey)).filter(Boolean).slice(0, 4),
      itemCount: o.parts.reduce((n: number, p: any) => n + p.lines.reduce((m: number, l: any) => m + l.qty, 0), 0),
      parts: o.parts.map((p: any) => ({ shopName: p.shopName, status: p.status })),
    }));
  }

  async myOrder(userId: string, id: string) {
    const o: any = await this.ownedOrder(userId, id);
    const market = await this.market();
    const shops = await this.shops.find({ _id: { $in: o.parts.map((p: any) => p.shopId) } }).select('name slug phone whatsapp logo rating ratingCount').lean();
    const sById = new Map(shops.map((s: any) => [String(s._id), s]));
    const now = Date.now();
    return {
      _id: String(o._id),
      number: o.number,
      status: o.status,
      currency: o.currency,
      recipient: o.recipient,
      delivery: o.delivery,
      subtotal: o.subtotal,
      deliveryFees: o.deliveryFees,
      serviceFee: o.serviceFee,
      total: o.total,
      createdAt: o.createdAt,
      paidAt: o.payment?.paidAt,
      expiresAt: o.expiresAt,
      parts: o.parts.map((p: any) => {
        const shop: any = sById.get(String(p.shopId));
        const live = o.status === 'paid' && ['placed', ...LIVE].includes(p.status);
        const deliveredAgo = p.deliveredAt ? now - new Date(p.deliveredAt).getTime() : Infinity;
        const inHold = deliveredAgo < market.holdHours * 3_600_000;
        const inWarranty = p.lines.some((l: any) => l.warrantyDays && deliveredAgo < l.warrantyDays * 86_400_000);
        return {
          _id: String(p._id),
          shop: { name: p.shopName, slug: shop?.slug, logo: shop?.logo, phone: live ? shop?.phone : undefined, whatsapp: live ? shop?.whatsapp : undefined },
          lines: p.lines,
          subtotal: p.subtotal,
          deliveryFee: p.deliveryFee,
          status: p.status,
          timeline: p.timeline,
          // Shown to the student only; the shop types it on delivery
          deliveryCode: live && p.status !== 'placed' ? deliveryCode(this.codeSecret, String(p._id)) : undefined,
          cancelReason: p.cancelReason,
          cancelledBy: p.cancelledBy,
          refund: p.refund ? { amount: p.refund.amount, status: p.refund.status } : undefined,
          dispute: p.dispute ? { reason: p.dispute.reason, status: p.dispute.status, decision: p.dispute.decision, note: p.dispute.note } : undefined,
          rating: p.rating,
          review: p.review,
          canCancel: o.status === 'paid' && p.status === 'placed',
          canReceive: o.status === 'paid' && LIVE.includes(p.status),
          canDispute: p.status === 'delivered' && !p.dispute && (inHold || inWarranty),
          canRate: (p.status === 'delivered' || (p.status === 'disputed' && p.dispute?.status === 'resolved')) && !p.rating,
        };
      }),
    };
  }

  private async ownedOrder(userId: string, id: string): Promise<EssOrderDocument> {
    if (!isValidObjectId(id)) throw new NotFoundException('Order not found');
    const o = await this.orders.findById(id);
    if (!o || String(o.userId) !== String(userId)) throw new NotFoundException('Order not found');
    return o;
  }

  private partOf(o: EssOrderDocument, partId: string): OrderPart {
    const p = o.parts.find((x) => String(x._id) === String(partId));
    if (!p) throw new NotFoundException('Order not found');
    return p;
  }

  async studentReceived(userId: string, orderId: string, partId: string) {
    const o = await this.ownedOrder(userId, orderId);
    const p = this.partOf(o, partId);
    if (!LIVE.includes(p.status)) throw new ConflictException({ code: 'NOT_ON_THE_WAY', message: 'This part can’t be marked as received now.' });
    await this.markDelivered(o, p, 'student');
    return this.myOrder(userId, orderId);
  }

  async studentCancel(userId: string, orderId: string, partId: string) {
    const o = await this.ownedOrder(userId, orderId);
    const p = this.partOf(o, partId);
    if (o.status !== 'paid' || p.status !== 'placed') {
      throw new ConflictException({ code: 'TOO_LATE', message: 'The shop already accepted this order. Contact them, or report a problem after delivery.' });
    }
    await this.cancelPart(o, p, 'student', 'Cancelled by the student', ['placed']);
    return this.myOrder(userId, orderId);
  }

  async studentDispute(userId: string, orderId: string, partId: string, dto: DisputeDto) {
    const o = await this.ownedOrder(userId, orderId);
    const p = this.partOf(o, partId);
    const view = await this.myOrder(userId, orderId);
    if (!view.parts.find((x) => x._id === String(partId))?.canDispute) {
      throw new ConflictException({ code: 'DISPUTE_CLOSED', message: 'The time to report a problem with this delivery is over.' });
    }
    const res = await this.orders.updateOne(
      { _id: o._id, parts: { $elemMatch: { _id: p._id, status: 'delivered', dispute: { $exists: false } } } },
      {
        $set: {
          'parts.$.status': 'disputed',
          'parts.$.dispute': { reason: dto.reason, text: dto.text?.trim(), photos: dto.photos ?? [], openedAt: new Date(), status: 'open' },
          // The shop isn't paid for this part until an admin decides
          'parts.$.payout.status': 'held',
        },
        $push: { 'parts.$.timeline': { status: 'disputed', at: new Date() } },
      },
    );
    if (!res.modifiedCount) throw new ConflictException({ code: 'DISPUTE_CLOSED', message: 'A problem was already reported for this delivery.' });
    const shop: any = await this.shops.findById(p.shopId).select('ownerId').lean();
    if (shop?.ownerId) {
      await this.notify(String(shop.ownerId), '/essentials/partner',
        { title: 'A customer reported a problem', message: `Order ${o.number}: HoroHouse will look at it and contact you.` },
        { title: 'Un client a signalé un problème', message: `Commande ${o.number} : HoroHouse va l’examiner et vous contacter.` },
        { orderId: String(o._id), partId: String(p._id) });
    }
    await this.notifications.notifyAdmins({
      title: 'Essentials dispute',
      message: `Order ${o.number} (${p.shopName}): ${dto.reason}${dto.text ? ` — ${dto.text.slice(0, 200)}` : ''}`,
      link: '/admin/essentials',
      metadata: { orderId: String(o._id), partId: String(p._id) },
    });
    return this.myOrder(userId, orderId);
  }

  async studentRate(userId: string, orderId: string, partId: string, dto: RateDto) {
    const o = await this.ownedOrder(userId, orderId);
    const p = this.partOf(o, partId);
    const view = await this.myOrder(userId, orderId);
    if (!view.parts.find((x) => x._id === String(partId))?.canRate) throw new ConflictException({ code: 'CANT_RATE', message: 'You can rate this shop after delivery.' });
    const res = await this.orders.updateOne(
      { _id: o._id, parts: { $elemMatch: { _id: p._id, rating: { $exists: false } } } },
      { $set: { 'parts.$.rating': dto.rating, 'parts.$.review': dto.review?.trim(), 'parts.$.ratedAt': new Date() } },
    );
    if (res.modifiedCount) {
      const shop: any = await this.shops.findById(p.shopId).select('rating ratingCount').lean();
      if (shop) {
        const count = (shop.ratingCount ?? 0) + 1;
        const avg = ((shop.rating ?? 0) * (count - 1) + dto.rating) / count;
        await this.shops.updateOne({ _id: p.shopId }, { $set: { rating: avg, ratingCount: count } });
      }
    }
    return this.myOrder(userId, orderId);
  }

  // ════════════════════════════════════════════════════════════════════════
  // Order steps shared with shops and admins
  // ════════════════════════════════════════════════════════════════════════

  checkCode(partId: string, code: string): boolean {
    return deliveryCode(this.codeSecret, partId) === code;
  }

  async markDelivered(o: EssOrderDocument, p: OrderPart, by: 'shop' | 'student' | 'admin') {
    const market = await this.market();
    const now = new Date();
    const res = await this.orders.updateOne(
      { _id: o._id, parts: { $elemMatch: { _id: p._id, status: { $in: LIVE } } } },
      {
        $set: {
          'parts.$.status': 'delivered',
          'parts.$.deliveredAt': now,
          'parts.$.payout': { status: 'held', releaseAt: new Date(now.getTime() + market.holdHours * 3_600_000) },
        },
        $push: { 'parts.$.timeline': { status: 'delivered', at: now, note: by === 'student' ? 'confirmed by the customer' : undefined } },
      },
    );
    if (!res.modifiedCount) throw new ConflictException({ code: 'NOT_ON_THE_WAY', message: 'This order isn’t on its way.' });
    await this.shops.updateOne({ _id: p.shopId }, { $inc: { deliveredCount: 1 } });
    await this.closeIfDone(String(o._id));
    await this.notify(String(o.userId), `/essentials/orders/${o._id}`,
      { title: 'Delivered', message: `${p.shopName} delivered your order ${o.number}. How was it? Rate the shop.` },
      { title: 'Livré', message: `${p.shopName} a livré votre commande ${o.number}. Comment ça s’est passé ? Notez la boutique.` },
      { orderId: String(o._id), partId: String(p._id) });
  }

  /** Moves a part one step (accepted → packed → out) and tells the student */
  async step(o: EssOrderDocument, p: OrderPart, from: PartStatus[], to: PartStatus) {
    const now = new Date();
    const set: any = { 'parts.$.status': to };
    if (to === 'accepted') set['parts.$.acceptedAt'] = now;
    const res = await this.orders.updateOne(
      { _id: o._id, status: 'paid', parts: { $elemMatch: { _id: p._id, status: { $in: from } } } },
      { $set: set, $push: { 'parts.$.timeline': { status: to, at: now } } },
    );
    if (!res.modifiedCount) throw new ConflictException({ code: 'WRONG_STEP', message: 'This order has moved on. Refresh to see where it is.' });
    const texts: Record<string, [Lang2, Lang2]> = {
      accepted: [both('Order accepted'), both('Commande acceptée')],
      packed: [both('Order packed'), both('Commande prête')],
      out: [both('Out for delivery'), both('En cours de livraison')],
    };
    const msg: Record<string, [string, string]> = {
      accepted: [`${p.shopName} accepted order ${o.number}. Delivery on ${o.delivery.date}.`, `${p.shopName} a accepté la commande ${o.number}. Livraison le ${o.delivery.date}.`],
      packed: [`${p.shopName} packed your order ${o.number}.`, `${p.shopName} a préparé votre commande ${o.number}.`],
      out: [`${p.shopName} is on the way with order ${o.number}. Have your delivery code ready.`, `${p.shopName} est en route avec la commande ${o.number}. Préparez votre code de livraison.`],
    };
    if (texts[to]) {
      await this.notify(String(o.userId), `/essentials/orders/${o._id}`,
        { title: texts[to][0].en, message: msg[to][0] }, { title: texts[to][1].fr, message: msg[to][1] }, { orderId: String(o._id) });
    }
  }

  /**
   * Cancels a part and refunds it to the student through CamerPay. When it was the last live
   * part of the order, the service fee goes back too.
   */
  async cancelPart(o: EssOrderDocument, p: OrderPart, by: 'student' | 'shop' | 'system' | 'admin', reason: string, from: PartStatus[]) {
    const others = o.parts.filter((x) => String(x._id) !== String(p._id));
    const lastOne = others.every((x) => x.status === 'cancelled');
    const amount = p.subtotal + p.deliveryFee + (lastOne ? o.serviceFee : 0);
    const now = new Date();
    const res = await this.orders.updateOne(
      { _id: o._id, parts: { $elemMatch: { _id: p._id, status: { $in: from } } } },
      {
        $set: {
          'parts.$.status': 'cancelled',
          'parts.$.cancelReason': reason,
          'parts.$.cancelledBy': by,
          'parts.$.payout': { status: 'none' },
          'parts.$.refund': { amount, status: 'pending' },
        },
        $push: { 'parts.$.timeline': { status: 'cancelled', at: now, note: reason } },
      },
    );
    if (!res.modifiedCount) throw new ConflictException({ code: 'WRONG_STEP', message: 'This order has moved on. Refresh to see where it is.' });
    // Items go back on the shelf
    for (const l of p.lines) if (l.kind === 'item') await this.itemOffers.updateOne({ _id: l.offerId }, { $inc: { stock: l.qty } });
    await this.refund(String(o._id), String(p._id), amount, `HoroHouse ${o.number}: ${reason}`.slice(0, 120));
    await this.closeIfDone(String(o._id));
    const who = by === 'shop' ? `${p.shopName} couldn’t take this order` : by === 'system' ? `${p.shopName} didn’t accept in time` : 'The order was cancelled';
    const whoFr = by === 'shop' ? `${p.shopName} ne peut pas prendre cette commande` : by === 'system' ? `${p.shopName} n’a pas accepté à temps` : 'La commande est annulée';
    await this.notify(String(o.userId), `/essentials/orders/${o._id}`,
      { title: 'Order cancelled', message: `${who} (${o.number}). ${this.money(amount)} is on its way back to you.` },
      { title: 'Commande annulée', message: `${whoFr} (${o.number}). ${this.money(amount)} vous est remboursé.` },
      { orderId: String(o._id) });
    if (by !== 'shop') {
      const shop: any = await this.shops.findById(p.shopId).select('ownerId').lean();
      if (shop?.ownerId) {
        await this.notify(String(shop.ownerId), '/essentials/partner',
          { title: 'Order cancelled', message: `Order ${o.number} was cancelled: ${reason}.` },
          { title: 'Commande annulée', message: `La commande ${o.number} est annulée : ${reason}.` },
          { orderId: String(o._id) });
      }
    }
  }

  /** Sends money back through CamerPay; a failure goes to the admins to do by hand */
  async refund(orderId: string, partId: string, amount: number, reason: string): Promise<boolean> {
    const o: any = await this.orders.findById(orderId).select('number payment').lean();
    const ref = o?.payment?.providerReference;
    const set = async (status: 'done' | 'failed', error?: string) => {
      await this.orders.updateOne(
        { _id: orderId, 'parts._id': new Types.ObjectId(partId) },
        { $set: { 'parts.$.refund': { amount, status, error, at: new Date() } } },
      );
    };
    if (!(amount > 0)) { await set('done'); return true; }
    try {
      if (!ref) throw new Error('No CamerPay reference on this order');
      const camerPay = this.moduleRef.get(CamerPayService, { strict: false });
      await camerPay.refundPayment(ref, amount, reason);
      await set('done');
      return true;
    } catch (err: any) {
      const msg = String(err?.message ?? err).slice(0, 300);
      await set('failed', msg);
      await this.notifications.notifyAdmins({
        title: 'Essentials refund failed',
        message: `Order ${o?.number}: refund of ${this.money(amount)} failed (${msg}). Refund the student in CamerPay, then mark it done in Admin → Essentials.`,
        link: '/admin/essentials',
        metadata: { orderId, partId, amount },
      });
      return false;
    }
  }

  async closeIfDone(orderId: string) {
    const o: any = await this.orders.findById(orderId).select('status parts.status parts.dispute').lean();
    if (!o || o.status !== 'paid') return;
    const done = o.parts.every((p: any) => p.status === 'cancelled' || p.status === 'delivered' || (p.status === 'disputed' && p.dispute?.status === 'resolved'));
    if (done) await this.orders.updateOne({ _id: orderId, status: 'paid' }, { $set: { status: 'closed' } });
  }

  async notify(userId: string, link: string, en: { title: string; message: string }, fr: { title: string; message: string }, metadata: Record<string, any> = {}) {
    try {
      await this.notifications.create({ userId, type: NotificationType.ESSENTIALS, title: en.title, message: en.message, link, metadata } as any, fr);
    } catch (err: any) {
      this.logger.warn(`Essentials notice to ${userId} failed: ${err?.message ?? err}`);
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  // Background jobs
  // ════════════════════════════════════════════════════════════════════════

  async expireUnpaid(): Promise<number> {
    const r = await this.orders.updateMany({ status: 'pending_payment', expiresAt: { $lt: new Date() } }, { $set: { status: 'expired' } });
    return r.modifiedCount;
  }

  /** Shops that don't accept in time: a reminder at 30 minutes, then cancel and refund */
  async chaseShops(): Promise<void> {
    const market = await this.market();
    const now = Date.now();
    const remindBefore = new Date(now - 30 * 60_000);
    const cancelBefore = new Date(now - market.acceptHours * 3_600_000);
    const orders = await this.orders.find({ status: 'paid', 'parts.status': 'placed', 'payment.paidAt': { $lt: remindBefore } }).limit(100);
    for (const o of orders) {
      for (const p of o.parts) {
        if (p.status !== 'placed') continue;
        const paidAt = new Date(o.payment?.paidAt ?? o.createdAt ?? now);
        try {
          if (paidAt < cancelBefore) {
            await this.cancelPart(o, p, 'system', 'Not accepted in time', ['placed']);
          } else if (!p.remindedAt) {
            await this.orders.updateOne({ _id: o._id, 'parts._id': p._id }, { $set: { 'parts.$.remindedAt': new Date() } });
            const shop: any = await this.shops.findById(p.shopId).select('ownerId').lean();
            if (shop?.ownerId) {
              await this.notify(String(shop.ownerId), '/essentials/partner',
                { title: 'An order is waiting', message: `Order ${o.number} is waiting for you. Accept it soon or it will be cancelled.` },
                { title: 'Une commande attend', message: `La commande ${o.number} vous attend. Acceptez-la vite, sinon elle sera annulée.` },
                { orderId: String(o._id) });
            }
          }
        } catch (err: any) {
          this.logger.warn(`Chasing part ${p._id} failed: ${err?.message ?? err}`);
        }
      }
    }
  }

  /** After the hold, delivered parts without an open problem are ready to pay out */
  async releaseHeld(): Promise<number> {
    const r = await this.orders.updateMany(
      { 'parts.payout.status': 'held' },
      { $set: { 'parts.$[p].payout.status': 'ready' } },
      { arrayFilters: [{ 'p.status': 'delivered', 'p.payout.status': 'held', 'p.payout.releaseAt': { $lte: new Date() } }] },
    );
    return r.modifiedCount;
  }

  // ════════════════════════════════════════════════════════════════════════
  // Helpers for the other services
  // ════════════════════════════════════════════════════════════════════════

  async orderWithPart(partId: string): Promise<{ o: EssOrderDocument; p: OrderPart }> {
    if (!isValidObjectId(partId)) throw new NotFoundException('Order not found');
    const o = await this.orders.findOne({ 'parts._id': new Types.ObjectId(partId) });
    if (!o) throw new NotFoundException('Order not found');
    return { o, p: this.partOf(o, partId) };
  }

  assertOwner(shop: any, userId: string) {
    if (!shop || String(shop.ownerId) !== String(userId)) throw new ForbiddenException('Not your shop');
  }
}
