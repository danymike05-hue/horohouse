import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

/**
 * Essential kits: partner shops sell kits (set by HoroHouse per country) and single items
 * to students. HoroHouse takes the payment, holds it until delivery is confirmed, then pays
 * the shop minus a commission. See docs/essential-kits-plan.md.
 */

export type Lang2 = { en: string; fr: string };

// ── Market (one per country) ────────────────────────────────────────────────

@Schema({ collection: 'ess_markets', timestamps: true })
export class EssMarket {
  /** ISO code, e.g. "CM" */
  @Prop({ required: true, unique: true }) country!: string;
  @Prop({ required: true }) name!: string;
  @Prop({ required: true, default: 'XAF' }) currency!: string;
  @Prop({ type: Number, default: 12, min: 0, max: 50 }) commissionPct!: number;
  /** Paid by the student, once per order */
  @Prop({ type: Number, default: 500, min: 0 }) serviceFee!: number;
  /** Hours a shop has to accept a paid order before it is cancelled and refunded */
  @Prop({ type: Number, default: 2, min: 1, max: 48 }) acceptHours!: number;
  /** Hours after delivery before the shop's money is released */
  @Prop({ type: Number, default: 48, min: 0, max: 336 }) holdHours!: number;
  /** Cities students can pick, even without a shop yet (demand capture) */
  @Prop({ type: [String], default: [] }) cities!: string[];
  @Prop({ type: Boolean, default: true }) isActive!: boolean;
}
export type EssMarketDocument = HydratedDocument<EssMarket>;
export const EssMarketSchema = SchemaFactory.createForClass(EssMarket);

// ── Item types (shared catalogue) ───────────────────────────────────────────

export const ESS_CATEGORIES = ['bedroom', 'kitchen', 'cleaning', 'furniture', 'study', 'bathroom'] as const;
export type EssCategory = (typeof ESS_CATEGORIES)[number];

@Schema({ collection: 'ess_item_types', timestamps: true })
export class EssItemType {
  @Prop({ required: true, unique: true }) key!: string;
  @Prop({ type: Object, required: true }) name!: Lang2;
  @Prop({ type: String, enum: ESS_CATEGORIES, required: true, index: true }) category!: EssCategory;
  /** An emoji shown on tiles and lines */
  @Prop({ default: '📦' }) icon!: string;
  /** large = motorbike or tricycle delivery */
  @Prop({ type: String, enum: ['small', 'medium', 'large'], default: 'small' }) size!: 'small' | 'medium' | 'large';
  @Prop({ type: Boolean, default: false }) electrical!: boolean;
  @Prop({ type: Object, default: { en: [], fr: [] } }) keywords!: { en: string[]; fr: string[] };
  @Prop({ type: Number, default: 0 }) order!: number;
}
export type EssItemTypeDocument = HydratedDocument<EssItemType>;
export const EssItemTypeSchema = SchemaFactory.createForClass(EssItemType);

// ── Kit templates (set by HoroHouse, per country) ───────────────────────────

export interface KitLine { itemTypeKey: string; qty: number; removable: boolean }
export interface KitOption { key: string; label: Lang2; values: { key: string; label: Lang2 }[] }

@Schema({ collection: 'ess_kit_templates', timestamps: true })
export class EssKitTemplate {
  @Prop({ required: true, index: true }) country!: string;
  @Prop({ required: true }) key!: string;
  @Prop({ type: Object, required: true }) name!: Lang2;
  @Prop({ type: Object, default: { en: '', fr: '' } }) description!: Lang2;
  @Prop({ default: '🧺' }) icon!: string;
  @Prop() image?: string;
  @Prop({ type: [Object], default: [] }) lines!: KitLine[];
  @Prop({ type: [Object], default: [] }) options!: KitOption[];
  @Prop({ type: Boolean, default: true }) isActive!: boolean;
  @Prop({ type: Number, default: 0 }) order!: number;
}
export type EssKitTemplateDocument = HydratedDocument<EssKitTemplate>;
export const EssKitTemplateSchema = SchemaFactory.createForClass(EssKitTemplate);
EssKitTemplateSchema.index({ country: 1, key: 1 }, { unique: true });

