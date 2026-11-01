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
exports.InsightsService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const schedule_1 = require("@nestjs/schedule");
const post_schema_1 = require("../schemas/post.schema");
const category_schema_1 = require("../schemas/category.schema");
const tag_schema_1 = require("../schemas/tag.schema");
const author_profile_schema_1 = require("../schemas/author-profile.schema");
const insights_seo_service_1 = require("./insights-seo.service");
const insights_recommendation_service_1 = require("./insights-recommendation.service");
let InsightsService = class InsightsService {
    postModel;
    categoryModel;
    tagModel;
    authorModel;
    seoService;
    recommendationService;
    constructor(postModel, categoryModel, tagModel, authorModel, seoService, recommendationService) {
        this.postModel = postModel;
        this.categoryModel = categoryModel;
        this.tagModel = tagModel;
        this.authorModel = authorModel;
        this.seoService = seoService;
        this.recommendationService = recommendationService;
    }
    async findPublished(query) {
        const { category, tag, postType, city, author, q, page = 1, limit = 12, sortBy = 'publishedAt', sortOrder = 'desc', } = query;
        const filter = { status: post_schema_1.PostStatus.PUBLISHED };
        if (category) {
            const cat = await this.categoryModel.findOne({ slug: category }).lean();
            if (cat)
                filter.category = cat._id;
        }
        if (tag) {
            const t = await this.tagModel.findOne({ slug: tag }).lean();
            if (t)
                filter.tags = t._id;
        }
        if (postType)
            filter.postType = postType;
        if (city)
            filter['neighborhood.city'] = { $regex: city, $options: 'i' };
        if (author) {
            const a = await this.authorModel.findOne({ slug: author }).lean();
            if (a)
                filter.author = a._id;
        }
        if (q)
            filter.$text = { $search: q };
        const [posts, total] = await Promise.all([
            this.postModel
                .find(filter)
                .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .populate('author', 'displayName slug avatar title')
                .populate('category', 'name slug accentColor icon')
                .populate('tags', 'name slug')
                .lean(),
            this.postModel.countDocuments(filter),
        ]);
        return {
            data: posts,
            meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
        };
    }
    async findFeatured(limit = 6) {
        return this.postModel
            .find({ status: post_schema_1.PostStatus.PUBLISHED, isFeatured: true })
            .sort({ publishedAt: -1 })
            .limit(limit)
            .populate('author', 'displayName slug avatar')
            .populate('category', 'name slug accentColor icon')
            .lean();
    }
    async findTrending(limit = 5) {
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600000);
        return this.postModel
            .find({ status: post_schema_1.PostStatus.PUBLISHED, publishedAt: { $gte: sevenDaysAgo } })
            .sort({ viewCount: -1, publishedAt: -1 })
            .limit(limit)
            .populate('author', 'displayName slug avatar')
            .populate('category', 'name slug accentColor icon')
            .lean();
    }
    async findBySlug(slug) {
        const post = await this.postModel
            .findOne({ slug, status: post_schema_1.PostStatus.PUBLISHED })
            .populate('author', 'displayName slug avatar title bio social specialties')
            .populate('coAuthors', 'displayName slug avatar')
            .populate('category', 'name slug accentColor icon')
            .populate('tags', 'name slug')
            .populate('relatedListings', 'title price images location isVerified')
            .lean();
        if (!post)
            throw new common_1.NotFoundException(`Article "${slug}" not found`);
        this.postModel.updateOne({ _id: post._id }, { $inc: { viewCount: 1 } }).exec();
        if ((post.viewCount || 0) > 100) {
            this.postModel.updateOne({ _id: post._id }, { isTrending: true }).exec();
        }
        return post;
    }
    async getRelated(slug, limit = 4) {
        const post = await this.postModel.findOne({ slug }).lean();
        if (!post)
            throw new common_1.NotFoundException();
        return this.recommendationService.getRelatedPosts(post, limit);
    }
    async findByCategory(categorySlug, query) {
        const category = await this.categoryModel.findOne({ slug: categorySlug, isActive: true }).lean();
        if (!category)
            throw new common_1.NotFoundException(`Category "${categorySlug}" not found`);
        return this.findPublished({ ...query, category: categorySlug });
    }
    async findByTag(tagSlug, query) {
        const tag = await this.tagModel.findOne({ slug: tagSlug, isActive: true }).lean();
        if (!tag)
            throw new common_1.NotFoundException(`Tag "${tagSlug}" not found`);
        return this.findPublished({ ...query, tag: tagSlug });
    }
    async getAuthorWithPosts(authorSlug, query) {
        const author = await this.authorModel
            .findOne({ slug: authorSlug, isActive: true })
            .populate('user', 'firstName lastName')
            .lean();
        if (!author)
            throw new common_1.NotFoundException(`Author "${authorSlug}" not found`);
        const posts = await this.findPublished({ ...query, author: authorSlug });
        return { author, ...posts };
    }
    async getNeighborhoodGuide(neighborhoodSlug) {
        const city = neighborhoodSlug.replace(/-/g, ' ');
        const posts = await this.postModel
            .find({
            status: post_schema_1.PostStatus.PUBLISHED,
            postType: post_schema_1.PostType.NEIGHBORHOOD_GUIDE,
            'neighborhood.city': { $regex: city, $options: 'i' },
        })
            .sort({ publishedAt: -1 })
            .populate('author', 'displayName slug avatar')
            .populate('relatedListings', 'title price images location')
            .lean();
        return { city, posts };
    }
    async getMarketInsights(query) {
        return this.findPublished({ ...query, postType: post_schema_1.PostType.MARKET_REPORT });
    }
    async searchInsights(q, params) {
        if (!q || q.trim().length < 2)
            throw new common_1.BadRequestException('Search query too short');
        return this.findPublished({ ...params, q });
    }
    async getCategories() {
        return this.categoryModel
            .find({ isActive: true })
            .sort({ sortOrder: 1, name: 1 })
            .lean();
    }
    async getPopularTags(limit = 30) {
        return this.tagModel
            .find({ isActive: true })
            .sort({ usageCount: -1 })
            .limit(limit)
            .lean();
    }
    async submitDraft(userId, createPostDto) {
        const authorProfile = await this.authorModel.findOne({ user: new mongoose_2.Types.ObjectId(userId) });
        if (!authorProfile) {
            throw new common_1.ForbiddenException('You need an author profile to submit articles. Apply in your account settings.');
        }
        const slug = await this.seoService.generateSlug(createPostDto.title);
        const contentText = this.seoService.extractTextFromTiptap(createPostDto.content);
        const readingTimeMinutes = this.seoService.calculateReadingTime(contentText);
        const status = authorProfile.role === author_profile_schema_1.AuthorRole.CONTRIBUTOR
            ? post_schema_1.PostStatus.REVIEW
            : post_schema_1.PostStatus.DRAFT;
        const post = await this.postModel.create({
            ...createPostDto,
            slug,
            contentText,
            readingTimeMinutes,
            status,
            submittedBy: new mongoose_2.Types.ObjectId(userId),
            author: authorProfile._id,
            editorialLog: [{ action: 'submitted', performedBy: new mongoose_2.Types.ObjectId(userId), at: new Date() }],
        });
        return post;
    }
    async getMySubmissions(userId, query) {
        const author = await this.authorModel.findOne({ user: new mongoose_2.Types.ObjectId(userId) }).lean();
        if (!author)
            return { data: [], meta: { total: 0, page: 1, limit: 12, totalPages: 0 } };
        const { page = 1, limit = 12 } = query;
        const filter = { author: author._id };
        const [posts, total] = await Promise.all([
            this.postModel
                .find(filter)
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .populate('category', 'name slug')
                .lean(),
            this.postModel.countDocuments(filter),
        ]);
        return { data: posts, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
    }
    async publishScheduledPosts() {
        const now = new Date();
        const toPublish = await this.postModel.find({
            status: post_schema_1.PostStatus.SCHEDULED,
            scheduledAt: { $lte: now },
        });
        for (const post of toPublish) {
            post.status = post_schema_1.PostStatus.PUBLISHED;
            post.publishedAt = now;
            post.editorialLog.push({ action: 'auto_published_scheduled', performedBy: null, note: 'Scheduled publish', at: now });
            await post.save();
            await this.categoryModel.updateOne({ _id: post.category }, { $inc: { postCount: 1 } });
            if (post.tags?.length) {
                await this.tagModel.updateMany({ _id: { $in: post.tags } }, { $inc: { usageCount: 1 } });
            }
        }
    }
};
exports.InsightsService = InsightsService;
__decorate([
    (0, schedule_1.Cron)(schedule_1.CronExpression.EVERY_MINUTE),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], InsightsService.prototype, "publishScheduledPosts", null);
exports.InsightsService = InsightsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(post_schema_1.Post.name)),
    __param(1, (0, mongoose_1.InjectModel)(category_schema_1.Category.name)),
    __param(2, (0, mongoose_1.InjectModel)(tag_schema_1.Tag.name)),
    __param(3, (0, mongoose_1.InjectModel)(author_profile_schema_1.AuthorProfile.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model,
        insights_seo_service_1.InsightsSeoService,
        insights_recommendation_service_1.InsightsRecommendationService])
], InsightsService);
//# sourceMappingURL=insights.service.js.map