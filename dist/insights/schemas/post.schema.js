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
Object.defineProperty(exports, "__esModule", { value: true });
exports.PostSchema = exports.Post = exports.PostType = exports.PostStatus = void 0;
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
var PostStatus;
(function (PostStatus) {
    PostStatus["DRAFT"] = "draft";
    PostStatus["REVIEW"] = "review";
    PostStatus["SCHEDULED"] = "scheduled";
    PostStatus["PUBLISHED"] = "published";
    PostStatus["ARCHIVED"] = "archived";
})(PostStatus || (exports.PostStatus = PostStatus = {}));
var PostType;
(function (PostType) {
    PostType["ARTICLE"] = "article";
    PostType["NEIGHBORHOOD_GUIDE"] = "neighborhood_guide";
    PostType["MARKET_REPORT"] = "market_report";
    PostType["FRAUD_ALERT"] = "fraud_alert";
    PostType["AI_INSIGHT"] = "ai_insight";
})(PostType || (exports.PostType = PostType = {}));
let Post = class Post {
    title;
    slug;
    excerpt;
    content;
    contentText;
    author;
    coAuthors;
    category;
    tags;
    status;
    postType;
    coverImage;
    seo;
    relatedListings;
    neighborhood;
    marketData;
    publishedAt;
    scheduledAt;
    isFeatured;
    isTrending;
    isPinned;
    isAiGenerated;
    viewCount;
    shareCount;
    likeCount;
    commentCount;
    readingTimeMinutes;
    cta;
    editorialLog;
    submittedBy;
    reviewedBy;
    publishedBy;
};
exports.Post = Post;
__decorate([
    (0, mongoose_1.Prop)({ required: true, trim: true, maxlength: 160 }),
    __metadata("design:type", String)
], Post.prototype, "title", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, unique: true, lowercase: true, index: true }),
    __metadata("design:type", String)
], Post.prototype, "slug", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, maxlength: 300 }),
    __metadata("design:type", String)
], Post.prototype, "excerpt", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Object, required: true }),
    __metadata("design:type", Object)
], Post.prototype, "content", void 0);
__decorate([
    (0, mongoose_1.Prop)({ index: 'text' }),
    __metadata("design:type", String)
], Post.prototype, "contentText", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'AuthorProfile', required: true, index: true }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], Post.prototype, "author", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [{ type: mongoose_2.Types.ObjectId, ref: 'AuthorProfile' }], default: [] }),
    __metadata("design:type", Array)
], Post.prototype, "coAuthors", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'Category', required: true, index: true }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], Post.prototype, "category", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [{ type: mongoose_2.Types.ObjectId, ref: 'Tag' }], default: [], index: true }),
    __metadata("design:type", Array)
], Post.prototype, "tags", void 0);
__decorate([
    (0, mongoose_1.Prop)({ enum: PostStatus, default: PostStatus.DRAFT, index: true }),
    __metadata("design:type", String)
], Post.prototype, "status", void 0);
__decorate([
    (0, mongoose_1.Prop)({ enum: PostType, default: PostType.ARTICLE, index: true }),
    __metadata("design:type", String)
], Post.prototype, "postType", void 0);
__decorate([
    (0, mongoose_1.Prop)({
        type: {
            url: String,
            publicId: String,
            alt: String,
            caption: String,
            width: Number,
            height: Number,
        },
    }),
    __metadata("design:type", Object)
], Post.prototype, "coverImage", void 0);
__decorate([
    (0, mongoose_1.Prop)({
        type: {
            metaTitle: String,
            metaDescription: String,
            ogImage: String,
            ogTitle: String,
            ogDescription: String,
            canonicalUrl: String,
            noIndex: { type: Boolean, default: false },
            structuredData: Object,
        },
    }),
    __metadata("design:type", Object)
], Post.prototype, "seo", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [{ type: mongoose_2.Types.ObjectId, ref: 'Property' }], default: [] }),
    __metadata("design:type", Array)
], Post.prototype, "relatedListings", void 0);
__decorate([
    (0, mongoose_1.Prop)({
        type: {
            name: String,
            city: String,
            country: String,
            coordinates: { lat: Number, lng: Number },
        },
    }),
    __metadata("design:type", Object)
], Post.prototype, "neighborhood", void 0);
__decorate([
    (0, mongoose_1.Prop)({
        type: {
            averagePrice: Number,
            priceChange: Number,
            demandIndex: Number,
            currency: { type: String, default: 'XAF' },
            dataDate: Date,
            source: String,
        },
    }),
    __metadata("design:type", Object)
], Post.prototype, "marketData", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Date, index: true }),
    __metadata("design:type", Date)
], Post.prototype, "publishedAt", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Date }),
    __metadata("design:type", Date)
], Post.prototype, "scheduledAt", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: false, index: true }),
    __metadata("design:type", Boolean)
], Post.prototype, "isFeatured", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: false, index: true }),
    __metadata("design:type", Boolean)
], Post.prototype, "isTrending", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: false }),
    __metadata("design:type", Boolean)
], Post.prototype, "isPinned", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: false }),
    __metadata("design:type", Boolean)
], Post.prototype, "isAiGenerated", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 0, index: true }),
    __metadata("design:type", Number)
], Post.prototype, "viewCount", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 0 }),
    __metadata("design:type", Number)
], Post.prototype, "shareCount", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 0 }),
    __metadata("design:type", Number)
], Post.prototype, "likeCount", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 0 }),
    __metadata("design:type", Number)
], Post.prototype, "commentCount", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 1 }),
    __metadata("design:type", Number)
], Post.prototype, "readingTimeMinutes", void 0);
__decorate([
    (0, mongoose_1.Prop)({
        type: {
            type: String,
            label: String,
            url: String,
            propertyId: String,
        },
    }),
    __metadata("design:type", Object)
], Post.prototype, "cta", void 0);
__decorate([
    (0, mongoose_1.Prop)({
        type: [
            {
                action: String,
                performedBy: { type: mongoose_2.Types.ObjectId, ref: 'User', default: null },
                note: String,
                at: Date,
            },
        ],
        default: [],
    }),
    __metadata("design:type", Array)
], Post.prototype, "editorialLog", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'User', index: true }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], Post.prototype, "submittedBy", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'User' }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], Post.prototype, "reviewedBy", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'User' }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], Post.prototype, "publishedBy", void 0);
exports.Post = Post = __decorate([
    (0, mongoose_1.Schema)({ timestamps: true })
], Post);
exports.PostSchema = mongoose_1.SchemaFactory.createForClass(Post);
exports.PostSchema.index({ status: 1, publishedAt: -1 });
exports.PostSchema.index({ category: 1, status: 1, publishedAt: -1 });
exports.PostSchema.index({ tags: 1, status: 1 });
exports.PostSchema.index({ isFeatured: 1, status: 1 });
exports.PostSchema.index({ isTrending: 1, status: 1 });
exports.PostSchema.index({ postType: 1, status: 1, publishedAt: -1 });
exports.PostSchema.index({ 'neighborhood.city': 1, status: 1 });
exports.PostSchema.index({ relatedListings: 1 });
exports.PostSchema.index({ viewCount: -1 });
exports.PostSchema.index({ scheduledAt: 1, status: 1 });
exports.PostSchema.index({ author: 1, status: 1, publishedAt: -1 });
exports.PostSchema.index({ title: 'text', contentText: 'text', excerpt: 'text' }, { weights: { title: 10, excerpt: 5, contentText: 1 }, name: 'insights_full_text' });
//# sourceMappingURL=post.schema.js.map