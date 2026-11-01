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
exports.SubscriptionPlanSchema = exports.SubscriptionPlanModel = void 0;
const mongoose_1 = require("@nestjs/mongoose");
const subscription_schema_1 = require("./subscription.schema");
const transaction_schema_1 = require("./transaction.schema");
let SubscriptionPlanModel = class SubscriptionPlanModel {
    name;
    displayName;
    description;
    highlights;
    pricing;
    currency;
    features;
    hasTrialPeriod;
    trialDurationDays;
    isActive;
    isPublic;
    displayOrder;
    currentDiscount;
    discountEndDate;
    isPopular;
    metadata;
    createdAt;
    updatedAt;
};
exports.SubscriptionPlanModel = SubscriptionPlanModel;
__decorate([
    (0, mongoose_1.Prop)({ required: true, unique: true, type: String, enum: subscription_schema_1.SubscriptionPlan }),
    __metadata("design:type", String)
], SubscriptionPlanModel.prototype, "name", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], SubscriptionPlanModel.prototype, "displayName", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], SubscriptionPlanModel.prototype, "description", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [String] }),
    __metadata("design:type", Array)
], SubscriptionPlanModel.prototype, "highlights", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Object, required: true }),
    __metadata("design:type", Object)
], SubscriptionPlanModel.prototype, "pricing", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 'XAF' }),
    __metadata("design:type", String)
], SubscriptionPlanModel.prototype, "currency", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Object, required: true }),
    __metadata("design:type", Object)
], SubscriptionPlanModel.prototype, "features", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: false }),
    __metadata("design:type", Boolean)
], SubscriptionPlanModel.prototype, "hasTrialPeriod", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Number)
], SubscriptionPlanModel.prototype, "trialDurationDays", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: true }),
    __metadata("design:type", Boolean)
], SubscriptionPlanModel.prototype, "isActive", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: true }),
    __metadata("design:type", Boolean)
], SubscriptionPlanModel.prototype, "isPublic", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 0 }),
    __metadata("design:type", Number)
], SubscriptionPlanModel.prototype, "displayOrder", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Number)
], SubscriptionPlanModel.prototype, "currentDiscount", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Date)
], SubscriptionPlanModel.prototype, "discountEndDate", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: false }),
    __metadata("design:type", Boolean)
], SubscriptionPlanModel.prototype, "isPopular", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Object }),
    __metadata("design:type", Object)
], SubscriptionPlanModel.prototype, "metadata", void 0);
exports.SubscriptionPlanModel = SubscriptionPlanModel = __decorate([
    (0, mongoose_1.Schema)({ timestamps: true })
], SubscriptionPlanModel);
exports.SubscriptionPlanSchema = mongoose_1.SchemaFactory.createForClass(SubscriptionPlanModel);
exports.SubscriptionPlanSchema.index({ name: 1 });
exports.SubscriptionPlanSchema.index({ isActive: 1, isPublic: 1 });
exports.SubscriptionPlanSchema.index({ displayOrder: 1 });
//# sourceMappingURL=subscription-plan.schema.js.map