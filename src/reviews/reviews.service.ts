import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { Review, ReviewDocument, ReviewType, ReviewerRole } from './schemas/review.schema';
import { User, UserRole, UserDocument } from '../users/schemas/user.schema';
import { Property, PropertyDocument } from '../properties/schemas/property.schema';
import { Booking, BookingDocument, BookingStatus } from '../bookings/schema/booking.schema';
import { CreateReviewDto, UpdateReviewDto, RespondReviewDto } from './dto';

// ─── How many days after checkout guests/hosts can still leave a review ───────
const REVIEW_WINDOW_DAYS = 14;

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface ReviewFilters {
  reviewType?: ReviewType;
  propertyId?: string;
  agentId?: string;
  bookingId?: string;
  insightId?: string;
  reviewedUserId?: string;
  minRating?: number;
  maxRating?: number;
  verified?: boolean;
}

export interface ReviewOptions {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class ReviewsService {
  private readonly logger = new Logger(ReviewsService.name);

  constructor(
    @InjectModel(Review.name) private reviewModel: Model<ReviewDocument>,
    @InjectModel(Property.name) private propertyModel: Model<PropertyDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Booking.name) private bookingModel: Model<BookingDocument>,
  ) { }

  // ════════════════════════════════════════════════════════════════════════════
  // CREATE
  // ════════════════════════════════════════════════════════════════════════════

  async create(createReviewDto: CreateReviewDto, user: User): Promise<Review> {
    try {
      const { reviewType } = createReviewDto;

      // ── Route to the correct creation handler ────────────────────────────
      if (reviewType === ReviewType.STAY || reviewType === ReviewType.GUEST) {
        return this.createBookingReview(createReviewDto, user);
      }
      if (reviewType === ReviewType.INSIGHT) {
        return this.createInsightReview(createReviewDto, user);
      }

      // ── Existing: property and agent reviews ─────────────────────────────
      return this.createStandardReview(createReviewDto, user);
    } catch (error) {
      this.logger.error('Error creating review:', error);
      throw error;
    }
  }

  // ─── Insight review ─────────────────────────────────────────────────────────

  private async createInsightReview(
    dto: CreateReviewDto,
    user: User,
  ): Promise<Review> {
    if (!dto.insightId) {
      throw new BadRequestException('insightId is required for insight reviews');
    }

    // Since this is for Article Comments, we may not restrict duplicates like we do for standard reviews,
    // or maybe we do depending on requirements. Standard article comments allow multiple per user.
    // For now, let's allow multiple comments per user on an article.

    // Validate article exists
    const PostModel = this.reviewModel.db.model('Post'); // Because ReviewService might not have injected PostModel directly
    const post = await PostModel.findById(dto.insightId);
    if (!post) throw new NotFoundException('Insight/Article not found');

    const review = new this.reviewModel({
      userId: user._id,
      userName: user.name,
      reviewType: dto.reviewType,
      reviewerRole: ReviewerRole.GUEST, // treat commenter as guest role safely
      insightId: new Types.ObjectId(dto.insightId),
      rating: dto.rating, // rating can be optional if the UI just sends 5, but DTO requires 1-5
      comment: dto.comment,
      images: dto.images ?? [],
      verified: true,
      bookingVerified: false,
      isPublished: true, // Auto-publish article comments
    });

    const saved = await review.save();

    // Increment comment count on the post
    await PostModel.findByIdAndUpdate(dto.insightId, { $inc: { commentCount: 1 } });

    this.logger.log(`Insight review created: ${saved._id} by user ${user._id}`);
    return saved;
  }

  // ─── Standard review (existing logic, unchanged) ──────────────────────────

