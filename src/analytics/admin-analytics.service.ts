import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, PipelineStage } from 'mongoose';

import { Booking, BookingDocument, BookingStatus } from '../bookings/schema/booking.schema';
import { Property, PropertyDocument, ListingType } from '../properties/schemas/property.schema';
import { Review, ReviewDocument, ReviewType } from '../reviews/schemas/review.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import {
  AdminDashboardAnalytics,
  PlatformKPIs,
  RevenueDataPoint,
  OccupancyDataPoint,
  TopProperty,
  BookingStatusBreakdown,
  PropertyTypeBreakdown,
  CityPerformance,
  HostLeaderboard,
} from './dto/admin-analytics.dto';

export interface DateRange {
  startDate: Date;
  endDate:   Date;
}

// ─── date-grouping helpers ─────────────────────────────────────────────────────

function periodGroupExpr(granularity: 'day' | 'week' | 'month', field = '$createdAt') {
  if (granularity === 'day') {
    return { $dateToString: { format: '%Y-%m-%d', date: field } };
  }
  if (granularity === 'week') {
    return {
      $concat: [
        { $toString: { $isoWeekYear: field } },
        '-W',
        {
          $toString: {
            $cond: [
              { $lt: [{ $isoWeek: field }, 10] },
              { $concat: ['0', { $toString: { $isoWeek: field } }] },
              { $toString: { $isoWeek: field } },
            ],
          },
        },
      ],
    };
  }
  // month
  return { $dateToString: { format: '%Y-%m', date: field } };
}

// ─────────────────────────────────────────────────────────────────────────────

@Injectable()
export class AdminAnalyticsService {
  private readonly logger = new Logger(AdminAnalyticsService.name);

  constructor(
    @InjectModel(Booking.name)  private bookingModel:  Model<BookingDocument>,
    @InjectModel(Property.name) private propertyModel: Model<PropertyDocument>,
    @InjectModel(Review.name)   private reviewModel:   Model<ReviewDocument>,
    @InjectModel(User.name)     private userModel:     Model<UserDocument>,
  ) {}

  // ════════════════════════════════════════════════════════════════════════════
  // MAIN DASHBOARD — all sections in one call
  // ════════════════════════════════════════════════════════════════════════════

  async getAdminDashboard(
    dateRange: DateRange,
    granularity: 'day' | 'week' | 'month' = 'month',
  ): Promise<AdminDashboardAnalytics> {
    this.logger.log(
      `[AdminAnalytics] Dashboard: ${dateRange.startDate.toISOString()} → ${dateRange.endDate.toISOString()}`,
    );

    const [
      kpis,
      revenueOverTime,
      occupancyOverTime,
      bookingStatusBreakdown,
      propertyTypeBreakdown,
      topProperties,
      cityPerformance,
      hostLeaderboard,
    ] = await Promise.all([
      this.getPlatformKPIs(dateRange),
      this.getRevenueOverTime(dateRange, granularity),
      this.getOccupancyOverTime(dateRange, granularity),
      this.getBookingStatusBreakdown(dateRange),
      this.getPropertyTypeBreakdown(dateRange),
      this.getTopProperties(dateRange, 10),
      this.getCityPerformance(dateRange, 10),
      this.getHostLeaderboard(dateRange, 10),
    ]);

    return {
      kpis,
      revenueOverTime,
      occupancyOverTime,
      bookingStatusBreakdown,
      propertyTypeBreakdown,
      topProperties,
      cityPerformance,
      hostLeaderboard,
      period: {
        startDate: dateRange.startDate.toISOString(),
        endDate:   dateRange.endDate.toISOString(),
      },
    };
  }

  // ════════════════════════════════════════════════════════════════════════════
  // PLATFORM KPIs
  // ════════════════════════════════════════════════════════════════════════════

