import { Document, Types } from 'mongoose';
export type SplitPaymentDocument = SplitPayment & Document;
export declare enum SplitPaymentStatus {
    PENDING = "pending",
    PARTIAL = "partial",
    COMPLETE = "complete",
    DISBURSED = "disbursed",
    OVERDUE = "overdue"
}
export declare enum TenantShareStatus {
    UNPAID = "unpaid",
    PAID = "paid",
    OVERDUE = "overdue",
    WAIVED = "waived"
}
export declare enum MoMoProvider {
    MTN = "mtn",
    ORANGE = "orange"
}
export interface TenantShare {
    tenantUserId: Types.ObjectId;
    tenantName: string;
    tenantPhone?: string;
    amountDue: number;
    amountPaid: number;
    status: TenantShareStatus;
    momoPhone?: string;
    momoProvider?: MoMoProvider;
    momoTransactionId?: string;
    paidAt?: Date;
    dueDate: Date;
}
export declare class SplitPayment {
    propertyId: Types.ObjectId;
    leaseId: Types.ObjectId;
    landlordUserId: Types.ObjectId;
    cycleLabel: string;
    cycleStart: Date;
    cycleEnd: Date;
    totalRent: number;
    tenantShares: TenantShare[];
    status: SplitPaymentStatus;
    totalCollected: number;
    disbursedAt?: Date;
    disbursementTransactionId?: string;
    createdAt: Date;
    updatedAt: Date;
}
export declare const SplitPaymentSchema: import("mongoose").Schema<SplitPayment, import("mongoose").Model<SplitPayment, any, any, any, Document<unknown, any, SplitPayment, any, {}> & SplitPayment & {
    _id: Types.ObjectId;
} & {
    __v: number;
}, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, SplitPayment, Document<unknown, {}, import("mongoose").FlatRecord<SplitPayment>, {}, import("mongoose").DefaultSchemaOptions> & import("mongoose").FlatRecord<SplitPayment> & {
    _id: Types.ObjectId;
} & {
    __v: number;
}>;
