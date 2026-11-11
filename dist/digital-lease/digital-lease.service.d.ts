import { Model } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { DigitalLease, DigitalLeaseDocument, LeaseStatus } from './schemas/digital-lease.schema';
import { CreateDigitalLeaseDto, SignLeaseDto, AddConditionLogDto, TerminateLeaseDto } from './dto/digital-lease.dto';
import { UserDocument } from '../users/schemas/user.schema';
import { PropertyDocument } from '../properties/schemas/property.schema';
import { NotificationsService } from '../notifications/notifications.service';
import { SplitPaymentsService } from '../split-payments/split-payments.service';
export declare class DigitalLeaseService {
    private leaseModel;
    private userModel;
    private propertyModel;
    private configService;
    private notificationsService;
    private splitPaymentsService;
    private readonly logger;
    private readonly STANDARD_CLAUSES;
    constructor(leaseModel: Model<DigitalLeaseDocument>, userModel: Model<UserDocument>, propertyModel: Model<PropertyDocument>, configService: ConfigService, notificationsService: NotificationsService, splitPaymentsService: SplitPaymentsService);
    create(landlordUserId: string, dto: CreateDigitalLeaseDto): Promise<DigitalLease>;
    findById(leaseId: string): Promise<DigitalLease>;
    findByLandlord(landlordUserId: string, status?: LeaseStatus): Promise<DigitalLease[]>;
    findByTenant(tenantUserId: string): Promise<DigitalLease[]>;
    sign(leaseId: string, signingUserId: string, dto: SignLeaseDto): Promise<DigitalLease>;
    addConditionLog(leaseId: string, loggedByUserId: string, dto: AddConditionLogDto): Promise<DigitalLease>;
    uploadConditionPhotos(leaseId: string, logType: 'move_in' | 'move_out', itemLabel: string, files: Array<{
        buffer: Buffer;
    }>, uploadedByUserId: string): Promise<DigitalLease>;
    terminate(leaseId: string, requestingUserId: string, dto: TerminateLeaseDto): Promise<DigitalLease>;
    expireLeases(): Promise<void>;
    private onLeaseActivated;
    private uploadSignature;
    private notifyTenantsToSign;
    private isPartyToLease;
    private getOtherPartyIds;
}
