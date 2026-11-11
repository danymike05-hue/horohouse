import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model, Types } from 'mongoose';
import { CoHostsService } from '../co-hosts/co-hosts.service';
import { SubscriptionsService } from '../payments/services/subscriptions.service';
import { ApprovalStatus, ListingType, Property, PropertyDocument } from '../properties/schemas/property.schema';
import { Room, RoomDocument } from '../rooms/schemas/room.schema';
import { UserRole } from '../users/schemas/user.schema';

/** Fewer than this and one listing could skew it, or its price could be worked out. */
export const MIN_COMPARABLES = 5;
const MIN_WEEKEND_SAMPLES = 3;
const ROUND_TO = 500;
const SAMPLE_LIMIT = 500;

export type PriceSuggestion =
  | { available: false; reason: 'plan' | 'rooms' | 'not_enough_data'; comparableCount?: number }
  | {
    available: true;
    /** similar = same city, type and size; city = same city and size, any type */
    scope: 'similar' | 'city';
    city: string;
    comparableCount: number;
    currentPrice: number;
    suggestedPrice: number;
    low: number;
    high: number;
    suggestedWeekendPrice: number | null;
  };

type Comparable = { price: number; weekendPrice?: number | null };

const roundPrice = (n: number) => Math.max(ROUND_TO, Math.round(n / ROUND_TO) * ROUND_TO);

/** Value at this position (0–1) of a sorted list, between neighbours when it falls between them. */
function percentile(sorted: number[], position: number): number {
  const index = (sorted.length - 1) * position;
  const below = Math.floor(index);
  const above = Math.ceil(index);
  return sorted[below] + (sorted[above] - sorted[below]) * (index - below);
}

/**
 * The middle of what similar listings ask, with the middle half as the range. The median
 * and that range ignore a few unusually cheap or expensive listings. Weekends use the
 * usual weekend uplift among listings that charge one, applied to the suggested price.
 */
export function suggestFromComparables(comparables: Comparable[]) {
  const prices = comparables.map((c) => c.price).sort((a, b) => a - b);
  const suggestedPrice = roundPrice(percentile(prices, 0.5));
  const uplifts = comparables
    .filter((c) => Number(c.weekendPrice) > c.price)
    .map((c) => Number(c.weekendPrice) / c.price)
    .sort((a, b) => a - b);
  return {
    suggestedPrice,
    low: roundPrice(percentile(prices, 0.25)),
    high: roundPrice(percentile(prices, 0.75)),
    suggestedWeekendPrice: uplifts.length >= MIN_WEEKEND_SAMPLES ? roundPrice(suggestedPrice * percentile(uplifts, 0.5)) : null,
  };
}

@Injectable()
export class PriceSuggestionsService {
  constructor(
    @InjectModel(Property.name) private readonly propertyModel: Model<PropertyDocument>,
    @InjectModel(Room.name) private readonly roomModel: Model<RoomDocument>,
    private readonly subscriptions: SubscriptionsService,
    private readonly coHosts: CoHostsService,
  ) {}

  async forListing(user: { _id?: any; id?: any; role?: string }, propertyId: string): Promise<PriceSuggestion> {
    if (!isValidObjectId(propertyId)) throw new NotFoundException('Listing not found');
    const property: any = await this.propertyModel
      .findById(propertyId)
      .select('ownerId agentId price city type bedrooms currency')
      .lean();
    if (!property) throw new NotFoundException('Listing not found');

    const uid = String(user._id ?? user.id);
    const manages = String(property.ownerId) === uid || String(property.agentId ?? '') === uid
      || user.role === UserRole.ADMIN || (await this.coHosts.isActive(uid, propertyId));
    if (!manages) throw new ForbiddenException('You can only see suggestions for listings you manage');

    // The plan belongs to the listing's owner, so their co-hosts get what they pay for.
    const plan: any = await this.subscriptions.getUserSubscription(String(property.ownerId));
    if (!plan?.features?.smartPricing && user.role !== UserRole.ADMIN) return { available: false, reason: 'plan' };

    // Hotels price each room type, which isn't comparable with whole listings.
    if (await this.roomModel.exists({ propertyId: new Types.ObjectId(propertyId) })) {
      return { available: false, reason: 'rooms' };
    }

    const similar = await this.comparables(property, true);
    const scope = similar.length >= MIN_COMPARABLES ? 'similar' : 'city';
    const pool = scope === 'similar' ? similar : await this.comparables(property, false);
    if (pool.length < MIN_COMPARABLES) {
      return { available: false, reason: 'not_enough_data', comparableCount: pool.length };
    }
    return {
      available: true,
      scope,
      city: property.city,
      comparableCount: pool.length,
      currentPrice: property.price ?? 0,
      ...suggestFromComparables(pool),
    };
  }

  private async comparables(property: any, sameType: boolean): Promise<Comparable[]> {
    const filter: any = {
      _id: { $ne: property._id },
      listingType: ListingType.SHORT_TERM,
      approvalStatus: ApprovalStatus.APPROVED,
      isActive: true,
      city: new RegExp(`^${String(property.city ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
      price: { $gt: 0 },
      currency: { $in: [property.currency ?? 'XAF', null] },
    };
    if (sameType) filter.type = property.type;
    if (typeof property.bedrooms === 'number') {
      filter.bedrooms = { $gte: property.bedrooms - 1, $lte: property.bedrooms + 1 };
    }
    return this.propertyModel.find(filter).select('price weekendPrice').limit(SAMPLE_LIMIT).lean() as any;
  }
}
