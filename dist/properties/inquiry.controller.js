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
var InquiryController_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.InquiryController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../auth/guards/jwt.auth.guard");
const inquiry_service_1 = require("./inquiry.service");
let InquiryController = InquiryController_1 = class InquiryController {
    inquiryService;
    logger = new common_1.Logger(InquiryController_1.name);
    constructor(inquiryService) {
        this.inquiryService = inquiryService;
    }
    health() {
        return { status: 'ok' };
    }
    async create(body, req) {
        const user = req.user;
        this.logger.log('=== INQUIRY CREATE REQUEST ===');
        this.logger.log('Raw body:', JSON.stringify(body, null, 2));
        this.logger.log('Body type:', typeof body);
        this.logger.log('Body keys:', body ? Object.keys(body) : 'null');
        this.logger.log('PropertyId:', body?.propertyId);
        if (!body) {
            this.logger.error('Request body is null or undefined');
            throw new Error('Request body is required');
        }
        const createInquiryDto = {
            propertyId: body.propertyId,
            message: body.message,
            type: body.type,
            preferredContactMethod: body.preferredContactMethod,
            preferredContactTime: body.preferredContactTime,
            viewingDate: body.viewingDate,
            budget: body.budget,
            moveInDate: body.moveInDate,
            contactEmail: body.email || body.contactEmail,
            contactPhone: body.phone || body.contactPhone,
        };
        this.logger.log('Constructed DTO:', JSON.stringify(createInquiryDto, null, 2));
        if (!createInquiryDto.propertyId) {
            this.logger.error('PropertyId is missing from request');
            throw new Error('PropertyId is required');
        }
        if (!createInquiryDto.message) {
            this.logger.error('Message is missing from request');
            throw new Error('Message is required');
        }
        return this.inquiryService.create(createInquiryDto, user);
    }
    async findAll(propertyId, agentId, userId, status, type, isRead, page = '1', limit = '20', sortBy = 'createdAt', sortOrder = 'desc', req) {
        const user = req.user;
        const filters = {
            propertyId: propertyId || undefined,
            agentId: agentId || undefined,
            userId: userId || undefined,
            status: status,
            type: type,
            isRead: typeof isRead !== 'undefined' ? isRead === 'true' : undefined,
        };
        const options = {
            page: Number(page) || 1,
            limit: Math.min(Number(limit) || 20, 100),
            sortBy,
            sortOrder,
        };
        return this.inquiryService.findAll(filters, options, user);
    }
    async stats(req) {
        const user = req.user;
        return this.inquiryService.getInquiryStats(user);
    }
    async forProperty(propertyId, req) {
        const user = req.user;
        return this.inquiryService.getInquiriesForProperty(propertyId, user);
    }
    async findOne(id, req) {
        const user = req.user;
        return this.inquiryService.findOne(id, user);
    }
    async update(id, updateInquiryDto, req) {
        const user = req.user;
        return this.inquiryService.update(id, updateInquiryDto, user);
    }
    async markAsRead(id, req) {
        const user = req.user;
        return this.inquiryService.markAsRead(id, user);
    }
    async remove(id, req) {
        const user = req.user;
        await this.inquiryService.remove(id, user);
        return { success: true };
    }
};
exports.InquiryController = InquiryController;
__decorate([
    (0, common_1.Get)('health'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], InquiryController.prototype, "health", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], InquiryController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)('propertyId')),
    __param(1, (0, common_1.Query)('agentId')),
    __param(2, (0, common_1.Query)('userId')),
    __param(3, (0, common_1.Query)('status')),
    __param(4, (0, common_1.Query)('type')),
    __param(5, (0, common_1.Query)('isRead')),
    __param(6, (0, common_1.Query)('page')),
    __param(7, (0, common_1.Query)('limit')),
    __param(8, (0, common_1.Query)('sortBy')),
    __param(9, (0, common_1.Query)('sortOrder')),
    __param(10, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, String, String, Object, Object, Object, String, Object]),
    __metadata("design:returntype", Promise)
], InquiryController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)('stats'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], InquiryController.prototype, "stats", null);
__decorate([
    (0, common_1.Get)('property/:propertyId'),
    __param(0, (0, common_1.Param)('propertyId')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], InquiryController.prototype, "forProperty", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], InquiryController.prototype, "findOne", null);
__decorate([
    (0, common_1.Patch)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], InquiryController.prototype, "update", null);
__decorate([
    (0, common_1.Patch)(':id/read'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], InquiryController.prototype, "markAsRead", null);
__decorate([
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], InquiryController.prototype, "remove", null);
exports.InquiryController = InquiryController = InquiryController_1 = __decorate([
    (0, common_1.Controller)('inquiries'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __metadata("design:paramtypes", [inquiry_service_1.InquiryService])
], InquiryController);
//# sourceMappingURL=inquiry.controller.js.map