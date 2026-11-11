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
Object.defineProperty(exports, "__esModule", { value: true });
exports.HostMessagesController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const jwt_auth_guard_1 = require("../auth/guards/jwt.auth.guard");
const roles_guard_1 = require("../auth/guards/roles.guard");
const user_schema_1 = require("../users/schemas/user.schema");
const host_messages_service_1 = require("./host-messages.service");
const host_messages_dto_1 = require("./dto/host-messages.dto");
const host_message_schema_1 = require("./schemas/host-message.schema");
const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
const HOSTS = [user_schema_1.UserRole.HOST, user_schema_1.UserRole.AGENT, user_schema_1.UserRole.LANDLORD, user_schema_1.UserRole.ADMIN];
let HostMessagesController = class HostMessagesController {
    service;
    constructor(service) {
        this.service = service;
    }
    list(req, kind) {
        return this.service.listTemplates(req.user, kind);
    }
    create(req, dto) {
        return this.service.createTemplate(req.user, dto);
    }
    update(req, id, dto) {
        return this.service.updateTemplate(req.user, id, dto);
    }
    remove(req, id) {
        return this.service.deleteTemplate(req.user, id);
    }
    quickReplies(req, guestId, propertyId) {
        return this.service.quickReplies(req.user, guestId, propertyId);
    }
    getGuide(req, propertyId) {
        return this.service.getGuideForHost(propertyId, req.user);
    }
    putGuide(req, propertyId, dto) {
        return this.service.updateGuide(propertyId, dto, req.user);
    }
    async addPhoto(req, propertyId, caption) {
        const data = await req.file();
        if (!data)
            throw new common_1.BadRequestException('No file uploaded');
        if (!PHOTO_TYPES.includes(String(data.mimetype).toLowerCase()))
            throw new common_1.BadRequestException('Upload a JPG, PNG, WEBP or HEIC photo');
        const buffer = await data.toBuffer();
        if (buffer.length > 10 * 1024 * 1024)
            throw new common_1.BadRequestException('The photo is too large (10 MB maximum)');
        return this.service.addGuidePhoto(propertyId, buffer, caption, req.user);
    }
    removePhoto(req, propertyId, publicId) {
        return this.service.removeGuidePhoto(propertyId, publicId, req.user);
    }
    guideForBooking(req, bookingId) {
        return this.service.getGuideForBooking(bookingId, req.user);
    }
    messages(req, bookingId) {
        return this.service.messagesForBooking(bookingId, req.user);
    }
};
exports.HostMessagesController = HostMessagesController;
__decorate([
    (0, common_1.Get)('templates'),
    (0, roles_guard_1.Roles)(...HOSTS),
    (0, swagger_1.ApiOperation)({ summary: 'My quick replies and scheduled messages (?kind=quick_reply|scheduled)' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('kind')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], HostMessagesController.prototype, "list", null);
__decorate([
    (0, common_1.Post)('templates'),
    (0, roles_guard_1.Roles)(...HOSTS),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, host_messages_dto_1.CreateTemplateDto]),
    __metadata("design:returntype", void 0)
], HostMessagesController.prototype, "create", null);
__decorate([
    (0, common_1.Patch)('templates/:id'),
    (0, roles_guard_1.Roles)(...HOSTS),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, host_messages_dto_1.UpdateTemplateDto]),
    __metadata("design:returntype", void 0)
], HostMessagesController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)('templates/:id'),
    (0, roles_guard_1.Roles)(...HOSTS),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], HostMessagesController.prototype, "remove", null);
__decorate([
    (0, common_1.Get)('quick-replies'),
    (0, roles_guard_1.Roles)(...HOSTS),
    (0, swagger_1.ApiOperation)({ summary: 'Quick replies filled in for a guest (?guestId=&propertyId=)' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('guestId')),
    __param(2, (0, common_1.Query)('propertyId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], HostMessagesController.prototype, "quickReplies", null);
__decorate([
    (0, common_1.Get)('check-in-guide/:propertyId'),
    (0, roles_guard_1.Roles)(...HOSTS),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('propertyId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], HostMessagesController.prototype, "getGuide", null);
__decorate([
    (0, common_1.Put)('check-in-guide/:propertyId'),
    (0, roles_guard_1.Roles)(...HOSTS),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('propertyId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, host_messages_dto_1.CheckInGuideDto]),
    __metadata("design:returntype", void 0)
], HostMessagesController.prototype, "putGuide", null);
__decorate([
    (0, common_1.Post)('check-in-guide/:propertyId/photos'),
    (0, roles_guard_1.Roles)(...HOSTS),
    (0, swagger_1.ApiConsumes)('multipart/form-data'),
    (0, swagger_1.ApiOperation)({ summary: 'Add a photo to the check-in guide (?caption=)' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('propertyId')),
    __param(2, (0, common_1.Query)('caption')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], HostMessagesController.prototype, "addPhoto", null);
__decorate([
    (0, common_1.Delete)('check-in-guide/:propertyId/photos/:publicId'),
    (0, roles_guard_1.Roles)(...HOSTS),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('propertyId')),
    __param(2, (0, common_1.Param)('publicId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], HostMessagesController.prototype, "removePhoto", null);
__decorate([
    (0, common_1.Get)('booking/:bookingId/check-in-guide'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('bookingId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], HostMessagesController.prototype, "guideForBooking", null);
__decorate([
    (0, common_1.Get)('booking/:bookingId/messages'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('bookingId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], HostMessagesController.prototype, "messages", null);
exports.HostMessagesController = HostMessagesController = __decorate([
    (0, swagger_1.ApiTags)('Host messages'),
    (0, swagger_1.ApiBearerAuth)('JWT-auth'),
    (0, common_1.Controller)('host-messages'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    __metadata("design:paramtypes", [host_messages_service_1.HostMessagesService])
], HostMessagesController);
//# sourceMappingURL=host-messages.controller.js.map