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
exports.HistorySchema = exports.History = exports.ActivityType = void 0;
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
var ActivityType;
(function (ActivityType) {
    ActivityType["PROPERTY_VIEW"] = "property_view";
    ActivityType["SEARCH"] = "search";
    ActivityType["FAVORITE_ADD"] = "favorite_add";
    ActivityType["FAVORITE_REMOVE"] = "favorite_remove";
    ActivityType["PROPERTY_INQUIRY"] = "property_inquiry";
    ActivityType["PROFILE_UPDATE"] = "profile_update";
    ActivityType["LOGIN"] = "login";
    ActivityType["LOGOUT"] = "logout";
    ActivityType["PROPERTY_SHARE"] = "property_share";
    ActivityType["AGENT_CONTACT"] = "agent_contact";
    ActivityType["PROPERTY_FAVORITE"] = "property_favorite";
    ActivityType["PROPERTY_SEARCH"] = "property_search";
})(ActivityType || (exports.ActivityType = ActivityType = {}));
let History = class History {
    userId;
    activityType;
    propertyId;
    agentId;
    searchQuery;
    searchFilters;
    resultsCount;
    resultsClicked;
    userLocation;
    searchLocation;
    city;
    country;
    sessionId;
    ipAddress;
    deviceInfo;
    referrer;
    source;
    utmSource;
    utmMedium;
    utmCampaign;
    viewDuration;
    viewedImages;
    scrollDepth;
    contactedAgent;
    metadata;
    tags;
    inquiryMessage;
    inquiryPhone;
    inquiryEmail;
    anonymousId;
    createdAt;
    updatedAt;
};
exports.History = History;
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'User' }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], History.prototype, "userId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String, enum: ActivityType, required: true }),
    __metadata("design:type", String)
], History.prototype, "activityType", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'Property' }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], History.prototype, "propertyId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'User' }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], History.prototype, "agentId", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], History.prototype, "searchQuery", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Object }),
    __metadata("design:type", Object)
], History.prototype, "searchFilters", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Number)
], History.prototype, "resultsCount", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Number)
], History.prototype, "resultsClicked", void 0);
__decorate([
    (0, mongoose_1.Prop)({
        type: {
            type: String,
            enum: ['Point'],
        },
        coordinates: {
            type: [Number],
        },
    }),
    __metadata("design:type", Object)
], History.prototype, "userLocation", void 0);
__decorate([
    (0, mongoose_1.Prop)({
        type: {
            type: String,
            enum: ['Point'],
        },
        coordinates: {
            type: [Number],
        },
    }),
    __metadata("design:type", Object)
], History.prototype, "searchLocation", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], History.prototype, "city", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], History.prototype, "country", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], History.prototype, "sessionId", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], History.prototype, "ipAddress", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Object }),
    __metadata("design:type", Object)
], History.prototype, "deviceInfo", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], History.prototype, "referrer", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], History.prototype, "source", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], History.prototype, "utmSource", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], History.prototype, "utmMedium", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], History.prototype, "utmCampaign", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Number)
], History.prototype, "viewDuration", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [String] }),
    __metadata("design:type", Array)
], History.prototype, "viewedImages", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Number)
], History.prototype, "scrollDepth", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Boolean)
], History.prototype, "contactedAgent", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Object, default: {} }),
    __metadata("design:type", Object)
], History.prototype, "metadata", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [String] }),
    __metadata("design:type", Array)
], History.prototype, "tags", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], History.prototype, "inquiryMessage", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], History.prototype, "inquiryPhone", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], History.prototype, "inquiryEmail", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], History.prototype, "anonymousId", void 0);
exports.History = History = __decorate([
    (0, mongoose_1.Schema)({ timestamps: true })
], History);
exports.HistorySchema = mongoose_1.SchemaFactory.createForClass(History);
exports.HistorySchema.index({ userId: 1, activityType: 1, createdAt: -1 });
exports.HistorySchema.index({ propertyId: 1, activityType: 1, createdAt: -1 });
exports.HistorySchema.index({ city: 1, activityType: 1, createdAt: -1 });
exports.HistorySchema.index({ createdAt: -1 });
exports.HistorySchema.index({ sessionId: 1 });
exports.HistorySchema.index({ anonymousId: 1 });
exports.HistorySchema.index({ agentId: 1, activityType: 1, createdAt: -1 });
exports.HistorySchema.index({ userLocation: '2dsphere' });
exports.HistorySchema.index({ searchLocation: '2dsphere' });
exports.HistorySchema.index({
    activityType: 1,
    createdAt: -1,
    city: 1
});
//# sourceMappingURL=history.schema.js.map