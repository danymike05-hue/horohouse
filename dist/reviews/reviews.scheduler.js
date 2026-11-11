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
var ReviewsScheduler_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReviewsScheduler = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const reviews_service_1 = require("./reviews.service");
let ReviewsScheduler = ReviewsScheduler_1 = class ReviewsScheduler {
    reviewsService;
    logger = new common_1.Logger(ReviewsScheduler_1.name);
    constructor(reviewsService) {
        this.reviewsService = reviewsService;
    }
    async publishExpired() {
        try {
            await this.reviewsService.publishExpiredReviews();
        }
        catch (err) {
            this.logger.error(`publishExpiredReviews failed: ${err?.message}`);
        }
    }
};
exports.ReviewsScheduler = ReviewsScheduler;
__decorate([
    (0, schedule_1.Cron)(schedule_1.CronExpression.EVERY_HOUR),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ReviewsScheduler.prototype, "publishExpired", null);
exports.ReviewsScheduler = ReviewsScheduler = ReviewsScheduler_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [reviews_service_1.ReviewsService])
], ReviewsScheduler);
//# sourceMappingURL=reviews.scheduler.js.map