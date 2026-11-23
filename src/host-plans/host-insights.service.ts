// The host's numbers: views, bookings, earnings, occupancy. Free and Starter see the last
// 30 days; Growth and up also get 12 months of trends and a line per listing.
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Model, Types } from 'mongoose';
import { Property, PropertyDocument } from '../properties/schemas/property.schema';
import { Booking, BookingDocument } from '../bookings/schema/booking.schema';
import { HostPlansService } from './host-plans.service';

/** Views per listing per day (the listing's viewsCount only gives the total) */
@Schema({ collection: 'listing_view_days' })
export class ListingViewDay {
  @Prop({ type: Types.ObjectId, required: true }) propertyId: Types.ObjectId;
  /** "2026-11-22" */
  @Prop({ type: String, required: true }) day: string;
  @Prop({ default: 0 }) n: number;
}
export type ListingViewDayDocument = ListingViewDay & Document;
export const ListingViewDaySchema = SchemaFactory.createForClass(ListingViewDay);
ListingViewDaySchema.index({ propertyId: 1, day: 1 }, { unique: true });

const DAY = 86_400_000;
/** Host's share of what the guest paid (the platform keeps 10%) */
const HOST_SHARE = 0.9;
const BOOKED = ['confirmed', 'completed'];
const PAID = ['paid', 'partial'];
const dayKey = (d: Date) => d.toISOString().slice(0, 10);

@Injectable()
export class HostInsightsService {
  private readonly logger = new Logger(HostInsightsService.name);

  constructor(
    @InjectModel(ListingViewDay.name) private readonly views: Model<ListingViewDayDocument>,
    @InjectModel(Property.name) private readonly properties: Model<PropertyDocument>,
    @InjectModel(Booking.name) private readonly bookings: Model<BookingDocument>,
    private readonly plans: HostPlansService,
  ) {}

  /** Fire-and-forget from the listing page */
  recordView(propertyId: string): void {
    if (!Types.ObjectId.isValid(propertyId)) return;
    this.views
      .updateOne({ propertyId: new Types.ObjectId(propertyId), day: dayKey(new Date()) }, { $inc: { n: 1 } }, { upsert: true })
      .catch((err) => this.logger.warn(`View not counted: ${err?.message}`));
  }

  private earned(b: any): number {
    if (!PAID.includes(b.paymentStatus)) return 0;
    const owed = b.payout?.amount;
    return Math.round(typeof owed === 'number' ? owed : (b.priceBreakdown?.totalAmount ?? 0) * HOST_SHARE);
  }

