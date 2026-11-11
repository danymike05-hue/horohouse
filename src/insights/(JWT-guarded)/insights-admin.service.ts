import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { Post, PostDocument, PostStatus } from '../schemas/post.schema';
import { Category, CategoryDocument } from '../schemas/category.schema';
import { Tag, TagDocument } from '../schemas/tag.schema';
import { AuthorProfile, AuthorProfileDocument } from '../schemas/author-profile.schema';
import { CreatePostDto, UpdatePostDto, SchedulePostDto, ReviewPostDto, QueryPostsDto, CreateCategoryDto, CreateAuthorProfileDto } from '../dto/insights.dto';
import { InsightsSeoService } from './insights-seo.service';
import { uploadBufferToCloudinary, deleteFromCloudinary } from '../../utils/cloudinary';

@Injectable()
export class InsightsAdminService {
  constructor(
    @InjectModel(Post.name) private postModel: Model<PostDocument>,
    @InjectModel(Category.name) private categoryModel: Model<CategoryDocument>,
    @InjectModel(Tag.name) private tagModel: Model<TagDocument>,
    @InjectModel(AuthorProfile.name) private authorModel: Model<AuthorProfileDocument>,
    private seoService: InsightsSeoService,
  ) {}

  // ── Posts Admin ───────────────────────────────────────────────────────────

  async findAll(query: QueryPostsDto) {
    const { status, page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc' } = query;
    const filter: any = {};
    if (status) filter.status = status;

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
      this.postModel.countDocuments({ status: PostStatus.PUBLISHED }),
      this.postModel.countDocuments({ status: PostStatus.DRAFT }),
      this.postModel.countDocuments({ status: PostStatus.REVIEW }),
      this.postModel.countDocuments({ status: PostStatus.SCHEDULED }),
      this.postModel.countDocuments({ status: PostStatus.PUBLISHED, isFeatured: true }),
      this.postModel.countDocuments({ status: PostStatus.PUBLISHED, isTrending: true }),
    ]);

    const topPosts = await this.postModel
      .find({ status: PostStatus.PUBLISHED })
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

  async findById(id: string) {
    const post = await this.postModel
      .findById(id)
      .populate('author', 'displayName slug avatar role')
      .populate('coAuthors', 'displayName slug')
      .populate('category', 'name slug')
      .populate('tags', 'name slug')
      .populate('relatedListings', 'title price images.url location')
      .lean();
    if (!post) throw new NotFoundException('Article not found');
    return post;
  }

  async create(dto: CreatePostDto, editorUserId: string) {
    const slug = await this.seoService.generateSlug(dto.title);
    const contentText = this.seoService.extractTextFromTiptap(dto.content);
    const readingTimeMinutes = this.seoService.calculateReadingTime(contentText);

    // Auto-generate SEO if not provided
    const seo = dto.seo ?? {};
    if (!seo.metaTitle) seo.metaTitle = dto.title.slice(0, 70);
    if (!seo.metaDescription) seo.metaDescription = dto.excerpt.slice(0, 160);
    if (!seo.ogTitle) seo.ogTitle = dto.title;
    if (!seo.ogDescription) seo.ogDescription = dto.excerpt;
    if (dto.coverImage?.url && !seo.ogImage) seo.ogImage = dto.coverImage.url;

    return this.postModel.create({
      ...dto,
      slug,
      contentText,
      readingTimeMinutes,
      seo,
      status: PostStatus.DRAFT,
      submittedBy: new Types.ObjectId(editorUserId),
      editorialLog: [{ action: 'created', performedBy: new Types.ObjectId(editorUserId), at: new Date() }],
    } as any);
  }

