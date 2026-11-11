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
var ReportsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReportsService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const report_schema_1 = require("./schemas/report.schema");
const property_schema_1 = require("../properties/schemas/property.schema");
const user_schema_1 = require("../users/schemas/user.schema");
const send_warning_dto_1 = require("./dto/send-warning.dto");
const email_service_1 = require("../email/email.service");
const notifications_service_1 = require("../notifications/notifications.service");
const notification_schema_1 = require("../notifications/schemas/notification.schema");
let ReportsService = ReportsService_1 = class ReportsService {
    reportModel;
    propertyModel;
    userModel;
    emailService;
    notificationsService;
    logger = new common_1.Logger(ReportsService_1.name);
    constructor(reportModel, propertyModel, userModel, emailService, notificationsService) {
        this.reportModel = reportModel;
        this.propertyModel = propertyModel;
        this.userModel = userModel;
        this.emailService = emailService;
        this.notificationsService = notificationsService;
    }
    async create(createReportDto, reporterId, propertyId) {
        const report = new this.reportModel({
            ...createReportDto,
            reporter: reporterId,
            property: propertyId,
        });
        return report.save();
    }
    async findAll(query) {
        const { page = 1, limit = 10, status, propertyId } = query;
        const skip = (page - 1) * limit;
        const filter = {};
        if (status)
            filter.status = status;
        if (propertyId)
            filter.property = propertyId;
        const [data, total] = await Promise.all([
            this.reportModel
                .find(filter)
                .populate('reporter', 'firstName lastName email profilePicture')
                .populate('property', 'title location currentPrice images')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(Number(limit))
                .exec(),
            this.reportModel.countDocuments(filter).exec(),
        ]);
        return { data, total, page: Number(page), limit: Number(limit) };
    }
    async findOne(id) {
        const report = await this.reportModel
            .findById(id)
            .populate('reporter', 'firstName lastName email profilePicture phoneNumber')
            .populate({
            path: 'property',
            select: 'title description location address city currentPrice images status ownerId',
            populate: { path: 'ownerId', select: 'firstName lastName email name' },
        })
            .exec();
        if (!report) {
            throw new common_1.NotFoundException(`Report with ID ${id} not found`);
        }
        return report;
    }
    async updateStatus(id, updateDto) {
        const report = await this.reportModel
            .findByIdAndUpdate(id, updateDto, { new: true })
            .populate('reporter', 'firstName lastName email profilePicture')
            .populate('property', 'title location')
            .exec();
        if (!report) {
            throw new common_1.NotFoundException(`Report with ID ${id} not found`);
        }
        return report;
    }
    async remove(id) {
        const result = await this.reportModel.findByIdAndDelete(id).exec();
        if (!result) {
            throw new common_1.NotFoundException(`Report with ID ${id} not found`);
        }
    }
    async getStats() {
        const [total, pending, resolved, dismissed] = await Promise.all([
            this.reportModel.countDocuments(),
            this.reportModel.countDocuments({ status: 'pending' }),
            this.reportModel.countDocuments({ status: 'resolved' }),
            this.reportModel.countDocuments({ status: 'dismissed' }),
        ]);
        return { total, pending, resolved, dismissed };
    }
    async deleteReportedProperty(reportId, admin) {
        const report = await this.reportModel
            .findById(reportId)
            .populate({
            path: 'property',
            populate: { path: 'ownerId', select: 'name firstName lastName email' },
        })
            .exec();
        if (!report) {
            throw new common_1.NotFoundException(`Report with ID ${reportId} not found`);
        }
        const property = report.property;
        if (!property || !property._id) {
            throw new common_1.BadRequestException('The property associated with this report has already been deleted.');
        }
        const propertyId = property._id.toString();
        const propertyTitle = property.title ?? 'Untitled Property';
        const owner = property.ownerId;
        await this.propertyModel.findByIdAndDelete(propertyId).exec();
        this.logger.log(`Property ${propertyId} ("${propertyTitle}") deleted by admin ${admin._id} via report ${reportId}`);
        await this.reportModel.updateMany({ property: propertyId, status: { $in: ['pending', 'reviewed'] } }, { status: 'resolved', adminNotes: `Property deleted by admin on ${new Date().toLocaleDateString()}` });
        if (owner?._id) {
            const ownerId = owner._id.toString();
            this.notificationsService
                .create({
                userId: ownerId,
                type: notification_schema_1.NotificationType.SYSTEM,
                title: 'Your property has been removed',
                message: `Your listing "${propertyTitle}" has been removed from the platform following a report review by our admin team. If you believe this is a mistake, please contact support.`,
                link: '/dashboard',
                metadata: { propertyTitle },
            })
                .catch((err) => this.logger.error('Failed to send deletion notification to owner', err));
            if (owner.email) {
                const ownerName = owner.firstName ?? owner.name ?? 'Property Owner';
                this.emailService
                    .sendPropertyRemovedEmail(owner.email, ownerName, propertyTitle)
                    .catch((err) => this.logger.error('Failed to send property removal email', err));
            }
        }
        return { message: `Property "${propertyTitle}" has been permanently deleted.` };
    }
    async warnOwner(reportId, dto, admin) {
        const report = await this.reportModel
            .findById(reportId)
            .populate({
            path: 'property',
            select: 'title ownerId address city',
            populate: { path: 'ownerId', select: 'name firstName lastName email' },
        })
            .exec();
        if (!report) {
            throw new common_1.NotFoundException(`Report with ID ${reportId} not found`);
        }
        const property = report.property;
        if (!property || !property._id) {
            throw new common_1.BadRequestException('Cannot send a warning — the reported property no longer exists.');
        }
        const owner = property.ownerId;
        if (!owner?._id) {
            throw new common_1.BadRequestException('Cannot send a warning — property owner information is unavailable.');
        }
        const ownerId = owner._id.toString();
        const ownerName = owner.firstName ?? owner.name ?? 'Property Owner';
        const propertyTitle = property.title ?? 'Untitled Property';
        const severity = dto.severity ?? send_warning_dto_1.WarningSeverity.WARNING;
        const isFinal = severity === send_warning_dto_1.WarningSeverity.FINAL_WARNING;
        const notifTitle = isFinal
            ? `⚠️ Final Warning: Action required on your listing`
            : `⚠️ Warning regarding your listing`;
        await this.notificationsService.create({
            userId: ownerId,
            type: notification_schema_1.NotificationType.SYSTEM,
            title: notifTitle,
            message: `Regarding your property "${propertyTitle}": ${dto.message}`,
            link: `/dashboard/properties`,
            metadata: {
                propertyTitle,
                propertyId: property._id.toString(),
                reportId,
                severity,
            },
        });
        if (owner.email) {
            this.emailService
                .sendPropertyWarningEmail(owner.email, ownerName, propertyTitle, dto.message, severity)
                .catch((err) => this.logger.error('Failed to send warning email to owner', err));
        }
        if (report.status === 'pending') {
            await this.reportModel.findByIdAndUpdate(reportId, {
                status: 'reviewed',
                adminNotes: `Warning sent to owner on ${new Date().toLocaleDateString()}. ${report.adminNotes ?? ''}`.trim(),
            });
        }
        this.logger.log(`Warning (severity: ${severity}) sent to owner ${ownerId} for property "${propertyTitle}" by admin ${admin._id}`);
        return {
            message: `Warning successfully sent to ${ownerName} (${owner.email ?? 'no email on file'}).`,
        };
    }
};
exports.ReportsService = ReportsService;
exports.ReportsService = ReportsService = ReportsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(report_schema_1.Report.name)),
    __param(1, (0, mongoose_1.InjectModel)(property_schema_1.Property.name)),
    __param(2, (0, mongoose_1.InjectModel)(user_schema_1.User.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model,
        email_service_1.EmailService,
        notifications_service_1.NotificationsService])
], ReportsService);
//# sourceMappingURL=reports.service.js.map