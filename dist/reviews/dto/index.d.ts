import { ReviewType } from '../schemas/review.schema';
export declare class StaySubRatingsDto {
    cleanliness?: number;
    accuracy?: number;
    checkIn?: number;
    communication?: number;
    location?: number;
    value?: number;
}
export declare class GuestSubRatingsDto {
    cleanliness?: number;
    communication?: number;
    rulesFollowed?: number;
    wouldHostAgain?: boolean;
}
export declare class CreateReviewDto {
    reviewType: ReviewType;
    propertyId?: string;
    agentId?: string;
    bookingId?: string;
    insightId?: string;
    rating: number;
    staySubRatings?: StaySubRatingsDto;
    guestSubRatings?: GuestSubRatingsDto;
    comment?: string;
    images?: string[];
}
export declare class UpdateReviewDto {
    rating?: number;
    staySubRatings?: StaySubRatingsDto;
    guestSubRatings?: GuestSubRatingsDto;
    comment?: string;
    images?: string[];
}
export declare class RespondReviewDto {
    response: string;
}
export { CreateReviewDto as default };
