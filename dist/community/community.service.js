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
exports.CommunityService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const community_post_schema_1 = require("./schemas/community-post.schema");
const user_schema_1 = require("../users/schemas/user.schema");
function buildAuthorSnapshot(user) {
    const name = user.name;
    const parts = name.trim().split(' ');
    const initials = parts.length >= 2
        ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
        : parts[0].slice(0, 2).toUpperCase();
    let role = 'Host';
    if (user.hostProfile?.isSuperhost)
        role = 'Superhost';
    if (user.role === 'admin')
        role = 'Admin';
    return {
        name,
        initials,
        role,
        avatar: user.profilePicture ?? '',
    };
}
function slugify(text) {
    return text
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .trim()
        .replace(/[\s-]+/g, '-');
}
let CommunityService = class CommunityService {
    postModel;
    userModel;
    constructor(postModel, userModel) {
        this.postModel = postModel;
        this.userModel = userModel;
    }
    async createPost(dto, reqUser) {
        const user = await this.userModel.findById(reqUser.id).exec();
        if (!user)
            throw new common_1.NotFoundException('User not found');
        const baseSlug = slugify(dto.title);
        const slug = await this.ensureUniqueSlug(baseSlug);
        let rootPostId = null;
        if (dto.replyToId) {
            rootPostId = dto.rootPostId
                ? new mongoose_2.Types.ObjectId(dto.rootPostId)
                : new mongoose_2.Types.ObjectId(dto.replyToId);
        }
        const post = new this.postModel({
            authorId: new mongoose_2.Types.ObjectId(reqUser.id),
            authorSnapshot: buildAuthorSnapshot(user),
            slug,
            category: dto.category,
            title: dto.title,
            excerpt: dto.excerpt,
            body: dto.body,
            tags: dto.tags ?? [],
            replyToId: dto.replyToId ? new mongoose_2.Types.ObjectId(dto.replyToId) : null,
            rootPostId,
        });
        const saved = await post.save();
        if (rootPostId) {
            await this.postModel.findByIdAndUpdate(rootPostId, {
                $inc: { replyCount: 1 },
            });
        }
        return saved;
    }
    async ensureUniqueSlug(base) {
        let slug = base;
        let suffix = 0;
        let collision = await this.postModel.exists({ slug });
        while (collision) {
            suffix++;
            slug = `${base}-${suffix}`;
            collision = await this.postModel.exists({ slug });
        }
        return slug;
    }
    async findAllPosts(filters, options) {
        const query = { isActive: true, replyToId: null };
        if (filters.category)
            query.category = filters.category;
        if (filters.pinned !== undefined)
            query.pinned = filters.pinned;
        if (filters.authorId)
            query.authorId = new mongoose_2.Types.ObjectId(filters.authorId);
        if (filters.tag)
            query.tags = filters.tag;
        if (filters.search) {
            query.$or = [
                { title: { $regex: filters.search, $options: 'i' } },
                { excerpt: { $regex: filters.search, $options: 'i' } },
                { tags: { $regex: filters.search, $options: 'i' } },
            ];
        }
        const skip = (options.page - 1) * options.limit;
        const sortOrder = options.sortOrder === 'asc' ? 1 : -1;
        const sortConfig = options.sortBy === 'default'
            ? { pinned: -1, createdAt: -1 }
            : { [options.sortBy]: sortOrder };
        const [total, posts] = await Promise.all([
            this.postModel.countDocuments(query),
            this.postModel
                .find(query)
                .sort(sortConfig)
                .skip(skip)
                .limit(options.limit)
                .lean({ virtuals: true })
                .exec(),
        ]);
        return {
            data: posts,
            meta: {
                total,
                page: options.page,
                limit: options.limit,
                totalPages: Math.ceil(total / options.limit),
            },
        };
    }
    async findPostBySlug(slug) {
        const post = await this.postModel.findOne({ slug, isActive: true }).exec();
        if (!post)
            throw new common_1.NotFoundException(`Post with slug "${slug}" not found`);
        return post;
    }
    async findPostById(id) {
        if (!mongoose_2.Types.ObjectId.isValid(id))
            throw new common_1.BadRequestException('Invalid ID');
        const post = await this.postModel.findById(id).exec();
        if (!post || !post.isActive)
            throw new common_1.NotFoundException('Post not found');
        return post;
    }
    async getPostReplies(postId, options) {
        if (!mongoose_2.Types.ObjectId.isValid(postId))
            throw new common_1.BadRequestException('Invalid ID');
        const postObjId = new mongoose_2.Types.ObjectId(postId);
        const allReplies = await this.postModel
            .find({
            isActive: true,
            $or: [
                { rootPostId: postObjId },
                { replyToId: postObjId, rootPostId: null },
            ],
        })
            .sort({ createdAt: 1 })
            .lean({ virtuals: true })
            .exec();
        return {
            data: allReplies,
            meta: { total: allReplies.length, page: 1, limit: allReplies.length, totalPages: 1 },
        };
    }
    async getPostsByAuthor(userId, options) {
        if (!mongoose_2.Types.ObjectId.isValid(userId))
            throw new common_1.BadRequestException('Invalid user ID');
        const skip = (options.page - 1) * options.limit;
        const query = { authorId: new mongoose_2.Types.ObjectId(userId), isActive: true, replyToId: null };
        const [total, posts] = await Promise.all([
            this.postModel.countDocuments(query),
            this.postModel
                .find(query)
                .sort({ createdAt: options.sortOrder === 'asc' ? 1 : -1 })
                .skip(skip)
                .limit(options.limit)
                .lean({ virtuals: true })
                .exec(),
        ]);
        return {
            data: posts,
            meta: { total, page: options.page, limit: options.limit, totalPages: Math.ceil(total / options.limit) },
        };
    }
    async getAuthorProfile(userId) {
        if (!mongoose_2.Types.ObjectId.isValid(userId))
            throw new common_1.BadRequestException('Invalid user ID');
        const user = await this.userModel
            .findById(userId)
            .select('name profilePicture role bio hostProfile createdAt')
            .exec();
        if (!user)
            throw new common_1.NotFoundException('Author not found');
        const objId = new mongoose_2.Types.ObjectId(userId);
        const [totalPosts, totalLikes] = await Promise.all([
            this.postModel.countDocuments({ authorId: objId, isActive: true, replyToId: null }),
            this.postModel.aggregate([
                { $match: { authorId: objId, isActive: true } },
                { $group: { _id: null, total: { $sum: '$likes' } } },
            ]).then(r => r[0]?.total ?? 0),
        ]);
        return {
            user: user.toJSON(),
            communityStats: { totalPosts, totalLikes },
        };
    }
    async updatePost(id, dto, reqUser) {
        const post = await this.findPostById(id);
        this.assertOwnerOrAdmin(post, reqUser);
        Object.assign(post, dto);
        return post.save();
    }
    async pinPost(id, pinned) {
        const post = await this.findPostById(id);
        post.pinned = pinned;
        return post.save();
    }
    async toggleLike(postId, reqUser) {
        if (!mongoose_2.Types.ObjectId.isValid(postId))
            throw new common_1.BadRequestException('Invalid ID');
        const userId = new mongoose_2.Types.ObjectId(reqUser.id);
        const post = await this.findPostById(postId);
        const alreadyLiked = post.likedBy.some(id => id.equals(userId));
        if (alreadyLiked) {
            post.likedBy = post.likedBy.filter(id => !id.equals(userId));
            post.likes = Math.max(0, post.likes - 1);
        }
        else {
            post.likedBy.push(userId);
            post.likes += 1;
        }
        await post.save();
        return { liked: !alreadyLiked, likes: post.likes };
    }
    async incrementViews(postId) {
        if (!mongoose_2.Types.ObjectId.isValid(postId))
            return;
        await this.postModel.findByIdAndUpdate(postId, { $inc: { views: 1 } });
    }
    async deletePost(id, reqUser) {
        const post = await this.findPostById(id);
        this.assertOwnerOrAdmin(post, reqUser);
        post.isActive = false;
        await post.save();
        if (post.replyToId) {
            await this.postModel.findByIdAndUpdate(post.replyToId, {
                $inc: { replyCount: -1 },
            });
        }
    }
    async hardDelete(id) {
        await this.postModel.findByIdAndDelete(id);
    }
    async getStats() {
        const totalUsers = await this.userModel.countDocuments();
        const totalPosts = await this.postModel.countDocuments({ isActive: true });
        const topContributorsAgg = await this.postModel.aggregate([
            { $match: { isActive: true } },
            { $group: { _id: '$authorId' } },
            { $count: 'count' }
        ]);
        const topContributors = topContributorsAgg[0]?.count || 0;
        return { totalUsers, totalPosts, topContributors };
    }
    async flagPost(postId, reqUser) {
        if (!mongoose_2.Types.ObjectId.isValid(postId))
            throw new common_1.BadRequestException('Invalid ID');
        const post = await this.findPostById(postId);
        const userId = new mongoose_2.Types.ObjectId(reqUser.id);
        if (!post.flaggedBy)
            post.flaggedBy = [];
        if (!post.flaggedBy.some(id => id.equals(userId))) {
            post.flaggedBy.push(userId);
            await post.save();
        }
        return { flagged: true };
    }
    async getFlaggedPosts(query) {
        const page = Number(query.page) || 1;
        const limit = Number(query.limit) || 20;
        const [posts, total] = await Promise.all([
            this.postModel
                .find({ 'flaggedBy.0': { $exists: true }, isActive: true })
                .sort({ updatedAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .exec(),
            this.postModel.countDocuments({ 'flaggedBy.0': { $exists: true }, isActive: true }),
        ]);
        return {
            data: posts,
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        };
    }
    async unflagPost(postId) {
        if (!mongoose_2.Types.ObjectId.isValid(postId))
            throw new common_1.BadRequestException('Invalid ID');
        const post = await this.findPostById(postId);
        post.flaggedBy = [];
        await post.save();
        return post;
    }
    assertOwnerOrAdmin(post, reqUser) {
        const isOwner = post.authorId.toString() === reqUser.id;
        const isAdmin = reqUser.role === 'admin';
        if (!isOwner && !isAdmin) {
            throw new common_1.ForbiddenException('You do not have permission to modify this post');
        }
    }
};
exports.CommunityService = CommunityService;
exports.CommunityService = CommunityService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(community_post_schema_1.CommunityPost.name)),
    __param(1, (0, mongoose_1.InjectModel)(user_schema_1.User.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Model])
], CommunityService);
//# sourceMappingURL=community.service.js.map