  private async createStandardReview(
    dto: CreateReviewDto,
    user: User,
  ): Promise<Review> {
    if (dto.reviewType === ReviewType.PROPERTY && !dto.propertyId) {
      throw new BadRequestException('propertyId is required for property reviews');
    }
    if (dto.reviewType === ReviewType.AGENT && !dto.agentId) {
      throw new BadRequestException('agentId is required for agent reviews');
    }

    // Duplicate check
    const existing = await this.checkExistingReview(
      user._id as Types.ObjectId,
      dto.propertyId,
      dto.agentId,
    );
    if (existing) {
      throw new BadRequestException(
        `You have already reviewed this ${dto.reviewType}`,
      );
    }

    // Validate targets exist
    if (dto.propertyId) {
      const property = await this.propertyModel.findById(dto.propertyId);
      if (!property) throw new NotFoundException('Property not found');
    }
    if (dto.agentId) {
      const agent = await this.userModel.findOne({
        _id: dto.agentId,
        role: { $in: [UserRole.HOST, UserRole.AGENT, UserRole.LANDLORD] },
        isActive: true,
      });
      if (!agent) throw new NotFoundException('Agent not found');
    }

    const review = new this.reviewModel({
      userId: user._id,
      userName: user.name,
      reviewType: dto.reviewType,
      reviewerRole: ReviewerRole.GUEST,
      propertyId: dto.propertyId ? new Types.ObjectId(dto.propertyId) : undefined,
      agentId: dto.agentId ? new Types.ObjectId(dto.agentId) : undefined,
      rating: dto.rating,
      comment: dto.comment,
      images: dto.images ?? [],
      verified: true,
      bookingVerified: false,
      isPublished: true,   // standard reviews are immediately visible
    });

    const saved = await review.save();

    // Update denormalized ratings on the target document
    if (dto.propertyId) await this.updatePropertyRating(dto.propertyId);
    if (dto.agentId) await this.updateAgentRating(dto.agentId);

    this.logger.log(`Standard review created: ${saved._id} by user ${user._id}`);
    return saved;
  }

  // ─── Booking review (STAY or GUEST) ──────────────────────────────────────

