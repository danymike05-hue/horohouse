import { MoMoProvider } from '../schemas/split-payment.schema';
export declare class TenantShareInputDto {
    tenantUserId: string;
    tenantName: string;
    tenantPhone?: string;
    amountDue: number;
    momoPhone?: string;
    momoProvider?: MoMoProvider;
    dueDate: string;
}
export declare class CreateSplitPaymentDto {
    propertyId: string;
    leaseId: string;
    cycleLabel: string;
    cycleStart: string;
    cycleEnd: string;
    totalRent: number;
    tenantShares: TenantShareInputDto[];
}
export declare class RecordTenantPaymentDto {
    tenantUserId: string;
    amountPaid: number;
    momoTransactionId?: string;
    momoProvider?: MoMoProvider;
}
export declare class InitiateTenantChargeDto {
    tenantUserId: string;
    momoPhone: string;
    momoProvider: MoMoProvider;
}
export declare class SplitRentCalculatorDto {
    totalRent: number;
    numberOfTenants: number;
    customPercentages?: number[];
}
