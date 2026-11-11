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
exports.TagSchema = exports.Tag = void 0;
const mongoose_1 = require("@nestjs/mongoose");
let Tag = class Tag {
    name;
    slug;
    description;
    usageCount;
    isActive;
};
exports.Tag = Tag;
__decorate([
    (0, mongoose_1.Prop)({ required: true, unique: true, trim: true }),
    __metadata("design:type", String)
], Tag.prototype, "name", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, unique: true, lowercase: true, index: true }),
    __metadata("design:type", String)
], Tag.prototype, "slug", void 0);
__decorate([
    (0, mongoose_1.Prop)({ maxlength: 160 }),
    __metadata("design:type", String)
], Tag.prototype, "description", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 0, index: true }),
    __metadata("design:type", Number)
], Tag.prototype, "usageCount", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: true }),
    __metadata("design:type", Boolean)
], Tag.prototype, "isActive", void 0);
exports.Tag = Tag = __decorate([
    (0, mongoose_1.Schema)({ timestamps: true })
], Tag);
exports.TagSchema = mongoose_1.SchemaFactory.createForClass(Tag);
exports.TagSchema.index({ usageCount: -1 });
//# sourceMappingURL=tag.schema.js.map