  private async createBookingReview(
    dto: CreateReviewDto,
    user: User,
  ): Promise<Review> {
    if (!dto.bookingId) {
      throw new BadRequestException(
        'bookingId is required for stay and guest reviews',
      );
    }

    // ── 1. Load and validate the booking ────────────────────────────────────
    const booking = await this.bookingModel
      .findById(dto.bookingId)
      .populate('propertyId', 'title city')
      .exec();

    if (!booking) throw new NotFoundException('Booking not found');

    if (booking.status !== BookingStatus.COMPLETED) {
      throw new BadRequestException(
        'Reviews can only be submitted after a completed stay',
      );
    }

    // ── 2. Determine reviewer role and validate caller identity ──────────────
    const isGuest = booking.guestId.toString() === user._id.toString();
    const isHost = booking.hostId.toString() === user._id.toString();

    if (dto.reviewType === ReviewType.STAY && !isGuest) {
      throw new ForbiddenException(
        'Only the guest who completed this booking can submit a stay review',
      );
    }
    if (dto.reviewType === ReviewType.GUEST && !isHost) {
      throw new ForbiddenException(
        'Only the host of this booking can submit a guest review',
      );
    }

    // ── 3. Check review window ───────────────────────────────────────────────
    const checkoutDate = booking.actualCheckOut ?? booking.checkOut;
    const daysSinceCheckout = Math.floor(
      (Date.now() - checkoutDate.getTime()) / (1000 * 60 * 60 * 24),
    );
    if (daysSinceCheckout > REVIEW_WINDOW_DAYS) {
      throw new BadRequestException(
        `The ${REVIEW_WINDOW_DAYS}-day review window for this booking has closed`,
      );
    }

    // ── 4. Enforce one review per booking per side ───────────────────────────
    const reviewerRole = dto.reviewType === ReviewType.STAY
      ? ReviewerRole.GUEST
      : ReviewerRole.HOST;

    const alreadyReviewed = await this.reviewModel.findOne({
      bookingId: new Types.ObjectId(dto.bookingId),
      reviewerRole,
      isActive: true,
    });
    if (alreadyReviewed) {
      throw new BadRequestException(
        `You have already submitted a ${dto.reviewType} review for this booking`,
      );
    }

    // ── 5. Compute publish deadline and initial publication state ────────────
    const publishDeadline = new Date(checkoutDate);
    publishDeadline.setDate(publishDeadline.getDate() + REVIEW_WINDOW_DAYS);

    // Check if the other side has already reviewed — if so, publish both
    const otherRole = reviewerRole === ReviewerRole.GUEST
      ? ReviewerRole.HOST
      : ReviewerRole.GUEST;

    const otherReview = await this.reviewModel.findOne({
      bookingId: new Types.ObjectId(dto.bookingId),
      reviewerRole: otherRole,
      isActive: true,
    });

    // Both sides reviewed → publish immediately; otherwise hold
    const shouldPublishNow = !!otherReview;

    // ── 6. Build and save the review ─────────────────────────────────────────
    const propertyId = (booking.propertyId as any)?._id ?? booking.propertyId;

    const review = new this.reviewModel({
      userId: user._id,
      userName: user.name,
      reviewType: dto.reviewType,
      reviewerRole,
      propertyId: dto.reviewType === ReviewType.STAY ? propertyId : undefined,
      bookingId: new Types.ObjectId(dto.bookingId),
      reviewedUserId: dto.reviewType === ReviewType.GUEST
        ? booking.guestId   // host is reviewing the guest
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

    // ── 7. If other review was waiting, publish it now too ────────────────────
    if (shouldPublishNow && otherReview) {
      await this.reviewModel.findByIdAndUpdate(otherReview._id, { isPublished: true });
    }

    // ── 8. Update Booking flags ───────────────────────────────────────────────
    const bookingUpdate: any = {};
    if (dto.reviewType === ReviewType.STAY) bookingUpdate.guestReviewLeft = true;
    if (dto.reviewType === ReviewType.GUEST) bookingUpdate.hostReviewLeft = true;
    await this.bookingModel.findByIdAndUpdate(dto.bookingId, bookingUpdate);

    // ── 9. Update denormalized ratings on Property ────────────────────────────
    if (dto.reviewType === ReviewType.STAY) {
      await this.updatePropertyStayRating(propertyId.toString());
    }

    this.logger.log(
      `Booking review created: ${saved._id} | booking: ${dto.bookingId} | ` +
      `role: ${reviewerRole} | published: ${shouldPublishNow}`,
    );

    return saved;
  }

  // ════════════════════════════════════════════════════════════════════════════
  // READ — existing methods (extended, not replaced)
  // ════════════════════════════════════════════════════════════════════════════

  async findAll(
    filters: ReviewFilters = {},
    options: ReviewOptions = {},
  ): Promise<{
    reviews: Review[];
    total: number;
    page: number;
    totalPages: number;
    averageRating: number;
  }> {
    const { page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc' } = options;
    const skip = (page - 1) * limit;

    const query: any = { isActive: true, isPublished: true };

    if (filters.reviewType) query.reviewType = filters.reviewType;
    if (filters.propertyId) query.propertyId = new Types.ObjectId(filters.propertyId);
    if (filters.agentId) query.agentId = new Types.ObjectId(filters.agentId);
    if (filters.bookingId) query.bookingId = new Types.ObjectId(filters.bookingId);
    if (filters.insightId) query.insightId = new Types.ObjectId(filters.insightId);
    if (filters.reviewedUserId) query.reviewedUserId = new Types.ObjectId(filters.reviewedUserId);
    if (filters.minRating || filters.maxRating) {
      query.rating = {};
      if (filters.minRating) query.rating.$gte = filters.minRating;
      if (filters.maxRating) query.rating.$lte = filters.maxRating;
    }
    if (typeof filters.verified === 'boolean') query.verified = filters.verified;

    const sort: any = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

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

  async getPropertyReviews(propertyId: string, options: ReviewOptions = {}): Promise<any> {
    // Return both PROPERTY and STAY reviews for the same property
    return this.findAll(
      { propertyId },
      options,
    );
  }

  /**
   * Extended stats — includes sub-rating averages for STAY reviews.
   */
  async getPropertyReviewStats(propertyId: string): Promise<{
    averageRating: number;
    totalReviews: number;
    ratingDistribution: { [key: number]: number };
    subRatingAverages?: {
      cleanliness: number;
      accuracy: number;
      checkIn: number;
      communication: number;
      location: number;
      value: number;
    };
  }> {
    const reviews = await this.reviewModel
      .find({
        propertyId: new Types.ObjectId(propertyId),
        isActive: true,
        isPublished: true,
      })
      .select('rating staySubRatings reviewType')
      .lean()
      .exec();

    const base = this.calculateReviewStats(reviews);

    // Compute sub-rating averages from STAY reviews only
    const stayReviews = reviews.filter((r: any) => r.reviewType === ReviewType.STAY);
    const subRatingAverages = this.calculateSubRatingAverages(stayReviews);

    return { ...base, subRatingAverages };
  }

  async getInsightReviews(insightId: string, options: ReviewOptions = {}): Promise<any> {
    return this.findAll({ reviewType: ReviewType.INSIGHT, insightId }, options);
  }

  async getAgentReviews(agentId: string, options: ReviewOptions = {}): Promise<any> {
    const { page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc' } = options;
    const skip = (page - 1) * limit;

    const properties = await this.propertyModel.find({ 
      $or: [{ agentId: new Types.ObjectId(agentId) }, { ownerId: new Types.ObjectId(agentId) }] 
    }).select('_id').lean().exec();
    const propertyIds = properties.map(p => p._id);

    const query: any = {
      isActive: true,
      isPublished: true,
      $or: [
        { reviewType: ReviewType.AGENT, agentId: new Types.ObjectId(agentId) },
        { reviewType: ReviewType.STAY, propertyId: { $in: propertyIds } },
        { reviewType: ReviewType.GUEST, reviewedUserId: new Types.ObjectId(agentId) }
      ]
    };

    const sort: any = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

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

  async getAgentReviewStats(agentId: string): Promise<{
    averageRating: number;
    totalReviews: number;
    ratingDistribution: { [key: number]: number };
  }> {
    const properties = await this.propertyModel.find({ 
      $or: [{ agentId: new Types.ObjectId(agentId) }, { ownerId: new Types.ObjectId(agentId) }] 
    }).select('_id').lean().exec();
    const propertyIds = properties.map(p => p._id);

    const query: any = {
      isActive: true,
      isPublished: true,
      $or: [
        { reviewType: ReviewType.AGENT, agentId: new Types.ObjectId(agentId) },
        { reviewType: ReviewType.STAY, propertyId: { $in: propertyIds } },
        { reviewType: ReviewType.GUEST, reviewedUserId: new Types.ObjectId(agentId) }
      ]
    };

    const reviews = await this.reviewModel
      .find(query)
      .select('rating')
      .lean()
      .exec();

    return this.calculateReviewStats(reviews);
  }

  /**
   * NEW — Reviews received by a user as a guest (host → guest reviews).
   */
  async getGuestReviews(
    guestUserId: string,
    options: ReviewOptions = {},
  ): Promise<any> {
    return this.findAll(
      { reviewType: ReviewType.GUEST, reviewedUserId: guestUserId },
      options,
    );
  }

  /**
   * NEW — All reviews (both sides) associated with a single booking.
   */
  async getBookingReviews(bookingId: string): Promise<{
    stayReview: Review | null;
    guestReview: Review | null;
  }> {
    if (!Types.ObjectId.isValid(bookingId)) {
      throw new BadRequestException('Invalid booking ID');
    }

    const [stayReview, guestReview] = await Promise.all([
      this.reviewModel
        .findOne({
          bookingId: new Types.ObjectId(bookingId),
          reviewerRole: ReviewerRole.GUEST,
          isActive: true,
        })
        .populate('userId', 'name profilePicture')
        .exec(),
      this.reviewModel
        .findOne({
          bookingId: new Types.ObjectId(bookingId),
          reviewerRole: ReviewerRole.HOST,
          isActive: true,
        })
        .populate('userId', 'name profilePicture')
        .exec(),
    ]);

    return { stayReview, guestReview };
  }

  async findOne(id: string): Promise<Review> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid review ID');
    }

    const review = await this.reviewModel
      .findById(id)
      .populate('userId', 'name profilePicture')
      .populate('propertyId', 'title images address')
      .populate('agentId', 'name profilePicture agency')
      .populate('respondedBy', 'name profilePicture')
      .populate('reviewedUserId', 'name profilePicture')
      .exec();

    if (!review) throw new NotFoundException('Review not found');
    return review;
  }

  async getUserReviews(userId: string, options: ReviewOptions = {}): Promise<any> {
    const { page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc' } = options;
    const skip = (page - 1) * limit;

    const query = { userId: new Types.ObjectId(userId), isActive: true };
    const sort: any = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

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

  // ════════════════════════════════════════════════════════════════════════════
  // UPDATE / RESPOND / HELPFUL / DELETE — unchanged logic, new fields supported
  // ════════════════════════════════════════════════════════════════════════════

  async update(id: string, dto: UpdateReviewDto, user: User): Promise<Review> {
    const review = await this.reviewModel.findById(id);
    if (!review) throw new NotFoundException('Review not found');

    if (review.userId.toString() !== user._id.toString()) {
      throw new ForbiddenException('You can only update your own reviews');
    }

    if (dto.rating) review.rating = dto.rating;
    if (dto.comment) review.comment = dto.comment;
    if (dto.images) review.images = dto.images;
    if (dto.staySubRatings) review.staySubRatings = dto.staySubRatings;
    if (dto.guestSubRatings) review.guestSubRatings = dto.guestSubRatings;

    await review.save();

    if (dto.rating) {
      if (review.propertyId) await this.updatePropertyRating(review.propertyId.toString());
      if (review.agentId) await this.updateAgentRating(review.agentId.toString());
      // Re-compute stay sub-rating averages if this is a stay review
      if (review.reviewType === ReviewType.STAY && review.propertyId) {
        await this.updatePropertyStayRating(review.propertyId.toString());
      }
    }

    return review;
  }

  async respondToReview(id: string, dto: RespondReviewDto, user: User): Promise<Review> {
    const review = await this.reviewModel.findById(id);
    if (!review) throw new NotFoundException('Review not found');

    // Agents respond to agent/stay reviews; hosts respond to stay reviews on their property
    const canRespond =
      user.role === UserRole.ADMIN ||
      (review.agentId?.toString() === user._id.toString()) ||
      // For STAY reviews: the host (ownerId / agentId on the booking) can respond
      (review.reviewType === ReviewType.STAY && await this.isPropertyHost(review, user));

    if (!canRespond) {
      throw new ForbiddenException('You can only respond to reviews about yourself or your properties');
    }

    review.response = dto.response;
    review.respondedBy = user._id as Types.ObjectId;
    review.respondedAt = new Date();
    await review.save();

    return review;
  }

  async markAsHelpful(id: string, user: User): Promise<Review> {
    const review = await this.reviewModel.findById(id);
    if (!review) throw new NotFoundException('Review not found');

    const userId = user._id as Types.ObjectId;
    const helpfulBy = review.helpfulBy ?? [];
    const helpfulCount = typeof review.helpfulCount === 'number' ? review.helpfulCount : 0;

    const alreadyMarked = helpfulBy.some(
      (hId) => hId.toString() === userId.toString(),
    );

    if (alreadyMarked) {
      review.helpfulBy = helpfulBy.filter((hId) => hId.toString() !== userId.toString());
      review.helpfulCount = Math.max(0, helpfulCount - 1);
    } else {
      review.helpfulBy = [...helpfulBy, userId];
      review.helpfulCount = helpfulCount + 1;
    }

    await review.save();
    return review;
  }

  async remove(id: string, user: User): Promise<void> {
    const review = await this.reviewModel.findById(id);
    if (!review) throw new NotFoundException('Review not found');

    const canDelete =
      user.role === UserRole.ADMIN ||
      review.userId.toString() === user._id.toString();

    if (!canDelete) throw new ForbiddenException('You can only delete your own reviews');

    review.isActive = false;
    await review.save();

    if (review.propertyId) await this.updatePropertyRating(review.propertyId.toString());
    if (review.agentId) await this.updateAgentRating(review.agentId.toString());
  }

  // ════════════════════════════════════════════════════════════════════════════
  // ADMIN — PUBLISH EXPIRED REVIEWS (run via cron job)
  // ════════════════════════════════════════════════════════════════════════════

  /**
   * Force-publish all unpublished booking reviews whose publishDeadline
   * has passed. Call this from a scheduled task (e.g. every hour via @Cron).
   */
  async publishExpiredReviews(): Promise<number> {
    const result = await this.reviewModel.updateMany(
      {
        isPublished: false,
        publishDeadline: { $lte: new Date() },
        isActive: true,
        bookingId: { $exists: true },
      },
      { $set: { isPublished: true } },
    );

    const published = result.modifiedCount;
    if (published > 0) {
      this.logger.log(`Force-published ${published} expired booking review(s)`);
    }
    return published;
  }

  // ════════════════════════════════════════════════════════════════════════════
  // PRIVATE HELPERS
  // ════════════════════════════════════════════════════════════════════════════

  private async checkExistingReview(
    userId: Types.ObjectId,
    propertyId?: string,
    agentId?: string,
  ): Promise<Review | null> {
    const query: any = { userId, isActive: true };
    if (propertyId) query.propertyId = new Types.ObjectId(propertyId);
    if (agentId) query.agentId = new Types.ObjectId(agentId);
    return this.reviewModel.findOne(query).exec();
  }

  private calculateReviewStats(reviews: any[]): {
    averageRating: number;
    totalReviews: number;
    ratingDistribution: { [key: number]: number };
  } {
    const totalReviews = reviews.length;
    const averageRating = totalReviews > 0
      ? reviews.reduce((acc, r) => acc + r.rating, 0) / totalReviews
      : 0;

    const ratingDistribution: { [key: number]: number } = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    reviews.forEach((r) => {
      ratingDistribution[r.rating] = (ratingDistribution[r.rating] ?? 0) + 1;
    });

    return {
      averageRating: Number(averageRating.toFixed(1)),
      totalReviews,
      ratingDistribution,
    };
  }

  /**
   * Computes per-category average across all STAY reviews for a property.
   * Categories with no data are omitted from the result.
   */
  private calculateSubRatingAverages(stayReviews: any[]): any {
    const categories = ['cleanliness', 'accuracy', 'checkIn', 'communication', 'location', 'value'];
    const result: any = {};

    categories.forEach((cat) => {
      const values = stayReviews
        .map((r: any) => r.staySubRatings?.[cat])
        .filter((v: any) => typeof v === 'number');

      if (values.length > 0) {
        result[cat] = Number(
          (values.reduce((a: number, b: number) => a + b, 0) / values.length).toFixed(1),
        );
      }
    });

    return result;
  }

  private async updatePropertyRating(propertyId: string): Promise<void> {
    try {
      const stats = await this.getPropertyReviewStats(propertyId);
      await this.propertyModel.findByIdAndUpdate(propertyId, {
        averageRating: stats.averageRating,
        reviewCount: stats.totalReviews,
      });
    } catch (error) {
      this.logger.error(`Failed to update property rating for ${propertyId}:`, error);
    }
  }

  /**
   * Separate updater for stay sub-ratings so the property carries
   * aggregated sub-scores (used by the listing detail page).
   */
  private async updatePropertyStayRating(propertyId: string): Promise<void> {
    try {
      const stayReviews = await this.reviewModel
        .find({
          propertyId: new Types.ObjectId(propertyId),
          reviewType: ReviewType.STAY,
          isActive: true,
          isPublished: true,
        })
        .select('rating staySubRatings')
        .lean()
        .exec();

      if (stayReviews.length === 0) return;

      const subAverages = this.calculateSubRatingAverages(stayReviews);
      const overallAvg = Number(
        (stayReviews.reduce((a, r) => a + r.rating, 0) / stayReviews.length).toFixed(1),
      );

      // Store on property — add a `stayRatingBreakdown` field to property schema if desired
      await this.propertyModel.findByIdAndUpdate(propertyId, {
        averageRating: overallAvg,
        reviewCount: stayReviews.length,
        stayRatingBreakdown: subAverages,  // optional extended field
      });
    } catch (error) {
      this.logger.error(`Failed to update stay rating for property ${propertyId}:`, error);
    }
  }

  private async updateAgentRating(agentId: string): Promise<void> {
    try {
      const stats = await this.getAgentReviewStats(agentId);
      await this.userModel.findByIdAndUpdate(agentId, {
        averageRating: stats.averageRating,
        reviewCount: stats.totalReviews,
      });
    } catch (error) {
      this.logger.error(`Failed to update agent rating for ${agentId}:`, error);
    }
  }

  /**
   * Determines whether `user` is the host of the property referenced by `review`.
   * Used to gate host responses to STAY reviews.
   */
  private async isPropertyHost(review: ReviewDocument, user: User): Promise<boolean> {
    if (!review.propertyId) return false;
    const property = await this.propertyModel
      .findById(review.propertyId)
      .select('ownerId agentId')
      .lean()
      .exec();

    if (!property) return false;

    return (
      (property as any).ownerId?.toString() === user._id.toString() ||
      (property as any).agentId?.toString() === user._id.toString()
    );
  }
}