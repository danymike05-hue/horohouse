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
var SplitPaymentsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SplitPaymentsService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const schedule_1 = require("@nestjs/schedule");
const split_payment_schema_1 = require("./schemas/split-payment.schema");
const user_schema_1 = require("../users/schemas/user.schema");
const notifications_service_1 = require("../notifications/notifications.service");
const notification_schema_1 = require("../notifications/schemas/notification.schema");
const camerpay_service_1 = require("../payments/services/camerpay.service");
let SplitPaymentsService = SplitPaymentsService_1 = class SplitPaymentsService {
    splitPaymentModel;
    userModel;
    notificationsService;
    camerpayService;
    logger = new common_1.Logger(SplitPaymentsService_1.name);
    constructor(splitPaymentModel, userModel, notificationsService, camerpayService) {
        this.splitPaymentModel = splitPaymentModel;
        this.userModel = userModel;
        this.notificationsService = notificationsService;
        this.camerpayService = camerpayService;
    }
    calculateSplit(dto) {
        const { totalRent, numberOfTenants, customPercentages } = dto;
        if (customPercentages) {
            if (customPercentages.length !== numberOfTenants) {
                throw new common_1.BadRequestException(`customPercentages must have exactly ${numberOfTenants} entries.`);
            }
            const sum = customPercentages.reduce((a, b) => a + b, 0);
            if (Math.abs(sum - 100) > 0.01) {
                throw new common_1.BadRequestException(`customPercentages must sum to 100 (got ${sum}).`);
            }
        }
        const shares = Array.from({ length: numberOfTenants }, (_, i) => {
            const percentage = customPercentages
                ? customPercentages[i]
                : 100 / numberOfTenants;
            const amount = Math.floor((totalRent * percentage) / 100);
            return { tenantIndex: i + 1, amount, percentage };
        });
        const distributed = shares.reduce((s, x) => s + x.amount, 0);
        const remainder = totalRent - distributed;
        if (remainder > 0)
            shares[0].amount += remainder;
        return { totalRent, numberOfTenants, shares, remainder };
    }
    async createCycle(landlordUserId, dto) {
        const sharesSum = dto.tenantShares.reduce((s, t) => s + t.amountDue, 0);
        if (sharesSum !== dto.totalRent) {
            throw new common_1.BadRequestException(`Tenant shares sum to ${sharesSum} XAF but totalRent is ${dto.totalRent} XAF. They must match.`);
        }
        const existing = await this.splitPaymentModel
            .findOne({
            leaseId: new mongoose_2.Types.ObjectId(dto.leaseId),
            cycleStart: new Date(dto.cycleStart),
        })
            .exec();
        if (existing) {
            throw new common_1.BadRequestException(`A payment cycle already exists for this lease starting ${dto.cycleStart}.`);
        }
        const cycle = new this.splitPaymentModel({
            propertyId: new mongoose_2.Types.ObjectId(dto.propertyId),
            leaseId: new mongoose_2.Types.ObjectId(dto.leaseId),
            landlordUserId: new mongoose_2.Types.ObjectId(landlordUserId),
            cycleLabel: dto.cycleLabel,
            cycleStart: new Date(dto.cycleStart),
            cycleEnd: new Date(dto.cycleEnd),
            totalRent: dto.totalRent,
            totalCollected: 0,
            status: split_payment_schema_1.SplitPaymentStatus.PENDING,
            tenantShares: dto.tenantShares.map((t) => ({
                tenantUserId: new mongoose_2.Types.ObjectId(t.tenantUserId),
                tenantName: t.tenantName,
                tenantPhone: t.tenantPhone,
                amountDue: t.amountDue,
                amountPaid: 0,
                status: split_payment_schema_1.TenantShareStatus.UNPAID,
                momoPhone: t.momoPhone,
                momoProvider: t.momoProvider,
                dueDate: new Date(t.dueDate),
            })),
        });
        await cycle.save();
        this.notifyTenantsOfNewCycle(cycle).catch((err) => this.logger.warn(`Tenant cycle notification failed: ${err.message}`));
        this.logger.log(`✅ Split payment cycle created: ${cycle._id} (${dto.cycleLabel}) — ${dto.tenantShares.length} tenants`);
        return cycle;
    }
    async findById(cycleId) {
        if (!mongoose_2.Types.ObjectId.isValid(cycleId)) {
            throw new common_1.BadRequestException('Invalid cycle ID');
        }
        const cycle = await this.splitPaymentModel
            .findById(cycleId)
            .populate('propertyId', 'title address city')
            .exec();
        if (!cycle)
            throw new common_1.NotFoundException('Payment cycle not found');
        return cycle;
    }
    async findByLease(leaseId) {
        return this.splitPaymentModel
            .find({ leaseId: new mongoose_2.Types.ObjectId(leaseId) })
            .populate('propertyId', 'title address city')
            .sort({ cycleStart: -1 })
            .exec();
    }
    async findMyPayments(tenantUserId) {
        return this.splitPaymentModel
            .find({ 'tenantShares.tenantUserId': new mongoose_2.Types.ObjectId(tenantUserId) })
            .populate('propertyId', 'title address city images')
            .sort({ cycleStart: -1 })
            .exec();
    }
    async findByLandlord(landlordUserId, status) {
        const filter = { landlordUserId: new mongoose_2.Types.ObjectId(landlordUserId) };
        if (status)
            filter.status = status;
        return this.splitPaymentModel
            .find(filter)
            .populate('propertyId', 'title address city')
            .sort({ cycleStart: -1 })
            .exec();
    }
    async recordPayment(cycleId, dto, requestingUserId) {
        const cycle = await this.splitPaymentModel.findById(cycleId).exec();
        if (!cycle)
            throw new common_1.NotFoundException('Payment cycle not found');
        const requestingUser = await this.userModel
            .findById(requestingUserId)
            .select('role')
            .exec();
        const isLandlord = cycle.landlordUserId.toString() === requestingUserId;
        const isAdmin = requestingUser?.role === user_schema_1.UserRole.ADMIN;
        const isTenant = cycle.tenantShares.some((s) => s.tenantUserId.toString() === dto.tenantUserId);
        if (!isLandlord && !isAdmin && !isTenant) {
            throw new common_1.ForbiddenException('You are not authorised to record this payment.');
        }
        const shareIndex = cycle.tenantShares.findIndex((s) => s.tenantUserId.toString() === dto.tenantUserId);
        if (shareIndex === -1) {
            throw new common_1.NotFoundException('Tenant share not found in this cycle.');
        }
        const share = cycle.tenantShares[shareIndex];
        if (share.status === split_payment_schema_1.TenantShareStatus.PAID) {
            throw new common_1.BadRequestException('This tenant has already paid for this cycle.');
        }
        cycle.tenantShares[shareIndex].amountPaid = dto.amountPaid;
        cycle.tenantShares[shareIndex].status =
            dto.amountPaid >= share.amountDue
                ? split_payment_schema_1.TenantShareStatus.PAID
                : split_payment_schema_1.TenantShareStatus.UNPAID;
        cycle.tenantShares[shareIndex].paidAt = new Date();
        if (dto.momoTransactionId) {
            cycle.tenantShares[shareIndex].momoTransactionId = dto.momoTransactionId;
        }
        if (dto.momoProvider) {
            cycle.tenantShares[shareIndex].momoProvider = dto.momoProvider;
        }
        cycle.totalCollected = cycle.tenantShares.reduce((s, t) => s + t.amountPaid, 0);
        cycle.status = this.deriveCycleStatus(cycle.tenantShares);
        cycle.markModified('tenantShares');
        await cycle.save();
        if (cycle.status === split_payment_schema_1.SplitPaymentStatus.COMPLETE) {
            this.notificationsService.create({
                userId: cycle.landlordUserId.toString(),
                type: notification_schema_1.NotificationType.PAYMENT_RECEIVED,
                title: 'All tenants have paid!',
                message: `Full rent of ${cycle.totalRent.toLocaleString()} XAF collected for ${cycle.cycleLabel}. Ready for disbursement.`,
                metadata: {
                    cycleId: cycle._id.toString(),
                    amount: cycle.totalRent,
                    currency: 'XAF',
                },
            }).catch((err) => this.logger.warn(`Notification failed: ${err.message}`));
        }
        this.logger.log(`✅ Payment recorded: tenant ${dto.tenantUserId} paid ${dto.amountPaid} XAF in cycle ${cycleId}`);
        return cycle;
    }
    async initiateCharge(cycleId, dto, requestingUserId) {
        const cycle = await this.splitPaymentModel.findById(cycleId).exec();
        if (!cycle)
            throw new common_1.NotFoundException('Payment cycle not found');
        if (cycle.landlordUserId.toString() !== requestingUserId) {
            const requestingUser = await this.userModel
                .findById(requestingUserId)
                .select('role')
                .exec();
            if (requestingUser?.role !== user_schema_1.UserRole.ADMIN) {
                throw new common_1.ForbiddenException('Only the landlord can initiate payment charges.');
            }
        }
        const share = cycle.tenantShares.find((s) => s.tenantUserId.toString() === dto.tenantUserId);
        if (!share) {
            throw new common_1.NotFoundException('Tenant share not found in this cycle.');
        }
        if (share.status === split_payment_schema_1.TenantShareStatus.PAID) {
            throw new common_1.BadRequestException('This tenant has already paid.');
        }
        const tenant = await this.userModel
            .findById(dto.tenantUserId)
            .select('name email')
            .exec();
        if (!tenant)
            throw new common_1.NotFoundException('Tenant user not found.');
        const txRef = `SPLIT-${cycleId}-${dto.tenantUserId}-${Date.now()}`;
        await this.camerpayService.initializePayment({
            merchant_invoice_id: txRef,
            amount: share.amountDue,
            currency: 'XAF',
            payment_method: dto.momoProvider === 'mtn' ? 'mtn_momo' : 'orange_money',
            customer_name: tenant.name ?? 'Tenant',
            customer_phone: dto.momoPhone,
            callback_url: '',
            return_url: '',
        });
        const shareIndex = cycle.tenantShares.findIndex((s) => s.tenantUserId.toString() === dto.tenantUserId);
        cycle.tenantShares[shareIndex].momoTransactionId = txRef;
        cycle.tenantShares[shareIndex].momoPhone = dto.momoPhone;
        cycle.tenantShares[shareIndex].momoProvider = dto.momoProvider;
        cycle.markModified('tenantShares');
        await cycle.save();
        this.logger.log(`✅ MoMo charge initiated: ${dto.momoPhone} — ${share.amountDue} XAF (ref: ${txRef})`);
        return {
            message: `Payment request sent to ${dto.momoPhone}. The tenant will receive a prompt on their phone.`,
            reference: txRef,
        };
    }
    async markDisbursed(cycleId, adminUserId, disbursementTransactionId) {
        const cycle = await this.splitPaymentModel.findById(cycleId).exec();
        if (!cycle)
            throw new common_1.NotFoundException('Payment cycle not found');
        if (cycle.status !== split_payment_schema_1.SplitPaymentStatus.COMPLETE) {
            throw new common_1.BadRequestException(`Cannot disburse a cycle with status "${cycle.status}". All tenants must have paid first.`);
        }
        const updated = await this.splitPaymentModel
            .findByIdAndUpdate(cycleId, {
            $set: {
                status: split_payment_schema_1.SplitPaymentStatus.DISBURSED,
                disbursedAt: new Date(),
                disbursementTransactionId,
            },
        }, { new: true })
            .exec();
        this.notificationsService.create({
            userId: cycle.landlordUserId.toString(),
            type: notification_schema_1.NotificationType.PAYMENT_RECEIVED,
            title: 'Rent disbursed',
            message: `${cycle.totalRent.toLocaleString()} XAF for ${cycle.cycleLabel} has been sent to your account.`,
            metadata: {
                cycleId,
                amount: cycle.totalRent,
                currency: 'XAF',
            },
        }).catch((err) => this.logger.warn(`Notification failed: ${err.message}`));
        this.logger.log(`✅ Cycle ${cycleId} marked as DISBURSED by admin ${adminUserId}`);
        return updated;
    }
    async markOverdueShares() {
        const now = new Date();
        const staleCycles = await this.splitPaymentModel
            .find({
            status: { $in: [split_payment_schema_1.SplitPaymentStatus.PENDING, split_payment_schema_1.SplitPaymentStatus.PARTIAL] },
            'tenantShares.dueDate': { $lt: now },
            'tenantShares.status': split_payment_schema_1.TenantShareStatus.UNPAID,
        })
            .exec();
        let overdueCount = 0;
        for (const cycle of staleCycles) {
            let modified = false;
            for (const share of cycle.tenantShares) {
                if (share.status === split_payment_schema_1.TenantShareStatus.UNPAID &&
                    share.dueDate < now) {
                    share.status = split_payment_schema_1.TenantShareStatus.OVERDUE;
                    modified = true;
                    overdueCount++;
                    this.notificationsService.create({
                        userId: share.tenantUserId.toString(),
                        type: notification_schema_1.NotificationType.SYSTEM,
                        title: 'Rent payment overdue',
                        message: `Your rent share of ${share.amountDue.toLocaleString()} XAF for ${cycle.cycleLabel} is now overdue.`,
                        metadata: {
                            cycleId: cycle._id.toString(),
                            amount: share.amountDue,
                            currency: 'XAF',
                        },
                    }).catch(() => { });
                }
            }
            if (modified) {
                cycle.status = this.deriveCycleStatus(cycle.tenantShares);
                cycle.markModified('tenantShares');
                await cycle.save();
            }
        }
        if (overdueCount > 0) {
            this.logger.log(`⏰ Marked ${overdueCount} tenant shares as OVERDUE`);
        }
    }
    deriveCycleStatus(shares) {
        const statuses = shares.map((s) => s.status);
        if (statuses.every((s) => s === split_payment_schema_1.TenantShareStatus.PAID)) {
            return split_payment_schema_1.SplitPaymentStatus.COMPLETE;
        }
        if (statuses.some((s) => s === split_payment_schema_1.TenantShareStatus.OVERDUE)) {
            return split_payment_schema_1.SplitPaymentStatus.OVERDUE;
        }
        if (statuses.some((s) => s === split_payment_schema_1.TenantShareStatus.PAID)) {
            return split_payment_schema_1.SplitPaymentStatus.PARTIAL;
        }
        return split_payment_schema_1.SplitPaymentStatus.PENDING;
    }
    async notifyTenantsOfNewCycle(cycle) {
        await Promise.all(cycle.tenantShares.map((share) => this.notificationsService.create({
            userId: share.tenantUserId.toString(),
            type: notification_schema_1.NotificationType.SYSTEM,
            title: `Rent due — ${cycle.cycleLabel}`,
            message: `Your share of ${share.amountDue.toLocaleString()} XAF is due by ${share.dueDate.toLocaleDateString()}.`,
            metadata: {
                cycleId: cycle._id.toString(),
                amount: share.amountDue,
                currency: 'XAF',
            },
        })));
    }
};
exports.SplitPaymentsService = SplitPaymentsService;
__decorate([
    (0, schedule_1.Cron)('0 8 * * *'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], SplitPaymentsService.prototype, "markOverdueShares", null);
exports.SplitPaymentsService = SplitPaymentsService = SplitPaymentsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(split_payment_schema_1.SplitPayment.name)),
    __param(1, (0, mongoose_1.InjectModel)(user_schema_1.User.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Model,
        notifications_service_1.NotificationsService,
        camerpay_service_1.CamerPayService])
], SplitPaymentsService);
//# sourceMappingURL=split-payments.service.js.map