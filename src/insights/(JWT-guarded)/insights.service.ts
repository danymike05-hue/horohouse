import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { Cron, CronExpression } from '@nestjs/schedule';

import { Post, PostDocument, PostStatus, PostType } from '../schemas/post.schema';
import { Category, CategoryDocument } from '../schemas/category.schema';
import { Tag, TagDocument } from '../schemas/tag.schema';
import { AuthorProfile,  AuthorProfileDocument, AuthorRole } from '../schemas/author-profile.schema';
import { CreatePostDto, UpdatePostDto, QueryPostsDto, SchedulePostDto, ReviewPostDto } from '../dto/insights.dto';
import { InsightsSeoService } from './insights-seo.service';
import { InsightsRecommendationService } from './insights-recommendation.service';

@Injectable()
export class InsightsService {
  constructor(
    @InjectModel(Post.name) private postModel: Model<PostDocument>,
    @InjectModel(Category.name) private categoryModel: Model<CategoryDocument>,
    @InjectModel(Tag.name) private tagModel: Model<TagDocument>,
    @InjectModel(AuthorProfile.name) private authorModel: Model<AuthorProfileDocument>,
    private seoService: InsightsSeoService,
    private recommendationService: InsightsRecommendationService,
  ) {}

  // ── Public Feed ────────────────────────────────────────────────────────────

  async findPublished(query: QueryPostsDto) {
    const {
      category, tag, postType, city, author,
      q, page = 1, limit = 12, sortBy = 'publishedAt', sortOrder = 'desc',
    } = query;

    const filter: any = { status: PostStatus.PUBLISHED };

    if (category) {
      const cat = await this.categoryModel.findOne({ slug: category }).lean();
      if (cat) filter.category = cat._id;
    }
    if (tag) {
      const t = await this.tagModel.findOne({ slug: tag }).lean();
      if (t) filter.tags = t._id;
    }
    if (postType) filter.postType = postType;
    if (city) filter['neighborhood.city'] = { $regex: city, $options: 'i' };
    if (author) {
      const a = await this.authorModel.findOne({ slug: author }).lean();
      if (a) filter.author = a._id;
    }
    if (q) filter.$text = { $search: q };

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
      .find({ status: PostStatus.PUBLISHED, isFeatured: true })
      .sort({ publishedAt: -1 })
      .limit(limit)
      .populate('author', 'displayName slug avatar')
      .populate('category', 'name slug accentColor icon')
      .lean();
  }