// ── Shops ───────────────────────────────────────────────────────────────────

export type ShopStatus = 'invited' | 'pending' | 'approved' | 'rejected' | 'suspended';
/** cityKey: the city without accents or case, for matching ("yaounde") */
export interface ShopZone { city: string; cityKey: string; district?: string; fee: number; minutes: number }

@Schema({ collection: 'ess_shops', timestamps: true })
export class EssShop {
  /** Empty while an admin invite hasn't been claimed */
  @Prop({ type: Types.ObjectId, ref: 'User', index: true }) ownerId?: Types.ObjectId;
  @Prop({ required: true }) name!: string;
  @Prop({ required: true, unique: true }) slug!: string;
  @Prop({ required: true, default: 'CM' }) country!: string;
  @Prop({ required: true, index: true }) city!: string;
  @Prop({ default: '' }) address!: string;
  @Prop({ type: Object }) location?: { lat: number; lng: number };
  @Prop({ default: '' }) phone!: string;
  @Prop() whatsapp?: string;
  @Prop() about?: string;
  @Prop() logo?: string;
  @Prop({ type: [String], default: [] }) photos!: string[];
  /** Registration and owner ID. Admins only, never sent to students */
  @Prop({ type: [Object], default: [] }) documents!: { kind: 'registration' | 'id' | 'other'; url: string }[];
  @Prop({ type: Object }) payoutMethod?: { provider: 'mtn_momo' | 'orange_money'; number: string; name: string };
  @Prop({ type: [Object], default: [] }) zones!: ShopZone[];
  @Prop({ type: Number, default: 0, min: 0 }) minOrder!: number;
  @Prop() openingHours?: string;
  @Prop({ type: String, enum: ['invited', 'pending', 'approved', 'rejected', 'suspended'], default: 'pending', index: true })
  status!: ShopStatus;
  @Prop() statusReason?: string;
  /** Holiday switch: the shop stays approved but is hidden */
  @Prop({ type: Boolean, default: false }) paused!: boolean;
  /** Admin invite: the owner types it on the apply screen to claim the shop */
  @Prop({ index: true, sparse: true }) inviteCode?: string;
  @Prop({ type: Number, default: 0 }) rating!: number;
  @Prop({ type: Number, default: 0 }) ratingCount!: number;
  @Prop({ type: Number, default: 0 }) deliveredCount!: number;
  @Prop() approvedAt?: Date;
  @Prop() submittedAt?: Date;
  createdAt?: Date;
}
export type EssShopDocument = HydratedDocument<EssShop>;
export const EssShopSchema = SchemaFactory.createForClass(EssShop);
EssShopSchema.index({ status: 1, 'zones.cityKey': 1 });

// ── Offers ──────────────────────────────────────────────────────────────────

@Schema({ collection: 'ess_kit_offers', timestamps: true })
export class EssKitOffer {
  @Prop({ type: Types.ObjectId, ref: 'EssShop', required: true, index: true }) shopId!: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'EssKitTemplate', required: true, index: true }) templateId!: Types.ObjectId;
  @Prop({ type: Number, required: true, min: 0 }) price!: number;
  /** "bed:double" → +6000 */
  @Prop({ type: Object, default: {} }) optionPrices!: Record<string, number>;
  /** itemTypeKey → price cut when the student removes that line */
  @Prop({ type: Object, default: {} }) removeDiscounts!: Record<string, number>;
  @Prop({ type: [String], default: [] }) photos!: string[];
  @Prop({ type: Boolean, default: true }) available!: boolean;
  @Prop({ type: Number, default: 24, min: 0 }) prepHours!: number;
}
export type EssKitOfferDocument = HydratedDocument<EssKitOffer>;
export const EssKitOfferSchema = SchemaFactory.createForClass(EssKitOffer);
EssKitOfferSchema.index({ shopId: 1, templateId: 1 }, { unique: true });

