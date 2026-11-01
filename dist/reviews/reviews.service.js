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
var ReviewsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReviewsService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const review_schema_1 = require("./schemas/review.schema");
const user_schema_1 = require("../users/schemas/user.schema");
const property_schema_1 = require("../properties/schemas/property.schema");
const booking_schema_1 = require("../bookings/schema/booking.schema");
const REVIEW_WINDOW_DAYS = 14;
let ReviewsService = ReviewsService_1 = class ReviewsService {
    reviewModel;
    propertyModel;
    userModel;
    bookingModel;
    logger = new common_1.Logger(ReviewsService_1.name);
    constructor(reviewModel, propertyModel, userModel, bookingModel) {
        this.reviewModel = reviewModel;
        this.propertyModel = propertyModel;
        this.userModel = userModel;
        this.bookingModel = bookingModel;
    }
    async create(createReviewDto, user) {
        try {
            const { reviewType } = createReviewDto;
            if (reviewType === review_schema_1.ReviewType.STAY || reviewType === review_schema_1.ReviewType.GUEST) {
                return this.createBookingReview(createReviewDto, user);
            }
            if (reviewType === review_schema_1.ReviewType.INSIGHT) {
                return this.createInsightReview(createReviewDto, user);
            }
            return this.createStandardReview(createReviewDto, user);
        }
        catch (error) {
            this.logger.error('Error creating review:', error);
            throw error;
        }
    }
    async createInsightReview(dto, user) {
        if (!dto.insightId) {
            throw new common_1.BadRequestException('insightId is required for insight reviews');
        }
        const PostModel = this.reviewModel.db.model('Post');
        const post = await PostModel.findById(dto.insightId);
        if (!post)
            throw new common_1.NotFoundException('Insight/Article not found');
        const review = new this.reviewModel({
            userId: user._id,
            userName: user.name,
            reviewType: dto.reviewType,
            reviewerRole: review_schema_1.ReviewerRole.GUEST,
            insightId: new mongoose_2.Types.ObjectId(dto.insightId),
            rating: dto.rating,
            comment: dto.comment,
            images: dto.images ?? [],
            verified: true,
            bookingVerified: false,
            isPublished: true,
        });
        const saved = await review.save();
        await PostModel.findByIdAndUpdate(dto.insightId, { $inc: { commentCount: 1 } });
        this.logger.log(`Insight review created: ${saved._id} by user ${user._id}`);
        return saved;
    }
    async createStandardReview(dto, user) {
        if (dto.reviewType === review_schema_1.ReviewType.PROPERTY && !dto.propertyId) {
            throw new common_1.BadRequestException('propertyId is required for property reviews');
        }
        if (dto.reviewType === review_schema_1.ReviewType.AGENT && !dto.agentId) {
            throw new common_1.BadRequestException('agentId is required for agent reviews');
        }
        const existing = await this.checkExistingReview(user._id, dto.propertyId, dto.agentId);
        if (existing) {
            throw new common_1.BadRequestException(`You have already reviewed this ${dto.reviewType}`);
        }
        if (dto.propertyId) {
            const property = await this.propertyModel.findById(dto.propertyId);
            if (!property)
                throw new common_1.NotFoundException('Property not found');
        }
        if (dto.agentId) {
            const agent = await this.userModel.findOne({
                _id: dto.agentId,
                role: { $in: [user_schema_1.UserRole.HOST, user_schema_1.UserRole.AGENT, user_schema_1.UserRole.LANDLORD] },
                isActive: true,
            });
            if (!agent)
                throw new common_1.NotFoundException('Agent not found');
        }
        const review = new this.reviewModel({
            userId: user._id,
            userName: user.name,
            reviewType: dto.reviewType,
            reviewerRole: review_schema_1.ReviewerRole.GUEST,
            propertyId: dto.propertyId ? new mongoose_2.Types.ObjectId(dto.propertyId) : undefined,
            agentId: dto.agentId ? new mongoose_2.Types.ObjectId(dto.agentId) : undefined,
            rating: dto.rating,
            comment: dto.comment,
            images: dto.images ?? [],
            verified: true,
            bookingVerified: false,
            isPublished: true,
        });
        const saved = await review.save();
        if (dto.propertyId)
            await this.updatePropertyRating(dto.propertyId);
        if (dto.agentId)
            await this.updateAgentRating(dto.agentId);
        this.logger.log(`Standard review created: ${saved._id} by user ${user._id}`);
        return saved;
    }
    async createBookingReview(dto, user) {
        if (!dto.bookingId) {
            throw new common_1.BadRequestException('bookingId is required for stay and guest reviews');
        }
        const booking = await this.bookingModel
            .findById(dto.bookingId)
            .populate('propertyId', 'title city')
            .exec();
        if (!booking)
            throw new common_1.NotFoundException('Booking not found');
        if (booking.status !== booking_schema_1.BookingStatus.COMPLETED) {
            throw new common_1.BadRequestException('Reviews can only be submitted after a completed stay');
        }
        const isGuest = booking.guestId.toString() === user._id.toString();
        const isHost = booking.hostId.toString() === user._id.toString();
        if (dto.reviewType === review_schema_1.ReviewType.STAY && !isGuest) {
            throw new common_1.ForbiddenException('Only the guest who completed this booking can submit a stay review');
        }
        if (dto.reviewType === review_schema_1.ReviewType.GUEST && !isHost) {
            throw new common_1.ForbiddenException('Only the host of this booking can submit a guest review');
        }
        const checkoutDate = booking.actualCheckOut ?? booking.checkOut;
        const daysSinceCheckout = Math.floor((Date.now() - checkoutDate.getTime()) / (1000 * 60 * 60 * 24));
        if (daysSinceCheckout > REVIEW_WINDOW_DAYS) {
            throw new common_1.BadRequestException(`The ${REVIEW_WINDOW_DAYS}-day review window for this booking has closed`);
        }
        const reviewerRole = dto.reviewType === review_schema_1.ReviewType.STAY
            ? review_schema_1.ReviewerRole.GUEST
            : review_schema_1.ReviewerRole.HOST;
        const alreadyReviewed = await this.reviewModel.findOne({
            bookingId: new mongoose_2.Types.ObjectId(dto.bookingId),
            reviewerRole,
            isActive: true,
        });
        if (alreadyReviewed) {
            throw new common_1.BadRequestException(`You have already submitted a ${dto.reviewType} review for this booking`);
        }
        const publishDeadline = new Date(checkoutDate);
        publishDeadline.setDate(publishDeadline.getDate() + REVIEW_WINDOW_DAYS);
        const otherRole = reviewerRole === review_schema_1.ReviewerRole.GUEST
            ? review_schema_1.ReviewerRole.HOST
            : review_schema_1.ReviewerRole.GUEST;
        const otherReview = await this.reviewModel.findOne({
            bookingId: new mongoose_2.Types.ObjectId(dto.bookingId),
            reviewerRole: otherRole,
            isActive: true,
        });
        const shouldPublishNow = !!otherReview;
        const propertyId = booking.propertyId?._id ?? booking.propertyId;
        const review = new this.reviewModel({
            userId: user._id,
            userName: user.name,
            reviewType: dto.reviewType,
            reviewerRole,
            propertyId: dto.reviewType === review_schema_1.ReviewType.STAY ? propertyId : undefined,
            bookingId: new mongoose_2.Types.ObjectId(dto.bookingId),
            reviewedUserId: dto.reviewType === review_schema_1.ReviewType.GUEST
                ? booking.guestId
                : undefined,
            rating: dto.rating,
            staySubRatings: dto.staySubRatings ?? {},
            guestSubRatings: dto.guestSubRatings ?? {},
            comment: dto.comment,
            images: dto.images ?? [],
            verified: true,
            bookingVerified: true,
            isPublished: shouldPublishNow,
            publishDeadline,
        });
        const saved = await review.save();
        if (shouldPublishNow && otherReview) {
            await this.reviewModel.findByIdAndUpdate(otherReview._id, { isPublished: true });
        }
        const bookingUpdate = {};
        if (dto.reviewType === review_schema_1.ReviewType.STAY)
            bookingUpdate.guestReviewLeft = true;
        if (dto.reviewType === review_schema_1.ReviewType.GUEST)
            bookingUpdate.hostReviewLeft = true;
        await this.bookingModel.findByIdAndUpdate(dto.bookingId, bookingUpdate);
        if (dto.reviewType === review_schema_1.ReviewType.STAY) {
            await this.updatePropertyStayRating(propertyId.toString());
        }
        this.logger.log(`Booking review created: ${saved._id} | booking: ${dto.bookingId} | ` +
            `role: ${reviewerRole} | published: ${shouldPublishNow}`);
        return saved;
    }
    async findAll(filters = {}, options = {}) {
        const { page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc' } = options;
        const skip = (page - 1) * limit;
        const query = { isActive: true, isPublished: true };
        if (filters.reviewType)
            query.reviewType = filters.reviewType;
        if (filters.propertyId)
            query.propertyId = new mongoose_2.Types.ObjectId(filters.propertyId);
        if (filters.agentId)
            query.agentId = new mongoose_2.Types.ObjectId(filters.agentId);
        if (filters.bookingId)
            query.bookingId = new mongoose_2.Types.ObjectId(filters.bookingId);
        if (filters.insightId)
            query.insightId = new mongoose_2.Types.ObjectId(filters.insightId);
        if (filters.reviewedUserId)
            query.reviewedUserId = new mongoose_2.Types.ObjectId(filters.reviewedUserId);
        if (filters.minRating || filters.maxRating) {
            query.rating = {};
            if (filters.minRating)
                query.rating.$gte = filters.minRating;
            if (filters.maxRating)
                query.rating.$lte = filters.maxRating;
        }
        if (typeof filters.verified === 'boolean')
            query.verified = filters.verified;
        const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };
        const [reviews, total] = await Promise.all([
            this.reviewModel
                .find(query)
                .populate('userId', 'name profilePicture')
                .populate('respondedBy', 'name profilePicture')
                .populate('reviewedUserId', 'name profilePicture')
                .sort(sort)
                .skip(skip)
                .limit(limit)
                .exec(),
            this.reviewModel.countDocuments(query),
        ]);
        const avgResult = await this.reviewModel.aggregate([
            { $match: query },
            { $group: { _id: null, avgRating: { $avg: '$rating' } } },
        ]);
        const averageRating = avgResult[0]
            ? Number(avgResult[0].avgRating.toFixed(1))
            : 0;
        return { reviews, total, page, totalPages: Math.ceil(total / limit), averageRating };
    }
    async getPropertyReviews(propertyId, options = {}) {
        return this.findAll({ propertyId }, options);
    }
    async getPropertyReviewStats(propertyId) {
        const reviews = await this.reviewModel
            .find({
            propertyId: new mongoose_2.Types.ObjectId(propertyId),
            isActive: true,
            isPublished: true,
        })
            .select('rating staySubRatings reviewType')
            .lean()
            .exec();
        const base = this.calculateReviewStats(reviews);
        const stayReviews = reviews.filter((r) => r.reviewType === review_schema_1.ReviewType.STAY);
        const subRatingAverages = this.calculateSubRatingAverages(stayReviews);
        return { ...base, subRatingAverages };
    }
    async getInsightReviews(insightId, options = {}) {
        return this.findAll({ reviewType: review_schema_1.ReviewType.INSIGHT, insightId }, options);
    }
    async getAgentReviews(agentId, options = {}) {
        const { page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc' } = options;
        const skip = (page - 1) * limit;
        const properties = await this.propertyModel.find({
            $or: [{ agentId: new mongoose_2.Types.ObjectId(agentId) }, { ownerId: new mongoose_2.Types.ObjectId(agentId) }]
        }).select('_id').lean().exec();
        const propertyIds = properties.map(p => p._id);
        const query = {
            isActive: true,
            isPublished: true,
            $or: [
                { reviewType: review_schema_1.ReviewType.AGENT, agentId: new mongoose_2.Types.ObjectId(agentId) },
                { reviewType: review_schema_1.ReviewType.STAY, propertyId: { $in: propertyIds } },
                { reviewType: review_schema_1.ReviewType.GUEST, reviewedUserId: new mongoose_2.Types.ObjectId(agentId) }
            ]
        };
        const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };
        const [reviews, total] = await Promise.all([
            this.reviewModel
                .find(query)
                .populate('userId', 'name profilePicture')
                .populate('respondedBy', 'name profilePicture')
                .populate('reviewedUserId', 'name profilePicture')
                .sort(sort)
                .skip(skip)
                .limit(limit)
                .exec(),
            this.reviewModel.countDocuments(query),
        ]);
        const avgResult = await this.reviewModel.aggregate([
            { $match: query },
            { $group: { _id: null, avgRating: { $avg: '$rating' } } },
        ]);
        const averageRating = avgResult[0] ? Number(avgResult[0].avgRating.toFixed(1)) : 0;
        return { reviews, total, page, totalPages: Math.ceil(total / limit), averageRating };
    }
    async getAgentReviewStats(agentId) {
        const properties = await this.propertyModel.find({
            $or: [{ agentId: new mongoose_2.Types.ObjectId(agentId) }, { ownerId: new mongoose_2.Types.ObjectId(agentId) }]
        }).select('_id').lean().exec();
        const propertyIds = properties.map(p => p._id);
        const query = {
            isActive: true,
            isPublished: true,
            $or: [
                { reviewType: review_schema_1.ReviewType.AGENT, agentId: new mongoose_2.Types.ObjectId(agentId) },
                { reviewType: review_schema_1.ReviewType.STAY, propertyId: { $in: propertyIds } },
                { reviewType: review_schema_1.ReviewType.GUEST, reviewedUserId: new mongoose_2.Types.ObjectId(agentId) }
            ]
        };
        const reviews = await this.reviewModel
            .find(query)
            .select('rating')
            .lean()
            .exec();
        return this.calculateReviewStats(reviews);
    }
    async getGuestReviews(guestUserId, options = {}) {
        return this.findAll({ reviewType: review_schema_1.ReviewType.GUEST, reviewedUserId: guestUserId }, options);
    }
    async getBookingReviews(bookingId) {
        if (!mongoose_2.Types.ObjectId.isValid(bookingId)) {
            throw new common_1.BadRequestException('Invalid booking ID');
        }
        const [stayReview, guestReview] = await Promise.all([
            this.reviewModel
                .findOne({
                bookingId: new mongoose_2.Types.ObjectId(bookingId),
                reviewerRole: review_schema_1.ReviewerRole.GUEST,
                isActive: true,
            })
                .populate('userId', 'name profilePicture')
                .exec(),
            this.reviewModel
                .findOne({
                bookingId: new mongoose_2.Types.ObjectId(bookingId),
                reviewerRole: review_schema_1.ReviewerRole.HOST,
                isActive: true,
            })
                .populate('userId', 'name profilePicture')
                .exec(),
        ]);
        return { stayReview, guestReview };
    }
    async findOne(id) {
        if (!mongoose_2.Types.ObjectId.isValid(id)) {
            throw new common_1.BadRequestException('Invalid review ID');
        }
        const review = await this.reviewModel
            .findById(id)
            .populate('userId', 'name profilePicture')
            .populate('propertyId', 'title images address')
            .populate('agentId', 'name profilePicture agency')
            .populate('respondedBy', 'name profilePicture')
            .populate('reviewedUserId', 'name profilePicture')
            .exec();
        if (!review)
            throw new common_1.NotFoundException('Review not found');
        return review;
    }
    async getUserReviews(userId, options = {}) {
        const { page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc' } = options;
        const skip = (page - 1) * limit;
        const query = { userId: new mongoose_2.Types.ObjectId(userId), isActive: true };
        const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };
        const [reviews, total] = await Promise.all([
            this.reviewModel
                .find(query)
                .populate('propertyId', 'title images address')
                .populate('agentId', 'name profilePicture agency')
                .sort(sort).skip(skip).limit(limit)
                .exec(),
            this.reviewModel.countDocuments(query),
        ]);
        return { reviews, total, page, totalPages: Math.ceil(total / limit) };
    }
    async update(id, dto, user) {
        const review = await this.reviewModel.findById(id);
        if (!review)
            throw new common_1.NotFoundException('Review not found');
        if (review.userId.toString() !== user._id.toString()) {
            throw new common_1.ForbiddenException('You can only update your own reviews');
        }
        if (dto.rating)
            review.rating = dto.rating;
        if (dto.comment)
            review.comment = dto.comment;
        if (dto.images)
            review.images = dto.images;
        if (dto.staySubRatings)
            review.staySubRatings = dto.staySubRatings;
        if (dto.guestSubRatings)
            review.guestSubRatings = dto.guestSubRatings;
        await review.save();
        if (dto.rating) {
            if (review.propertyId)
                await this.updatePropertyRating(review.propertyId.toString());
            if (review.agentId)
                await this.updateAgentRating(review.agentId.toString());
            if (review.reviewType === review_schema_1.ReviewType.STAY && review.propertyId) {
                await this.updatePropertyStayRating(review.propertyId.toString());
            }
        }
        return review;
    }
    async respondToReview(id, dto, user) {
        const review = await this.reviewModel.findById(id);
        if (!review)
            throw new common_1.NotFoundException('Review not found');
        const canRespond = user.role === user_schema_1.UserRole.ADMIN ||
            (review.agentId?.toString() === user._id.toString()) ||
            (review.reviewType === review_schema_1.ReviewType.STAY && await this.isPropertyHost(review, user));
        if (!canRespond) {
            throw new common_1.ForbiddenException('You can only respond to reviews about yourself or your properties');
        }
        review.response = dto.response;
        review.respondedBy = user._id;
        review.respondedAt = new Date();
        await review.save();
        return review;
    }
    async markAsHelpful(id, user) {
        const review = await this.reviewModel.findById(id);
        if (!review)
            throw new common_1.NotFoundException('Review not found');
        const userId = user._id;
        const helpfulBy = review.helpfulBy ?? [];
        const helpfulCount = typeof review.helpfulCount === 'number' ? review.helpfulCount : 0;
        const alreadyMarked = helpfulBy.some((hId) => hId.toString() === userId.toString());
        if (alreadyMarked) {
            review.helpfulBy = helpfulBy.filter((hId) => hId.toString() !== userId.toString());
            review.helpfulCount = Math.max(0, helpfulCount - 1);
        }
        else {
            review.helpfulBy = [...helpfulBy, userId];
            review.helpfulCount = helpfulCount + 1;
        }
        await review.save();
        return review;
    }
    async remove(id, user) {
        const review = await this.reviewModel.findById(id);
        if (!review)
            throw new common_1.NotFoundException('Review not found');
        const canDelete = user.role === user_schema_1.UserRole.ADMIN ||
            review.userId.toString() === user._id.toString();
        if (!canDelete)
            throw new common_1.ForbiddenException('You can only delete your own reviews');
        review.isActive = false;
        await review.save();
        if (review.propertyId)
            await this.updatePropertyRating(review.propertyId.toString());
        if (review.agentId)
            await this.updateAgentRating(review.agentId.toString());
    }
    async publishExpiredReviews() {
        const result = await this.reviewModel.updateMany({
            isPublished: false,
            publishDeadline: { $lte: new Date() },
            isActive: true,
            bookingId: { $exists: true },
        }, { $set: { isPublished: true } });
        const published = result.modifiedCount;
        if (published > 0) {
            this.logger.log(`Force-published ${published} expired booking review(s)`);
        }
        return published;
    }
    async checkExistingReview(userId, propertyId, agentId) {
        const query = { userId, isActive: true };
        if (propertyId)
            query.propertyId = new mongoose_2.Types.ObjectId(propertyId);
        if (agentId)
            query.agentId = new mongoose_2.Types.ObjectId(agentId);
        return this.reviewModel.findOne(query).exec();
    }
    calculateReviewStats(reviews) {
        const totalReviews = reviews.length;
        const averageRating = totalReviews > 0
            ? reviews.reduce((acc, r) => acc + r.rating, 0) / totalReviews
            : 0;
        const ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
        reviews.forEach((r) => {
            ratingDistribution[r.rating] = (ratingDistribution[r.rating] ?? 0) + 1;
        });
        return {
            averageRating: Number(averageRating.toFixed(1)),
            totalReviews,
            ratingDistribution,
        };
    }
    calculateSubRatingAverages(stayReviews) {
        const categories = ['cleanliness', 'accuracy', 'checkIn', 'communication', 'location', 'value'];
        const result = {};
        categories.forEach((cat) => {
            const values = stayReviews
                .map((r) => r.staySubRatings?.[cat])
                .filter((v) => typeof v === 'number');
            if (values.length > 0) {
                result[cat] = Number((values.reduce((a, b) => a + b, 0) / values.length).toFixed(1));
            }
        });
        return result;
    }
    async updatePropertyRating(propertyId) {
        try {
            const stats = await this.getPropertyReviewStats(propertyId);
            await this.propertyModel.findByIdAndUpdate(propertyId, {
                averageRating: stats.averageRating,
                reviewCount: stats.totalReviews,
            });
        }
        catch (error) {
            this.logger.error(`Failed to update property rating for ${propertyId}:`, error);
        }
    }
    async updatePropertyStayRating(propertyId) {
        try {
            const stayReviews = await this.reviewModel
                .find({
                propertyId: new mongoose_2.Types.ObjectId(propertyId),
                reviewType: review_schema_1.ReviewType.STAY,
                isActive: true,
                isPublished: true,
            })
                .select('rating staySubRatings')
                .lean()
                .exec();
            if (stayReviews.length === 0)
                return;
            const subAverages = this.calculateSubRatingAverages(stayReviews);
            const overallAvg = Number((stayReviews.reduce((a, r) => a + r.rating, 0) / stayReviews.length).toFixed(1));
            await this.propertyModel.findByIdAndUpdate(propertyId, {
                averageRating: overallAvg,
                reviewCount: stayReviews.length,
                stayRatingBreakdown: subAverages,
            });
        }
        catch (error) {
            this.logger.error(`Failed to update stay rating for property ${propertyId}:`, error);
        }
    }
    async updateAgentRating(agentId) {
        try {
            const stats = await this.getAgentReviewStats(agentId);
            await this.userModel.findByIdAndUpdate(agentId, {
                averageRating: stats.averageRating,
                reviewCount: stats.totalReviews,
            });
        }
        catch (error) {
            this.logger.error(`Failed to update agent rating for ${agentId}:`, error);
        }
    }
    async isPropertyHost(review, user) {
        if (!review.propertyId)
            return false;
        const property = await this.propertyModel
            .findById(review.propertyId)
            .select('ownerId agentId')
            .lean()
            .exec();
        if (!property)
            return false;
        return (property.ownerId?.toString() === user._id.toString() ||
            property.agentId?.toString() === user._id.toString());
    }
};
exports.ReviewsService = ReviewsService;
exports.ReviewsService = ReviewsService = ReviewsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(review_schema_1.Review.name)),
    __param(1, (0, mongoose_1.InjectModel)(property_schema_1.Property.name)),
    __param(2, (0, mongoose_1.InjectModel)(user_schema_1.User.name)),
    __param(3, (0, mongoose_1.InjectModel)(booking_schema_1.Booking.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model])
], ReviewsService);
//# sourceMappingURL=reviews.service.js.map