import { BadRequestException, ConflictException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model, Types } from 'mongoose';
import { AdminOrdersQueryDto, AdminShopsQueryDto, InviteShopDto, ItemTypeDto, MarketDto, ResolveDisputeDto, SendPayoutDto, TemplateDto } from './dto/essentials.dto';
import { EssentialsService } from './essentials.service';
import { cityKey, escapeRegex, inviteCode, slugify } from './essentials.util';
import { EssPayout, EssPayoutDocument } from './schemas/essentials.schema';

const COUNTRY = 'CM';

@Injectable()
export class EssentialsAdminService {
  constructor(
    private readonly ess: EssentialsService,
    @InjectModel(EssPayout.name) private readonly payouts: Model<EssPayoutDocument>,
  ) {}

  // ── Overview ──────────────────────────────────────────────────────────────

  async overview() {
    const [pending, approved, disputes, late, ready, failedRefunds] = await Promise.all([
      this.ess.shops.countDocuments({ status: 'pending', submittedAt: { $exists: true } }),
      this.ess.shops.countDocuments({ status: 'approved' }),
      this.ess.orders.countDocuments({ parts: { $elemMatch: { status: 'disputed', 'dispute.status': 'open' } } }),
      this.ess.orders.countDocuments(this.lateFilter()),
      this.readyByShop(),
      this.ess.orders.countDocuments({ 'parts.refund.status': 'failed' }),
    ]);
    return { pendingShops: pending, approvedShops: approved, openDisputes: disputes, lateOrders: late, readyPayouts: ready.length, failedRefunds };
  }

  // ── Shops ─────────────────────────────────────────────────────────────────

  async shops(q: AdminShopsQueryDto) {
    const filter: any = {};
    if (q.status) filter.status = q.status;
    if (q.status === 'pending') filter.submittedAt = { $exists: true };
    if (q.q?.trim()) filter.$or = [{ name: new RegExp(escapeRegex(q.q.trim()), 'i') }, { city: new RegExp(escapeRegex(q.q.trim()), 'i') }];
    const list = await this.ess.shops.find(filter).sort({ submittedAt: -1, createdAt: -1 }).limit(200).lean();
    const owners = await this.ess.users.find({ _id: { $in: list.map((s) => s.ownerId).filter(Boolean) } }).select('name email phoneNumber').lean();
    const oById = new Map(owners.map((u: any) => [String(u._id), u]));
    return list.map((s: any) => ({
      ...s,
      _id: String(s._id),
      owner: s.ownerId ? { name: (oById.get(String(s.ownerId)) as any)?.name, email: (oById.get(String(s.ownerId)) as any)?.email, phone: (oById.get(String(s.ownerId)) as any)?.phoneNumber } : null,
    }));
  }

  private async shopOr404(id: string) {
    if (!isValidObjectId(id)) throw new NotFoundException('Shop not found');
    const s = await this.ess.shops.findById(id);
    if (!s) throw new NotFoundException('Shop not found');
    return s;
  }