export interface ItemOption { key: string; label: string; values: { key: string; label: string; extra: number }[] }

@Schema({ collection: 'ess_item_offers', timestamps: true })
export class EssItemOffer {
  @Prop({ type: Types.ObjectId, ref: 'EssShop', required: true, index: true }) shopId!: Types.ObjectId;
  @Prop({ required: true, index: true }) itemTypeKey!: string;
  @Prop({ required: true }) title!: string;
  @Prop() brand?: string;
  @Prop() description?: string;
  @Prop({ type: Number, required: true, min: 0 }) price!: number;
  @Prop({ type: [Object], default: [] }) options!: ItemOption[];
  @Prop({ type: [String], default: [] }) photos!: string[];
  @Prop({ type: Number, default: 0, min: 0 }) stock!: number;
  @Prop({ type: Number, min: 0 }) warrantyDays?: number;
  @Prop({ type: Boolean, default: false }) assembly!: boolean;
  @Prop({ type: Boolean, default: true }) isActive!: boolean;
}
export type EssItemOfferDocument = HydratedDocument<EssItemOffer>;
export const EssItemOfferSchema = SchemaFactory.createForClass(EssItemOffer);

// ── Cart ────────────────────────────────────────────────────────────────────

export interface CartLine {
  kind: 'kit' | 'item';
  offerId: string;
  qty: number;
  /** Kit: option key → value key. Item: option key → value key */
  options?: Record<string, string>;
  /** Kit only: removable item types the student took out */
  removed?: string[];
}

@Schema({ collection: 'ess_carts', timestamps: true })
export class EssCart {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, unique: true }) userId!: Types.ObjectId;
  @Prop({ default: '' }) city!: string;
  @Prop({ type: [Object], default: [] }) lines!: CartLine[];
}
export type EssCartDocument = HydratedDocument<EssCart>;
export const EssCartSchema = SchemaFactory.createForClass(EssCart);

// ── Orders ──────────────────────────────────────────────────────────────────

export type OrderStatus = 'pending_payment' | 'paid' | 'expired' | 'closed';
export type PartStatus = 'placed' | 'accepted' | 'packed' | 'out' | 'delivered' | 'cancelled' | 'disputed';

/** A copy of the offer at order time, so later price changes never alter the order */
export interface OrderLine {
  kind: 'kit' | 'item';
  offerId: string;
  name: Lang2;
  icon?: string;
  photo?: string;
  unitPrice: number;
  qty: number;
  total: number;
  /** Readable choices: "Bed size: Double (140 cm)" */
  choices: Lang2[];
  /** Kit lines the student removed (names) */
  removed: Lang2[];
  /** Kit contents at order time ("2 × Bed sheet") */
  contents?: Lang2[];
  warrantyDays?: number;
}

export interface OrderPart {
  _id: Types.ObjectId;
  shopId: Types.ObjectId;
  shopName: string;
  lines: OrderLine[];
  subtotal: number;
  deliveryFee: number;
  commission: number;
  /** What the shop gets: subtotal - commission + delivery fee */
  net: number;
  status: PartStatus;
  timeline: { status: string; at: Date; note?: string }[];
  codeTries: number;
  codeLocked?: boolean;
  acceptedAt?: Date;
  deliveredAt?: Date;
  remindedAt?: Date;
  cancelReason?: string;
  cancelledBy?: 'student' | 'shop' | 'system' | 'admin';
  rating?: number;
  review?: string;
  ratedAt?: Date;
  dispute?: {
    reason: 'missing' | 'damaged' | 'wrong' | 'not_delivered' | 'faulty' | 'other';
    text?: string;
    photos: string[];
    openedAt: Date;
    status: 'open' | 'resolved';
    decision?: 'refund_full' | 'refund_partial' | 'no_refund';
    note?: string;
    resolvedAt?: Date;
  };
  /** Money back to the student for this part */
  refund?: { amount: number; status: 'pending' | 'done' | 'failed'; error?: string; at?: Date };
  /** held → ready (after the hold) → paid (payout sent); none when cancelled/refunded */
  payout: { status: 'none' | 'held' | 'ready' | 'paid'; releaseAt?: Date; payoutId?: Types.ObjectId };
}