  async forHost(hostId: string) {
    const { plan, tier } = await this.plans.planOf(hostId);
    const hid = new Types.ObjectId(hostId);
    const now = new Date();
    const since30 = new Date(now.getTime() - 30 * DAY);
    const yearStart = new Date(now.getFullYear(), now.getMonth() - 11, 1);

    const listings: any[] = await this.properties
      .find({ ownerId: hid })
      .select('title images city viewsCount averageRating reviewCount isActive approvalStatus createdAt')
      .lean();
    const ids = listings.map((l) => l._id);

    const [viewRows, bookingRows] = await Promise.all([
      this.views.aggregate([
        { $match: { propertyId: { $in: ids }, day: { $gte: dayKey(yearStart) } } },
        { $project: { propertyId: 1, n: 1, month: { $substrCP: ['$day', 0, 7] }, recent: { $gte: ['$day', dayKey(since30)] } } },
      ]),
      this.bookings
        .find({ hostId: hid, createdAt: { $gte: yearStart }, status: { $in: [...BOOKED, 'cancelled'] } })
        .select('propertyId status paymentStatus priceBreakdown payout checkIn checkOut nights createdAt')
        .lean(),
    ]);

    const real = bookingRows.filter((b: any) => BOOKED.includes(b.status));
    const recent = real.filter((b: any) => new Date(b.createdAt) >= since30);
    const views30 = viewRows.filter((v) => v.recent).reduce((s, v) => s + v.n, 0);

    // Occupancy: booked nights in the last 30 days out of the nights the listings were online
    const active = listings.filter((l) => l.isActive !== false && l.approvalStatus === 'approved');
    let bookedNights = 0;
    for (const b of real as any[]) {
      const from = Math.max(new Date(b.checkIn).getTime(), since30.getTime());
      const to = Math.min(new Date(b.checkOut).getTime(), now.getTime());
      if (to > from) bookedNights += Math.round((to - from) / DAY);
    }
    const nightsOnline = active.length * 30;
    const rated = listings.filter((l) => (l.averageRating ?? 0) > 0);
    const rating = rated.length ? Math.round((rated.reduce((s, l) => s + l.averageRating, 0) / rated.length) * 100) / 100 : 0;
    const reviews = listings.reduce((s, l) => s + (l.reviewCount ?? 0), 0);

    const basic = {
      views30,
      viewsTotal: listings.reduce((s, l) => s + (l.viewsCount ?? 0), 0),
      bookings30: recent.length,
      earnings30: recent.reduce((s, b) => s + this.earned(b), 0),
      occupancy30: nightsOnline > 0 ? Math.min(100, Math.round((bookedNights / nightsOnline) * 100)) : 0,
      rating,
      reviews,
      listings: listings.length,
      activeListings: active.length,
      upcoming: (real as any[]).filter((b) => new Date(b.checkIn) > now).length,
    };

    if (tier.insights !== 'full') return { plan, level: 'basic' as const, canExport: false, basic };

    const months: { month: string; earnings: number; bookings: number; nights: number; views: number; cancelled: number }[] = [];
    for (let i = 0; i < 12; i++) {
      const d = new Date(yearStart.getFullYear(), yearStart.getMonth() + i, 1);
      months.push({ month: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, earnings: 0, bookings: 0, nights: 0, views: 0, cancelled: 0 });
    }
    const byMonth = new Map(months.map((m) => [m.month, m]));
    const monthOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    for (const b of bookingRows as any[]) {
      const m = byMonth.get(monthOf(new Date(b.createdAt)));
      if (!m) continue;
      if (b.status === 'cancelled') { m.cancelled++; continue; }
      m.bookings++;
      m.nights += b.nights ?? 0;
      m.earnings += this.earned(b);
    }
    for (const v of viewRows) {
      const m = byMonth.get(v.month);
      if (m) m.views += v.n;
    }

    const perListing = listings.map((l) => {
      const mine = (real as any[]).filter((b) => String(b.propertyId) === String(l._id));
      const mine30 = mine.filter((b) => new Date(b.createdAt) >= since30);
      const v30 = viewRows.filter((v) => v.recent && String(v.propertyId) === String(l._id)).reduce((s, v) => s + v.n, 0);
      const img = l.images?.[0];
      return {
        id: String(l._id),
        title: l.title,
        city: l.city,
        image: typeof img === 'string' ? img : img?.url ?? null,
        views30: v30,
        viewsTotal: l.viewsCount ?? 0,
        bookings30: mine30.length,
        bookings12m: mine.length,
        earnings30: mine30.reduce((s, b) => s + this.earned(b), 0),
        earnings12m: mine.reduce((s, b) => s + this.earned(b), 0),
        conversion30: v30 > 0 ? Math.round((mine30.length / v30) * 1000) / 10 : 0,
        rating: l.averageRating ?? 0,
        reviews: l.reviewCount ?? 0,
        online: l.isActive !== false && l.approvalStatus === 'approved',
      };
    }).sort((a, b) => b.earnings12m - a.earnings12m);

    return {
      plan,
      level: 'full' as const,
      canExport: tier.insightsExport,
      basic: { ...basic, conversion30: views30 > 0 ? Math.round((recent.length / views30) * 1000) / 10 : 0 },
      months,
      listings: perListing,
      earnings12m: months.reduce((s, m) => s + m.earnings, 0),
    };
  }
}
