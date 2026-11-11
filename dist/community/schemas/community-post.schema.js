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
exports.CommunityPostSchema = exports.CommunityPost = exports.PostCategory = void 0;
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
var PostCategory;
(function (PostCategory) {
    PostCategory["HOMES"] = "homes";
    PostCategory["CAFE"] = "cafe";
    PostCategory["EXPLORE"] = "explore";
    PostCategory["RESOURCES"] = "resources";
    PostCategory["UPDATES"] = "updates";
})(PostCategory || (exports.PostCategory = PostCategory = {}));
let CommunityPost = class CommunityPost {
    authorId;
    authorSnapshot;
    slug;
    category;
    title;
    excerpt;
    body;
    tags;
    pinned;
    likes;
    likedBy;
    flaggedBy;
    views;
    replyCount;
    replyToId;
    rootPostId;
    isActive;
    createdAt;
    updatedAt;
};
exports.CommunityPost = CommunityPost;
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'User', required: true, index: true }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], CommunityPost.prototype, "authorId", void 0);
__decorate([
    (0, mongoose_1.Prop)({
        type: {
            name: { type: String, required: true },
            initials: { type: String, required: true },
            role: { type: String, required: true },
            avatar: { type: String, default: '' },
        },
        required: true,
    }),
    __metadata("design:type", Object)
], CommunityPost.prototype, "authorSnapshot", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String, required: true, unique: true, index: true }),
    __metadata("design:type", String)
], CommunityPost.prototype, "slug", void 0);
__decorate([
    (0, mongoose_1.Prop)({
        type: String,
        enum: Object.values(PostCategory),
        required: true,
        index: true,
    }),
    __metadata("design:type", String)
], CommunityPost.prototype, "category", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String, required: true, trim: true }),
    __metadata("design:type", String)
], CommunityPost.prototype, "title", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String, trim: true }),
    __metadata("design:type", String)
], CommunityPost.prototype, "excerpt", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String }),
    __metadata("design:type", String)
], CommunityPost.prototype, "body", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [String], default: [] }),
    __metadata("design:type", Array)
], CommunityPost.prototype, "tags", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Boolean, default: false, index: true }),
    __metadata("design:type", Boolean)
], CommunityPost.prototype, "pinned", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Number, default: 0 }),
    __metadata("design:type", Number)
], CommunityPost.prototype, "likes", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [{ type: mongoose_2.Types.ObjectId, ref: 'User' }], default: [] }),
    __metadata("design:type", Array)
], CommunityPost.prototype, "likedBy", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [{ type: mongoose_2.Types.ObjectId, ref: 'User' }], default: [] }),
    __metadata("design:type", Array)
], CommunityPost.prototype, "flaggedBy", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Number, default: 0 }),
    __metadata("design:type", Number)
], CommunityPost.prototype, "views", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Number, default: 0 }),
    __metadata("design:type", Number)
], CommunityPost.prototype, "replyCount", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'CommunityPost', index: true, default: null }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], CommunityPost.prototype, "replyToId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'CommunityPost', index: true, default: null }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], CommunityPost.prototype, "rootPostId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Boolean, default: true }),
    __metadata("design:type", Boolean)
], CommunityPost.prototype, "isActive", void 0);
exports.CommunityPost = CommunityPost = __decorate([
    (0, mongoose_1.Schema)({ timestamps: true })
], CommunityPost);
exports.CommunityPostSchema = mongoose_1.SchemaFactory.createForClass(CommunityPost);
exports.CommunityPostSchema.index({ pinned: -1, createdAt: -1 });
exports.CommunityPostSchema.index({ category: 1, isActive: 1, createdAt: -1 });
exports.CommunityPostSchema.index({ authorId: 1, isActive: 1, createdAt: -1 });
exports.CommunityPostSchema.index({ replyToId: 1, createdAt: 1 });
exports.CommunityPostSchema.index({ rootPostId: 1, createdAt: 1 });
exports.CommunityPostSchema.virtual('id').get(function () {
    return this._id.toString();
});
exports.CommunityPostSchema.set('toJSON', {
    virtuals: true,
    versionKey: false,
    transform: (_doc, ret) => {
        delete ret._id;
        return ret;
    },
});
//# sourceMappingURL=community-post.schema.js.map