  async findTrending(limit = 5) {
    // Trending = weighted score of views + recency decay
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600000);
    return this.postModel
      .find({ status: PostStatus.PUBLISHED, publishedAt: { $gte: sevenDaysAgo } })
      .sort({ viewCount: -1, publishedAt: -1 })
      .limit(limit)
      .populate('author', 'displayName slug avatar')
      .populate('category', 'name slug accentColor icon')
      .lean();
  }

  async findBySlug(slug: string) {
    const post = await this.postModel
      .findOne({ slug, status: PostStatus.PUBLISHED })
      .populate('author', 'displayName slug avatar title bio social specialties')
      .populate('coAuthors', 'displayName slug avatar')
      .populate('category', 'name slug accentColor icon')
      .populate('tags', 'name slug')
      .populate('relatedListings', 'title price images location isVerified')
      .lean();

    if (!post) throw new NotFoundException(`Article "${slug}" not found`);

    // Fire-and-forget view count increment
    this.postModel.updateOne({ _id: post._id }, { $inc: { viewCount: 1 } }).exec();

    // Update trending flag if view count crosses threshold
    if ((post.viewCount || 0) > 100) {
      this.postModel.updateOne({ _id: post._id }, { isTrending: true }).exec();
    }

    return post;
  }

  async getRelated(slug: string, limit = 4) {
    const post = await this.postModel.findOne({ slug }).lean();
    if (!post) throw new NotFoundException();
    return this.recommendationService.getRelatedPosts(post as any, limit);
  }

  async findByCategory(categorySlug: string, query: QueryPostsDto) {
    const category = await this.categoryModel.findOne({ slug: categorySlug, isActive: true }).lean();
    if (!category) throw new NotFoundException(`Category "${categorySlug}" not found`);
    return this.findPublished({ ...query, category: categorySlug });
  }

  async findByTag(tagSlug: string, query: QueryPostsDto) {
    const tag = await this.tagModel.findOne({ slug: tagSlug, isActive: true }).lean();
    if (!tag) throw new NotFoundException(`Tag "${tagSlug}" not found`);
    return this.findPublished({ ...query, tag: tagSlug });
  }

  async getAuthorWithPosts(authorSlug: string, query: QueryPostsDto) {
    const author = await this.authorModel
      .findOne({ slug: authorSlug, isActive: true })
      .populate('user', 'firstName lastName')
      .lean();
    if (!author) throw new NotFoundException(`Author "${authorSlug}" not found`);
    const posts = await this.findPublished({ ...query, author: authorSlug });
    return { author, ...posts };
  }

  async getNeighborhoodGuide(neighborhoodSlug: string) {
    // Neighborhood slug is the city name slugified
    const city = neighborhoodSlug.replace(/-/g, ' ');
    const posts = await this.postModel
      .find({
        status: PostStatus.PUBLISHED,
        postType: PostType.NEIGHBORHOOD_GUIDE,
        'neighborhood.city': { $regex: city, $options: 'i' },
      })
      .sort({ publishedAt: -1 })
      .populate('author', 'displayName slug avatar')
      .populate('relatedListings', 'title price images location')
      .lean();

    return { city, posts };
  }

  async getMarketInsights(query: QueryPostsDto) {
    return this.findPublished({ ...query, postType: PostType.MARKET_REPORT });
  }

  async searchInsights(q: string, params: QueryPostsDto) {
    if (!q || q.trim().length < 2) throw new BadRequestException('Search query too short');
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

  // ── Contributor Workflow ───────────────────────────────────────────────────

  async submitDraft(userId: string, createPostDto: CreatePostDto) {
    const authorProfile = await this.authorModel.findOne({ user: new Types.ObjectId(userId) });
    if (!authorProfile) {
      throw new ForbiddenException('You need an author profile to submit articles. Apply in your account settings.');
    }

    const slug = await this.seoService.generateSlug(createPostDto.title);
    const contentText = this.seoService.extractTextFromTiptap(createPostDto.content);
    const readingTimeMinutes = this.seoService.calculateReadingTime(contentText);

    const status = authorProfile.role === AuthorRole.CONTRIBUTOR
      ? PostStatus.REVIEW  // contributors need review
      : PostStatus.DRAFT;  // editors/admins go straight to draft

    const post = await this.postModel.create({
      ...createPostDto,
      slug,
      contentText,
      readingTimeMinutes,
      status,
      submittedBy: new Types.ObjectId(userId),
      author: authorProfile._id,
      editorialLog: [{ action: 'submitted', performedBy: new Types.ObjectId(userId), at: new Date() }],
    } as any);

    return post;
  }

  async getMySubmissions(userId: string, query: QueryPostsDto) {
    const author = await this.authorModel.findOne({ user: new Types.ObjectId(userId) }).lean();
    if (!author) return { data: [], meta: { total: 0, page: 1, limit: 12, totalPages: 0 } };

    const { page = 1, limit = 12 } = query;
    const filter: any = { author: author._id };

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

  // ── Scheduler ─────────────────────────────────────────────────────────────

  @Cron(CronExpression.EVERY_MINUTE)
  async publishScheduledPosts() {
    const now = new Date();
    const toPublish = await this.postModel.find({
      status: PostStatus.SCHEDULED,
      scheduledAt: { $lte: now },
    });

    for (const post of toPublish) {
      post.status = PostStatus.PUBLISHED;
      post.publishedAt = now;
      post.editorialLog.push({ action: 'auto_published_scheduled', performedBy: null, note: 'Scheduled publish', at: now });
      await post.save();

      // Update category postCount
      await this.categoryModel.updateOne({ _id: post.category }, { $inc: { postCount: 1 } });

      // Update tag usageCounts
      if (post.tags?.length) {
        await this.tagModel.updateMany({ _id: { $in: post.tags } }, { $inc: { usageCount: 1 } });
      }
    }
  }
}