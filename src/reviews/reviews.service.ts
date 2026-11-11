import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
  Logger,
  Optional,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { Review, ReviewDocument, ReviewType, ReviewerRole } from './schemas/review.schema';
import { User, UserRole, UserDocument } from '../users/schemas/user.schema';
import { Property, PropertyDocument } from '../properties/schemas/property.schema';
import { Booking, BookingDocument, BookingStatus } from '../bookings/schema/booking.schema';
import { Appointment, AppointmentDocument, AppointmentStatus } from '../appointments/schemas/appointment.schema';
import { DigitalLease, DigitalLeaseDocument, LeaseStatus } from '../digital-lease/schemas/digital-lease.schema';
import { Room, RoomDocument } from '../rooms/schemas/room.schema';
import { CreateReviewDto, UpdateReviewDto, RespondReviewDto } from './dto';
import { countMentions, fold, isReviewTopic, topicsOf } from './review-topics.util';

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

export interface PropertyReviewQuery {
  sort?: 'relevant' | 'recent' | 'highest' | 'lowest';
  q?: string;
  topic?: string;
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
    @InjectModel(Appointment.name) private appointmentModel: Model<AppointmentDocument>,
    @InjectModel(DigitalLease.name) private leaseModel: Model<DigitalLeaseDocument>,
    @Optional() @InjectModel(Room.name) private roomModel?: Model<RoomDocument>,
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

      if (reviewType === ReviewType.PROPERTY) {
        return this.createPropertyReviewFromStay(createReviewDto, user);
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

  // ─── Property review: only from a real stay ──────────────────────────────────

  /**
   * reviewType = property used to skip every check: anyone signed in could post one, and it
   * went public at once. It now becomes the stay review of this guest's latest completed
   * booking, so it follows the same rules (one per booking, 14 days, hidden until both
   * sides have reviewed). App versions still sending it keep working for real guests.
   */
  private async createPropertyReviewFromStay(dto: CreateReviewDto, user: User): Promise<Review> {
    if (!dto.propertyId) throw new BadRequestException('propertyId is required for property reviews');
    if (!Types.ObjectId.isValid(dto.propertyId)) throw new BadRequestException('Invalid property ID');

    const stays = await this.bookingModel
      .find({ guestId: user._id, propertyId: new Types.ObjectId(dto.propertyId), status: BookingStatus.COMPLETED })
      .select('checkOut actualCheckOut guestReviewLeft')
      .sort({ checkOut: -1 })
      .limit(20)
      .lean()
      .exec();
    if (!stays.length) throw new ForbiddenException('You can review a place after you have stayed there');

    const now = Date.now();
    const open = stays.find((stay: any) => {
      const checkout = new Date(stay.actualCheckOut ?? stay.checkOut).getTime();
      return !stay.guestReviewLeft && Math.floor((now - checkout) / 86_400_000) <= REVIEW_WINDOW_DAYS;
    });
    if (!open) throw new BadRequestException('You have already reviewed your stays here, or the time to review has passed');

    return this.createBookingReview(
      { ...dto, reviewType: ReviewType.STAY, bookingId: String((open as any)._id), propertyId: undefined } as CreateReviewDto,
      user,
    );
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
      if (String(agent._id) === String(user._id)) {
        throw new ForbiddenException('You cannot review yourself');
      }
      // Anyone signed in used to be able to rate any agent. Now only people who actually
      // dealt with them can: a completed stay at one of their listings, a viewing they
      // held with you, or a lease you signed with them.
      if (!(await this.hasDealtWith(user._id as Types.ObjectId, agent._id as Types.ObjectId))) {
        throw new ForbiddenException('You can review an agent after a stay, a viewing or a lease with them');
      }
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
      // Agent reviews are only possible after a real dealing (see hasDealtWith).
      bookingVerified: dto.reviewType === ReviewType.AGENT,
      isPublished: true,   // standard reviews are immediately visible
    });

    const saved = await review.save();

    // Update denormalized ratings on the target document
    if (dto.propertyId) await this.updatePropertyRating(dto.propertyId);
    if (dto.agentId) await this.updateAgentRating(dto.agentId);