  async getPlatformKPIs(dateRange: DateRange): Promise<PlatformKPIs> {
    const dateFilter = {
      createdAt: { $gte: dateRange.startDate, $lte: dateRange.endDate },
    };

    // ── Booking status counts ─────────────────────────────────────────────────
    const statusCounts = await this.bookingModel.aggregate([
      { $match: dateFilter },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    const byStatus = Object.fromEntries(
      statusCounts.map((s: any) => [s._id, s.count]),
    ) as Record<string, number>;

    const totalBookings     = statusCounts.reduce((a, s) => a + s.count, 0);
    const confirmedBookings = byStatus[BookingStatus.CONFIRMED]  ?? 0;
    const cancelledBookings = byStatus[BookingStatus.CANCELLED]  ?? 0;
    const completedBookings = byStatus[BookingStatus.COMPLETED]  ?? 0;
    const pendingBookings   = byStatus[BookingStatus.PENDING]    ?? 0;
    const cancellationRate  = totalBookings > 0
      ? Math.round((cancelledBookings / totalBookings) * 100)
      : 0;

    // ── Revenue ───────────────────────────────────────────────────────────────
    const revenueAgg = await this.bookingModel.aggregate([
      {
        $match: {
          ...dateFilter,
          status: { $in: [BookingStatus.CONFIRMED, BookingStatus.COMPLETED] },
        },
      },
      {
        $group: {
          _id:             null,
          grossRevenue:    { $sum: '$priceBreakdown.totalAmount' },
          platformFees:    { $sum: '$priceBreakdown.serviceFee' },
          totalBookings:   { $sum: 1 },
          totalNights:     { $sum: '$nights' },
          totalLeadTime: {
            $sum: {
              $divide: [
                { $subtract: ['$checkIn', '$createdAt'] },
                1000 * 60 * 60 * 24, // ms → days
              ],
            },
          },
        },
      },
    ]);

    const rev = revenueAgg[0] ?? {
      grossRevenue: 0, platformFees: 0, totalBookings: 0,
      totalNights: 0, totalLeadTime: 0,
    };

    const paidCount          = rev.totalBookings || 1;
    const grossRevenue        = rev.grossRevenue        ?? 0;
    const platformFeeRevenue  = rev.platformFees        ?? 0;
    const averageBookingValue = Math.round(grossRevenue / paidCount);
    const averageNightsBooked = Math.round((rev.totalNights   ?? 0) / paidCount * 10) / 10;
    const averageLeadTime     = Math.round((rev.totalLeadTime ?? 0) / paidCount * 10) / 10;

    // ── Occupancy ─────────────────────────────────────────────────────────────
    const activeShortTermCount = await this.propertyModel.countDocuments({
      listingType: ListingType.SHORT_TERM,
      isActive:    true,
    });

    const rangeNights = Math.ceil(
      (dateRange.endDate.getTime() - dateRange.startDate.getTime()) / (1000 * 60 * 60 * 24),
    );
    const totalAvailableNights = activeShortTermCount * rangeNights;
    const averageOccupancyRate = totalAvailableNights > 0
      ? Math.round(((rev.totalNights ?? 0) / totalAvailableNights) * 100)
      : 0;

    // ── Unique guests & hosts ─────────────────────────────────────────────────
    const [guestAgg, hostAgg] = await Promise.all([
      this.bookingModel.aggregate([
        {
          $match: {
            ...dateFilter,
            status: { $in: [BookingStatus.CONFIRMED, BookingStatus.COMPLETED] },
          },
        },
        { $group: { _id: '$guestId' } },
        { $count: 'total' },
      ]),
      this.bookingModel.aggregate([
        {
          $match: {
            ...dateFilter,
            status: { $in: [BookingStatus.CONFIRMED, BookingStatus.COMPLETED] },
          },
        },
        { $group: { _id: '$hostId' } },
        { $count: 'total' },
      ]),
    ]);

    const totalGuests = guestAgg[0]?.total ?? 0;
    const totalHosts  = hostAgg[0]?.total  ?? 0;

    // New guests: guests whose earliest booking falls within this period
    const newGuestsAgg = await this.bookingModel.aggregate([
      {
        $match: {
          status: { $in: [BookingStatus.CONFIRMED, BookingStatus.COMPLETED] },
        },
      },
      { $group: { _id: '$guestId', firstBooking: { $min: '$createdAt' } } },
      {
        $match: {
          firstBooking: { $gte: dateRange.startDate, $lte: dateRange.endDate },
        },
      },
      { $count: 'total' },
    ]);
    const newGuestsThisPeriod = newGuestsAgg[0]?.total ?? 0;

    // ── Reviews ───────────────────────────────────────────────────────────────
    const reviewAgg = await this.reviewModel.aggregate([
      {
        $match: {
          reviewType: ReviewType.STAY,
          isActive:   true,
          createdAt:  { $gte: dateRange.startDate, $lte: dateRange.endDate },
        },
      },
      {
        $group: {
          _id:           null,
          totalReviews:  { $sum: 1 },
          averageRating: { $avg: '$rating' },
        },
      },
    ]);

    const totalReviews  = reviewAgg[0]?.totalReviews  ?? 0;
    const averageRating = reviewAgg[0]?.averageRating
      ? Math.round(reviewAgg[0].averageRating * 10) / 10
      : 0;

    const reviewCompletionRate = completedBookings > 0
      ? Math.round((totalReviews / completedBookings) * 100)
      : 0;

    return {
      totalBookings,
      confirmedBookings,
      cancelledBookings,
      completedBookings,
      pendingBookings,
      cancellationRate,
      grossRevenue,
      platformFeeRevenue,
      averageBookingValue,
      averageOccupancyRate,
      averageNightsBooked,
      averageLeadTime,
      totalGuests,
      totalHosts,
      newGuestsThisPeriod,
      totalReviews,
      averageRating,
      reviewCompletionRate,
    };
  }

  // ════════════════════════════════════════════════════════════════════════════
  // REVENUE OVER TIME
  // ════════════════════════════════════════════════════════════════════════════

  async getRevenueOverTime(
    dateRange: DateRange,
    granularity: 'day' | 'week' | 'month' = 'month',
    filters: { hostId?: string; propertyType?: string } = {},
  ): Promise<RevenueDataPoint[]> {
    const matchStage: any = {
      status:    { $in: [BookingStatus.CONFIRMED, BookingStatus.COMPLETED] },
      createdAt: { $gte: dateRange.startDate, $lte: dateRange.endDate },
    };

    if (filters.hostId) {
      matchStage.hostId = new Types.ObjectId(filters.hostId);
    }

    const pipeline: PipelineStage[] = [
      { $match: matchStage },
    ];

    // Join to property if filtering by type
    if (filters.propertyType) {
      pipeline.push(
        {
          $lookup: {
            from:         'properties',
            localField:   'propertyId',
            foreignField: '_id',
            as:           'property',
          },
        } as PipelineStage,
        { $unwind: '$property' } as PipelineStage,
        { $match: { 'property.type': filters.propertyType } } as PipelineStage,
      );
    }

    pipeline.push(
      {
        $group: {
          _id:          periodGroupExpr(granularity, '$createdAt'),
          grossRevenue: { $sum: '$priceBreakdown.totalAmount' },
          platformFees: { $sum: '$priceBreakdown.serviceFee' },
          bookingCount: { $sum: 1 },
        },
      } as PipelineStage,
      { $sort: { _id: 1 } } as PipelineStage,
    );

    const results = await this.bookingModel.aggregate(pipeline);

    return results.map((r: any) => ({
      period:       r._id,
      grossRevenue: Math.round(r.grossRevenue ?? 0),
      platformFees: Math.round(r.platformFees ?? 0),
      bookingCount: r.bookingCount,
      averageValue: r.bookingCount > 0
        ? Math.round((r.grossRevenue ?? 0) / r.bookingCount)
        : 0,
    }));
  }

  // ════════════════════════════════════════════════════════════════════════════
  // OCCUPANCY OVER TIME
  // ════════════════════════════════════════════════════════════════════════════

  async getOccupancyOverTime(
    dateRange: DateRange,
    granularity: 'day' | 'week' | 'month' = 'month',
    filters: { propertyId?: string; city?: string } = {},
  ): Promise<OccupancyDataPoint[]> {
    const propertyFilter: any = {
      listingType: ListingType.SHORT_TERM,
      isActive:    true,
    };
    if (filters.city)       propertyFilter.city  = new RegExp(filters.city, 'i');
    if (filters.propertyId) propertyFilter._id   = new Types.ObjectId(filters.propertyId);

    // Count active properties (denominator for occupancy)
    const propertyCount = await this.propertyModel.countDocuments(propertyFilter);

    const matchStage: any = {
      status:   { $in: [BookingStatus.CONFIRMED, BookingStatus.COMPLETED] },
      checkIn:  { $lte: dateRange.endDate },
      checkOut: { $gte: dateRange.startDate },
    };
    if (filters.propertyId) {
      matchStage.propertyId = new Types.ObjectId(filters.propertyId);
    }

    // If filtering by city, first resolve property IDs for that city
    if (filters.city && !filters.propertyId) {
      const props = await this.propertyModel
        .find(propertyFilter)
        .select('_id')
        .lean();
      matchStage.propertyId = { $in: props.map((p: any) => p._id) };
    }

    const results = await this.bookingModel.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id:          periodGroupExpr(granularity, '$checkIn'),
          nightsBooked: { $sum: '$nights' },
          bookingCount: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Determine nights available per period bucket
    const daysInPeriod = Math.ceil(
      (dateRange.endDate.getTime() - dateRange.startDate.getTime()) / (1000 * 60 * 60 * 24),
    );
    const bucketsCount  = results.length || 1;
    const nightsPerBucket = Math.round(daysInPeriod / bucketsCount);

    return results.map((r: any) => {
      const nightsAvailable = nightsPerBucket * propertyCount;
      const occupancyRate   = nightsAvailable > 0
        ? Math.min(100, Math.round((r.nightsBooked / nightsAvailable) * 100))
        : 0;

      return {
        period:          r._id,
        occupancyRate,
        nightsBooked:    r.nightsBooked,
        nightsAvailable,
        propertyCount,
      };
    });
  }

  // ════════════════════════════════════════════════════════════════════════════
  // BOOKING STATUS BREAKDOWN
  // ════════════════════════════════════════════════════════════════════════════

  async getBookingStatusBreakdown(dateRange: DateRange): Promise<BookingStatusBreakdown[]> {
    const results = await this.bookingModel.aggregate([
      {
        $match: {
          createdAt: { $gte: dateRange.startDate, $lte: dateRange.endDate },
        },
      },
      {
        $group: {
          _id:     '$status',
          count:   { $sum: 1 },
          revenue: { $sum: '$priceBreakdown.totalAmount' },
        },
      },
    ]);

    const total = results.reduce((a: number, r: any) => a + r.count, 0);

    return results.map((r: any) => ({
      status:     r._id,
      count:      r.count,
      percentage: total > 0 ? Math.round((r.count / total) * 100) : 0,
      revenue:    Math.round(r.revenue ?? 0),
    }));
  }

  // ════════════════════════════════════════════════════════════════════════════
  // PROPERTY TYPE BREAKDOWN
  // ════════════════════════════════════════════════════════════════════════════

  async getPropertyTypeBreakdown(dateRange: DateRange): Promise<PropertyTypeBreakdown[]> {
    const results = await this.bookingModel.aggregate([
      {
        $match: {
          status:    { $in: [BookingStatus.CONFIRMED, BookingStatus.COMPLETED] },
          createdAt: { $gte: dateRange.startDate, $lte: dateRange.endDate },
        },
      },
      {
        $lookup: {
          from:         'properties',
          localField:   'propertyId',
          foreignField: '_id',
          as:           'property',
        },
      },
      { $unwind: '$property' },
      {
        $group: {
          _id:          '$property.type',
          bookingCount: { $sum: 1 },
          revenue:      { $sum: '$priceBreakdown.totalAmount' },
          totalNights:  { $sum: '$nights' },
          propertyIds:  { $addToSet: '$propertyId' },
        },
      },
      { $sort: { bookingCount: -1 } },
    ]);

    const totalBookings = results.reduce((a: number, r: any) => a + r.bookingCount, 0);

    // Attach average rating per type
    return Promise.all(
      results.map(async (r: any) => {
        const ratingAgg = await this.reviewModel.aggregate([
          {
            $match: {
              propertyId: { $in: r.propertyIds },
              reviewType: ReviewType.STAY,
              isActive:   true,
            },
          },
          { $group: { _id: null, avg: { $avg: '$rating' } } },
        ]);

        const propertyCount = r.propertyIds.length;
        const rangeNights   = Math.ceil(
          (dateRange.endDate.getTime() - dateRange.startDate.getTime()) /
          (1000 * 60 * 60 * 24),
        );
        const occupancyRate = propertyCount > 0 && rangeNights > 0
          ? Math.min(100, Math.round((r.totalNights / (propertyCount * rangeNights)) * 100))
          : 0;

        return {
          type:          r._id,
          bookingCount:  r.bookingCount,
          revenue:       Math.round(r.revenue ?? 0),
          occupancyRate,
          averageRating: ratingAgg[0]
            ? Math.round(ratingAgg[0].avg * 10) / 10
            : 0,
          percentage: totalBookings > 0
            ? Math.round((r.bookingCount / totalBookings) * 100)
            : 0,
        };
      }),
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // TOP PROPERTIES
  // ════════════════════════════════════════════════════════════════════════════

  async getTopProperties(
    dateRange: DateRange,
    limit = 10,
  ): Promise<TopProperty[]> {
    const results = await this.bookingModel.aggregate([
      {
        $match: {
          status:    { $in: [BookingStatus.CONFIRMED, BookingStatus.COMPLETED] },
          createdAt: { $gte: dateRange.startDate, $lte: dateRange.endDate },
        },
      },
      {
        $group: {
          _id:          '$propertyId',
          bookingCount: { $sum: 1 },
          revenue:      { $sum: '$priceBreakdown.totalAmount' },
          totalNights:  { $sum: '$nights' },
        },
      },
      { $sort: { revenue: -1 } },
      { $limit: limit },
      {
        $lookup: {
          from:         'properties',
          localField:   '_id',
          foreignField: '_id',
          as:           'property',
        },
      },
      { $unwind: '$property' },
      {
        $lookup: {
          from:         'users',
          localField:   'property.ownerId',
          foreignField: '_id',
          as:           'host',
        },
      },
      { $unwind: { path: '$host', preserveNullAndEmptyArrays: true } },
    ]);

    const rangeNights = Math.ceil(
      (dateRange.endDate.getTime() - dateRange.startDate.getTime()) /
      (1000 * 60 * 60 * 24),
    );

    return Promise.all(
      results.map(async (r: any) => {
        const ratingAgg = await this.reviewModel.aggregate([
          {
            $match: {
              propertyId: r._id,
              reviewType: ReviewType.STAY,
              isActive:   true,
            },
          },
          {
            $group: {
              _id:    null,
              avg:    { $avg: '$rating' },
              count:  { $sum: 1 },
            },
          },
        ]);

        const occupancyRate = rangeNights > 0
          ? Math.min(100, Math.round((r.totalNights / rangeNights) * 100))
          : 0;

        return {
          propertyId:    r._id.toString(),
          title:         r.property?.title      ?? 'Unknown',
          city:          r.property?.city       ?? '',
          type:          r.property?.type       ?? '',
          hostName:      r.host?.name            ?? 'Unknown',
          bookingCount:  r.bookingCount,
          revenue:       Math.round(r.revenue   ?? 0),
          occupancyRate,
          averageRating: ratingAgg[0] ? Math.round(ratingAgg[0].avg  * 10) / 10 : 0,
          reviewCount:   ratingAgg[0]?.count ?? 0,
        };
      }),
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // CITY PERFORMANCE
  // ════════════════════════════════════════════════════════════════════════════

  async getCityPerformance(
    dateRange: DateRange,
    limit = 10,
  ): Promise<CityPerformance[]> {
    const results = await this.bookingModel.aggregate([
      {
        $match: {
          status:    { $in: [BookingStatus.CONFIRMED, BookingStatus.COMPLETED] },
          createdAt: { $gte: dateRange.startDate, $lte: dateRange.endDate },
        },
      },
      {
        $lookup: {
          from:         'properties',
          localField:   'propertyId',
          foreignField: '_id',
          as:           'property',
        },
      },
      { $unwind: '$property' },
      {
        $group: {
          _id:          '$property.city',
          bookingCount: { $sum: 1 },
          revenue:      { $sum: '$priceBreakdown.totalAmount' },
          totalNights:  { $sum: '$nights' },
          propertyIds:  { $addToSet: '$propertyId' },
        },
      },
      { $sort: { revenue: -1 } },
      { $limit: limit },
    ]);

    const rangeNights = Math.ceil(
      (dateRange.endDate.getTime() - dateRange.startDate.getTime()) /
      (1000 * 60 * 60 * 24),
    );

    return Promise.all(
      results.map(async (r: any) => {
        const propertyCount = r.propertyIds.length;

        const ratingAgg = await this.reviewModel.aggregate([
          {
            $match: {
              propertyId: { $in: r.propertyIds },
              reviewType: ReviewType.STAY,
              isActive:   true,
            },
          },
          { $group: { _id: null, avg: { $avg: '$rating' } } },
        ]);

        const occupancyRate = propertyCount > 0 && rangeNights > 0
          ? Math.min(100, Math.round((r.totalNights / (propertyCount * rangeNights)) * 100))
          : 0;

        return {
          city:          r._id,
          bookingCount:  r.bookingCount,
          revenue:       Math.round(r.revenue ?? 0),
          propertyCount,
          averageRating: ratingAgg[0] ? Math.round(ratingAgg[0].avg * 10) / 10 : 0,
          occupancyRate,
        };
      }),
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // HOST LEADERBOARD
  // ════════════════════════════════════════════════════════════════════════════

  async getHostLeaderboard(
    dateRange: DateRange,
    limit = 10,
  ): Promise<HostLeaderboard[]> {
    const results = await this.bookingModel.aggregate([
      {
        $match: {
          createdAt: { $gte: dateRange.startDate, $lte: dateRange.endDate },
        },
      },
      {
        $group: {
          _id:              '$hostId',
          bookingCount:     { $sum: 1 },
          revenue:          {
            $sum: {
              $cond: [
                { $in: ['$status', [BookingStatus.CONFIRMED, BookingStatus.COMPLETED]] },
                '$priceBreakdown.totalAmount',
                0,
              ],
            },
          },
          cancelledCount: {
            $sum: {
              $cond: [{ $eq: ['$status', BookingStatus.CANCELLED] }, 1, 0],
            },
          },
          propertyIds:      { $addToSet: '$propertyId' },
        },
      },
      { $sort: { revenue: -1 } },
      { $limit: limit },
      {
        $lookup: {
          from:         'users',
          localField:   '_id',
          foreignField: '_id',
          as:           'host',
        },
      },
      { $unwind: { path: '$host', preserveNullAndEmptyArrays: true } },
    ]);

    return Promise.all(
      results.map(async (r: any) => {
        const ratingAgg = await this.reviewModel.aggregate([
          {
            $match: {
              propertyId: { $in: r.propertyIds },
              reviewType: ReviewType.STAY,
              isActive:   true,
            },
          },
          { $group: { _id: null, avg: { $avg: '$rating' } } },
        ]);

        const cancellationRate = r.bookingCount > 0
          ? Math.round((r.cancelledCount / r.bookingCount) * 100)
          : 0;

        return {
          hostId:           r._id.toString(),
          hostName:         r.host?.name          ?? 'Unknown',
          bookingCount:     r.bookingCount,
          revenue:          Math.round(r.revenue  ?? 0),
          averageRating:    ratingAgg[0] ? Math.round(ratingAgg[0].avg * 10) / 10 : 0,
          propertyCount:    r.propertyIds.length,
          cancellationRate,
        };
      }),
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // PERIOD-OVER-PERIOD COMPARISON
  // ════════════════════════════════════════════════════════════════════════════

  async getKPIComparison(dateRange: DateRange): Promise<{
    current:    PlatformKPIs;
    previous:   PlatformKPIs;
    comparison: Record<string, { current: number; previous: number; change: number; percentChange: number; trend: 'up' | 'down' | 'stable' }>;
  }> {
    const periodMs       = dateRange.endDate.getTime() - dateRange.startDate.getTime();
    const previousRange: DateRange = {
      startDate: new Date(dateRange.startDate.getTime() - periodMs),
      endDate:   new Date(dateRange.startDate.getTime() - 1),
    };

    const [current, previous] = await Promise.all([
      this.getPlatformKPIs(dateRange),
      this.getPlatformKPIs(previousRange),
    ]);

    const comparison: Record<string, any> = {};
    for (const key of Object.keys(current) as Array<keyof PlatformKPIs>) {
      if (typeof current[key] === 'number' && typeof previous[key] === 'number') {
        const c = current[key]  as number;
        const p = previous[key] as number;
        const change        = c - p;
        const percentChange = p !== 0 ? Math.round((change / p) * 100) : c > 0 ? 100 : 0;
        comparison[key] = {
          current:  c,
          previous: p,
          change,
          percentChange,
          trend: change > 0 ? 'up' : change < 0 ? 'down' : 'stable',
        };
      }
    }

    return { current, previous, comparison };
  }
}