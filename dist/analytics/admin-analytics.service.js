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
var AdminAnalyticsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminAnalyticsService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const booking_schema_1 = require("../bookings/schema/booking.schema");
const property_schema_1 = require("../properties/schemas/property.schema");
const review_schema_1 = require("../reviews/schemas/review.schema");
const user_schema_1 = require("../users/schemas/user.schema");
function periodGroupExpr(granularity, field = '$createdAt') {
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
    return { $dateToString: { format: '%Y-%m', date: field } };
}
let AdminAnalyticsService = AdminAnalyticsService_1 = class AdminAnalyticsService {
    bookingModel;
    propertyModel;
    reviewModel;
    userModel;
    logger = new common_1.Logger(AdminAnalyticsService_1.name);
    constructor(bookingModel, propertyModel, reviewModel, userModel) {
        this.bookingModel = bookingModel;
        this.propertyModel = propertyModel;
        this.reviewModel = reviewModel;
        this.userModel = userModel;
    }
    async getAdminDashboard(dateRange, granularity = 'month') {
        this.logger.log(`[AdminAnalytics] Dashboard: ${dateRange.startDate.toISOString()} → ${dateRange.endDate.toISOString()}`);
        const [kpis, revenueOverTime, occupancyOverTime, bookingStatusBreakdown, propertyTypeBreakdown, topProperties, cityPerformance, hostLeaderboard,] = await Promise.all([
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
                endDate: dateRange.endDate.toISOString(),
            },
        };
    }
    async getPlatformKPIs(dateRange) {
        const dateFilter = {
            createdAt: { $gte: dateRange.startDate, $lte: dateRange.endDate },
        };
        const statusCounts = await this.bookingModel.aggregate([
            { $match: dateFilter },
            { $group: { _id: '$status', count: { $sum: 1 } } },
        ]);
        const byStatus = Object.fromEntries(statusCounts.map((s) => [s._id, s.count]));
        const totalBookings = statusCounts.reduce((a, s) => a + s.count, 0);
        const confirmedBookings = byStatus[booking_schema_1.BookingStatus.CONFIRMED] ?? 0;
        const cancelledBookings = byStatus[booking_schema_1.BookingStatus.CANCELLED] ?? 0;
        const completedBookings = byStatus[booking_schema_1.BookingStatus.COMPLETED] ?? 0;
        const pendingBookings = byStatus[booking_schema_1.BookingStatus.PENDING] ?? 0;
        const cancellationRate = totalBookings > 0
            ? Math.round((cancelledBookings / totalBookings) * 100)
            : 0;
        const revenueAgg = await this.bookingModel.aggregate([
            {
                $match: {
                    ...dateFilter,
                    status: { $in: [booking_schema_1.BookingStatus.CONFIRMED, booking_schema_1.BookingStatus.COMPLETED] },
                },
            },
            {
                $group: {
                    _id: null,
                    grossRevenue: { $sum: '$priceBreakdown.totalAmount' },
                    platformFees: { $sum: '$priceBreakdown.serviceFee' },
                    totalBookings: { $sum: 1 },
                    totalNights: { $sum: '$nights' },
                    totalLeadTime: {
                        $sum: {
                            $divide: [
                                { $subtract: ['$checkIn', '$createdAt'] },
                                1000 * 60 * 60 * 24,
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
        const paidCount = rev.totalBookings || 1;
        const grossRevenue = rev.grossRevenue ?? 0;
        const platformFeeRevenue = rev.platformFees ?? 0;
        const averageBookingValue = Math.round(grossRevenue / paidCount);
        const averageNightsBooked = Math.round((rev.totalNights ?? 0) / paidCount * 10) / 10;
        const averageLeadTime = Math.round((rev.totalLeadTime ?? 0) / paidCount * 10) / 10;
        const activeShortTermCount = await this.propertyModel.countDocuments({
            listingType: property_schema_1.ListingType.SHORT_TERM,
            isActive: true,
        });
        const rangeNights = Math.ceil((dateRange.endDate.getTime() - dateRange.startDate.getTime()) / (1000 * 60 * 60 * 24));
        const totalAvailableNights = activeShortTermCount * rangeNights;
        const averageOccupancyRate = totalAvailableNights > 0
            ? Math.round(((rev.totalNights ?? 0) / totalAvailableNights) * 100)
            : 0;
        const [guestAgg, hostAgg] = await Promise.all([
            this.bookingModel.aggregate([
                {
                    $match: {
                        ...dateFilter,
                        status: { $in: [booking_schema_1.BookingStatus.CONFIRMED, booking_schema_1.BookingStatus.COMPLETED] },
                    },
                },
                { $group: { _id: '$guestId' } },
                { $count: 'total' },
            ]),
            this.bookingModel.aggregate([
                {
                    $match: {
                        ...dateFilter,
                        status: { $in: [booking_schema_1.BookingStatus.CONFIRMED, booking_schema_1.BookingStatus.COMPLETED] },
                    },
                },
                { $group: { _id: '$hostId' } },
                { $count: 'total' },
            ]),
        ]);
        const totalGuests = guestAgg[0]?.total ?? 0;
        const totalHosts = hostAgg[0]?.total ?? 0;
        const newGuestsAgg = await this.bookingModel.aggregate([
            {
                $match: {
                    status: { $in: [booking_schema_1.BookingStatus.CONFIRMED, booking_schema_1.BookingStatus.COMPLETED] },
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
        const reviewAgg = await this.reviewModel.aggregate([
            {
                $match: {
                    reviewType: review_schema_1.ReviewType.STAY,
                    isActive: true,
                    createdAt: { $gte: dateRange.startDate, $lte: dateRange.endDate },
                },
            },
            {
                $group: {
                    _id: null,
                    totalReviews: { $sum: 1 },
                    averageRating: { $avg: '$rating' },
                },
            },
        ]);
        const totalReviews = reviewAgg[0]?.totalReviews ?? 0;
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
    async getRevenueOverTime(dateRange, granularity = 'month', filters = {}) {
        const matchStage = {
            status: { $in: [booking_schema_1.BookingStatus.CONFIRMED, booking_schema_1.BookingStatus.COMPLETED] },
            createdAt: { $gte: dateRange.startDate, $lte: dateRange.endDate },
        };
        if (filters.hostId) {
            matchStage.hostId = new mongoose_2.Types.ObjectId(filters.hostId);
        }
        const pipeline = [
            { $match: matchStage },
        ];
        if (filters.propertyType) {
            pipeline.push({
                $lookup: {
                    from: 'properties',
                    localField: 'propertyId',
                    foreignField: '_id',
                    as: 'property',
                },
            }, { $unwind: '$property' }, { $match: { 'property.type': filters.propertyType } });
        }
        pipeline.push({
            $group: {
                _id: periodGroupExpr(granularity, '$createdAt'),
                grossRevenue: { $sum: '$priceBreakdown.totalAmount' },
                platformFees: { $sum: '$priceBreakdown.serviceFee' },
                bookingCount: { $sum: 1 },
            },
        }, { $sort: { _id: 1 } });
        const results = await this.bookingModel.aggregate(pipeline);
        return results.map((r) => ({
            period: r._id,
            grossRevenue: Math.round(r.grossRevenue ?? 0),
            platformFees: Math.round(r.platformFees ?? 0),
            bookingCount: r.bookingCount,
            averageValue: r.bookingCount > 0
                ? Math.round((r.grossRevenue ?? 0) / r.bookingCount)
                : 0,
        }));
    }
    async getOccupancyOverTime(dateRange, granularity = 'month', filters = {}) {
        const propertyFilter = {
            listingType: property_schema_1.ListingType.SHORT_TERM,
            isActive: true,
        };
        if (filters.city)
            propertyFilter.city = new RegExp(filters.city, 'i');
        if (filters.propertyId)
            propertyFilter._id = new mongoose_2.Types.ObjectId(filters.propertyId);
        const propertyCount = await this.propertyModel.countDocuments(propertyFilter);
        const matchStage = {
            status: { $in: [booking_schema_1.BookingStatus.CONFIRMED, booking_schema_1.BookingStatus.COMPLETED] },
            checkIn: { $lte: dateRange.endDate },
            checkOut: { $gte: dateRange.startDate },
        };
        if (filters.propertyId) {
            matchStage.propertyId = new mongoose_2.Types.ObjectId(filters.propertyId);
        }
        if (filters.city && !filters.propertyId) {
            const props = await this.propertyModel
                .find(propertyFilter)
                .select('_id')
                .lean();
            matchStage.propertyId = { $in: props.map((p) => p._id) };
        }
        const results = await this.bookingModel.aggregate([
            { $match: matchStage },
            {
                $group: {
                    _id: periodGroupExpr(granularity, '$checkIn'),
                    nightsBooked: { $sum: '$nights' },
                    bookingCount: { $sum: 1 },
                },
            },
            { $sort: { _id: 1 } },
        ]);
        const daysInPeriod = Math.ceil((dateRange.endDate.getTime() - dateRange.startDate.getTime()) / (1000 * 60 * 60 * 24));
        const bucketsCount = results.length || 1;
        const nightsPerBucket = Math.round(daysInPeriod / bucketsCount);
        return results.map((r) => {
            const nightsAvailable = nightsPerBucket * propertyCount;
            const occupancyRate = nightsAvailable > 0
                ? Math.min(100, Math.round((r.nightsBooked / nightsAvailable) * 100))
                : 0;
            return {
                period: r._id,
                occupancyRate,
                nightsBooked: r.nightsBooked,
                nightsAvailable,
                propertyCount,
            };
        });
    }
    async getBookingStatusBreakdown(dateRange) {
        const results = await this.bookingModel.aggregate([
            {
                $match: {
                    createdAt: { $gte: dateRange.startDate, $lte: dateRange.endDate },
                },
            },
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 },
                    revenue: { $sum: '$priceBreakdown.totalAmount' },
                },
            },
        ]);
        const total = results.reduce((a, r) => a + r.count, 0);
        return results.map((r) => ({
            status: r._id,
            count: r.count,
            percentage: total > 0 ? Math.round((r.count / total) * 100) : 0,
            revenue: Math.round(r.revenue ?? 0),
        }));
    }
    async getPropertyTypeBreakdown(dateRange) {
        const results = await this.bookingModel.aggregate([
            {
                $match: {
                    status: { $in: [booking_schema_1.BookingStatus.CONFIRMED, booking_schema_1.BookingStatus.COMPLETED] },
                    createdAt: { $gte: dateRange.startDate, $lte: dateRange.endDate },
                },
            },
            {
                $lookup: {
                    from: 'properties',
                    localField: 'propertyId',
                    foreignField: '_id',
                    as: 'property',
                },
            },
            { $unwind: '$property' },
            {
                $group: {
                    _id: '$property.type',
                    bookingCount: { $sum: 1 },
                    revenue: { $sum: '$priceBreakdown.totalAmount' },
                    totalNights: { $sum: '$nights' },
                    propertyIds: { $addToSet: '$propertyId' },
                },
            },
            { $sort: { bookingCount: -1 } },
        ]);
        const totalBookings = results.reduce((a, r) => a + r.bookingCount, 0);
        return Promise.all(results.map(async (r) => {
            const ratingAgg = await this.reviewModel.aggregate([
                {
                    $match: {
                        propertyId: { $in: r.propertyIds },
                        reviewType: review_schema_1.ReviewType.STAY,
                        isActive: true,
                    },
                },
                { $group: { _id: null, avg: { $avg: '$rating' } } },
            ]);
            const propertyCount = r.propertyIds.length;
            const rangeNights = Math.ceil((dateRange.endDate.getTime() - dateRange.startDate.getTime()) /
                (1000 * 60 * 60 * 24));
            const occupancyRate = propertyCount > 0 && rangeNights > 0
                ? Math.min(100, Math.round((r.totalNights / (propertyCount * rangeNights)) * 100))
                : 0;
            return {
                type: r._id,
                bookingCount: r.bookingCount,
                revenue: Math.round(r.revenue ?? 0),
                occupancyRate,
                averageRating: ratingAgg[0]
                    ? Math.round(ratingAgg[0].avg * 10) / 10
                    : 0,
                percentage: totalBookings > 0
                    ? Math.round((r.bookingCount / totalBookings) * 100)
                    : 0,
            };
        }));
    }
    async getTopProperties(dateRange, limit = 10) {
        const results = await this.bookingModel.aggregate([
            {
                $match: {
                    status: { $in: [booking_schema_1.BookingStatus.CONFIRMED, booking_schema_1.BookingStatus.COMPLETED] },
                    createdAt: { $gte: dateRange.startDate, $lte: dateRange.endDate },
                },
            },
            {
                $group: {
                    _id: '$propertyId',
                    bookingCount: { $sum: 1 },
                    revenue: { $sum: '$priceBreakdown.totalAmount' },
                    totalNights: { $sum: '$nights' },
                },
            },
            { $sort: { revenue: -1 } },
            { $limit: limit },
            {
                $lookup: {
                    from: 'properties',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'property',
                },
            },
            { $unwind: '$property' },
            {
                $lookup: {
                    from: 'users',
                    localField: 'property.ownerId',
                    foreignField: '_id',
                    as: 'host',
                },
            },
            { $unwind: { path: '$host', preserveNullAndEmptyArrays: true } },
        ]);
        const rangeNights = Math.ceil((dateRange.endDate.getTime() - dateRange.startDate.getTime()) /
            (1000 * 60 * 60 * 24));
        return Promise.all(results.map(async (r) => {
            const ratingAgg = await this.reviewModel.aggregate([
                {
                    $match: {
                        propertyId: r._id,
                        reviewType: review_schema_1.ReviewType.STAY,
                        isActive: true,
                    },
                },
                {
                    $group: {
                        _id: null,
                        avg: { $avg: '$rating' },
                        count: { $sum: 1 },
                    },
                },
            ]);
            const occupancyRate = rangeNights > 0
                ? Math.min(100, Math.round((r.totalNights / rangeNights) * 100))
                : 0;
            return {
                propertyId: r._id.toString(),
                title: r.property?.title ?? 'Unknown',
                city: r.property?.city ?? '',
                type: r.property?.type ?? '',
                hostName: r.host?.name ?? 'Unknown',
                bookingCount: r.bookingCount,
                revenue: Math.round(r.revenue ?? 0),
                occupancyRate,
                averageRating: ratingAgg[0] ? Math.round(ratingAgg[0].avg * 10) / 10 : 0,
                reviewCount: ratingAgg[0]?.count ?? 0,
            };
        }));
    }
    async getCityPerformance(dateRange, limit = 10) {
        const results = await this.bookingModel.aggregate([
            {
                $match: {
                    status: { $in: [booking_schema_1.BookingStatus.CONFIRMED, booking_schema_1.BookingStatus.COMPLETED] },
                    createdAt: { $gte: dateRange.startDate, $lte: dateRange.endDate },
                },
            },
            {
                $lookup: {
                    from: 'properties',
                    localField: 'propertyId',
                    foreignField: '_id',
                    as: 'property',
                },
            },
            { $unwind: '$property' },
            {
                $group: {
                    _id: '$property.city',
                    bookingCount: { $sum: 1 },
                    revenue: { $sum: '$priceBreakdown.totalAmount' },
                    totalNights: { $sum: '$nights' },
                    propertyIds: { $addToSet: '$propertyId' },
                },
            },
            { $sort: { revenue: -1 } },
            { $limit: limit },
        ]);
        const rangeNights = Math.ceil((dateRange.endDate.getTime() - dateRange.startDate.getTime()) /
            (1000 * 60 * 60 * 24));
        return Promise.all(results.map(async (r) => {
            const propertyCount = r.propertyIds.length;
            const ratingAgg = await this.reviewModel.aggregate([
                {
                    $match: {
                        propertyId: { $in: r.propertyIds },
                        reviewType: review_schema_1.ReviewType.STAY,
                        isActive: true,
                    },
                },
                { $group: { _id: null, avg: { $avg: '$rating' } } },
            ]);
            const occupancyRate = propertyCount > 0 && rangeNights > 0
                ? Math.min(100, Math.round((r.totalNights / (propertyCount * rangeNights)) * 100))
                : 0;
            return {
                city: r._id,
                bookingCount: r.bookingCount,
                revenue: Math.round(r.revenue ?? 0),
                propertyCount,
                averageRating: ratingAgg[0] ? Math.round(ratingAgg[0].avg * 10) / 10 : 0,
                occupancyRate,
            };
        }));
    }
    async getHostLeaderboard(dateRange, limit = 10) {
        const results = await this.bookingModel.aggregate([
            {
                $match: {
                    createdAt: { $gte: dateRange.startDate, $lte: dateRange.endDate },
                },
            },
            {
                $group: {
                    _id: '$hostId',
                    bookingCount: { $sum: 1 },
                    revenue: {
                        $sum: {
                            $cond: [
                                { $in: ['$status', [booking_schema_1.BookingStatus.CONFIRMED, booking_schema_1.BookingStatus.COMPLETED]] },
                                '$priceBreakdown.totalAmount',
                                0,
                            ],
                        },
                    },
                    cancelledCount: {
                        $sum: {
                            $cond: [{ $eq: ['$status', booking_schema_1.BookingStatus.CANCELLED] }, 1, 0],
                        },
                    },
                    propertyIds: { $addToSet: '$propertyId' },
                },
            },
            { $sort: { revenue: -1 } },
            { $limit: limit },
            {
                $lookup: {
                    from: 'users',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'host',
                },
            },
            { $unwind: { path: '$host', preserveNullAndEmptyArrays: true } },
        ]);
        return Promise.all(results.map(async (r) => {
            const ratingAgg = await this.reviewModel.aggregate([
                {
                    $match: {
                        propertyId: { $in: r.propertyIds },
                        reviewType: review_schema_1.ReviewType.STAY,
                        isActive: true,
                    },
                },
                { $group: { _id: null, avg: { $avg: '$rating' } } },
            ]);
            const cancellationRate = r.bookingCount > 0
                ? Math.round((r.cancelledCount / r.bookingCount) * 100)
                : 0;
            return {
                hostId: r._id.toString(),
                hostName: r.host?.name ?? 'Unknown',
                bookingCount: r.bookingCount,
                revenue: Math.round(r.revenue ?? 0),
                averageRating: ratingAgg[0] ? Math.round(ratingAgg[0].avg * 10) / 10 : 0,
                propertyCount: r.propertyIds.length,
                cancellationRate,
            };
        }));
    }
    async getKPIComparison(dateRange) {
        const periodMs = dateRange.endDate.getTime() - dateRange.startDate.getTime();
        const previousRange = {
            startDate: new Date(dateRange.startDate.getTime() - periodMs),
            endDate: new Date(dateRange.startDate.getTime() - 1),
        };
        const [current, previous] = await Promise.all([
            this.getPlatformKPIs(dateRange),
            this.getPlatformKPIs(previousRange),
        ]);
        const comparison = {};
        for (const key of Object.keys(current)) {
            if (typeof current[key] === 'number' && typeof previous[key] === 'number') {
                const c = current[key];
                const p = previous[key];
                const change = c - p;
                const percentChange = p !== 0 ? Math.round((change / p) * 100) : c > 0 ? 100 : 0;
                comparison[key] = {
                    current: c,
                    previous: p,
                    change,
                    percentChange,
                    trend: change > 0 ? 'up' : change < 0 ? 'down' : 'stable',
                };
            }
        }
        return { current, previous, comparison };
    }
};
exports.AdminAnalyticsService = AdminAnalyticsService;
exports.AdminAnalyticsService = AdminAnalyticsService = AdminAnalyticsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(booking_schema_1.Booking.name)),
    __param(1, (0, mongoose_1.InjectModel)(property_schema_1.Property.name)),
    __param(2, (0, mongoose_1.InjectModel)(review_schema_1.Review.name)),
    __param(3, (0, mongoose_1.InjectModel)(user_schema_1.User.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model])
], AdminAnalyticsService);
//# sourceMappingURL=admin-analytics.service.js.map