    this.logger.log(`Standard review created: ${saved._id} by user ${user._id}`);
    return saved;
  }

  /**
   * Whether this person may review the agent now: they dealt with them (stay, viewing or
   * lease), it isn't themselves, and they haven't reviewed them already.
   */
  async canReviewAgent(userId: string, agentId: string): Promise<{ canReview: boolean; reason?: 'self' | 'no_dealing' | 'already' | 'not_found' }> {
    if (!Types.ObjectId.isValid(agentId)) return { canReview: false, reason: 'not_found' };
    if (String(userId) === String(agentId)) return { canReview: false, reason: 'self' };
    const me = new Types.ObjectId(String(userId));
    const agent = new Types.ObjectId(agentId);
    const already = await this.reviewModel.exists({ userId: me, agentId: agent, reviewType: ReviewType.AGENT, isActive: true });
    if (already) return { canReview: false, reason: 'already' };
    if (!(await this.hasDealtWith(me, agent))) return { canReview: false, reason: 'no_dealing' };
    return { canReview: true };
  }

  /** Has this person really dealt with the agent? Counts only finished or signed dealings. */
  async hasDealtWith(userId: Types.ObjectId, agentId: Types.ObjectId): Promise<boolean> {
    const [stay, viewing, lease] = await Promise.all([
      this.bookingModel.exists({ guestId: userId, hostId: agentId, status: BookingStatus.COMPLETED }),
      this.appointmentModel.exists({ agentId, clientId: userId, status: AppointmentStatus.COMPLETED }),
      this.leaseModel.exists({
        landlordUserId: agentId,
        'tenants.tenantUserId': userId,
        status: { $in: [LeaseStatus.ACTIVE, LeaseStatus.EXPIRED, LeaseStatus.TERMINATED] },
      }),
    ]);
    return !!(stay || viewing || lease);
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
      if (otherReview.reviewType === ReviewType.STAY && otherReview.propertyId) {
        await this.updatePropertyStayRating(otherReview.propertyId.toString());
      }
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

  /**
   * A listing's published reviews, the way Airbnb lists them:
   *  - sort: relevant (detailed reviews first, then newest) | recent | highest | lowest
   *  - q: words to find in the text; topic: one of the "Guests mention" topics
   *    (both ignore case and accents, which Mongo regexes can't, so they're done here;
   *    a listing has at most a few hundred reviews)
   *  - each review also says how long the stay was, which room it was in, and since
   *    when the reviewer has been a member
   */
  async getPropertyReviews(propertyId: string, options: ReviewOptions & PropertyReviewQuery = {}): Promise<any> {
    if (!Types.ObjectId.isValid(propertyId)) throw new BadRequestException('Invalid property ID');
    const page = Math.max(1, Number(options.page) || 1);
    const limit = Math.min(Math.max(1, Number(options.limit) || 20), 50);

    const all: any[] = await this.reviewModel
      .find({ propertyId: new Types.ObjectId(propertyId), isActive: true, isPublished: true })
      .populate('userId', 'name profilePicture createdAt')
      .populate('respondedBy', 'name profilePicture')
      .lean()
      .exec();

    const words = fold(options.q ?? '').trim().split(/\s+/).filter(Boolean).slice(0, 8);
    const topic = isReviewTopic(options.topic) ? options.topic : undefined;
    const matching = all.filter((r) => {
      if (topic && !topicsOf(r.comment).includes(topic)) return false;
      if (!words.length) return true;
      const text = fold(r.comment);
      return words.every((w) => text.includes(w));
    });

    const time = (r: any) => new Date(r.createdAt).getTime() || 0;
    const sort = options.sort ?? (options.sortBy === 'rating' ? (options.sortOrder === 'asc' ? 'lowest' : 'highest') : 'relevant');
    const detailed = (r: any) => (String(r.comment ?? '').trim().length >= 80 ? 1 : 0);
    matching.sort((a, b) => {
      if (sort === 'recent') return time(b) - time(a);
      if (sort === 'highest') return b.rating - a.rating || time(b) - time(a);
      if (sort === 'lowest') return a.rating - b.rating || time(b) - time(a);
      return detailed(b) - detailed(a) || time(b) - time(a);
    });

    const pageItems = matching.slice((page - 1) * limit, page * limit);
    await this.attachStays(pageItems);

    const averageRating = all.length ? Number((all.reduce((s, r) => s + (r.rating || 0), 0) / all.length).toFixed(2)) : 0;
    return { reviews: pageItems, total: matching.length, page, totalPages: Math.ceil(matching.length / limit), averageRating };
  }

  /** Adds `stay: { nights, roomName }` from each review's booking, when it has one. */
  private async attachStays(reviews: any[]): Promise<void> {
    const ids = reviews.map((r) => r.bookingId).filter((id) => id && Types.ObjectId.isValid(String(id)));
    if (!ids.length) return;
    try {
      const bookings: any[] = await this.bookingModel.find({ _id: { $in: ids } }).select('nights roomId').lean().exec();
      const roomIds = bookings.map((b) => b.roomId).filter(Boolean);
      const rooms: any[] = roomIds.length && this.roomModel
        ? await this.roomModel.find({ _id: { $in: roomIds } }).select('name').lean().exec()
        : [];
      const roomName = new Map(rooms.map((x) => [String(x._id), x.name]));
      const byId = new Map(bookings.map((b) => [String(b._id), b]));
      for (const r of reviews) {
        const b = byId.get(String(r.bookingId));
        if (!b) continue;
        r.stay = { nights: b.nights, ...(b.roomId && roomName.get(String(b.roomId)) ? { roomName: roomName.get(String(b.roomId)) } : {}) };
      }
    } catch (err: any) {
      // The reviews still show, without the stay details.
      this.logger.warn(`Stay details for reviews not loaded: ${err?.message}`);
    }
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
      .select('rating staySubRatings reviewType comment')
      .lean()
      .exec();

    const base = this.calculateReviewStats(reviews);

    // Compute sub-rating averages from STAY reviews only
    const stayReviews = reviews.filter((r: any) => r.reviewType === ReviewType.STAY);
    const subRatingAverages = this.calculateSubRatingAverages(stayReviews);
    const exact = reviews.length ? reviews.reduce((s: number, r: any) => s + (r.rating || 0), 0) / reviews.length : 0;

    return {
      ...base,
      subRatingAverages,
      // The names the app reads (it used to read these and get nothing), with two decimals like Airbnb
      average: Number(exact.toFixed(2)),
      count: base.totalReviews,
      distribution: base.ratingDistribution,
      subRatings: subRatingAverages,
      mentions: countMentions(reviews.map((r: any) => r.comment)),
    } as any;
  }

  /**
   * Host's own "Reviews" screen: published stay reviews on the listings they own,
   * with the overall rating, the 1–5 distribution and the category averages.
   * (GUEST reviews about them as a traveller are not included.)
   */
  async getHostStayReviews(hostId: string, page = 1, limit = 20, propertyId?: string): Promise<any> {
    if (!Types.ObjectId.isValid(hostId)) throw new BadRequestException('Invalid user ID');
    const safeLimit = Math.min(Math.max(1, limit), 50);
    const props = await this.propertyModel
      .find({ ownerId: new Types.ObjectId(hostId) })
      .select('_id title')
      .lean()
      .exec();
    const titles = new Map(props.map((p: any) => [String(p._id), p.title]));
    // Optional: one listing (must be one of the host's own)
    const ids = propertyId && Types.ObjectId.isValid(propertyId)
      ? props.filter((p: any) => String(p._id) === propertyId).map((p: any) => p._id)
      : props.map((p: any) => p._id);
    const query: any = {
      isActive: true,
      isPublished: true,
      reviewType: ReviewType.STAY,
      propertyId: { $in: ids },
    };

    const [reviews, total, all] = await Promise.all([
      this.reviewModel
        .find(query)
        .populate('userId', 'name profilePicture')
        .sort({ createdAt: -1 })
        .skip((Math.max(1, page) - 1) * safeLimit)
        .limit(safeLimit)
        .lean()
        .exec(),
      this.reviewModel.countDocuments(query),
      this.reviewModel.find(query).select('rating staySubRatings').lean().exec(),
    ]);

    const stats = this.calculateReviewStats(all);
    return {
      reviews: reviews.map((r: any) => ({ ...r, propertyTitle: titles.get(String(r.propertyId)) ?? null })),
      total,
      page: Math.max(1, page),
      totalPages: Math.ceil(total / safeLimit),
      averageRating: stats.averageRating,
      ratingDistribution: stats.ratingDistribution,
      subRatingAverages: this.calculateSubRatingAverages(all),
    };
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
  /**
   * Public route: only published reviews. Booking reviews stay hidden until both sides
   * have written theirs (or the 14-day window ends). This used to return hidden ones
   * too, so either side could read the other's review before writing their own.
   * The flags tell the app whether each side has already submitted.
   */
  async getBookingReviews(bookingId: string): Promise<{
    stayReview: Review | null;
    guestReview: Review | null;
    stayReviewSubmitted: boolean;
    guestReviewSubmitted: boolean;
  }> {
    if (!Types.ObjectId.isValid(bookingId)) {
      throw new BadRequestException('Invalid booking ID');
    }

    const find = (reviewerRole: ReviewerRole) =>
      this.reviewModel
        .findOne({ bookingId: new Types.ObjectId(bookingId), reviewerRole, isActive: true })
        .populate('userId', 'name profilePicture')
        .exec();
    const [stay, guest] = await Promise.all([find(ReviewerRole.GUEST), find(ReviewerRole.HOST)]);

    return {
      stayReview: stay?.isPublished ? stay : null,
      guestReview: guest?.isPublished ? guest : null,
      stayReviewSubmitted: !!stay,
      guestReviewSubmitted: !!guest,
    };
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

    // A booking review that isn't published yet is hidden like it doesn't exist.
    if (!review || !review.isActive || !review.isPublished) throw new NotFoundException('Review not found');
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
    if (review.bookingId && review.isPublished) {
      throw new BadRequestException('Stay reviews can no longer be edited once they are published');
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

    // One public reply per review (admins can still correct one)
    if (review.response && user.role !== UserRole.ADMIN) {
      throw new ConflictException({ message: 'You already replied to this review', code: 'ALREADY_REPLIED' });
    }
    const text = String(dto.response ?? '').trim();
    if (text.length < 2 || text.length > 1000) {
      throw new BadRequestException('A reply must be between 2 and 1000 characters');
    }

    review.response = text;
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
    const filter = {
      isPublished: false,
      publishDeadline: { $lte: new Date() },
      isActive: true,
      bookingId: { $exists: true },
    };
    // Which listings need their rating recomputed once these go public.
    const affected = await this.reviewModel
      .find({ ...filter, reviewType: ReviewType.STAY })
      .distinct('propertyId');

    const result = await this.reviewModel.updateMany(filter, { $set: { isPublished: true } });

    const published = result.modifiedCount;
    if (published > 0) {
      this.logger.log(`Force-published ${published} expired booking review(s)`);
      for (const propertyId of affected) {
        if (propertyId) await this.updatePropertyStayRating(String(propertyId));
      }
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