  async setStatus(id: string, action: 'approve' | 'reject' | 'suspend' | 'reinstate', reason?: string) {
    const s = await this.shopOr404(id);
    const allowed: Record<string, string[]> = { approve: ['pending', 'rejected'], reject: ['pending'], suspend: ['approved'], reinstate: ['suspended'] };
    if (!allowed[action].includes(s.status)) throw new ConflictException(`A ${s.status} shop can’t be changed this way`);
    if ((action === 'reject' || action === 'suspend') && !reason?.trim()) throw new BadRequestException('Give a reason the shop will see');
    s.status = action === 'approve' || action === 'reinstate' ? 'approved' : action === 'reject' ? 'rejected' : 'suspended';
    s.statusReason = reason?.trim() || undefined;
    if (action === 'approve') s.approvedAt = new Date();
    await s.save();
    if (s.ownerId) {
      const texts = {
        approve: [{ title: 'Your shop is approved', message: `${s.name} is now a verified HoroHouse partner. Add your kits and items so students can order.` }, { title: 'Votre boutique est approuvée', message: `${s.name} est maintenant partenaire vérifié HoroHouse. Ajoutez vos kits et articles pour recevoir des commandes.` }],
        reject: [{ title: 'Application not approved', message: `Your application for ${s.name} wasn’t approved: ${reason}. You can fix it and send it again.` }, { title: 'Demande non approuvée', message: `La demande pour ${s.name} n’a pas été approuvée : ${reason}. Vous pouvez corriger et renvoyer.` }],
        suspend: [{ title: 'Shop suspended', message: `${s.name} is hidden from students: ${reason}. Finish your open orders.` }, { title: 'Boutique suspendue', message: `${s.name} est masquée : ${reason}. Terminez vos commandes en cours.` }],
        reinstate: [{ title: 'Shop back online', message: `${s.name} is visible to students again.` }, { title: 'Boutique de nouveau en ligne', message: `${s.name} est de nouveau visible.` }],
      }[action];
      await this.ess.notify(String(s.ownerId), '/essentials/partner', texts[0], texts[1], { shopId: String(s._id) });
    }
    return { ok: true, status: s.status };
  }

  /** Creates a shop waiting for its owner; the owner types the code on the apply screen */
  async invite(dto: InviteShopDto) {
    let slug = slugify(dto.name);
    if (await this.ess.shops.exists({ slug })) slug = `${slug}-${Date.now().toString(36)}`;
    const code = inviteCode();
    const s = await this.ess.shops.create({
      name: dto.name.trim(),
      slug,
      country: COUNTRY,
      city: dto.city.trim(),
      phone: dto.phone?.replace(/\s/g, '') ?? '',
      zones: [{ city: dto.city.trim(), cityKey: cityKey(dto.city), fee: 1000, minutes: 180 }],
      status: 'invited',
      inviteCode: code,
    });
    return { _id: String(s._id), inviteCode: code };
  }

  // ── Catalogue ─────────────────────────────────────────────────────────────

  async catalogue() {
    const [market, templates, itemTypes] = await Promise.all([
      this.ess.market(),
      this.ess.templates.find({ country: COUNTRY }).sort({ order: 1 }).lean(),
      this.ess.itemTypes.find().sort({ category: 1, order: 1 }).lean(),
    ]);
    const offerCounts = await this.ess.kitOffers.aggregate([{ $group: { _id: '$templateId', n: { $sum: 1 } } }]);
    const oc = new Map(offerCounts.map((x: any) => [String(x._id), x.n]));
    return {
      market,
      templates: templates.map((t: any) => ({ ...t, _id: String(t._id), offerCount: oc.get(String(t._id)) ?? 0 })),
      itemTypes: itemTypes.map((t: any) => ({ ...t, _id: String(t._id) })),
    };
  }

  async updateMarket(dto: MarketDto) {
    const set: any = { ...dto };
    if (dto.cities) set.cities = [...new Set(dto.cities.map((c) => c.trim()).filter(Boolean))];
    await this.ess.markets.updateOne({ country: COUNTRY }, { $set: set });
    return this.ess.market();
  }

  async saveTemplate(id: string | null, dto: TemplateDto) {
    if (dto.lines) {
      const keys = dto.lines.map((l) => l.itemTypeKey);
      const found = await this.ess.itemTypes.countDocuments({ key: { $in: keys } });
      if (found !== new Set(keys).size) throw new BadRequestException('A kit line uses an unknown item type');
    }
    if (!id) {
      if (!dto.key || !dto.name?.en || !dto.lines?.length) throw new BadRequestException('A new kit needs a key, a name and at least one line');
      const t = await this.ess.templates.create({ ...dto, country: COUNTRY });
      return { _id: String(t._id) };
    }
    if (!isValidObjectId(id)) throw new NotFoundException('Kit not found');
    const { key: _key, ...rest } = dto;
    const r = await this.ess.templates.updateOne({ _id: id }, { $set: rest });
    if (!r.matchedCount) throw new NotFoundException('Kit not found');
    return { _id: id };
  }

