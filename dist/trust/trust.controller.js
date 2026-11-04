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
exports.TrustController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const jwt_auth_guard_1 = require("../auth/guards/jwt.auth.guard");
const roles_guard_1 = require("../auth/guards/roles.guard");
const user_schema_1 = require("../users/schemas/user.schema");
const trust_service_1 = require("./trust.service");
class ReviewIdentityDto {
    approve;
    reason;
}
__decorate([
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], ReviewIdentityDto.prototype, "approve", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(300),
    __metadata("design:type", String)
], ReviewIdentityDto.prototype, "reason", void 0);
let TrustController = class TrustController {
    trust;
    constructor(trust) {
        this.trust = trust;
    }
    myIdentity(req) {
        return this.trust.getMyIdentity(String(req.user._id ?? req.user.id));
    }
    async submitIdentity(req, documentType) {
        const type = trust_service_1.ID_DOCUMENT_TYPES.includes(String(documentType)) ? documentType : 'national_id';
        const data = await req.file();
        if (!data)
            throw new common_1.BadRequestException('No file uploaded');
        if (!trust_service_1.ID_MIME_TYPES.includes(String(data.mimetype).toLowerCase())) {
            throw new common_1.BadRequestException('Upload a photo of your ID (JPG, PNG, WEBP or HEIC)');
        }
        const buffer = await data.toBuffer();
        if (buffer.length > trust_service_1.ID_MAX_BYTES)
            throw new common_1.BadRequestException('The photo is too large (10 MB maximum)');
        return this.trust.submitIdentity(String(req.user._id ?? req.user.id), buffer, type);
    }
    pending(page, limit) {
        return this.trust.listPending(Number(page) || 1, Number(limit) || 20);
    }
    document(userId) {
        return this.trust.documentUrl(userId);
    }
    review(userId, body, req) {
        return this.trust.review(userId, body.approve, body.reason, req.user);
    }
    guest(guestId, req) {
        return this.trust.guestProfile(guestId, req.user);
    }
};
exports.TrustController = TrustController;
__decorate([
    (0, common_1.Get)('me/identity'),
    (0, swagger_1.ApiOperation)({ summary: 'My identity verification status' }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], TrustController.prototype, "myIdentity", null);
__decorate([
    (0, common_1.Post)('me/identity'),
    (0, swagger_1.ApiConsumes)('multipart/form-data'),
    (0, swagger_1.ApiOperation)({ summary: 'Upload an ID photo (?documentType=national_id|passport|residence_permit|driving_licence)' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('documentType')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], TrustController.prototype, "submitIdentity", null);
__decorate([
    (0, common_1.Get)('identity/pending'),
    (0, roles_guard_1.Roles)(user_schema_1.UserRole.ADMIN),
    (0, swagger_1.ApiOperation)({ summary: 'IDs waiting for review, oldest first (Admin)' }),
    __param(0, (0, common_1.Query)('page')),
    __param(1, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], TrustController.prototype, "pending", null);
__decorate([
    (0, common_1.Get)('identity/:userId/document'),
    (0, roles_guard_1.Roles)(user_schema_1.UserRole.ADMIN),
    (0, swagger_1.ApiOperation)({ summary: 'Signed 10-minute link to a user ID photo (Admin)' }),
    __param(0, (0, common_1.Param)('userId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], TrustController.prototype, "document", null);
__decorate([
    (0, common_1.Patch)('identity/:userId'),
    (0, roles_guard_1.Roles)(user_schema_1.UserRole.ADMIN),
    (0, swagger_1.ApiOperation)({ summary: 'Approve or reject an ID (Admin)' }),
    __param(0, (0, common_1.Param)('userId')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, ReviewIdentityDto, Object]),
    __metadata("design:returntype", void 0)
], TrustController.prototype, "review", null);
__decorate([
    (0, common_1.Get)('guests/:guestId'),
    (0, roles_guard_1.Roles)(user_schema_1.UserRole.HOST, user_schema_1.UserRole.AGENT, user_schema_1.UserRole.LANDLORD, user_schema_1.UserRole.ADMIN),
    (0, swagger_1.ApiOperation)({ summary: 'Guest profile for a host: verifications, stays, reviews from hosts' }),
    __param(0, (0, common_1.Param)('guestId')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], TrustController.prototype, "guest", null);
exports.TrustController = TrustController = __decorate([
    (0, swagger_1.ApiTags)('Trust'),
    (0, swagger_1.ApiBearerAuth)('JWT-auth'),
    (0, common_1.Controller)('trust'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    __metadata("design:paramtypes", [trust_service_1.TrustService])
], TrustController);
//# sourceMappingURL=trust.controller.js.map