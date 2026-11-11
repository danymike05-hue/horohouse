import { Model, Types } from 'mongoose';
import { User, UserDocument } from '../users/schemas/user.schema';
import { BookingDocument } from '../bookings/schema/booking.schema';
import { ReviewDocument } from '../reviews/schemas/review.schema';
import { NotificationsService } from '../notifications/notifications.service';
export declare const ID_DOCUMENT_TYPES: readonly ["national_id", "passport", "residence_permit", "driving_licence"];
export type IdDocumentType = (typeof ID_DOCUMENT_TYPES)[number];
export declare const ID_MIME_TYPES: string[];
export declare const ID_MAX_BYTES: number;
export interface IdentityStatus {
    status: 'unverified' | 'pending' | 'verified' | 'rejected';
    documentType?: IdDocumentType;
    submittedAt?: Date;
    reviewedAt?: Date;
    rejectionReason?: string;
}
export declare class TrustService {
    private readonly userModel;
    private readonly bookingModel;
    private readonly reviewModel;
    private readonly notifications?;
    private readonly logger;
    constructor(userModel: Model<UserDocument>, bookingModel: Model<BookingDocument>, reviewModel: Model<ReviewDocument>, notifications?: NotificationsService | undefined);
    static isVerified(u: any): boolean;
    getMyIdentity(userId: string): Promise<IdentityStatus>;
    submitIdentity(userId: string, buffer: Buffer, documentType: IdDocumentType): Promise<IdentityStatus>;
    listPending(page?: number, limit?: number): Promise<{
        items: (import("mongoose").FlattenMaps<UserDocument> & Required<{
            _id: Types.ObjectId;
        }> & {
            __v: number;
        })[];
        total: number;
        page: number;
        totalPages: number;
    }>;
    documentUrl(userId: string): Promise<{
        url: string;
    }>;
    review(userId: string, approve: boolean, reason: string | undefined, admin: User): Promise<IdentityStatus>;
    guestProfile(guestId: string, requester: User): Promise<{
        id: string;
        firstName: string;
        profilePicture: any;
        memberSince: any;
        languages: any;
        verifications: {
            email: boolean;
            phone: boolean;
            identity: boolean;
        };
        completedStays: number;
        guestCancellations12m: number;
        rating: number | null;
        reviewCount: any;
        reviews: {
            hostFirstName: string;
            rating: any;
            comment: any;
            subRatings: any;
            createdAt: any;
        }[];
    }>;
}