  async saveItemType(key: string | null, dto: ItemTypeDto) {
    if (!key) {
      if (!dto.key || !dto.name?.en || !dto.name?.fr || !dto.category) throw new BadRequestException('A new item type needs a key, names in English and French, and a category');
      if (await this.ess.itemTypes.exists({ key: dto.key })) throw new ConflictException('This key exists already');
      await this.ess.itemTypes.create({ ...dto, order: 999 });
      return { key: dto.key };
    }
    const { key: _k, ...rest } = dto;
    const r = await this.ess.itemTypes.updateOne({ key }, { $set: rest });
    if (!r.matchedCount) throw new NotFoundException('Item type not found');
    return { key };
  }

  // ── Orders and disputes ───────────────────────────────────────────────────

  private lateFilter() {
    const twoHours = new Date(Date.now() - 2 * 3_600_000);
    const today = new Date().toISOString().slice(0, 10);
    return {
      status: 'paid',
      $or: [
        { parts: { $elemMatch: { status: 'placed' } }, 'payment.paidAt': { $lt: twoHours } },
        { 'delivery.date': { $lt: today }, parts: { $elemMatch: { status: { $in: ['accepted', 'packed', 'out'] } } } },
      ],
    };
  }

  async orders(q: AdminOrdersQueryDto) {
    const view = q.view ?? 'active';
    let filter: any = {};
    if (view === 'late') filter = this.lateFilter();
    else if (view === 'disputed') filter = { $or: [{ parts: { $elemMatch: { status: 'disputed', 'dispute.status': 'open' } } }, { 'parts.refund.status': 'failed' }] };
    else if (view === 'active') filter = { status: 'paid' };
    else if (view === 'done') filter = { status: 'closed' };
    else filter = { status: { $in: ['paid', 'closed'] } };
    if (q.city?.trim()) filter['delivery.city'] = new RegExp(`^${escapeRegex(q.city.trim())}$`, 'i');
    const list = await this.ess.orders.find(filter).sort({ createdAt: -1 }).limit(150).lean();
    return list.map((o: any) => ({ ...o, _id: String(o._id) }));
  }

  async resolveDispute(partId: string, dto: ResolveDisputeDto) {
    const { o, p } = await this.ess.orderWithPart(partId);
    if (p.status !== 'disputed' || p.dispute?.status !== 'open') throw new ConflictException('No open problem on this order');
    const max = p.subtotal + p.deliveryFee;
    const amount = dto.decision === 'refund_full' ? max : dto.decision === 'refund_partial' ? Math.min(max, Math.max(1, dto.amount ?? 0)) : 0;
    if (dto.decision === 'refund_partial' && !dto.amount) throw new BadRequestException('Give the amount to refund');
    const now = new Date();
    // Full refund: the shop gets nothing. Partial: the refund comes out of the shop's share.
    const netAfter = dto.decision === 'refund_full' ? 0 : Math.max(0, p.net - amount);
    const res = await this.ess.orders.updateOne(
      { _id: o._id, parts: { $elemMatch: { _id: p._id, 'dispute.status': 'open' } } },
      {
        $set: {
          'parts.$.dispute.status': 'resolved',
          'parts.$.dispute.decision': dto.decision,
          'parts.$.dispute.note': dto.note?.trim(),
          'parts.$.dispute.resolvedAt': now,
          'parts.$.net': netAfter,
          'parts.$.payout': netAfter > 0 ? { status: 'ready' } : { status: 'none' },
          ...(amount > 0 ? { 'parts.$.refund': { amount, status: 'pending' } } : {}),
        },
        $push: { 'parts.$.timeline': { status: 'resolved', at: now, note: dto.decision } },
      },
    );
    if (!res.modifiedCount) throw new ConflictException('This problem was already handled');
    if (amount > 0) await this.ess.refund(String(o._id), String(p._id), amount, `HoroHouse ${o.number}: problem with the delivery`);
    await this.ess.closeIfDone(String(o._id));
    const msgEn = amount > 0 ? `We looked at your report for ${o.number}. ${amount.toLocaleString('fr-FR')} FCFA is on its way back to you.` : `We looked at your report for ${o.number}. ${dto.note?.trim() || 'No refund this time.'}`;
    const msgFr = amount > 0 ? `Nous avons examiné votre signalement pour ${o.number}. ${amount.toLocaleString('fr-FR')} FCFA vous est remboursé.` : `Nous avons examiné votre signalement pour ${o.number}. ${dto.note?.trim() || 'Pas de remboursement cette fois.'}`;
    await this.ess.notify(String(o.userId), `/essentials/orders/${o._id}`, { title: 'Your report was handled', message: msgEn }, { title: 'Votre signalement est traité', message: msgFr }, { orderId: String(o._id) });
    return { ok: true, refunded: amount };
  }

