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
exports.AuthorProfileSchema = exports.AuthorProfile = exports.AuthorRole = void 0;
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
var AuthorRole;
(function (AuthorRole) {
    AuthorRole["ADMIN_EDITOR"] = "admin_editor";
    AuthorRole["EDITOR"] = "editor";
    AuthorRole["AGENT_AUTHOR"] = "agent_author";
    AuthorRole["CONTRIBUTOR"] = "contributor";
})(AuthorRole || (exports.AuthorRole = AuthorRole = {}));
let AuthorProfile = class AuthorProfile {
    user;
    displayName;
    slug;
    bio;
    avatar;
    title;
    specialties;
    social;
    role;
    isActive;
    publishedPostCount;
    totalViewCount;
};
exports.AuthorProfile = AuthorProfile;
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'User', required: true, unique: true, index: true }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], AuthorProfile.prototype, "user", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, trim: true }),
    __metadata("design:type", String)
], AuthorProfile.prototype, "displayName", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, unique: true, lowercase: true, index: true }),
    __metadata("design:type", String)
], AuthorProfile.prototype, "slug", void 0);
__decorate([
    (0, mongoose_1.Prop)({ maxlength: 500 }),
    __metadata("design:type", String)
], AuthorProfile.prototype, "bio", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], AuthorProfile.prototype, "avatar", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], AuthorProfile.prototype, "title", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [String], default: [] }),
    __metadata("design:type", Array)
], AuthorProfile.prototype, "specialties", void 0);
__decorate([
    (0, mongoose_1.Prop)({
        type: {
            twitter: String,
            linkedin: String,
            website: String,
        },
        default: {},
    }),
    __metadata("design:type", Object)
], AuthorProfile.prototype, "social", void 0);
__decorate([
    (0, mongoose_1.Prop)({ enum: AuthorRole, default: AuthorRole.CONTRIBUTOR, index: true }),
    __metadata("design:type", String)
], AuthorProfile.prototype, "role", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: true, index: true }),
    __metadata("design:type", Boolean)
], AuthorProfile.prototype, "isActive", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 0 }),
    __metadata("design:type", Number)
], AuthorProfile.prototype, "publishedPostCount", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 0 }),
    __metadata("design:type", Number)
], AuthorProfile.prototype, "totalViewCount", void 0);
exports.AuthorProfile = AuthorProfile = __decorate([
    (0, mongoose_1.Schema)({ timestamps: true })
], AuthorProfile);
exports.AuthorProfileSchema = mongoose_1.SchemaFactory.createForClass(AuthorProfile);
exports.AuthorProfileSchema.index({ role: 1, isActive: 1 });
exports.AuthorProfileSchema.index({ publishedPostCount: -1 });
//# sourceMappingURL=author-profile.schema.js.map