  async update(id: string, dto: UpdatePostDto, editorUserId: string) {
    const post = await this.postModel.findById(id);
    if (!post) throw new NotFoundException('Article not found');

    if (dto.title && dto.title !== post.title) {
      post.slug = await this.seoService.generateSlug(dto.title, id);
    }

    if (dto.content) {
      post.contentText = this.seoService.extractTextFromTiptap(dto.content);
      post.readingTimeMinutes = this.seoService.calculateReadingTime(post.contentText);
    }

    Object.assign(post, dto);
    post.editorialLog.push({ action: 'updated', performedBy: new Types.ObjectId(editorUserId), note: '', at: new Date() });

    return post.save();
  }

async publish(id: string, editorUserId: string) {
  const post = await this.postModel.findById(id);
  if (!post) throw new NotFoundException();
  if (post.status === PostStatus.PUBLISHED) throw new BadRequestException('Already published');

  post.status = PostStatus.PUBLISHED;
  post.publishedAt = post.publishedAt || new Date();
  post.publishedBy = new Types.ObjectId(editorUserId);
  post.editorialLog.push({ action: 'published', performedBy: new Types.ObjectId(editorUserId), note: '', at: new Date() });

  const saved = await post.save();

  // Guard above guarantees we only reach here when not previously published
  await this.categoryModel.updateOne({ _id: post.category }, { $inc: { postCount: 1 } });
  if (post.tags?.length) {
    await this.tagModel.updateMany({ _id: { $in: post.tags } }, { $inc: { usageCount: 1 } });
  }
  await this.authorModel.updateOne({ _id: post.author }, { $inc: { publishedPostCount: 1 } });

  const baseUrl = process.env.FRONTEND_URL || 'https://horohouse.com';
  await this.postModel.updateOne(
    { _id: id },
    { 'seo.structuredData': this.seoService.buildStructuredData(saved, baseUrl) },
  );

  return saved;
}

  async schedule(id: string, dto: SchedulePostDto, editorUserId: string) {
    const post = await this.postModel.findById(id);
    if (!post) throw new NotFoundException();

    const scheduledAt = new Date(dto.scheduledAt);
    if (scheduledAt <= new Date()) throw new BadRequestException('Scheduled time must be in the future');

    post.status = PostStatus.SCHEDULED;
    post.scheduledAt = scheduledAt;
    post.editorialLog.push({
      action: 'scheduled',
      performedBy: new Types.ObjectId(editorUserId),
      note: `Scheduled for ${scheduledAt.toISOString()}`,
      at: new Date(),
    });

    return post.save();
  }

  async toggleFeatured(id: string, isFeatured: boolean, editorUserId: string) {
    const post = await this.postModel.findById(id);
    if (!post) throw new NotFoundException();
    post.isFeatured = isFeatured;
    post.editorialLog.push({
      action: isFeatured ? 'featured' : 'unfeatured',
      performedBy: new Types.ObjectId(editorUserId),
      note: '',
      at: new Date(),
    });
    return post.save();
  }

  async reviewSubmission(id: string, dto: ReviewPostDto, editorUserId: string) {
    const post = await this.postModel.findById(id);
    if (!post) throw new NotFoundException();
    if (post.status !== PostStatus.REVIEW) {
      throw new BadRequestException('Post is not in review status');
    }

    if (dto.decision === 'approve') {
      post.status = PostStatus.DRAFT; // moves to draft for final edit before publish
      post.reviewedBy = new Types.ObjectId(editorUserId);
      post.editorialLog.push({ action: 'review_approved', performedBy: new Types.ObjectId(editorUserId), note: dto.note || '', at: new Date() });
    } else {
      post.status = PostStatus.DRAFT; // returns to contributor as draft
      post.editorialLog.push({ action: 'review_rejected', performedBy: new Types.ObjectId(editorUserId), note: dto.note || '', at: new Date() });
    }

    return post.save();
  }

  async delete(id: string, editorUserId: string) {
    const post = await this.postModel.findById(id);
    if (!post) throw new NotFoundException();

    if (post.status === PostStatus.PUBLISHED) {
      await this.categoryModel.updateOne({ _id: post.category }, { $inc: { postCount: -1 } });
      if (post.tags?.length) {
        await this.tagModel.updateMany({ _id: { $in: post.tags } }, { $inc: { usageCount: -1 } });
      }
      await this.authorModel.updateOne({ _id: post.author }, { $inc: { publishedPostCount: -1 } });
    }

    // Delete cover image from Cloudinary
    if (post.coverImage?.publicId) {
      await deleteFromCloudinary(post.coverImage.publicId).catch(() => {});
    }

    await this.postModel.deleteOne({ _id: id });
    return { message: 'Article deleted' };
  }

  // ── Slug Backfill (one-time migration) ────────────────────────────────────

  async backfillSlugs(): Promise<{ fixed: number; skipped: number }> {
    const posts = await this.postModel
      .find({ $or: [{ slug: { $exists: false } }, { slug: null }, { slug: '' }] })
      .select('_id title slug')
      .lean();

    let fixed = 0;
    let skipped = 0;

    for (const post of posts) {
      try {
        const slug = await this.seoService.generateSlug(
          post.title || `post-${post._id}`,
          String(post._id),
        );
        await this.postModel.updateOne({ _id: post._id }, { $set: { slug } });
        fixed++;
      } catch {
        skipped++;
      }
    }

    return { fixed, skipped };
  }

