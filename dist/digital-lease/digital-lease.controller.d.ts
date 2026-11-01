import { FastifyRequest } from 'fastify';
import { DigitalLeaseService } from './digital-lease.service';
import { CreateDigitalLeaseDto, SignLeaseDto, AddConditionLogDto, TerminateLeaseDto } from './dto/digital-lease.dto';
import { LeaseStatus } from './schemas/digital-lease.schema';
import { User } from '../users/schemas/user.schema';
export declare class DigitalLeaseController {
    private readonly digitalLeaseService;
    constructor(digitalLeaseService: DigitalLeaseService);
    create(req: FastifyRequest & {
        user: User;
    }, dto: CreateDigitalLeaseDto): Promise<import("./schemas/digital-lease.schema").DigitalLease>;
    getLandlordLeases(req: FastifyRequest & {
        user: User;
    }, status?: LeaseStatus): Promise<import("./schemas/digital-lease.schema").DigitalLease[]>;
    getTenantLeases(req: FastifyRequest & {
        user: User;
    }): Promise<import("./schemas/digital-lease.schema").DigitalLease[]>;
    findOne(leaseId: string): Promise<import("./schemas/digital-lease.schema").DigitalLease>;
    sign(leaseId: string, req: FastifyRequest & {
        user: User;
    }, dto: SignLeaseDto): Promise<import("./schemas/digital-lease.schema").DigitalLease>;
    addConditionLog(leaseId: string, req: FastifyRequest & {
        user: User;
    }, dto: AddConditionLogDto): Promise<import("./schemas/digital-lease.schema").DigitalLease>;
    uploadConditionPhotos(leaseId: string, logType: 'move_in' | 'move_out', itemLabel: string, req: FastifyRequest & {
        user: User;
    }): Promise<import("./schemas/digital-lease.schema").DigitalLease>;
    terminate(leaseId: string, req: FastifyRequest & {
        user: User;
    }, dto: TerminateLeaseDto): Promise<import("./schemas/digital-lease.schema").DigitalLease>;
}