@Schema({ collection: 'ess_orders', timestamps: true })
export class EssOrder {
  @Prop({ required: true, unique: true }) number!: string;
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true }) userId!: Types.ObjectId;
  @Prop({ type: Object, required: true }) recipient!: { name: string; phone: string; forSomeoneElse?: boolean };
  @Prop({ required: true, default: 'CM' }) country!: string;
  @Prop({ required: true, default: 'XAF' }) currency!: string;
  @Prop({ type: Object, required: true })
  delivery!: { address: string; city: string; district?: string; date: string; slot: 'morning' | 'afternoon' | 'evening'; note?: string; leaseId?: string };
  @Prop({ type: [Object], default: [] }) parts!: OrderPart[];
  @Prop({ type: Number, required: true }) subtotal!: number;
  @Prop({ type: Number, required: true }) deliveryFees!: number;
  @Prop({ type: Number, required: true }) serviceFee!: number;
  @Prop({ type: Number, required: true }) total!: number;
  @Prop({ type: Number, required: true }) commission!: number;
  @Prop({ type: Object }) payment?: { checkoutPaymentId?: string; providerReference?: string; method?: string; paidAt?: Date };
  @Prop({ type: String, enum: ['pending_payment', 'paid', 'expired', 'closed'], default: 'pending_payment', index: true })
  status!: OrderStatus;
  @Prop({ type: Date, required: true }) expiresAt!: Date;
  createdAt?: Date;
}
export type EssOrderDocument = HydratedDocument<EssOrder>;
export const EssOrderSchema = SchemaFactory.createForClass(EssOrder);
EssOrderSchema.index({ 'parts.shopId': 1, createdAt: -1 });
EssOrderSchema.index({ 'parts._id': 1 });
EssOrderSchema.index({ status: 1, expiresAt: 1 });

// ── Payouts (manual in phase 1: an admin sends Mobile Money and records the reference) ──

@Schema({ collection: 'ess_payouts', timestamps: true })
export class EssPayout {
  @Prop({ type: Types.ObjectId, ref: 'EssShop', required: true, index: true }) shopId!: Types.ObjectId;
  @Prop({ default: '' }) shopName!: string;
  @Prop({ type: [Object], default: [] }) parts!: { orderId: string; partId: string; number: string }[];
  @Prop({ type: Number, required: true }) gross!: number;
  @Prop({ type: Number, required: true }) commission!: number;
  @Prop({ type: Number, required: true }) net!: number;
  @Prop({ type: String, enum: ['sent'], default: 'sent' }) status!: 'sent';
  @Prop({ required: true }) reference!: string;
  @Prop({ type: Object }) to?: { provider: string; number: string; name: string };
  @Prop({ type: Types.ObjectId }) sentBy?: Types.ObjectId;
  @Prop() sentAt?: Date;
  createdAt?: Date;
}
export type EssPayoutDocument = HydratedDocument<EssPayout>;
export const EssPayoutSchema = SchemaFactory.createForClass(EssPayout);

// ── Demand from cities without a shop ───────────────────────────────────────

@Schema({ collection: 'ess_interest', timestamps: true })
export class EssInterest {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true }) userId!: Types.ObjectId;
  @Prop({ required: true, index: true }) city!: string;
}
export type EssInterestDocument = HydratedDocument<EssInterest>;
export const EssInterestSchema = SchemaFactory.createForClass(EssInterest);
EssInterestSchema.index({ userId: 1, city: 1 }, { unique: true });