  async uploadCover(file: Express.Multer.File) {
    if (!file?.buffer?.length) throw new BadRequestException('No file uploaded or file is empty');

    const result = await uploadBufferToCloudinary(file.buffer, {
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

  async getAnalytics(params: any) {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 3600000);

    const [topByViews, recentPublished, viewsByCategory] = await Promise.all([
      this.postModel
        .find({ status: PostStatus.PUBLISHED })
        .sort({ viewCount: -1 })
        .limit(10)
        .select('title slug viewCount likeCount shareCount publishedAt')
        .lean(),

      this.postModel
        .find({ status: PostStatus.PUBLISHED, publishedAt: { $gte: thirtyDaysAgo } })
        .sort({ publishedAt: -1 })
        .select('title slug viewCount publishedAt')
        .lean(),

      this.postModel.aggregate([
        { $match: { status: PostStatus.PUBLISHED } },
        { $group: { _id: '$category', totalViews: { $sum: '$viewCount' }, count: { $sum: 1 } } },
        { $lookup: { from: 'categories', localField: '_id', foreignField: '_id', as: 'category' } },
        { $unwind: '$category' },
        { $sort: { totalViews: -1 } },
      ]),
    ]);

    return { topByViews, recentPublished, viewsByCategory };
  }

  // ── Categories Admin ──────────────────────────────────────────────────────

  async createCategory(dto: CreateCategoryDto) {
    const slug = dto.name
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '-');
    const exists = await this.categoryModel.findOne({ slug });
    if (exists) throw new BadRequestException('Category with this name already exists');
    return this.categoryModel.create({ ...dto, slug });
  }

  async updateCategory(id: string, dto: Partial<CreateCategoryDto>) {
    const cat = await this.categoryModel.findByIdAndUpdate(id, dto, { new: true });
    if (!cat) throw new NotFoundException();
    return cat;
  }

  async deleteCategory(id: string) {
    const postCount = await this.postModel.countDocuments({ category: new Types.ObjectId(id) });
    if (postCount > 0) throw new BadRequestException(`Cannot delete category with ${postCount} articles. Reassign them first.`);
    await this.categoryModel.findByIdAndDelete(id);
    return { message: 'Category deleted' };
  }

  async getAllCategories() {
    return this.categoryModel.find().sort({ sortOrder: 1, name: 1 }).lean();
  }

  // ── Tags Admin ────────────────────────────────────────────────────────────

  async getAllTags(params: any) {
    const { page = 1, limit = 50 } = params;
    const [tags, total] = await Promise.all([
      this.tagModel.find().sort({ usageCount: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      this.tagModel.countDocuments(),
    ]);
    return { data: tags, meta: { total, page, limit } };
  }

  async createTag(name: string) {
    const slug = name.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '-');
    const exists = await this.tagModel.findOne({ slug });
    if (exists) throw new BadRequestException('Tag already exists');
    return this.tagModel.create({ name, slug });
  }

  async deleteTag(id: string) {
    await this.postModel.updateMany({ tags: new Types.ObjectId(id) }, { $pull: { tags: new Types.ObjectId(id) } });
    await this.tagModel.findByIdAndDelete(id);
    return { message: 'Tag deleted' };
  }

  // ── Authors Admin ─────────────────────────────────────────────────────────

  async getAuthors(params: any) {
    const { page = 1, limit = 20, role } = params;
    const filter: any = {};
    if (role) filter.role = role;
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

  async createAuthorProfile(dto: CreateAuthorProfileDto) {
    const existing = await this.authorModel.findOne({ user: new Types.ObjectId(dto.userId) });
    if (existing) throw new BadRequestException('Author profile already exists for this user');

    const slug = dto.displayName
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '-');

    return this.authorModel.create({
      ...dto,
      user: new Types.ObjectId(dto.userId),
      slug,
    } as any);
  }

  async updateAuthorProfile(id: string, dto: Partial<CreateAuthorProfileDto>) {
    const author = await this.authorModel.findByIdAndUpdate(id, dto, { new: true });
    if (!author) throw new NotFoundException();
    return author;
  }
}