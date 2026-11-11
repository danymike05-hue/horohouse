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
exports.AdminReviewController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
const jwt_auth_guard_1 = require("../auth/guards/jwt.auth.guard");
const roles_guard_1 = require("../auth/guards/roles.guard");
const user_schema_1 = require("../users/schemas/user.schema");
const admin_review_service_1 = require("./admin-review.service");
class RefundDto {
    amount;
    note;
}
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], RefundDto.prototype, "amount", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(300),
    __metadata("design:type", String)
], RefundDto.prototype, "note", void 0);
class ResolveDto {
    resolution;
    amount;
    note;
}
__decorate([
    (0, class_validator_1.IsIn)(['refunded_manually', 'no_refund_needed']),
    __metadata("design:type", String)
], ResolveDto.prototype, "resolution", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], ResolveDto.prototype, "amount", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(300),
    __metadata("design:type", String)
], ResolveDto.prototype, "note", void 0);
let AdminReviewController = class AdminReviewController {
    review;
    constructor(review) {
        this.review = review;
    }
    summary(days) {
        return this.review.summary(Number(days) || 30);
    }
    payments(state, limit) {
        return this.review.list(state === 'resolved' ? 'resolved' : 'open', Number(limit) || 50);
    }
    refund(source, id, dto, req) {
        return this.review.refund(source, id, req.user, dto.amount, dto.note);
    }
    resolve(source, id, dto, req) {
        return this.review.resolve(source, id, req.user, dto.resolution, dto.note, dto.amount);
    }
};
exports.AdminReviewController = AdminReviewController;
__decorate([
    (0, common_1.Get)('summary'),
    (0, swagger_1.ApiOperation)({ summary: 'Real dashboard figures: commission, refunds, items waiting (Admin)' }),
    __param(0, (0, common_1.Query)('days')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AdminReviewController.prototype, "summary", null);
__decorate([
    (0, common_1.Get)('payments'),
    (0, swagger_1.ApiOperation)({ summary: 'Payments that need a human (state=open|resolved) (Admin)' }),
    __param(0, (0, common_1.Query)('state')),
    __param(1, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], AdminReviewController.prototype, "payments", null);
__decorate([
    (0, common_1.Post)('payments/:source/:id/refund'),
    (0, swagger_1.ApiOperation)({ summary: 'Refund the guest through CamerPay (once only) (Admin)' }),
    __param(0, (0, common_1.Param)('source')),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, RefundDto, Object]),
    __metadata("design:returntype", void 0)
], AdminReviewController.prototype, "refund", null);
__decorate([
    (0, common_1.Post)('payments/:source/:id/resolve'),
    (0, swagger_1.ApiOperation)({ summary: 'Close by hand: refunded outside the app, or no refund needed (Admin)' }),
    __param(0, (0, common_1.Param)('source')),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, ResolveDto, Object]),
    __metadata("design:returntype", void 0)
], AdminReviewController.prototype, "resolve", null);
exports.AdminReviewController = AdminReviewController = __decorate([
    (0, swagger_1.ApiTags)('Admin review'),
    (0, swagger_1.ApiBearerAuth)('JWT-auth'),
    (0, common_1.Controller)('admin/review'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_guard_1.Roles)(user_schema_1.UserRole.ADMIN),
    __metadata("design:paramtypes", [admin_review_service_1.AdminReviewService])
], AdminReviewController);
//# sourceMappingURL=admin-review.controller.js.map