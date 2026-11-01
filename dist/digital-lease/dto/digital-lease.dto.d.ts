import { ConditionRating } from '../schemas/digital-lease.schema';
export declare class LeaseTenantInputDto {
    tenantUserId: string;
    tenantName: string;
    tenantEmail?: string;
    tenantPhone?: string;
    rentShare: number;
}
export declare class CreateDigitalLeaseDto {
    propertyId: string;
    tenants: LeaseTenantInputDto[];
    leaseStart: string;
    leaseEnd: string;
    monthlyRent: number;
    depositAmount?: number;
    advanceMonths?: number;
    customClauses?: Array<{
        heading: string;
        body: string;
    }>;
}
export declare class SignLeaseDto {
    signatureBase64: string;
}
export declare class ConditionItemDto {
    label: string;
    rating: ConditionRating;
    notes?: string;
}
export declare class AddConditionLogDto {
    type: 'move_in' | 'move_out';
    items: ConditionItemDto[];
    overallNotes?: string;
}
export declare class TerminateLeaseDto {
    reason: string;
}
