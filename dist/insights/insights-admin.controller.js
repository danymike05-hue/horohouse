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
exports.InsightsAdminController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../auth/guards/jwt.auth.guard");
const roles_guard_1 = require("../auth/guards/roles.guard");
const roles_guard_2 = require("../auth/guards/roles.guard");
const insights_admin_service_1 = require("./(JWT-guarded)/insights-admin.service");
const user_schema_1 = require("../users/schemas/user.schema");
const insights_dto_1 = require("./dto/insights.dto");
let InsightsAdminController = class InsightsAdminController {
    adminService;
    constructor(adminService) {
        this.adminService = adminService;
    }
    findAll(query) {
        return this.adminService.findAll(query);
    }
    getStats() {
        return this.adminService.getStats();
    }
    getAnalytics(params) {
        return this.adminService.getAnalytics(params);
    }
    create(dto, req) {
        return this.adminService.create(dto, req.user.id);
    }
    async uploadCover(req) {
        const parts = req.parts();
        for await (const part of parts) {
            if (part.type === 'file') {
                const chunks = [];
                for await (const chunk of part.file) {
                    chunks.push(Buffer.from(chunk));
                }
                const buffer = Buffer.concat(chunks);
                return this.adminService.uploadCover({ buffer });
            }
        }
        throw new common_1.BadRequestException('No file uploaded');
    }
    findOne(id) {
        return this.adminService.findById(id);
    }
    update(id, dto, req) {
        return this.adminService.update(id, dto, req.user.id);
    }
    publish(id, req) {
        return this.adminService.publish(id, req.user.id);
    }
    schedule(id, dto, req) {
        return this.adminService.schedule(id, dto, req.user.id);
    }
    feature(id, isFeatured, req) {
        return this.adminService.toggleFeatured(id, isFeatured, req.user.id);
    }
    review(id, dto, req) {
        return this.adminService.reviewSubmission(id, dto, req.user.id);
    }
    remove(id, req) {
        return this.adminService.delete(id, req.user.id);
    }
    backfillSlugs() {
        return this.adminService.backfillSlugs();
    }
    getCategories() {
        return this.adminService.getAllCategories();
    }
    createCategory(dto) {
        return this.adminService.createCategory(dto);
    }
    updateCategory(id, dto) {
        return this.adminService.updateCategory(id, dto);
    }
    deleteCategory(id) {
        return this.adminService.deleteCategory(id);
    }
    getAllTags(params) {
        return this.adminService.getAllTags(params);
    }
    createTag(name) {
        return this.adminService.createTag(name);
    }
    deleteTag(id) {
        return this.adminService.deleteTag(id);
    }
    getAuthors(params) {
        return this.adminService.getAuthors(params);
    }
    createAuthor(dto) {
        return this.adminService.createAuthorProfile(dto);
    }
    updateAuthor(id, dto) {
        return this.adminService.updateAuthorProfile(id, dto);
    }
};
exports.InsightsAdminController = InsightsAdminController;
__decorate([
    (0, common_1.Get)('all'),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [insights_dto_1.QueryPostsDto]),
    __metadata("design:returntype", void 0)
], InsightsAdminController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)('stats'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], InsightsAdminController.prototype, "getStats", null);
__decorate([
    (0, common_1.Get)('analytics'),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], InsightsAdminController.prototype, "getAnalytics", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [insights_dto_1.CreatePostDto, Object]),
    __metadata("design:returntype", void 0)
], InsightsAdminController.prototype, "create", null);
__decorate([
    (0, common_1.Post)('upload-cover'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], InsightsAdminController.prototype, "uploadCover", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], InsightsAdminController.prototype, "findOne", null);
__decorate([
    (0, common_1.Patch)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, insights_dto_1.UpdatePostDto, Object]),
    __metadata("design:returntype", void 0)
], InsightsAdminController.prototype, "update", null);
__decorate([
    (0, common_1.Patch)(':id/publish'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], InsightsAdminController.prototype, "publish", null);
__decorate([
    (0, common_1.Patch)(':id/schedule'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, insights_dto_1.SchedulePostDto, Object]),
    __metadata("design:returntype", void 0)
], InsightsAdminController.prototype, "schedule", null);
__decorate([
    (0, common_1.Patch)(':id/feature'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)('isFeatured')),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Boolean, Object]),
    __metadata("design:returntype", void 0)
], InsightsAdminController.prototype, "feature", null);
__decorate([
    (0, common_1.Patch)(':id/review'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, insights_dto_1.ReviewPostDto, Object]),
    __metadata("design:returntype", void 0)
], InsightsAdminController.prototype, "review", null);
__decorate([
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], InsightsAdminController.prototype, "remove", null);
__decorate([
    (0, common_1.Post)('backfill-slugs'),
    (0, roles_guard_2.Roles)(user_schema_1.UserRole.ADMIN),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], InsightsAdminController.prototype, "backfillSlugs", null);
__decorate([
    (0, common_1.Get)('categories'),
    (0, roles_guard_2.Roles)(user_schema_1.UserRole.ADMIN, user_schema_1.UserRole.AGENT),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], InsightsAdminController.prototype, "getCategories", null);
__decorate([
    (0, common_1.Post)('categories'),
    (0, roles_guard_2.Roles)(user_schema_1.UserRole.ADMIN),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [insights_dto_1.CreateCategoryDto]),
    __metadata("design:returntype", void 0)
], InsightsAdminController.prototype, "createCategory", null);
__decorate([
    (0, common_1.Patch)('categories/:id'),
    (0, roles_guard_2.Roles)(user_schema_1.UserRole.ADMIN),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], InsightsAdminController.prototype, "updateCategory", null);
__decorate([
    (0, common_1.Delete)('categories/:id'),
    (0, roles_guard_2.Roles)(user_schema_1.UserRole.ADMIN),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], InsightsAdminController.prototype, "deleteCategory", null);
__decorate([
    (0, common_1.Get)('tags'),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], InsightsAdminController.prototype, "getAllTags", null);
__decorate([
    (0, common_1.Post)('tags'),
    __param(0, (0, common_1.Body)('name')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], InsightsAdminController.prototype, "createTag", null);
__decorate([
    (0, common_1.Delete)('tags/:id'),
    (0, roles_guard_2.Roles)(user_schema_1.UserRole.ADMIN),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], InsightsAdminController.prototype, "deleteTag", null);
__decorate([
    (0, common_1.Get)('authors'),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], InsightsAdminController.prototype, "getAuthors", null);
__decorate([
    (0, common_1.Post)('authors'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [insights_dto_1.CreateAuthorProfileDto]),
    __metadata("design:returntype", void 0)
], InsightsAdminController.prototype, "createAuthor", null);
__decorate([
    (0, common_1.Patch)('authors/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], InsightsAdminController.prototype, "updateAuthor", null);
exports.InsightsAdminController = InsightsAdminController = __decorate([
    (0, common_1.Controller)('insights/admin'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_guard_2.Roles)(user_schema_1.UserRole.ADMIN),
    __metadata("design:paramtypes", [insights_admin_service_1.InsightsAdminService])
], InsightsAdminController);
//# sourceMappingURL=insights-admin.controller.js.map