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
exports.InsightsAdminService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const post_schema_1 = require("../schemas/post.schema");
const category_schema_1 = require("../schemas/category.schema");
const tag_schema_1 = require("../schemas/tag.schema");
const author_profile_schema_1 = require("../schemas/author-profile.schema");
const insights_seo_service_1 = require("./insights-seo.service");
const cloudinary_1 = require("../../utils/cloudinary");
let InsightsAdminService = class InsightsAdminService {
    postModel;
    categoryModel;
    tagModel;
    authorModel;
    seoService;
    constructor(postModel, categoryModel, tagModel, authorModel, seoService) {
        this.postModel = postModel;
        this.categoryModel = categoryModel;
        this.tagModel = tagModel;
        this.authorModel = authorModel;
        this.seoService = seoService;
    }
    async findAll(query) {
        const { status, page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc' } = query;
        const filter = {};
        if (status)
            filter.status = status;
        const [posts, total] = await Promise.all([
            this.postModel
                .find(filter)
                .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .populate('author', 'displayName slug avatar role')
                .populate('category', 'name slug')
                .lean(),
            this.postModel.countDocuments(filter),
        ]);
        return { data: posts, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
    }
    async getStats() {
        const [total, published, draft, review, scheduled, featured, trending] = await Promise.all([
            this.postModel.countDocuments(),
            this.postModel.countDocuments({ status: post_schema_1.PostStatus.PUBLISHED }),
            this.postModel.countDocuments({ status: post_schema_1.PostStatus.DRAFT }),
            this.postModel.countDocuments({ status: post_schema_1.PostStatus.REVIEW }),
            this.postModel.countDocuments({ status: post_schema_1.PostStatus.SCHEDULED }),
            this.postModel.countDocuments({ status: post_schema_1.PostStatus.PUBLISHED, isFeatured: true }),
            this.postModel.countDocuments({ status: post_schema_1.PostStatus.PUBLISHED, isTrending: true }),
        ]);
        const topPosts = await this.postModel
            .find({ status: post_schema_1.PostStatus.PUBLISHED })
            .sort({ viewCount: -1 })
            .limit(5)
            .select('title slug viewCount publishedAt')
            .lean();
        const recentActivity = await this.postModel
            .find()
            .sort({ updatedAt: -1 })
            .limit(10)
            .select('title slug status updatedAt')
            .populate('author', 'displayName')
            .lean();
        return { total, published, draft, review, scheduled, featured, trending, topPosts, recentActivity };
    }
    async findById(id) {
        const post = await this.postModel
            .findById(id)
            .populate('author', 'displayName slug avatar role')
            .populate('coAuthors', 'displayName slug')
            .populate('category', 'name slug')
            .populate('tags', 'name slug')
            .populate('relatedListings', 'title price images.url location')
            .lean();
        if (!post)
            throw new common_1.NotFoundException('Article not found');
        return post;
    }
    async create(dto, editorUserId) {
        const slug = await this.seoService.generateSlug(dto.title);
        const contentText = this.seoService.extractTextFromTiptap(dto.content);
        const readingTimeMinutes = this.seoService.calculateReadingTime(contentText);
        const seo = dto.seo ?? {};
        if (!seo.metaTitle)
            seo.metaTitle = dto.title.slice(0, 70);
        if (!seo.metaDescription)
            seo.metaDescription = dto.excerpt.slice(0, 160);
        if (!seo.ogTitle)
            seo.ogTitle = dto.title;
        if (!seo.ogDescription)
            seo.ogDescription = dto.excerpt;
        if (dto.coverImage?.url && !seo.ogImage)
            seo.ogImage = dto.coverImage.url;
        return this.postModel.create({
            ...dto,
            slug,
            contentText,
            readingTimeMinutes,
            seo,
            status: post_schema_1.PostStatus.DRAFT,
            submittedBy: new mongoose_2.Types.ObjectId(editorUserId),
            editorialLog: [{ action: 'created', performedBy: new mongoose_2.Types.ObjectId(editorUserId), at: new Date() }],
        });
    }
    async update(id, dto, editorUserId) {
        const post = await this.postModel.findById(id);
        if (!post)
            throw new common_1.NotFoundException('Article not found');
        if (dto.title && dto.title !== post.title) {
            post.slug = await this.seoService.generateSlug(dto.title, id);
        }
        if (dto.content) {
            post.contentText = this.seoService.extractTextFromTiptap(dto.content);
            post.readingTimeMinutes = this.seoService.calculateReadingTime(post.contentText);
        }
        Object.assign(post, dto);
        post.editorialLog.push({ action: 'updated', performedBy: new mongoose_2.Types.ObjectId(editorUserId), note: '', at: new Date() });
        return post.save();
    }
    async publish(id, editorUserId) {
        const post = await this.postModel.findById(id);
        if (!post)
            throw new common_1.NotFoundException();
        if (post.status === post_schema_1.PostStatus.PUBLISHED)
            throw new common_1.BadRequestException('Already published');
        post.status = post_schema_1.PostStatus.PUBLISHED;
        post.publishedAt = post.publishedAt || new Date();
        post.publishedBy = new mongoose_2.Types.ObjectId(editorUserId);
        post.editorialLog.push({ action: 'published', performedBy: new mongoose_2.Types.ObjectId(editorUserId), note: '', at: new Date() });
        const saved = await post.save();
        await this.categoryModel.updateOne({ _id: post.category }, { $inc: { postCount: 1 } });
        if (post.tags?.length) {
            await this.tagModel.updateMany({ _id: { $in: post.tags } }, { $inc: { usageCount: 1 } });
        }
        await this.authorModel.updateOne({ _id: post.author }, { $inc: { publishedPostCount: 1 } });
        const baseUrl = process.env.FRONTEND_URL || 'https://horohouse.com';
        await this.postModel.updateOne({ _id: id }, { 'seo.structuredData': this.seoService.buildStructuredData(saved, baseUrl) });
        return saved;
    }
    async schedule(id, dto, editorUserId) {
        const post = await this.postModel.findById(id);
        if (!post)
            throw new common_1.NotFoundException();
        const scheduledAt = new Date(dto.scheduledAt);
        if (scheduledAt <= new Date())
            throw new common_1.BadRequestException('Scheduled time must be in the future');
        post.status = post_schema_1.PostStatus.SCHEDULED;
        post.scheduledAt = scheduledAt;
        post.editorialLog.push({
            action: 'scheduled',
            performedBy: new mongoose_2.Types.ObjectId(editorUserId),
            note: `Scheduled for ${scheduledAt.toISOString()}`,
            at: new Date(),
        });
        return post.save();
    }
    async toggleFeatured(id, isFeatured, editorUserId) {
        const post = await this.postModel.findById(id);
        if (!post)
            throw new common_1.NotFoundException();
        post.isFeatured = isFeatured;
        post.editorialLog.push({
            action: isFeatured ? 'featured' : 'unfeatured',
            performedBy: new mongoose_2.Types.ObjectId(editorUserId),
            note: '',
            at: new Date(),
        });
        return post.save();
    }
    async reviewSubmission(id, dto, editorUserId) {
        const post = await this.postModel.findById(id);
        if (!post)
            throw new common_1.NotFoundException();
        if (post.status !== post_schema_1.PostStatus.REVIEW) {
            throw new common_1.BadRequestException('Post is not in review status');
        }
        if (dto.decision === 'approve') {
            post.status = post_schema_1.PostStatus.DRAFT;
            post.reviewedBy = new mongoose_2.Types.ObjectId(editorUserId);
            post.editorialLog.push({ action: 'review_approved', performedBy: new mongoose_2.Types.ObjectId(editorUserId), note: dto.note || '', at: new Date() });
        }
        else {
            post.status = post_schema_1.PostStatus.DRAFT;
            post.editorialLog.push({ action: 'review_rejected', performedBy: new mongoose_2.Types.ObjectId(editorUserId), note: dto.note || '', at: new Date() });
        }
        return post.save();
    }
    async delete(id, editorUserId) {
        const post = await this.postModel.findById(id);
        if (!post)
            throw new common_1.NotFoundException();
        if (post.status === post_schema_1.PostStatus.PUBLISHED) {
            await this.categoryModel.updateOne({ _id: post.category }, { $inc: { postCount: -1 } });
            if (post.tags?.length) {
                await this.tagModel.updateMany({ _id: { $in: post.tags } }, { $inc: { usageCount: -1 } });
            }
            await this.authorModel.updateOne({ _id: post.author }, { $inc: { publishedPostCount: -1 } });
        }
        if (post.coverImage?.publicId) {
            await (0, cloudinary_1.deleteFromCloudinary)(post.coverImage.publicId).catch(() => { });
        }
        await this.postModel.deleteOne({ _id: id });
        return { message: 'Article deleted' };
    }
    async backfillSlugs() {
        const posts = await this.postModel
            .find({ $or: [{ slug: { $exists: false } }, { slug: null }, { slug: '' }] })
            .select('_id title slug')
            .lean();
        let fixed = 0;
        let skipped = 0;
        for (const post of posts) {
            try {
                const slug = await this.seoService.generateSlug(post.title || `post-${post._id}`, String(post._id));
                await this.postModel.updateOne({ _id: post._id }, { $set: { slug } });
                fixed++;
            }
            catch {
                skipped++;
            }
        }
        return { fixed, skipped };
    }
    async uploadCover(file) {
        if (!file?.buffer?.length)
            throw new common_1.BadRequestException('No file uploaded or file is empty');
        const result = await (0, cloudinary_1.uploadBufferToCloudinary)(file.buffer, {
            folder: 'horohouse/insights/covers',
            resourceType: 'image',
            transformation: [
                { width: 1200, height: 630, crop: 'fill', gravity: 'auto' },
                { quality: 'auto', fetch_format: 'auto' },
            ],
        });
        return {
            url: result.secure_url,
            publicId: result.public_id,
            width: result.width,
            height: result.height,
        };
    }
    async getAnalytics(params) {
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 3600000);
        const [topByViews, recentPublished, viewsByCategory] = await Promise.all([
            this.postModel
                .find({ status: post_schema_1.PostStatus.PUBLISHED })
                .sort({ viewCount: -1 })
                .limit(10)
                .select('title slug viewCount likeCount shareCount publishedAt')
                .lean(),
            this.postModel
                .find({ status: post_schema_1.PostStatus.PUBLISHED, publishedAt: { $gte: thirtyDaysAgo } })
                .sort({ publishedAt: -1 })
                .select('title slug viewCount publishedAt')
                .lean(),
            this.postModel.aggregate([
                { $match: { status: post_schema_1.PostStatus.PUBLISHED } },
                { $group: { _id: '$category', totalViews: { $sum: '$viewCount' }, count: { $sum: 1 } } },
                { $lookup: { from: 'categories', localField: '_id', foreignField: '_id', as: 'category' } },
                { $unwind: '$category' },
                { $sort: { totalViews: -1 } },
            ]),
        ]);
        return { topByViews, recentPublished, viewsByCategory };
    }
    async createCategory(dto) {
        const slug = dto.name
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, '')
            .replace(/\s+/g, '-');
        const exists = await this.categoryModel.findOne({ slug });
        if (exists)
            throw new common_1.BadRequestException('Category with this name already exists');
        return this.categoryModel.create({ ...dto, slug });
    }
    async updateCategory(id, dto) {
        const cat = await this.categoryModel.findByIdAndUpdate(id, dto, { new: true });
        if (!cat)
            throw new common_1.NotFoundException();
        return cat;
    }
    async deleteCategory(id) {
        const postCount = await this.postModel.countDocuments({ category: new mongoose_2.Types.ObjectId(id) });
        if (postCount > 0)
            throw new common_1.BadRequestException(`Cannot delete category with ${postCount} articles. Reassign them first.`);
        await this.categoryModel.findByIdAndDelete(id);
        return { message: 'Category deleted' };
    }
    async getAllCategories() {
        return this.categoryModel.find().sort({ sortOrder: 1, name: 1 }).lean();
    }
    async getAllTags(params) {
        const { page = 1, limit = 50 } = params;
        const [tags, total] = await Promise.all([
            this.tagModel.find().sort({ usageCount: -1 }).skip((page - 1) * limit).limit(limit).lean(),
            this.tagModel.countDocuments(),
        ]);
        return { data: tags, meta: { total, page, limit } };
    }
    async createTag(name) {
        const slug = name.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '-');
        const exists = await this.tagModel.findOne({ slug });
        if (exists)
            throw new common_1.BadRequestException('Tag already exists');
        return this.tagModel.create({ name, slug });
    }
    async deleteTag(id) {
        await this.postModel.updateMany({ tags: new mongoose_2.Types.ObjectId(id) }, { $pull: { tags: new mongoose_2.Types.ObjectId(id) } });
        await this.tagModel.findByIdAndDelete(id);
        return { message: 'Tag deleted' };
    }
    async getAuthors(params) {
        const { page = 1, limit = 20, role } = params;
        const filter = {};
        if (role)
            filter.role = role;
        const [authors, total] = await Promise.all([
            this.authorModel
                .find(filter)
                .sort({ publishedPostCount: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .populate('user', 'email firstName lastName phone')
                .lean(),
            this.authorModel.countDocuments(filter),
        ]);
        return { data: authors, meta: { total, page, limit } };
    }
    async createAuthorProfile(dto) {
        const existing = await this.authorModel.findOne({ user: new mongoose_2.Types.ObjectId(dto.userId) });
        if (existing)
            throw new common_1.BadRequestException('Author profile already exists for this user');
        const slug = dto.displayName
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, '')
            .replace(/\s+/g, '-');
        return this.authorModel.create({
            ...dto,
            user: new mongoose_2.Types.ObjectId(dto.userId),
            slug,
        });
    }
    async updateAuthorProfile(id, dto) {
        const author = await this.authorModel.findByIdAndUpdate(id, dto, { new: true });
        if (!author)
            throw new common_1.NotFoundException();
        return author;
    }
};
exports.InsightsAdminService = InsightsAdminService;
exports.InsightsAdminService = InsightsAdminService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(post_schema_1.Post.name)),
    __param(1, (0, mongoose_1.InjectModel)(category_schema_1.Category.name)),
    __param(2, (0, mongoose_1.InjectModel)(tag_schema_1.Tag.name)),
    __param(3, (0, mongoose_1.InjectModel)(author_profile_schema_1.AuthorProfile.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model,
        insights_seo_service_1.InsightsSeoService])
], InsightsAdminService);
//# sourceMappingURL=insights-admin.service.js.map