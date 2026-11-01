import { FastifyRequest } from 'fastify';
import { SplitPaymentsService } from './split-payments.service';
import { CreateSplitPaymentDto, RecordTenantPaymentDto, InitiateTenantChargeDto, SplitRentCalculatorDto } from './dto/split-payment.dto';
import { SplitPaymentStatus } from './schemas/split-payment.schema';
import { User } from '../users/schemas/user.schema';
export declare class SplitPaymentsController {
    private readonly splitPaymentsService;
    constructor(splitPaymentsService: SplitPaymentsService);
    calculate(dto: SplitRentCalculatorDto): {
        totalRent: number;
        numberOfTenants: number;
        shares: Array<{
            tenantIndex: number;
            amount: number;
            percentage: number;
        }>;
        remainder: number;
    };
    createCycle(req: FastifyRequest & {
        user: User;
    }, dto: CreateSplitPaymentDto): Promise<import("./schemas/split-payment.schema").SplitPayment>;
    getLandlordCycles(req: FastifyRequest & {
        user: User;
    }, status?: SplitPaymentStatus): Promise<import("./schemas/split-payment.schema").SplitPayment[]>;
    getCyclesByLease(leaseId: string): Promise<import("./schemas/split-payment.schema").SplitPayment[]>;
    initiateCharge(cycleId: string, req: FastifyRequest & {
        user: User;
    }, dto: InitiateTenantChargeDto): Promise<{
        message: string;
        reference: string;
    }>;
    recordPayment(cycleId: string, req: FastifyRequest & {
        user: User;
    }, dto: RecordTenantPaymentDto): Promise<import("./schemas/split-payment.schema").SplitPayment>;
    getMyPayments(req: FastifyRequest & {
        user: User;
    }): Promise<import("./schemas/split-payment.schema").SplitPayment[]>;
    getCycle(cycleId: string): Promise<import("./schemas/split-payment.schema").SplitPayment>;
    markDisbursed(cycleId: string, req: FastifyRequest & {
        user: User;
    }, body: {
        disbursementTransactionId?: string;
    }): Promise<import("./schemas/split-payment.schema").SplitPayment>;
}
