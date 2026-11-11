import { TrustService } from './trust.service';
declare class ReviewIdentityDto {
    approve: boolean;
    reason?: string;
}
export declare class TrustController {
    private readonly trust;
    constructor(trust: TrustService);
    myIdentity(req: any): Promise<import("./trust.service").IdentityStatus>;
    submitIdentity(req: any, documentType?: string): Promise<import("./trust.service").IdentityStatus>;
    pending(page?: string, limit?: string): Promise<{
        items: (import("mongoose").FlattenMaps<import("../users/schemas/user.schema").UserDocument> & Required<{
            _id: import("mongoose").Types.ObjectId;
        }> & {
            __v: number;
        })[];
        total: number;
        page: number;
        totalPages: number;
    }>;
    document(userId: string): Promise<{
        url: string;
    }>;
    review(userId: string, body: ReviewIdentityDto, req: any): Promise<import("./trust.service").IdentityStatus>;
    guest(guestId: string, req: any): Promise<{
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
export {};
