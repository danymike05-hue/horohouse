import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Post, PostDocument, PostStatus } from '../schemas/post.schema';

@Injectable()
export class InsightsRecommendationService {
  constructor(@InjectModel(Post.name) private postModel: Model<PostDocument>) {}

  async getRelatedPosts(post: PostDocument, limit = 4): Promise<any[]> {
    /**
     * Scoring matrix:
     *  +3  same category
     *  +1  per shared tag (capped at 3)
     *  +2  same neighborhood city
     *  +1  same postType
     *  +1  recency boost (published < 30 days ago)
     *  −   already in relatedListings (excluded)
     */
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 3600000);
    const tagIds = post.tags?.map((t: any) => t._id ?? t) ?? [];
    const neighborhoodCity = (post as any).neighborhood?.city;

    const pipeline: any[] = [
      {
        $match: {
          _id: { $ne: post._id },
          status: PostStatus.PUBLISHED,
          $or: [
            { category: post.category },
            ...(tagIds.length ? [{ tags: { $in: tagIds } }] : []),
            ...(neighborhoodCity ? [{ 'neighborhood.city': neighborhoodCity }] : []),
            { postType: (post as any).postType },
          ],
        },
      },
      {
        $addFields: {
          _score: {
            $add: [
              // Category match
              { $cond: [{ $eq: ['$category', post.category] }, 3, 0] },
              // Tag overlap (capped at 3)
              {
                $min: [
                  { $size: { $ifNull: [{ $setIntersection: ['$tags', tagIds] }, []] } },
                  3,
                ],
              },
              // Neighborhood city match
              {
                $cond: [
                  { $and: [{ $ne: [neighborhoodCity, null] }, { $eq: ['$neighborhood.city', neighborhoodCity] }] },
                  2,
                  0,
                ],
              },
              // Post type match
              { $cond: [{ $eq: ['$postType', (post as any).postType] }, 1, 0] },
              // Recency boost
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

  async getTrendingScore(viewCount: number, publishedAt: Date): Promise<number> {
    // Hacker News-style decay: score / (age_hours + 2)^1.8
    const ageHours = (Date.now() - publishedAt.getTime()) / 3600000;
    return viewCount / Math.pow(ageHours + 2, 1.8);
  }
}