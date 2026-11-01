import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import {
  CommunityPost,
  CommunityPostDocument,
  PostCategory,
} from './schemas/community-post.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildAuthorSnapshot(user: UserDocument) {
  const name     = user.name;
  const parts    = name.trim().split(' ');
  const initials =
    parts.length >= 2
      ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
      : parts[0].slice(0, 2).toUpperCase();

  // Derive community role from user role / host status
  let role = 'Host';
  if ((user as any).hostProfile?.isSuperhost) role = 'Superhost';
  if (user.role === 'admin') role = 'Admin';

  return {
    name,
    initials,
    role,
    avatar: user.profilePicture ?? '',
  };
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/[\s-]+/g, '-');
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class CommunityService {
  constructor(
    @InjectModel(CommunityPost.name)
    private readonly postModel: Model<CommunityPostDocument>,

    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
  ) {}

  // ══════════════════════════════════════════════════════════════════════════
  // CREATE
  // ══════════════════════════════════════════════════════════════════════════

  async createPost(dto: CreatePostDto, reqUser: any): Promise<CommunityPostDocument> {
    const user = await this.userModel.findById(reqUser.id).exec();
    if (!user) throw new NotFoundException('User not found');

    const baseSlug = slugify(dto.title);
    const slug     = await this.ensureUniqueSlug(baseSlug);

    // Determine rootPostId:
    // If replying to a post directly → rootPostId = replyToId (which is the top-level post)
    // If replying to a reply → caller supplies rootPostId explicitly
    let rootPostId: Types.ObjectId | null = null;
    if (dto.replyToId) {
      rootPostId = dto.rootPostId
        ? new Types.ObjectId(dto.rootPostId)
        : new Types.ObjectId(dto.replyToId);
    }

    const post = new this.postModel({
      authorId:       new Types.ObjectId(reqUser.id),
      authorSnapshot: buildAuthorSnapshot(user),
      slug,
      category:  dto.category,
      title:     dto.title,
      excerpt:   dto.excerpt,
      body:      dto.body,
      tags:      dto.tags ?? [],
      replyToId: dto.replyToId ? new Types.ObjectId(dto.replyToId) : null,
      rootPostId,
    });

    const saved = await post.save();

    // Increment the root post's total replyCount
    if (rootPostId) {
      await this.postModel.findByIdAndUpdate(rootPostId, {
        $inc: { replyCount: 1 },
      });
    }

    return saved;
  }

  private async ensureUniqueSlug(base: string): Promise<string> {
    let slug      = base;
    let suffix    = 0;
    let collision = await this.postModel.exists({ slug });
    while (collision) {
      suffix++;
      slug      = `${base}-${suffix}`;
      collision = await this.postModel.exists({ slug });
    }
    return slug;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // READ
  // ══════════════════════════════════════════════════════════════════════════

  async findAllPosts(
    filters: {
      category?: PostCategory;
      tag?:      string;
      pinned?:   boolean;
      authorId?: string;
      search?:   string;
    },
    options: {
      page:      number;
      limit:     number;
      sortBy:    string;
      sortOrder: 'asc' | 'desc';
    },
  ) {
    const query: Record<string, any> = { isActive: true, replyToId: null };

    if (filters.category) query.category = filters.category;
    if (filters.pinned !== undefined) query.pinned = filters.pinned;
    if (filters.authorId) query.authorId = new Types.ObjectId(filters.authorId);
    if (filters.tag) query.tags = filters.tag;
    if (filters.search) {
      query.$or = [
        { title:   { $regex: filters.search, $options: 'i' } },
        { excerpt: { $regex: filters.search, $options: 'i' } },
        { tags:    { $regex: filters.search, $options: 'i' } },
      ];
    }

    const skip       = (options.page - 1) * options.limit;
    const sortOrder  = options.sortOrder === 'asc' ? 1 : -1;
    const sortConfig: Record<string, 1 | -1> =
      options.sortBy === 'default'
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
        page:       options.page,
        limit:      options.limit,
        totalPages: Math.ceil(total / options.limit),
      },
    };
  }

  async findPostBySlug(slug: string): Promise<CommunityPostDocument> {
    const post = await this.postModel.findOne({ slug, isActive: true }).exec();
    if (!post) throw new NotFoundException(`Post with slug "${slug}" not found`);
    return post;
  }

  async findPostById(id: string): Promise<CommunityPostDocument> {
    if (!Types.ObjectId.isValid(id)) throw new BadRequestException('Invalid ID');
    const post = await this.postModel.findById(id).exec();
    if (!post || !post.isActive) throw new NotFoundException('Post not found');
    return post;
  }

  async getPostReplies(
    postId: string,
    options: { page: number; limit: number },
  ) {
    if (!Types.ObjectId.isValid(postId)) throw new BadRequestException('Invalid ID');
    const postObjId = new Types.ObjectId(postId);

    // Fetch ALL replies in the thread using rootPostId index (fast flat query)
    // Falls back to replyToId match for older docs that predate rootPostId.
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

  async getPostsByAuthor(
    userId: string,
    options: { page: number; limit: number; sortOrder: 'asc' | 'desc' },
  ) {
    if (!Types.ObjectId.isValid(userId)) throw new BadRequestException('Invalid user ID');
    const skip  = (options.page - 1) * options.limit;
    const query = { authorId: new Types.ObjectId(userId), isActive: true, replyToId: null };

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

  async getAuthorProfile(userId: string) {
    if (!Types.ObjectId.isValid(userId)) throw new BadRequestException('Invalid user ID');
    const user = await this.userModel
      .findById(userId)
      .select('name profilePicture role bio hostProfile createdAt')
      .exec();
    if (!user) throw new NotFoundException('Author not found');

    const objId = new Types.ObjectId(userId);

    const [totalPosts, totalLikes] = await Promise.all([
      this.postModel.countDocuments({ authorId: objId, isActive: true, replyToId: null }),
      this.postModel.aggregate([
        { $match: { authorId: objId, isActive: true } },
        { $group: { _id: null, total: { $sum: '$likes' } } },
      ]).then(r => r[0]?.total ?? 0),
    ]);

    return {
      user:       user.toJSON(),
      communityStats: { totalPosts, totalLikes },
    };
  }

  // ══════════════════════════════════════════════════════════════════════════
  // UPDATE
  // ══════════════════════════════════════════════════════════════════════════

  async updatePost(
    id: string,
    dto: UpdatePostDto,
    reqUser: any,
  ): Promise<CommunityPostDocument> {
    const post = await this.findPostById(id);
    this.assertOwnerOrAdmin(post, reqUser);

    Object.assign(post, dto);
    return post.save();
  }

  async pinPost(id: string, pinned: boolean): Promise<CommunityPostDocument> {
    const post = await this.findPostById(id);
    post.pinned = pinned;
    return post.save();
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ENGAGEMENT
  // ══════════════════════════════════════════════════════════════════════════

  async toggleLike(
    postId: string,
    reqUser: any,
  ): Promise<{ liked: boolean; likes: number }> {
    if (!Types.ObjectId.isValid(postId)) throw new BadRequestException('Invalid ID');
    const userId = new Types.ObjectId(reqUser.id);

    const post = await this.findPostById(postId);
    const alreadyLiked = post.likedBy.some(id => id.equals(userId));

    if (alreadyLiked) {
      post.likedBy = post.likedBy.filter(id => !id.equals(userId));
      post.likes   = Math.max(0, post.likes - 1);
    } else {
      post.likedBy.push(userId);
      post.likes += 1;
    }

    await post.save();
    return { liked: !alreadyLiked, likes: post.likes };
  }

  async incrementViews(postId: string): Promise<void> {
    if (!Types.ObjectId.isValid(postId)) return;
    await this.postModel.findByIdAndUpdate(postId, { $inc: { views: 1 } });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // DELETE
  // ══════════════════════════════════════════════════════════════════════════

  async deletePost(id: string, reqUser: any): Promise<void> {
    const post = await this.findPostById(id);
    this.assertOwnerOrAdmin(post, reqUser);

    post.isActive = false;
    await post.save();

    // Decrement parent's replyCount
    if (post.replyToId) {
      await this.postModel.findByIdAndUpdate(post.replyToId, {
        $inc: { replyCount: -1 },
      });
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ADMIN
  // ══════════════════════════════════════════════════════════════════════════

  async hardDelete(id: string): Promise<void> {
    await this.postModel.findByIdAndDelete(id);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // STATS & REPORTING
  // ══════════════════════════════════════════════════════════════════════════

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

  async flagPost(postId: string, reqUser: any): Promise<{ flagged: boolean }> {
    if (!Types.ObjectId.isValid(postId)) throw new BadRequestException('Invalid ID');
    const post = await this.findPostById(postId);
    const userId = new Types.ObjectId(reqUser.id);
    
    if (!post.flaggedBy) post.flaggedBy = [];
    if (!post.flaggedBy.some(id => id.equals(userId))) {
      post.flaggedBy.push(userId);
      await post.save();
    }
    return { flagged: true };
  }

  async getFlaggedPosts(query: { page?: number; limit?: number }) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;

    const [posts, total] = await Promise.all([
      this.postModel
        .find({ 'flaggedBy.0': { $exists: true }, isActive: true }) // posts with at least 1 flag
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

  async unflagPost(postId: string) {
    if (!Types.ObjectId.isValid(postId)) throw new BadRequestException('Invalid ID');
    const post = await this.findPostById(postId);
    post.flaggedBy = [];
    await post.save();
    return post;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // HELPERS
  // ══════════════════════════════════════════════════════════════════════════

  private assertOwnerOrAdmin(post: CommunityPostDocument, reqUser: any): void {
    const isOwner = post.authorId.toString() === reqUser.id;
    const isAdmin = reqUser.role === 'admin';
    if (!isOwner && !isAdmin) {
      throw new ForbiddenException('You do not have permission to modify this post');
    }
  }
}
