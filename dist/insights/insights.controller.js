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
exports.InsightsController = void 0;
const common_1 = require("@nestjs/common");
const throttler_1 = require("@nestjs/throttler");
const jwt_auth_guard_1 = require("../auth/guards/jwt.auth.guard");
const insights_service_1 = require("./(JWT-guarded)/insights.service");
const insights_dto_1 = require("./dto/insights.dto");
let InsightsController = class InsightsController {
    insightsService;
    constructor(insightsService) {
        this.insightsService = insightsService;
    }
    findAll(query) {
        return this.insightsService.findPublished(query);
    }
    featured(limit) {
        return this.insightsService.findFeatured(limit);
    }
    trending(limit) {
        return this.insightsService.findTrending(limit);
    }
    search(q, query) {
        return this.insightsService.searchInsights(q, query);
    }
    getCategories() {
        return this.insightsService.getCategories();
    }
    popularTags(limit) {
        return this.insightsService.getPopularTags(limit);
    }
    marketInsights(query) {
        return this.insightsService.getMarketInsights(query);
    }
    byCategory(slug, query) {
        return this.insightsService.findByCategory(slug, query);
    }
    byTag(slug, query) {
        return this.insightsService.findByTag(slug, query);
    }
    authorPage(slug, query) {
        return this.insightsService.getAuthorWithPosts(slug, query);
    }
    neighborhoodGuide(slug) {
        return this.insightsService.getNeighborhoodGuide(slug);
    }
    findOne(slug) {
        return this.insightsService.findBySlug(slug);
    }
    related(slug, limit) {
        return this.insightsService.getRelated(slug, limit);
    }
    submitDraft(dto, req) {
        return this.insightsService.submitDraft(req.user.id, dto);
    }
    mySubmissions(query, req) {
        return this.insightsService.getMySubmissions(req.user.id, query);
    }
};
exports.InsightsController = InsightsController;
__decorate([
    (0, common_1.Get)(),
    (0, throttler_1.SkipThrottle)(),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [insights_dto_1.QueryPostsDto]),
    __metadata("design:returntype", void 0)
], InsightsController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)('featured'),
    (0, throttler_1.SkipThrottle)(),
    __param(0, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], InsightsController.prototype, "featured", null);
__decorate([
    (0, common_1.Get)('trending'),
    (0, throttler_1.SkipThrottle)(),
    __param(0, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], InsightsController.prototype, "trending", null);
__decorate([
    (0, common_1.Get)('search'),
    (0, throttler_1.Throttle)({ default: { limit: 30, ttl: 60000 } }),
    __param(0, (0, common_1.Query)('q')),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, insights_dto_1.QueryPostsDto]),
    __metadata("design:returntype", void 0)
], InsightsController.prototype, "search", null);
__decorate([
    (0, common_1.Get)('categories'),
    (0, throttler_1.SkipThrottle)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], InsightsController.prototype, "getCategories", null);
__decorate([
    (0, common_1.Get)('tags/popular'),
    (0, throttler_1.SkipThrottle)(),
    __param(0, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], InsightsController.prototype, "popularTags", null);
__decorate([
    (0, common_1.Get)('market'),
    (0, throttler_1.SkipThrottle)(),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [insights_dto_1.QueryPostsDto]),
    __metadata("design:returntype", void 0)
], InsightsController.prototype, "marketInsights", null);
__decorate([
    (0, common_1.Get)('category/:slug'),
    (0, throttler_1.SkipThrottle)(),
    __param(0, (0, common_1.Param)('slug')),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, insights_dto_1.QueryPostsDto]),
    __metadata("design:returntype", void 0)
], InsightsController.prototype, "byCategory", null);
__decorate([
    (0, common_1.Get)('tag/:slug'),
    (0, throttler_1.SkipThrottle)(),
    __param(0, (0, common_1.Param)('slug')),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, insights_dto_1.QueryPostsDto]),
    __metadata("design:returntype", void 0)
], InsightsController.prototype, "byTag", null);
__decorate([
    (0, common_1.Get)('author/:slug'),
    (0, throttler_1.SkipThrottle)(),
    __param(0, (0, common_1.Param)('slug')),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, insights_dto_1.QueryPostsDto]),
    __metadata("design:returntype", void 0)
], InsightsController.prototype, "authorPage", null);
__decorate([
    (0, common_1.Get)('neighborhood/:slug'),
    (0, throttler_1.SkipThrottle)(),
    __param(0, (0, common_1.Param)('slug')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], InsightsController.prototype, "neighborhoodGuide", null);
__decorate([
    (0, common_1.Get)(':slug'),
    (0, throttler_1.SkipThrottle)(),
    __param(0, (0, common_1.Param)('slug')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], InsightsController.prototype, "findOne", null);
__decorate([
    (0, common_1.Get)(':slug/related'),
    (0, throttler_1.SkipThrottle)(),
    __param(0, (0, common_1.Param)('slug')),
    __param(1, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Number]),
    __metadata("design:returntype", void 0)
], InsightsController.prototype, "related", null);
__decorate([
    (0, common_1.Post)('contribute'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], InsightsController.prototype, "submitDraft", null);
__decorate([
    (0, common_1.Get)('my-submissions'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [insights_dto_1.QueryPostsDto, Object]),
    __metadata("design:returntype", void 0)
], InsightsController.prototype, "mySubmissions", null);
exports.InsightsController = InsightsController = __decorate([
    (0, common_1.Controller)('insights'),
    __metadata("design:paramtypes", [insights_service_1.InsightsService])
], InsightsController);
//# sourceMappingURL=insights.controller.js.map