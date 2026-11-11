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
exports.UserInteractionSchema = exports.UserInteraction = exports.InteractionSource = exports.InteractionType = void 0;
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
var InteractionType;
(function (InteractionType) {
    InteractionType["PROPERTY_VIEW"] = "property_view";
    InteractionType["PROPERTY_FAVORITE"] = "property_favorite";
    InteractionType["PROPERTY_UNFAVORITE"] = "property_unfavorite";
    InteractionType["PROPERTY_SHARE"] = "property_share";
    InteractionType["PROPERTY_INQUIRY"] = "property_inquiry";
    InteractionType["SEARCH"] = "search";
    InteractionType["FILTER_APPLY"] = "filter_apply";
    InteractionType["PROPERTY_COMPARE"] = "property_compare";
    InteractionType["MAP_VIEW"] = "map_view";
    InteractionType["LIST_VIEW"] = "list_view";
    InteractionType["SIMILAR_PROPERTIES_CLICK"] = "similar_properties_click";
    InteractionType["RECOMMENDATION_CLICK"] = "recommendation_click";
    InteractionType["RECOMMENDATION_DISMISS"] = "recommendation_dismiss";
    InteractionType["CONTACT_AGENT"] = "contact_agent";
    InteractionType["SCHEDULE_VIEWING"] = "schedule_viewing";
})(InteractionType || (exports.InteractionType = InteractionType = {}));
var InteractionSource;
(function (InteractionSource) {
    InteractionSource["SEARCH_RESULTS"] = "search_results";
    InteractionSource["RECOMMENDATIONS"] = "recommendations";
    InteractionSource["SIMILAR_PROPERTIES"] = "similar_properties";
    InteractionSource["FAVORITES"] = "favorites";
    InteractionSource["DIRECT_LINK"] = "direct_link";
    InteractionSource["MAP"] = "map";
    InteractionSource["DASHBOARD"] = "dashboard";
    InteractionSource["NOTIFICATION"] = "notification";
})(InteractionSource || (exports.InteractionSource = InteractionSource = {}));
let UserInteraction = class UserInteraction {
    userId;
    interactionType;
    propertyId;
    source;
    metadata;
    agentId;
    location;
    city;
    neighborhood;
    propertyType;
    price;
    listingType;
    bedrooms;
    bathrooms;
    weight;
    expiresAt;
    isProcessed;
    processedAt;
    batchId;
    createdAt;
    updatedAt;
};
exports.UserInteraction = UserInteraction;
__decorate([
    (0, mongoose_1.Prop)({ required: true, type: mongoose_2.Types.ObjectId, ref: 'User' }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], UserInteraction.prototype, "userId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, type: String, enum: InteractionType }),
    __metadata("design:type", String)
], UserInteraction.prototype, "interactionType", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'Property' }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], UserInteraction.prototype, "propertyId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String, enum: InteractionSource }),
    __metadata("design:type", String)
], UserInteraction.prototype, "source", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Object, default: {} }),
    __metadata("design:type", Object)
], UserInteraction.prototype, "metadata", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'User' }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], UserInteraction.prototype, "agentId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Object }),
    __metadata("design:type", Object)
], UserInteraction.prototype, "location", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String }),
    __metadata("design:type", String)
], UserInteraction.prototype, "city", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String }),
    __metadata("design:type", String)
], UserInteraction.prototype, "neighborhood", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String }),
    __metadata("design:type", String)
], UserInteraction.prototype, "propertyType", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Number }),
    __metadata("design:type", Number)
], UserInteraction.prototype, "price", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String }),
    __metadata("design:type", String)
], UserInteraction.prototype, "listingType", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Number }),
    __metadata("design:type", Number)
], UserInteraction.prototype, "bedrooms", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Number }),
    __metadata("design:type", Number)
], UserInteraction.prototype, "bathrooms", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Number, default: 1 }),
    __metadata("design:type", Number)
], UserInteraction.prototype, "weight", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Date }),
    __metadata("design:type", Date)
], UserInteraction.prototype, "expiresAt", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Boolean, default: false }),
    __metadata("design:type", Boolean)
], UserInteraction.prototype, "isProcessed", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Date }),
    __metadata("design:type", Date)
], UserInteraction.prototype, "processedAt", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String }),
    __metadata("design:type", String)
], UserInteraction.prototype, "batchId", void 0);
exports.UserInteraction = UserInteraction = __decorate([
    (0, mongoose_1.Schema)({ timestamps: true })
], UserInteraction);
exports.UserInteractionSchema = mongoose_1.SchemaFactory.createForClass(UserInteraction);
exports.UserInteractionSchema.index({ userId: 1, createdAt: -1 });
exports.UserInteractionSchema.index({ userId: 1, interactionType: 1, createdAt: -1 });
exports.UserInteractionSchema.index({ propertyId: 1, interactionType: 1, createdAt: -1 });
exports.UserInteractionSchema.index({ interactionType: 1, createdAt: -1 });
exports.UserInteractionSchema.index({ source: 1, createdAt: -1 });
exports.UserInteractionSchema.index({ city: 1, interactionType: 1, createdAt: -1 });
exports.UserInteractionSchema.index({ propertyType: 1, interactionType: 1, createdAt: -1 });
exports.UserInteractionSchema.index({ price: 1, interactionType: 1, createdAt: -1 });
exports.UserInteractionSchema.index({ isProcessed: 1, createdAt: -1 });
exports.UserInteractionSchema.index({ batchId: 1 });
exports.UserInteractionSchema.index({ createdAt: 1 }, { expireAfterSeconds: 2 * 365 * 24 * 60 * 60 });
exports.UserInteractionSchema.index({
    userId: 1,
    propertyType: 1,
    interactionType: 1,
    createdAt: -1
});
exports.UserInteractionSchema.index({
    userId: 1,
    city: 1,
    price: 1,
    interactionType: 1,
    createdAt: -1
});
exports.UserInteractionSchema.index({ location: '2dsphere' });
//# sourceMappingURL=user-interaction.schema.js.map