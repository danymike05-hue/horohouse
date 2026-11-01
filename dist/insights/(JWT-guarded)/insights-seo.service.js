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
exports.InsightsSeoService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const post_schema_1 = require("../schemas/post.schema");
let InsightsSeoService = class InsightsSeoService {
    postModel;
    constructor(postModel) {
        this.postModel = postModel;
    }
    async generateSlug(title, existingId) {
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
            const query = { slug };
            if (existingId)
                query._id = { $ne: existingId };
            const exists = await this.postModel.findOne(query).lean().select('_id');
            if (!exists)
                return slug;
            slug = `${base}-${counter++}`;
        }
    }
    calculateReadingTime(text) {
        const wordsPerMinute = 200;
        const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
        return Math.max(1, Math.ceil(wordCount / wordsPerMinute));
    }
    extractTextFromTiptap(tiptapJson) {
        if (!tiptapJson)
            return '';
        const texts = [];
        const traverse = (node) => {
            if (!node)
                return;
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
    buildStructuredData(post, baseUrl) {
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
            keywords: post.tags?.map((t) => t.name || t).join(', '),
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
    buildSitemapEntry(post, baseUrl) {
        return {
            url: `${baseUrl}/insights/${post.slug}`,
            lastModified: post.updatedAt,
            changeFrequency: 'weekly',
            priority: post.isFeatured ? 0.9 : post.isTrending ? 0.8 : 0.7,
        };
    }
};
exports.InsightsSeoService = InsightsSeoService;
exports.InsightsSeoService = InsightsSeoService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(post_schema_1.Post.name)),
    __metadata("design:paramtypes", [mongoose_2.Model])
], InsightsSeoService);
//# sourceMappingURL=insights-seo.service.js.map