import { Document, Types } from 'mongoose';
export type DigitalLeaseDocument = DigitalLease & Document;
export declare enum LeaseStatus {
    DRAFT = "draft",
    PENDING_TENANT = "pending_tenant",
    ACTIVE = "active",
    EXPIRED = "expired",
    TERMINATED = "terminated"
}
export declare enum ConditionRating {
    EXCELLENT = "excellent",
    GOOD = "good",
    FAIR = "fair",
    POOR = "poor"
}
export interface LeaseTenant {
    tenantUserId: Types.ObjectId;
    tenantName: string;
    tenantEmail?: string;
    tenantPhone?: string;
    signatureUrl?: string;
    signedAt?: Date;
    rentShare: number;
}
export interface ConditionItem {
    label: string;
    rating: ConditionRating;
    notes?: string;
    photoUrls: string[];
}
export interface ConditionLog {
    loggedByUserId: Types.ObjectId;
    loggedAt: Date;
    items: ConditionItem[];
    overallNotes?: string;
    type: 'move_in' | 'move_out';
}
export declare class DigitalLease {
    propertyId: Types.ObjectId;
    landlordUserId: Types.ObjectId;
    tenants: LeaseTenant[];
    leaseStart: Date;
    leaseEnd: Date;
    monthlyRent: number;
    depositAmount: number;
    advanceMonths: number;
    status: LeaseStatus;
    landlordSignatureUrl?: string;
    landlordSignedAt?: Date;
    clauses: Array<{
        heading: string;
        body: string;
    }>;
    customClauses: Array<{
        heading: string;
        body: string;
    }>;
    conditionLogs: ConditionLog[];
    terminationReason?: string;
    terminatedAt?: Date;
    terminatedByUserId?: Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}
export declare const DigitalLeaseSchema: import("mongoose").Schema<DigitalLease, import("mongoose").Model<DigitalLease, any, any, any, Document<unknown, any, DigitalLease, any, {}> & DigitalLease & {
    _id: Types.ObjectId;
} & {
    __v: number;
}, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, DigitalLease, Document<unknown, {}, import("mongoose").FlatRecord<DigitalLease>, {}, import("mongoose").DefaultSchemaOptions> & import("mongoose").FlatRecord<DigitalLease> & {
    _id: Types.ObjectId;
} & {
    __v: number;
}>;