  /** After refunding by hand in CamerPay */
  async markRefunded(partId: string) {
    const { o, p } = await this.ess.orderWithPart(partId);
    if (p.refund?.status !== 'failed') throw new ConflictException('No failed refund on this order');
    await this.ess.orders.updateOne({ _id: o._id, 'parts._id': p._id }, { $set: { 'parts.$.refund.status': 'done', 'parts.$.refund.error': 'refunded by hand', 'parts.$.refund.at': new Date() } });
    return { ok: true };
  }

  async retryRefund(partId: string) {
    const { o, p } = await this.ess.orderWithPart(partId);
    if (p.refund?.status !== 'failed') throw new ConflictException('No failed refund on this order');
    const ok = await this.ess.refund(String(o._id), String(p._id), p.refund.amount, `HoroHouse ${o.number}: refund`);
    return { ok };
  }

  // ── Payouts (manual: send Mobile Money, then record the reference) ────────

  private async readyByShop() {
    const rows = await this.ess.orders.aggregate([
      { $match: { 'parts.payout.status': 'ready' } },
      { $unwind: '$parts' },
      { $match: { 'parts.payout.status': 'ready' } },
      {
        $group: {
          _id: '$parts.shopId',
          shopName: { $first: '$parts.shopName' },
          gross: { $sum: { $add: ['$parts.subtotal', '$parts.deliveryFee'] } },
          commission: { $sum: '$parts.commission' },
          net: { $sum: '$parts.net' },
          count: { $sum: 1 },
        },
      },
      { $sort: { net: -1 } },
    ]);
    return rows;
  }

  async payoutsView() {
    const ready = await this.readyByShop();
    const shops = await this.ess.shops.find({ _id: { $in: ready.map((r: any) => r._id) } }).select('payoutMethod name').lean();
    const sById = new Map(shops.map((s: any) => [String(s._id), s]));
    const history = await this.payouts.find().sort({ sentAt: -1 }).limit(100).lean();
    return {
      ready: ready.map((r: any) => ({ shopId: String(r._id), shopName: r.shopName, gross: r.gross, commission: r.commission, net: r.net, count: r.count, payoutMethod: (sById.get(String(r._id)) as any)?.payoutMethod })),
      history: history.map((h: any) => ({ ...h, _id: String(h._id) })),
    };
  }

