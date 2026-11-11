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
exports.ComparisonSchema = exports.Comparison = void 0;
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
let Comparison = class Comparison {
    userId;
    name;
    propertyIds;
    isPublic;
    shareToken;
    viewsCount;
    createdAt;
    updatedAt;
};
exports.Comparison = Comparison;
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'User', required: true }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], Comparison.prototype, "userId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, trim: true }),
    __metadata("design:type", String)
], Comparison.prototype, "name", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [{ type: mongoose_2.Types.ObjectId, ref: 'Property' }], required: true }),
    __metadata("design:type", Array)
], Comparison.prototype, "propertyIds", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: false }),
    __metadata("design:type", Boolean)
], Comparison.prototype, "isPublic", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], Comparison.prototype, "shareToken", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 0 }),
    __metadata("design:type", Number)
], Comparison.prototype, "viewsCount", void 0);
exports.Comparison = Comparison = __decorate([
    (0, mongoose_1.Schema)({ timestamps: true })
], Comparison);
exports.ComparisonSchema = mongoose_1.SchemaFactory.createForClass(Comparison);
exports.ComparisonSchema.index({ userId: 1, createdAt: -1 });
exports.ComparisonSchema.index({ shareToken: 1 });
exports.ComparisonSchema.index({ isPublic: 1, createdAt: -1 });
//# sourceMappingURL=comparison.schema.js.map