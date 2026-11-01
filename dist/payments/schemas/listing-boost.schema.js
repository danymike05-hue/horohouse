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
exports.ListingBoostSchema = exports.ListingBoost = exports.BoostStatus = exports.BoostType = void 0;
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
var BoostType;
(function (BoostType) {
    BoostType["STANDARD"] = "standard";
    BoostType["FEATURED"] = "featured";
    BoostType["HIGHLIGHT"] = "highlight";
    BoostType["TOP"] = "top";
    BoostType["HOMEPAGE"] = "homepage";
    BoostType["SOCIAL_MEDIA"] = "social_media";
})(BoostType || (exports.BoostType = BoostType = {}));
var BoostStatus;
(function (BoostStatus) {
    BoostStatus["PENDING"] = "pending";
    BoostStatus["ACTIVE"] = "active";
    BoostStatus["EXPIRED"] = "expired";
    BoostStatus["CANCELLED"] = "cancelled";
})(BoostStatus || (exports.BoostStatus = BoostStatus = {}));
let ListingBoost = class ListingBoost {
    userId;
    propertyId;
    boostType;
    status;
    duration;
    price;
    currency;
    startDate;
    endDate;
    paymentDate;
    transactionId;
    impressions;
    clicks;
    inquiries;
    cancelledAt;
    cancellationReason;
    metadata;
    createdAt;
    updatedAt;
};
exports.ListingBoost = ListingBoost;
__decorate([
    (0, mongoose_1.Prop)({ required: true, type: mongoose_2.Types.ObjectId, ref: 'User' }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], ListingBoost.prototype, "userId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, type: mongoose_2.Types.ObjectId, ref: 'Property' }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], ListingBoost.prototype, "propertyId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, type: String, enum: BoostType }),
    __metadata("design:type", String)
], ListingBoost.prototype, "boostType", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, type: String, enum: BoostStatus, default: BoostStatus.PENDING }),
    __metadata("design:type", String)
], ListingBoost.prototype, "status", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", Number)
], ListingBoost.prototype, "duration", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", Number)
], ListingBoost.prototype, "price", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 'XAF' }),
    __metadata("design:type", String)
], ListingBoost.prototype, "currency", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Date)
], ListingBoost.prototype, "startDate", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Date)
], ListingBoost.prototype, "endDate", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Date)
], ListingBoost.prototype, "paymentDate", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'Transaction' }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], ListingBoost.prototype, "transactionId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 0 }),
    __metadata("design:type", Number)
], ListingBoost.prototype, "impressions", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 0 }),
    __metadata("design:type", Number)
], ListingBoost.prototype, "clicks", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 0 }),
    __metadata("design:type", Number)
], ListingBoost.prototype, "inquiries", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Date)
], ListingBoost.prototype, "cancelledAt", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], ListingBoost.prototype, "cancellationReason", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Object }),
    __metadata("design:type", Object)
], ListingBoost.prototype, "metadata", void 0);
exports.ListingBoost = ListingBoost = __decorate([
    (0, mongoose_1.Schema)({ timestamps: true })
], ListingBoost);
exports.ListingBoostSchema = mongoose_1.SchemaFactory.createForClass(ListingBoost);
exports.ListingBoostSchema.index({ propertyId: 1 });
exports.ListingBoostSchema.index({ userId: 1 });
exports.ListingBoostSchema.index({ boostType: 1, status: 1 });
exports.ListingBoostSchema.index({ status: 1, endDate: 1 });
exports.ListingBoostSchema.index({ status: 1, startDate: 1, endDate: 1 });
//# sourceMappingURL=listing-boost.schema.js.map