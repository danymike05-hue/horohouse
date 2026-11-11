// ─── insights-seo.service.ts ──────────────────────────────────────────────────
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Post, PostDocument } from '../schemas/post.schema';

@Injectable()
export class InsightsSeoService {
  constructor(@InjectModel(Post.name) private postModel: Model<PostDocument>) {}

  async generateSlug(title: string, existingId?: string): Promise<string> {
    const base = title
      .toLowerCase()
      .replace(/[àáâãäå]/g, 'a')
      .replace(/[èéêë]/g, 'e')
      .replace(/[ìíîï]/g, 'i')
      .replace(/[òóôõö]/g, 'o')
      .replace(/[ùúûü]/g, 'u')
      .replace(/[ç]/g, 'c')
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 80);

    let slug = base;
    let counter = 1;

    while (true) {
      const query: any = { slug };
      if (existingId) query._id = { $ne: existingId };
      const exists = await this.postModel.findOne(query).lean().select('_id');
      if (!exists) return slug;
      slug = `${base}-${counter++}`;
    }
  }

  calculateReadingTime(text: string): number {
    const wordsPerMinute = 200;
    const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.ceil(wordCount / wordsPerMinute));
  }

  extractTextFromTiptap(tiptapJson: Record<string, any>): string {
    if (!tiptapJson) return '';
    const texts: string[] = [];

    const traverse = (node: any) => {
      if (!node) return;
      if (node.type === 'text' && node.text) {
        texts.push(node.text);
      }
      if (Array.isArray(node.content)) {
        node.content.forEach(traverse);
      }
    };

    traverse(tiptapJson);
    return texts.join(' ').replace(/\s+/g, ' ').trim();
  }

  buildStructuredData(post: any, baseUrl: string): Record<string, any> {
    return {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: post.seo?.metaTitle || post.title,
      description: post.seo?.metaDescription || post.excerpt,
      image: post.coverImage?.url
        ? [{ '@type': 'ImageObject', url: post.coverImage.url, width: post.coverImage.width, height: post.coverImage.height }]
        : [],
      author: {
        '@type': 'Person',
        name: post.author?.displayName || 'HoroHouse Editorial',
        url: post.author?.slug ? `${baseUrl}/insights/author/${post.author.slug}` : undefined,
      },
      publisher: {
        '@type': 'Organization',
        name: 'HoroHouse',
        logo: {
          '@type': 'ImageObject',
          url: `${baseUrl}/images/horohouse-logo.png`,
        },
      },
      datePublished: post.publishedAt?.toISOString?.() || new Date().toISOString(),
      dateModified: post.updatedAt?.toISOString?.() || new Date().toISOString(),
      url: `${baseUrl}/insights/${post.slug}`,
      mainEntityOfPage: {
        '@type': 'WebPage',
        '@id': `${baseUrl}/insights/${post.slug}`,
      },
      keywords: post.tags?.map((t: any) => t.name || t).join(', '),
      articleSection: post.category?.name,
      timeRequired: `PT${post.readingTimeMinutes}M`,
      ...(post.postType === 'neighborhood_guide' && post.neighborhood
        ? {
            '@type': 'TravelGuide',
            about: {
              '@type': 'Place',
              name: post.neighborhood.name,
              address: { '@type': 'PostalAddress', addressLocality: post.neighborhood.city },
            },
          }
        : {}),
    };
  }

  buildSitemapEntry(post: any, baseUrl: string) {
    return {
      url: `${baseUrl}/insights/${post.slug}`,
      lastModified: post.updatedAt,
      changeFrequency: 'weekly',
      priority: post.isFeatured ? 0.9 : post.isTrending ? 0.8 : 0.7,
    };
  }
}