  async sendPayout(adminId: string, dto: SendPayoutDto) {
    const shop: any = await this.ess.shops.findById(dto.shopId).lean();
    if (!shop) throw new NotFoundException('Shop not found');
    const orders = await this.ess.orders.find({ parts: { $elemMatch: { shopId: shop._id, 'payout.status': 'ready' } } });
    const parts = orders.flatMap((o) => o.parts.filter((p) => String(p.shopId) === String(shop._id) && p.payout?.status === 'ready').map((p) => ({ o, p })));
    if (!parts.length) throw new UnprocessableEntityException('Nothing to pay this shop');
    const payoutId = new Types.ObjectId();
    // Claim each part first, so two admins can't pay the same part twice
    const claimed: typeof parts = [];
    for (const x of parts) {
      const r = await this.ess.orders.updateOne(
        { _id: x.o._id, parts: { $elemMatch: { _id: x.p._id, 'payout.status': 'ready' } } },
        { $set: { 'parts.$.payout.status': 'paid', 'parts.$.payout.payoutId': payoutId } },
      );
      if (r.modifiedCount) claimed.push(x);
    }
    if (!claimed.length) throw new ConflictException('Another admin just paid this shop');
    const gross = claimed.reduce((n, x) => n + x.p.subtotal + x.p.deliveryFee, 0);
    const commission = claimed.reduce((n, x) => n + x.p.commission, 0);
    const net = claimed.reduce((n, x) => n + x.p.net, 0);
    const p = await this.payouts.create({
      _id: payoutId,
      shopId: shop._id,
      shopName: shop.name,
      parts: claimed.map((x) => ({ orderId: String(x.o._id), partId: String(x.p._id), number: x.o.number })),
      gross,
      commission,
      net,
      reference: dto.reference.trim(),
      to: shop.payoutMethod,
      sentBy: new Types.ObjectId(adminId),
      sentAt: new Date(),
    });
    if (shop.ownerId) {
      await this.ess.notify(String(shop.ownerId), '/essentials/partner',
        { title: 'Payout sent', message: `${net.toLocaleString('fr-FR')} FCFA for ${claimed.length} order(s) was sent to your Mobile Money (ref. ${p.reference}).` },
        { title: 'Paiement envoyé', message: `${net.toLocaleString('fr-FR')} FCFA pour ${claimed.length} commande(s) envoyés sur votre Mobile Money (réf. ${p.reference}).` },
        { payoutId: String(p._id) });
    }
    return { _id: String(p._id), net, count: claimed.length };
  }

  // ── Insights ──────────────────────────────────────────────────────────────

  async insights() {
    const since = new Date(Date.now() - 30 * 86_400_000);
    const [byCity, topLines, demand, totals] = await Promise.all([
      this.ess.orders.aggregate([
        { $match: { status: { $in: ['paid', 'closed'] }, createdAt: { $gte: since } } },
        { $group: { _id: '$delivery.city', orders: { $sum: 1 }, total: { $sum: '$total' } } },
        { $sort: { orders: -1 } },
      ]),
      this.ess.orders.aggregate([
        { $match: { status: { $in: ['paid', 'closed'] }, createdAt: { $gte: since } } },
        { $unwind: '$parts' },
        { $unwind: '$parts.lines' },
        { $group: { _id: '$parts.lines.name.en', icon: { $first: '$parts.lines.icon' }, iconKey: { $first: '$parts.lines.iconKey' }, qty: { $sum: '$parts.lines.qty' } } },
        { $sort: { qty: -1 } },
        { $limit: 10 },
      ]),
      this.ess.interest.aggregate([{ $group: { _id: '$city', n: { $sum: 1 } } }, { $sort: { n: -1 } }, { $limit: 15 }]),
      this.ess.orders.aggregate([
        { $match: { status: { $in: ['paid', 'closed'] }, createdAt: { $gte: since } } },
        { $group: { _id: null, orders: { $sum: 1 }, total: { $sum: '$total' }, commission: { $sum: '$commission' }, fees: { $sum: '$serviceFee' } } },
      ]),
    ]);
    const t = totals[0] ?? { orders: 0, total: 0, commission: 0, fees: 0 };
    return {
      last30: { orders: t.orders, sales: t.total, revenue: t.commission + t.fees },
      byCity: byCity.map((c: any) => ({ city: c._id, orders: c.orders, total: c.total })),
      top: topLines.map((l: any) => ({ name: l._id, icon: l.icon, iconKey: l.iconKey, qty: l.qty })),
      demand: demand.map((d: any) => ({ city: d._id, count: d.n })),
    };
  }
}
