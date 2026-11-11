import { Model } from 'mongoose';
import { SplitPayment, SplitPaymentDocument, SplitPaymentStatus } from './schemas/split-payment.schema';
import { CreateSplitPaymentDto, RecordTenantPaymentDto, InitiateTenantChargeDto, SplitRentCalculatorDto } from './dto/split-payment.dto';
import { UserDocument } from '../users/schemas/user.schema';
import { NotificationsService } from '../notifications/notifications.service';
import { CamerPayService } from '../payments/services/camerpay.service';
export declare class SplitPaymentsService {
    private splitPaymentModel;
    private userModel;
    private notificationsService;
    private camerpayService;
    private readonly logger;
    constructor(splitPaymentModel: Model<SplitPaymentDocument>, userModel: Model<UserDocument>, notificationsService: NotificationsService, camerpayService: CamerPayService);
    calculateSplit(dto: SplitRentCalculatorDto): {
        totalRent: number;
        numberOfTenants: number;
        shares: Array<{
            tenantIndex: number;
            amount: number;
            percentage: number;
        }>;
        remainder: number;
    };
    createCycle(landlordUserId: string, dto: CreateSplitPaymentDto): Promise<SplitPayment>;
    findById(cycleId: string): Promise<SplitPayment>;
    findByLease(leaseId: string): Promise<SplitPayment[]>;
    findMyPayments(tenantUserId: string): Promise<SplitPayment[]>;
    findByLandlord(landlordUserId: string, status?: SplitPaymentStatus): Promise<SplitPayment[]>;
    recordPayment(cycleId: string, dto: RecordTenantPaymentDto, requestingUserId: string): Promise<SplitPayment>;
    initiateCharge(cycleId: string, dto: InitiateTenantChargeDto, requestingUserId: string): Promise<{
        message: string;
        reference: string;
    }>;
    markDisbursed(cycleId: string, adminUserId: string, disbursementTransactionId?: string): Promise<SplitPayment>;
    markOverdueShares(): Promise<void>;
    private deriveCycleStatus;
    private notifyTenantsOfNewCycle;
}
