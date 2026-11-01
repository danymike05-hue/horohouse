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
exports.InsightsRecommendationService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const post_schema_1 = require("../schemas/post.schema");
let InsightsRecommendationService = class InsightsRecommendationService {
    postModel;
    constructor(postModel) {
        this.postModel = postModel;
    }
    async getRelatedPosts(post, limit = 4) {
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 3600000);
        const tagIds = post.tags?.map((t) => t._id ?? t) ?? [];
        const neighborhoodCity = post.neighborhood?.city;
        const pipeline = [
            {
                $match: {
                    _id: { $ne: post._id },
                    status: post_schema_1.PostStatus.PUBLISHED,
                    $or: [
                        { category: post.category },
                        ...(tagIds.length ? [{ tags: { $in: tagIds } }] : []),
                        ...(neighborhoodCity ? [{ 'neighborhood.city': neighborhoodCity }] : []),
                        { postType: post.postType },
                    ],
                },
            },
            {
                $addFields: {
                    _score: {
                        $add: [
                            { $cond: [{ $eq: ['$category', post.category] }, 3, 0] },
                            {
                                $min: [
                                    { $size: { $ifNull: [{ $setIntersection: ['$tags', tagIds] }, []] } },
                                    3,
                                ],
                            },
                            {
                                $cond: [
                                    { $and: [{ $ne: [neighborhoodCity, null] }, { $eq: ['$neighborhood.city', neighborhoodCity] }] },
                                    2,
                                    0,
                                ],
                            },
                            { $cond: [{ $eq: ['$postType', post.postType] }, 1, 0] },
                            { $cond: [{ $gte: ['$publishedAt', thirtyDaysAgo] }, 1, 0] },
                        ],
                    },
                },
            },
            { $sort: { _score: -1, publishedAt: -1 } },
            { $limit: limit },
            {
                $lookup: {
                    from: 'authorprofiles',
                    localField: 'author',
                    foreignField: '_id',
                    as: 'author',
                },
            },
            { $unwind: { path: '$author', preserveNullAndEmpty: true } },
            {
                $lookup: {
                    from: 'categories',
                    localField: 'category',
                    foreignField: '_id',
                    as: 'category',
                },
            },
            { $unwind: { path: '$category', preserveNullAndEmpty: true } },
            {
                $project: {
                    title: 1,
                    slug: 1,
                    excerpt: 1,
                    coverImage: 1,
                    publishedAt: 1,
                    readingTimeMinutes: 1,
                    viewCount: 1,
                    postType: 1,
                    'author.displayName': 1,
                    'author.slug': 1,
                    'author.avatar': 1,
                    'category.name': 1,
                    'category.slug': 1,
                    'category.accentColor': 1,
                    _score: 1,
                },
            },
        ];
        return this.postModel.aggregate(pipeline);
    }
    async getTrendingScore(viewCount, publishedAt) {
        const ageHours = (Date.now() - publishedAt.getTime()) / 3600000;
        return viewCount / Math.pow(ageHours + 2, 1.8);
    }
};
exports.InsightsRecommendationService = InsightsRecommendationService;
exports.InsightsRecommendationService = InsightsRecommendationService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(post_schema_1.Post.name)),
    __metadata("design:paramtypes", [mongoose_2.Model])
], InsightsRecommendationService);
//# sourceMappingURL=insights-recommendation.service.js.map