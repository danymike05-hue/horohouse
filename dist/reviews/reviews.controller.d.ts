import { ReviewsService } from './reviews.service';
import { CreateReviewDto, UpdateReviewDto, RespondReviewDto } from './dto';
export declare class ReviewsController {
    private readonly reviewsService;
    constructor(reviewsService: ReviewsService);
    create(dto: CreateReviewDto, req: any): Promise<import("./schemas/review.schema").Review>;
    findAll(query: any): Promise<{
        reviews: import("./schemas/review.schema").Review[];
        total: number;
        page: number;
        totalPages: number;
        averageRating: number;
    }>;
    getPropertyReviews(propertyId: string, query: any): Promise<any>;
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
    getInsightReviews(insightId: string, query: any): Promise<any>;
    getAgentReviews(agentId: string, query: any): Promise<any>;
    getAgentReviewStats(agentId: string): Promise<{
        averageRating: number;
        totalReviews: number;
        ratingDistribution: {
            [key: number]: number;
        };
    }>;
    getBookingReviews(bookingId: string): Promise<{
        stayReview: import("./schemas/review.schema").Review | null;
        guestReview: import("./schemas/review.schema").Review | null;
    }>;
    getGuestReviews(userId: string, query: any): Promise<any>;
    getMyReviews(req: any, query: any): Promise<any>;
    findOne(id: string): Promise<import("./schemas/review.schema").Review>;
    update(id: string, dto: UpdateReviewDto, req: any): Promise<import("./schemas/review.schema").Review>;
    respondToReview(id: string, dto: RespondReviewDto, req: any): Promise<import("./schemas/review.schema").Review>;
    markAsHelpful(id: string, req: any): Promise<import("./schemas/review.schema").Review>;
    remove(id: string, req: any): Promise<{
        message: string;
    }>;
}
