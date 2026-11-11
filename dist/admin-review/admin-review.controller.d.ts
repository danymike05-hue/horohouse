import { AdminReviewService, ReviewSource } from './admin-review.service';
declare class RefundDto {
    amount?: number;
    note?: string;
}
declare class ResolveDto {
    resolution: 'refunded_manually' | 'no_refund_needed';
    amount?: number;
    note?: string;
}
export declare class AdminReviewController {
    private readonly review;
    constructor(review: AdminReviewService);
    summary(days?: string): Promise<{
        days: number;
        paymentsToReview: number;
        pendingIdentities: number;
        platformCommission: number;
        hostPayouts: number;
        paidBookings: any;
        refundedTotal: number;
        refundCount: any;
    }>;
    payments(state?: string, limit?: string): Promise<{
        items: import("./admin-review.service").ReviewItem[];
        openCount: number;
    }>;
    refund(source: ReviewSource, id: string, dto: RefundDto, req: any): Promise<{
        ok: true;
    }>;
    resolve(source: ReviewSource, id: string, dto: ResolveDto, req: any): Promise<{
        ok: true;
    }>;
}
export {};
