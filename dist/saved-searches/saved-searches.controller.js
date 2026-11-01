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
exports.SavedSearchesController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../auth/guards/jwt.auth.guard");
const saved_searches_service_1 = require("./saved-searches.service");
const saved_search_dto_1 = require("./dto/saved-search.dto");
let SavedSearchesController = class SavedSearchesController {
    savedSearchesService;
    constructor(savedSearchesService) {
        this.savedSearchesService = savedSearchesService;
    }
    async create(createDto, req) {
        return this.savedSearchesService.create(createDto, req.user._id.toString());
    }
    async findAll(req) {
        return this.savedSearchesService.findAllByUser(req.user._id.toString());
    }
    async getStatistics(req) {
        return this.savedSearchesService.getStatistics(req.user._id.toString());
    }
    async getMatchingProperties(id, page = '1', limit = '20', req) {
        return this.savedSearchesService.getMatchingProperties(id, req.user._id.toString(), parseInt(page, 10), parseInt(limit, 10));
    }
    async findOne(id, req) {
        return this.savedSearchesService.findOne(id, req.user._id.toString());
    }
    async update(id, updateDto, req) {
        return this.savedSearchesService.update(id, updateDto, req.user._id.toString());
    }
    async remove(id, req) {
        await this.savedSearchesService.remove(id, req.user._id.toString());
    }
};
exports.SavedSearchesController = SavedSearchesController;
__decorate([
    (0, common_1.Post)(),
    (0, common_1.HttpCode)(common_1.HttpStatus.CREATED),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [saved_search_dto_1.CreateSavedSearchDto, Object]),
    __metadata("design:returntype", Promise)
], SavedSearchesController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], SavedSearchesController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)('statistics'),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], SavedSearchesController.prototype, "getStatistics", null);
__decorate([
    (0, common_1.Get)(':id/properties'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Query)('page')),
    __param(2, (0, common_1.Query)('limit')),
    __param(3, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, Object]),
    __metadata("design:returntype", Promise)
], SavedSearchesController.prototype, "getMatchingProperties", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], SavedSearchesController.prototype, "findOne", null);
__decorate([
    (0, common_1.Patch)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, saved_search_dto_1.UpdateSavedSearchDto, Object]),
    __metadata("design:returntype", Promise)
], SavedSearchesController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, common_1.HttpCode)(common_1.HttpStatus.NO_CONTENT),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], SavedSearchesController.prototype, "remove", null);
exports.SavedSearchesController = SavedSearchesController = __decorate([
    (0, common_1.Controller)('saved-searches'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __metadata("design:paramtypes", [saved_searches_service_1.SavedSearchesService])
], SavedSearchesController);
//# sourceMappingURL=saved-searches.controller.js.map