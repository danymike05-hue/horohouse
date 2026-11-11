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
var InquiryService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.InquiryService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const inquiry_schema_1 = require("./schemas/inquiry.schema");
const property_schema_1 = require("./schemas/property.schema");
const user_schema_1 = require("../users/schemas/user.schema");
const history_service_1 = require("../history/history.service");
const history_schema_1 = require("../history/schemas/history.schema");
const notifications_service_1 = require("../notifications/notifications.service");
let InquiryService = InquiryService_1 = class InquiryService {
    inquiryModel;
    propertyModel;
    userModel;
    historyService;
    notificationsService;
    logger = new common_1.Logger(InquiryService_1.name);
    constructor(inquiryModel, propertyModel, userModel, historyService, notificationsService) {
        this.inquiryModel = inquiryModel;
        this.propertyModel = propertyModel;
        this.userModel = userModel;
        this.historyService = historyService;
        this.notificationsService = notificationsService;
    }
    async create(createInquiryDto, user) {
        const property = await this.propertyModel.findById(createInquiryDto.propertyId).populate('agentId ownerId');
        if (!property) {
            throw new common_1.NotFoundException('Property not found');
        }
        const rawAgent = property.agentId || property.ownerId;
        if (!rawAgent) {
            throw new common_1.BadRequestException('Property has no assigned agent or owner');
        }
        const agentId = (() => {
            if (!rawAgent)
                return '';
            if (typeof rawAgent === 'object' && rawAgent._id) {
                return rawAgent._id.toString();
            }
            try {
                return rawAgent.toString();
            }
            catch (e) {
                return String(rawAgent);
            }
        })();
        const inquiry = new this.inquiryModel({
            ...createInquiryDto,
            propertyId: new mongoose_2.Types.ObjectId(createInquiryDto.propertyId),
            userId: user._id,
            agentId: new mongoose_2.Types.ObjectId(agentId),
        });
        const savedInquiry = await inquiry.save();
        this.logger.log(`Inquiry created: ${savedInquiry._id} for property ${property._id} by user ${user._id}`);
        await this.propertyModel.findByIdAndUpdate(property._id, { $inc: { inquiriesCount: 1 } });
        await this.historyService.logActivity({
            userId: user._id,
            activityType: history_schema_1.ActivityType.PROPERTY_INQUIRY,
            propertyId: property._id,
            agentId: new mongoose_2.Types.ObjectId(agentId),
            metadata: {
                inquiryId: savedInquiry._id,
                agentId: agentId,
                message: createInquiryDto.message.substring(0, 100) + '...',
            },
        });
        try {
            await this.notificationsService.createInquiryNotification(agentId, savedInquiry._id.toString(), property._id.toString(), user.name || 'A user', property.title);
        }
        catch (error) {
            this.logger.error(`Failed to create inquiry notification: ${error.message}`);
        }
        return savedInquiry.populate('propertyId userId agentId');
    }
    async findAll(filters = {}, options = {}, user) {
        const { page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc' } = options;
        const skip = (page - 1) * limit;
        let query = {};
        if (user.role === user_schema_1.UserRole.AGENT || user.role === user_schema_1.UserRole.LANDLORD) {
            query.agentId = user._id;
        }
        else if (user.role === user_schema_1.UserRole.REGISTERED_USER) {
            query.userId = user._id;
        }
        if (filters.propertyId) {
            query.propertyId = new mongoose_2.Types.ObjectId(filters.propertyId);
        }
        if (filters.agentId) {
            query.agentId = new mongoose_2.Types.ObjectId(filters.agentId);
        }
        if (filters.userId) {
            query.userId = new mongoose_2.Types.ObjectId(filters.userId);
        }
        if (filters.status) {
            query.status = filters.status;
        }
        if (filters.type) {
            query.type = filters.type;
        }
        if (filters.isRead !== undefined) {
            query.isRead = filters.isRead;
        }
        const [inquiries, total] = await Promise.all([
            this.inquiryModel
                .find(query)
                .populate('propertyId', 'title price type images location')
                .populate('userId', 'name email phoneNumber profilePicture')
                .populate('agentId', 'name email phoneNumber profilePicture')
                .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
                .skip(skip)
                .limit(limit)
                .exec(),
            this.inquiryModel.countDocuments(query),
        ]);
        return {
            inquiries,
            total,
            page,
            totalPages: Math.ceil(total / limit),
        };
    }
    async findOne(id, user) {
        const inquiry = await this.inquiryModel
            .findById(id)
            .populate('propertyId')
            .populate('userId', 'name email phoneNumber profilePicture')
            .populate('agentId', 'name email phoneNumber profilePicture');
        if (!inquiry) {
            throw new common_1.NotFoundException('Inquiry not found');
        }
        const getUserId = (field) => {
            if (!field)
                return null;
            if (typeof field === 'object' && field._id) {
                return field._id.toString();
            }
            return field.toString();
        };
        const inquiryUserId = getUserId(inquiry.userId);
        const inquiryAgentId = getUserId(inquiry.agentId);
        const currentUserId = (user._id || user.id).toString();
        const canAccess = user.role === user_schema_1.UserRole.ADMIN ||
            inquiryUserId === currentUserId ||
            (inquiryAgentId && inquiryAgentId === currentUserId);
        if (!canAccess) {
            this.logger.warn(`Access denied for user ${currentUserId} to inquiry ${id}`);
            this.logger.debug(`Permission check: userId=${inquiryUserId}, agentId=${inquiryAgentId}, currentUser=${currentUserId}, role=${user.role}`);
            throw new common_1.ForbiddenException('Access denied');
        }
        if (inquiryAgentId && inquiryAgentId === currentUserId && !inquiry.isRead) {
            inquiry.isRead = true;
            inquiry.readAt = new Date();
            await inquiry.save();
        }
        return inquiry;
    }
    async update(id, updateInquiryDto, user) {
        const inquiry = await this.inquiryModel.findById(id);
        if (!inquiry) {
            throw new common_1.NotFoundException('Inquiry not found');
        }
        const canUpdate = user.role === user_schema_1.UserRole.ADMIN ||
            (inquiry.agentId && inquiry.agentId.toString() === user._id.toString());
        if (!canUpdate) {
            throw new common_1.ForbiddenException('Access denied');
        }
        Object.assign(inquiry, updateInquiryDto);
        if (updateInquiryDto.response) {
            inquiry.respondedAt = new Date();
            inquiry.respondedBy = user._id;
            inquiry.status = inquiry_schema_1.InquiryStatus.RESPONDED;
        }
        const updatedInquiry = await inquiry.save();
        await this.historyService.logActivity({
            userId: user._id,
            activityType: history_schema_1.ActivityType.AGENT_CONTACT,
            propertyId: inquiry.propertyId,
            metadata: {
                inquiryId: inquiry._id,
                action: 'response',
                response: updateInquiryDto.response?.substring(0, 100) + '...',
            },
        });
        try {
            const targetUserId = (() => {
                const u = inquiry.userId;
                if (!u)
                    return '';
                if (typeof u === 'object' && u._id)
                    return u._id.toString();
                return u.toString();
            })();
            if (targetUserId) {
                const snippet = updateInquiryDto.response ? updateInquiryDto.response.substring(0, 120) : undefined;
                await this.notificationsService.createInquiryResponseNotification(targetUserId, inquiry._id.toString(), inquiry.propertyId.toString(), user.name || 'An agent', snippet);
            }
            else {
                this.logger.warn(`Could not determine target user for inquiry ${inquiry._id}`);
            }
        }
        catch (error) {
            this.logger.error(`Failed to notify user about agent response: ${error.message}`);
        }
        return updatedInquiry.populate('propertyId userId agentId');
    }
    async remove(id, user) {
        const inquiry = await this.inquiryModel.findById(id);
        if (!inquiry) {
            throw new common_1.NotFoundException('Inquiry not found');
        }
        const canDelete = user.role === user_schema_1.UserRole.ADMIN ||
            inquiry.userId.toString() === user._id.toString();
        if (!canDelete) {
            throw new common_1.ForbiddenException('Access denied');
        }
        await this.inquiryModel.findByIdAndDelete(id);
        await this.propertyModel.findByIdAndUpdate(inquiry.propertyId, { $inc: { inquiriesCount: -1 } });
    }
    async getInquiriesForProperty(propertyId, user) {
        const property = await this.propertyModel.findById(propertyId);
        if (!property) {
            throw new common_1.NotFoundException('Property not found');
        }
        const canAccess = user.role === user_schema_1.UserRole.ADMIN ||
            property.ownerId.toString() === user._id.toString() ||
            property.agentId?.toString() === user._id.toString();
        if (!canAccess) {
            throw new common_1.ForbiddenException('Access denied');
        }
        return this.inquiryModel
            .find({ propertyId: new mongoose_2.Types.ObjectId(propertyId) })
            .populate('userId', 'name email phoneNumber profilePicture')
            .sort({ createdAt: -1 })
            .exec();
    }
    async getInquiryStats(user) {
        let matchQuery = {};
        if (user.role === user_schema_1.UserRole.AGENT || user.role === user_schema_1.UserRole.LANDLORD) {
            matchQuery.agentId = user._id;
        }
        else if (user.role === user_schema_1.UserRole.REGISTERED_USER) {
            matchQuery.userId = user._id;
        }
        const stats = await this.inquiryModel.aggregate([
            { $match: matchQuery },
            {
                $group: {
                    _id: null,
                    total: { $sum: 1 },
                    pending: { $sum: { $cond: [{ $eq: ['$status', inquiry_schema_1.InquiryStatus.PENDING] }, 1, 0] } },
                    responded: { $sum: { $cond: [{ $eq: ['$status', inquiry_schema_1.InquiryStatus.RESPONDED] }, 1, 0] } },
                    closed: { $sum: { $cond: [{ $eq: ['$status', inquiry_schema_1.InquiryStatus.CLOSED] }, 1, 0] } },
                    unread: { $sum: { $cond: [{ $eq: ['$isRead', false] }, 1, 0] } },
                },
            },
        ]);
        return stats[0] || {
            total: 0,
            pending: 0,
            responded: 0,
            closed: 0,
            unread: 0,
        };
    }
    async markAsRead(id, user) {
        const inquiry = await this.inquiryModel.findById(id);
        if (!inquiry) {
            throw new common_1.NotFoundException('Inquiry not found');
        }
        const canMarkRead = user.role === user_schema_1.UserRole.ADMIN ||
            inquiry.agentId.toString() === user._id.toString();
        if (!canMarkRead) {
            throw new common_1.ForbiddenException('Access denied');
        }
        inquiry.isRead = true;
        inquiry.readAt = new Date();
        return inquiry.save();
    }
};
exports.InquiryService = InquiryService;
exports.InquiryService = InquiryService = InquiryService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(inquiry_schema_1.Inquiry.name)),
    __param(1, (0, mongoose_1.InjectModel)(property_schema_1.Property.name)),
    __param(2, (0, mongoose_1.InjectModel)(user_schema_1.User.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model,
        history_service_1.HistoryService,
        notifications_service_1.NotificationsService])
], InquiryService);
//# sourceMappingURL=inquiry.service.js.map