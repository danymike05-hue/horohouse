"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var DigitalLeaseService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.DigitalLeaseService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const schedule_1 = require("@nestjs/schedule");
const config_1 = require("@nestjs/config");
const cloudinary_1 = require("cloudinary");
const digital_lease_schema_1 = require("./schemas/digital-lease.schema");
const user_schema_1 = require("../users/schemas/user.schema");
const property_schema_1 = require("../properties/schemas/property.schema");
const notifications_service_1 = require("../notifications/notifications.service");
const notification_schema_1 = require("../notifications/schemas/notification.schema");
const split_payments_service_1 = require("../split-payments/split-payments.service");
let DigitalLeaseService = DigitalLeaseService_1 = class DigitalLeaseService {
    leaseModel;
    userModel;
    propertyModel;
    configService;
    notificationsService;
    splitPaymentsService;
    logger = new common_1.Logger(DigitalLeaseService_1.name);
    STANDARD_CLAUSES = [
        {
            heading: 'Payment terms',
            body: 'Rent is due on the 1st of each month. A grace period of 5 days is granted before late fees apply.',
        },
        {
            heading: 'Security deposit',
            body: 'The security deposit shall be returned within 30 days of the lease end date, less any deductions for damages documented in the move-out condition log.',
        },
        {
            heading: 'Maintenance',
            body: 'The landlord is responsible for structural repairs and major appliances. The tenant is responsible for minor maintenance and keeping the premises clean.',
        },
        {
            heading: 'Sub-letting',
            body: 'The tenant shall not sub-let the property or any part thereof without the prior written consent of the landlord.',
        },
        {
            heading: 'Termination notice',
            body: 'Either party must give 30 days written notice before terminating this lease early.',
        },
        {
            heading: 'Dispute resolution',
            body: 'Any disputes arising from this lease shall first be submitted to HoroHouse mediation before escalation to legal proceedings.',
        },
    ];
    constructor(leaseModel, userModel, propertyModel, configService, notificationsService, splitPaymentsService) {
        this.leaseModel = leaseModel;
        this.userModel = userModel;
        this.propertyModel = propertyModel;
        this.configService = configService;
        this.notificationsService = notificationsService;
        this.splitPaymentsService = splitPaymentsService;
        cloudinary_1.v2.config({
            cloud_name: this.configService.get('CLOUDINARY_CLOUD_NAME'),
            api_key: this.configService.get('CLOUDINARY_API_KEY'),
            api_secret: this.configService.get('CLOUDINARY_API_SECRET'),
        });
    }
    async create(landlordUserId, dto) {
        const property = await this.propertyModel
            .findOne({
            _id: new mongoose_2.Types.ObjectId(dto.propertyId),
            $or: [
                { ownerId: new mongoose_2.Types.ObjectId(landlordUserId) },
                { agentId: new mongoose_2.Types.ObjectId(landlordUserId) },
            ],
        })
            .exec();
        if (!property) {
            throw new common_1.NotFoundException('Property not found or does not belong to you.');
        }
        const sharesSum = dto.tenants.reduce((s, t) => s + t.rentShare, 0);
        if (sharesSum !== dto.monthlyRent) {
            throw new common_1.BadRequestException(`Tenant rent shares sum to ${sharesSum} XAF but monthlyRent is ${dto.monthlyRent} XAF. They must match.`);
        }
        const start = new Date(dto.leaseStart);
        const end = new Date(dto.leaseEnd);
        if (end <= start) {
            throw new common_1.BadRequestException('Lease end date must be after start date.');
        }
        const lease = new this.leaseModel({
            propertyId: new mongoose_2.Types.ObjectId(dto.propertyId),
            landlordUserId: new mongoose_2.Types.ObjectId(landlordUserId),
            tenants: dto.tenants.map((t) => ({
                tenantUserId: new mongoose_2.Types.ObjectId(t.tenantUserId),
                tenantName: t.tenantName,
                tenantEmail: t.tenantEmail,
                tenantPhone: t.tenantPhone,
                rentShare: t.rentShare,
            })),
            leaseStart: start,
            leaseEnd: end,
            monthlyRent: dto.monthlyRent,
            depositAmount: dto.depositAmount ?? 0,
            advanceMonths: dto.advanceMonths ?? 1,
            status: digital_lease_schema_1.LeaseStatus.DRAFT,
            clauses: this.STANDARD_CLAUSES,
            customClauses: dto.customClauses ?? [],
            conditionLogs: [],
        });
        await lease.save();
        this.logger.log(`✅ Lease draft created: ${lease._id} for property ${dto.propertyId}`);
        return lease;
    }
    async findById(leaseId) {
        if (!mongoose_2.Types.ObjectId.isValid(leaseId)) {
            throw new common_1.BadRequestException('Invalid lease ID');
        }
        const lease = await this.leaseModel
            .findById(leaseId)
            .populate('propertyId', 'title address city images studentDetails')
            .populate('landlordUserId', 'name email phoneNumber profilePicture')
            .exec();
        if (!lease)
            throw new common_1.NotFoundException('Lease not found');
        return lease;
    }
    async findByLandlord(landlordUserId, status) {
        const filter = {
            landlordUserId: new mongoose_2.Types.ObjectId(landlordUserId),
        };
        if (status)
            filter.status = status;
        return this.leaseModel
            .find(filter)
            .populate('propertyId', 'title address city images')
            .sort({ leaseStart: -1 })
            .exec();
    }
    async findByTenant(tenantUserId) {
        return this.leaseModel
            .find({ 'tenants.tenantUserId': new mongoose_2.Types.ObjectId(tenantUserId) })
            .populate('propertyId', 'title address city images studentDetails')
            .populate('landlordUserId', 'name email phoneNumber profilePicture')
            .sort({ leaseStart: -1 })
            .exec();
    }
    async sign(leaseId, signingUserId, dto) {
        const lease = await this.leaseModel.findById(leaseId).exec();
        if (!lease)
            throw new common_1.NotFoundException('Lease not found');
        if (lease.status === digital_lease_schema_1.LeaseStatus.ACTIVE) {
            throw new common_1.BadRequestException('This lease is already fully signed.');
        }
        if (lease.status === digital_lease_schema_1.LeaseStatus.EXPIRED ||
            lease.status === digital_lease_schema_1.LeaseStatus.TERMINATED) {
            throw new common_1.BadRequestException(`Cannot sign a lease with status "${lease.status}".`);
        }
        const signatureUrl = await this.uploadSignature(dto.signatureBase64, leaseId, signingUserId);
        const isLandlord = lease.landlordUserId.toString() === signingUserId;
        const tenantIndex = lease.tenants.findIndex((t) => t.tenantUserId.toString() === signingUserId);
        const isTenant = tenantIndex !== -1;
        if (!isLandlord && !isTenant) {
            throw new common_1.ForbiddenException('You are not a party to this lease.');
        }
        const now = new Date();
        if (isLandlord) {
            if (lease.landlordSignedAt) {
                throw new common_1.BadRequestException('You have already signed this lease.');
            }
            lease.landlordSignatureUrl = signatureUrl;
            lease.landlordSignedAt = now;
            lease.status = digital_lease_schema_1.LeaseStatus.PENDING_TENANT;
            await this.notifyTenantsToSign(lease);
        }
        else {
            if (lease.tenants[tenantIndex].signedAt) {
                throw new common_1.BadRequestException('You have already signed this lease.');
            }
            if (lease.status !== digital_lease_schema_1.LeaseStatus.PENDING_TENANT) {
                throw new common_1.BadRequestException('The landlord must sign before tenants can sign.');
            }
            lease.tenants[tenantIndex].signatureUrl = signatureUrl;
            lease.tenants[tenantIndex].signedAt = now;
            lease.markModified('tenants');
            const allSigned = lease.tenants.every((t) => !!t.signedAt);
            if (allSigned) {
                lease.status = digital_lease_schema_1.LeaseStatus.ACTIVE;
                await this.onLeaseActivated(lease);
            }
        }
        await lease.save();
        this.logger.log(`✅ Lease ${leaseId} signed by ${isLandlord ? 'landlord' : 'tenant'} ${signingUserId}`);
        return lease;
    }
    async addConditionLog(leaseId, loggedByUserId, dto) {
        const lease = await this.leaseModel.findById(leaseId).exec();
        if (!lease)
            throw new common_1.NotFoundException('Lease not found');
        const isParty = this.isPartyToLease(lease, loggedByUserId);
        if (!isParty) {
            throw new common_1.ForbiddenException('You are not a party to this lease.');
        }
        const existingType = lease.conditionLogs.find((l) => l.type === dto.type);
        if (existingType) {
            throw new common_1.BadRequestException(`A ${dto.type.replace('_', '-')} condition log has already been recorded for this lease.`);
        }
        const logEntry = {
            loggedByUserId: new mongoose_2.Types.ObjectId(loggedByUserId),
            loggedAt: new Date(),
            type: dto.type,
            overallNotes: dto.overallNotes,
            items: dto.items.map((item) => ({
                label: item.label,
                rating: item.rating,
                notes: item.notes,
                photoUrls: [],
            })),
        };
        lease.conditionLogs.push(logEntry);
        await lease.save();
        this.logger.log(`✅ ${dto.type} condition log added to lease ${leaseId} by ${loggedByUserId}`);
        return lease;
    }
    async uploadConditionPhotos(leaseId, logType, itemLabel, files, uploadedByUserId) {
        const lease = await this.leaseModel.findById(leaseId).exec();
        if (!lease)
            throw new common_1.NotFoundException('Lease not found');
        if (!this.isPartyToLease(lease, uploadedByUserId)) {
            throw new common_1.ForbiddenException('You are not a party to this lease.');
        }
        const logIndex = lease.conditionLogs.findIndex((l) => l.type === logType);
        if (logIndex === -1) {
            throw new common_1.NotFoundException(`No ${logType} condition log found. Add the log entry first.`);
        }
        const itemIndex = lease.conditionLogs[logIndex].items.findIndex((i) => i.label.toLowerCase() === itemLabel.toLowerCase());
        if (itemIndex === -1) {
            throw new common_1.NotFoundException(`Item "${itemLabel}" not found in the ${logType} log.`);
        }
        const uploadedUrls = await Promise.all(files.map((file, idx) => new Promise((resolve, reject) => {
            const stream = cloudinary_1.v2.uploader.upload_stream({
                folder: `horohouse/leases/${leaseId}/condition`,
                resource_type: 'image',
                transformation: [{ quality: 75, fetch_format: 'auto' }],
            }, (error, result) => {
                if (error)
                    reject(error);
                else
                    resolve(result.secure_url);
            });
            stream.end(file.buffer);
        })));
        lease.conditionLogs[logIndex].items[itemIndex].photoUrls.push(...uploadedUrls);
        lease.markModified('conditionLogs');
        await lease.save();
        this.logger.log(`✅ ${uploadedUrls.length} condition photo(s) uploaded for lease ${leaseId} item "${itemLabel}"`);
        return lease;
    }
    async terminate(leaseId, requestingUserId, dto) {
        const lease = await this.leaseModel.findById(leaseId).exec();
        if (!lease)
            throw new common_1.NotFoundException('Lease not found');
        if (!this.isPartyToLease(lease, requestingUserId)) {
            throw new common_1.ForbiddenException('You are not a party to this lease.');
        }
        if (lease.status === digital_lease_schema_1.LeaseStatus.EXPIRED ||
            lease.status === digital_lease_schema_1.LeaseStatus.TERMINATED) {
            throw new common_1.BadRequestException(`Lease is already ${lease.status}.`);
        }
        const updated = await this.leaseModel
            .findByIdAndUpdate(leaseId, {
            $set: {
                status: digital_lease_schema_1.LeaseStatus.TERMINATED,
                terminationReason: dto.reason,
                terminatedAt: new Date(),
                terminatedByUserId: new mongoose_2.Types.ObjectId(requestingUserId),
            },
        }, { new: true })
            .exec();
        const otherPartyIds = this.getOtherPartyIds(lease, requestingUserId);
        await Promise.all(otherPartyIds.map((userId) => this.notificationsService.create({
            userId,
            type: notification_schema_1.NotificationType.SYSTEM,
            title: 'Lease terminated',
            message: `The lease for your property has been terminated. Reason: ${dto.reason}`,
            metadata: { leaseId },
        })));
        this.logger.log(`Lease ${leaseId} terminated by ${requestingUserId}. Reason: ${dto.reason}`);
        return updated;
    }
    async expireLeases() {
        const result = await this.leaseModel
            .updateMany({
            status: digital_lease_schema_1.LeaseStatus.ACTIVE,
            leaseEnd: { $lt: new Date() },
        }, { $set: { status: digital_lease_schema_1.LeaseStatus.EXPIRED } })
            .exec();
        if (result.modifiedCount > 0) {
            this.logger.log(`⏰ Expired ${result.modifiedCount} leases`);
        }
    }
    async onLeaseActivated(lease) {
        const allPartyIds = [
            lease.landlordUserId.toString(),
            ...lease.tenants.map((t) => t.tenantUserId.toString()),
        ];
        await Promise.all(allPartyIds.map((userId) => this.notificationsService.create({
            userId,
            type: notification_schema_1.NotificationType.SYSTEM,
            title: 'Lease activated!',
            message: 'All parties have signed. Your lease is now active.',
            metadata: { leaseId: lease._id.toString() },
        })));
        const cycleStart = lease.leaseStart;
        const cycleEnd = new Date(cycleStart);
        cycleEnd.setMonth(cycleEnd.getMonth() + 1);
        cycleEnd.setDate(cycleEnd.getDate() - 1);
        const cycleLabel = cycleStart.toLocaleDateString('en-US', {
            month: 'long',
            year: 'numeric',
        });
        const dueDate = new Date(cycleStart);
        dueDate.setDate(5);
        await this.splitPaymentsService.createCycle(lease.landlordUserId.toString(), {
            propertyId: lease.propertyId.toString(),
            leaseId: lease._id.toString(),
            cycleLabel,
            cycleStart: cycleStart.toISOString().split('T')[0],
            cycleEnd: cycleEnd.toISOString().split('T')[0],
            totalRent: lease.monthlyRent,
            tenantShares: lease.tenants.map((t) => ({
                tenantUserId: t.tenantUserId.toString(),
                tenantName: t.tenantName,
                tenantPhone: t.tenantPhone,
                amountDue: t.rentShare,
                dueDate: dueDate.toISOString().split('T')[0],
            })),
        });
        this.logger.log(`✅ First billing cycle auto-created for lease ${lease._id} (${cycleLabel})`);
    }
    async uploadSignature(base64, leaseId, userId) {
        const data = base64.includes(',') ? base64.split(',')[1] : base64;
        const buffer = Buffer.from(data, 'base64');
        return new Promise((resolve, reject) => {
            const stream = cloudinary_1.v2.uploader.upload_stream({
                folder: `horohouse/leases/${leaseId}/signatures`,
                resource_type: 'image',
                public_id: `sig_${userId}_${Date.now()}`,
                transformation: [{ quality: 90 }],
            }, (error, result) => {
                if (error)
                    reject(error);
                else
                    resolve(result.secure_url);
            });
            stream.end(buffer);
        });
    }
    async notifyTenantsToSign(lease) {
        await Promise.all(lease.tenants.map((t) => this.notificationsService.create({
            userId: t.tenantUserId.toString(),
            type: notification_schema_1.NotificationType.SYSTEM,
            title: 'Lease ready for your signature',
            message: 'Your landlord has signed the lease. Please review and sign to activate it.',
            metadata: {
                leaseId: lease._id.toString(),
                action: 'sign_lease',
            },
        })));
    }
    isPartyToLease(lease, userId) {
        const isLandlord = lease.landlordUserId.toString() === userId;
        const isTenant = lease.tenants.some((t) => t.tenantUserId.toString() === userId);
        return isLandlord || isTenant;
    }
    getOtherPartyIds(lease, excludeUserId) {
        const all = [
            lease.landlordUserId.toString(),
            ...lease.tenants.map((t) => t.tenantUserId.toString()),
        ];
        return [...new Set(all.filter((id) => id !== excludeUserId))];
    }
};
exports.DigitalLeaseService = DigitalLeaseService;
__decorate([
    (0, schedule_1.Cron)('0 1 * * *'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], DigitalLeaseService.prototype, "expireLeases", null);
exports.DigitalLeaseService = DigitalLeaseService = DigitalLeaseService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(digital_lease_schema_1.DigitalLease.name)),
    __param(1, (0, mongoose_1.InjectModel)(user_schema_1.User.name)),
    __param(2, (0, mongoose_1.InjectModel)(property_schema_1.Property.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model,
        config_1.ConfigService,
        notifications_service_1.NotificationsService,
        split_payments_service_1.SplitPaymentsService])
], DigitalLeaseService);
//# sourceMappingURL=digital-lease.service.js.map