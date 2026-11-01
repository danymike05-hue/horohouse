import { Model } from 'mongoose';
import { Review, ReviewDocument, ReviewType } from './schemas/review.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { PropertyDocument } from '../properties/schemas/property.schema';
import { BookingDocument } from '../bookings/schema/booking.schema';
import { CreateReviewDto, UpdateReviewDto, RespondReviewDto } from './dto';
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
export declare class ReviewsService {
    private reviewModel;
    private propertyModel;
    private userModel;
    private bookingModel;
    private readonly logger;
    constructor(reviewModel: Model<ReviewDocument>, propertyModel: Model<PropertyDocument>, userModel: Model<UserDocument>, bookingModel: Model<BookingDocument>);
    create(createReviewDto: CreateReviewDto, user: User): Promise<Review>;
    private createInsightReview;
    private createStandardReview;
    private createBookingReview;
    findAll(filters?: ReviewFilters, options?: ReviewOptions): Promise<{
        reviews: Review[];
        total: number;
        page: number;
        totalPages: number;
        averageRating: number;
    }>;
    getPropertyReviews(propertyId: string, options?: ReviewOptions): Promise<any>;
    getPropertyReviewStats(propertyId: string): Promise<{
        averageRating: number;
        totalReviews: number;
        ratingDistribution: {
            [key: number]: number;
        };
        subRatingAverages?: {
            cleanliness: number;
            accuracy: number;
            checkIn: number;
            communication: number;
            location: number;
            value: number;
        };
    }>;
    getInsightReviews(insightId: string, options?: ReviewOptions): Promise<any>;
    getAgentReviews(agentId: string, options?: ReviewOptions): Promise<any>;
    getAgentReviewStats(agentId: string): Promise<{
        averageRating: number;
        totalReviews: number;
        ratingDistribution: {
            [key: number]: number;
        };
    }>;
    getGuestReviews(guestUserId: string, options?: ReviewOptions): Promise<any>;
    getBookingReviews(bookingId: string): Promise<{
        stayReview: Review | null;
        guestReview: Review | null;
    }>;
    findOne(id: string): Promise<Review>;
    getUserReviews(userId: string, options?: ReviewOptions): Promise<any>;
    update(id: string, dto: UpdateReviewDto, user: User): Promise<Review>;
    respondToReview(id: string, dto: RespondReviewDto, user: User): Promise<Review>;
    markAsHelpful(id: string, user: User): Promise<Review>;
    remove(id: string, user: User): Promise<void>;
    publishExpiredReviews(): Promise<number>;
    private checkExistingReview;
    private calculateReviewStats;
    private calculateSubRatingAverages;
    private updatePropertyRating;
    private updatePropertyStayRating;
    private updateAgentRating;
    private isPropertyHost;
}
