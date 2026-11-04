import { ReviewsService } from './reviews.service';
export declare class ReviewsScheduler {
    private readonly reviewsService;
    private readonly logger;
    constructor(reviewsService: ReviewsService);
    publishExpired(): Promise<void>;
}
