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
exports.schemas = exports.SavedSearchSchema = exports.SavedSearch = exports.ConversationSummarySchema = exports.ConversationSummary = exports.ChatAnalyticsSchema = exports.ChatAnalytics = exports.LeadActivitySchema = exports.LeadActivity = void 0;
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
let LeadActivity = class LeadActivity {
    userId;
    sessionId;
    activityType;
    description;
    metadata;
    impactScore;
    timestamp;
    source;
};
exports.LeadActivity = LeadActivity;
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'User', required: true, index: true }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], LeadActivity.prototype, "userId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String, ref: 'ChatSession', required: true, index: true }),
    __metadata("design:type", String)
], LeadActivity.prototype, "sessionId", void 0);
__decorate([
    (0, mongoose_1.Prop)({
        required: true,
        enum: [
            'message_sent',
            'property_viewed',
            'property_saved',
            'filter_applied',
            'viewing_requested',
            'agent_contacted',
            'budget_mentioned',
            'timeframe_mentioned',
            'refinement_made',
            'search_performed',
            'session_started',
            'session_ended',
            'conversion',
        ],
        index: true
    }),
    __metadata("design:type", String)
], LeadActivity.prototype, "activityType", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String }),
    __metadata("design:type", String)
], LeadActivity.prototype, "description", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Object }),
    __metadata("design:type", Object)
], LeadActivity.prototype, "metadata", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Number, min: 0, max: 100 }),
    __metadata("design:type", Number)
], LeadActivity.prototype, "impactScore", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Date, default: Date.now, index: true }),
    __metadata("design:type", Date)
], LeadActivity.prototype, "timestamp", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String }),
    __metadata("design:type", String)
], LeadActivity.prototype, "source", void 0);
exports.LeadActivity = LeadActivity = __decorate([
    (0, mongoose_1.Schema)({
        timestamps: true,
        collection: 'lead_activities',
    })
], LeadActivity);
exports.LeadActivitySchema = mongoose_1.SchemaFactory.createForClass(LeadActivity);
exports.LeadActivitySchema.index({ userId: 1, timestamp: -1 });
exports.LeadActivitySchema.index({ sessionId: 1, timestamp: -1 });
exports.LeadActivitySchema.index({ activityType: 1, timestamp: -1 });
let ChatAnalytics = class ChatAnalytics {
    date;
    period;
    totalSessions;
    totalMessages;
    uniqueUsers;
    guestSessions;
    authenticatedSessions;
    leadDistribution;
    conversions;
    conversionTypes;
    avgMessagesPerSession;
    avgSessionDuration;
    avgResponseTime;
    topCities;
    topPropertyTypes;
    priceRanges;
    topKeywords;
    propertiesShown;
    propertiesViewed;
    propertiesSaved;
    engagementRate;
    bounceRate;
    languageDistribution;
    deviceDistribution;
    customMetrics;
};
exports.ChatAnalytics = ChatAnalytics;
__decorate([
    (0, mongoose_1.Prop)({ required: true, type: Date, index: true }),
    __metadata("design:type", Date)
], ChatAnalytics.prototype, "date", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String, enum: ['hourly', 'daily', 'weekly', 'monthly'], default: 'daily' }),
    __metadata("design:type", String)
], ChatAnalytics.prototype, "period", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Number, default: 0 }),
    __metadata("design:type", Number)
], ChatAnalytics.prototype, "totalSessions", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Number, default: 0 }),
    __metadata("design:type", Number)
], ChatAnalytics.prototype, "totalMessages", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Number, default: 0 }),
    __metadata("design:type", Number)
], ChatAnalytics.prototype, "uniqueUsers", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Number, default: 0 }),
    __metadata("design:type", Number)
], ChatAnalytics.prototype, "guestSessions", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Number, default: 0 }),
    __metadata("design:type", Number)
], ChatAnalytics.prototype, "authenticatedSessions", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Object, default: {} }),
    __metadata("design:type", Object)
], ChatAnalytics.prototype, "leadDistribution", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Number, default: 0 }),
    __metadata("design:type", Number)
], ChatAnalytics.prototype, "conversions", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Object }),
    __metadata("design:type", Object)
], ChatAnalytics.prototype, "conversionTypes", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Number }),
    __metadata("design:type", Number)
], ChatAnalytics.prototype, "avgMessagesPerSession", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Number }),
    __metadata("design:type", Number)
], ChatAnalytics.prototype, "avgSessionDuration", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Number }),
    __metadata("design:type", Number)
], ChatAnalytics.prototype, "avgResponseTime", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Object }),
    __metadata("design:type", Object)
], ChatAnalytics.prototype, "topCities", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Object }),
    __metadata("design:type", Object)
], ChatAnalytics.prototype, "topPropertyTypes", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Object }),
    __metadata("design:type", Object)
], ChatAnalytics.prototype, "priceRanges", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [String], default: [] }),
    __metadata("design:type", Array)
], ChatAnalytics.prototype, "topKeywords", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Number, default: 0 }),
    __metadata("design:type", Number)
], ChatAnalytics.prototype, "propertiesShown", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Number, default: 0 }),
    __metadata("design:type", Number)
], ChatAnalytics.prototype, "propertiesViewed", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Number, default: 0 }),
    __metadata("design:type", Number)
], ChatAnalytics.prototype, "propertiesSaved", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Number }),
    __metadata("design:type", Number)
], ChatAnalytics.prototype, "engagementRate", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Number }),
    __metadata("design:type", Number)
], ChatAnalytics.prototype, "bounceRate", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Object }),
    __metadata("design:type", Object)
], ChatAnalytics.prototype, "languageDistribution", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Object }),
    __metadata("design:type", Object)
], ChatAnalytics.prototype, "deviceDistribution", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Object }),
    __metadata("design:type", Object)
], ChatAnalytics.prototype, "customMetrics", void 0);
exports.ChatAnalytics = ChatAnalytics = __decorate([
    (0, mongoose_1.Schema)({
        timestamps: true,
        collection: 'chat_analytics',
    })
], ChatAnalytics);
exports.ChatAnalyticsSchema = mongoose_1.SchemaFactory.createForClass(ChatAnalytics);
exports.ChatAnalyticsSchema.index({ date: -1, period: 1 });
let ConversationSummary = class ConversationSummary {
    sessionId;
    userId;
    summary;
    keyPoints;
    userIntent;
    requirements;
    userCategory;
    intentClarityScore;
    recommendedAction;
    tags;
    generationType;
    lastUpdated;
    sentiment;
};
exports.ConversationSummary = ConversationSummary;
__decorate([
    (0, mongoose_1.Prop)({ type: String, ref: 'ChatSession', required: true, unique: true, index: true }),
    __metadata("design:type", String)
], ConversationSummary.prototype, "sessionId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'User', index: true }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], ConversationSummary.prototype, "userId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String, required: true }),
    __metadata("design:type", String)
], ConversationSummary.prototype, "summary", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [String], default: [] }),
    __metadata("design:type", Array)
], ConversationSummary.prototype, "keyPoints", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Object }),
    __metadata("design:type", Object)
], ConversationSummary.prototype, "userIntent", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Object }),
    __metadata("design:type", Object)
], ConversationSummary.prototype, "requirements", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String, enum: ['buyer', 'renter', 'seller', 'landlord', 'browser', 'unknown'], default: 'unknown' }),
    __metadata("design:type", String)
], ConversationSummary.prototype, "userCategory", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Number, min: 0, max: 100 }),
    __metadata("design:type", Number)
], ConversationSummary.prototype, "intentClarityScore", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String }),
    __metadata("design:type", String)
], ConversationSummary.prototype, "recommendedAction", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [String], default: [] }),
    __metadata("design:type", Array)
], ConversationSummary.prototype, "tags", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String, enum: ['auto', 'manual', 'hybrid'], default: 'auto' }),
    __metadata("design:type", String)
], ConversationSummary.prototype, "generationType", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Date }),
    __metadata("design:type", Date)
], ConversationSummary.prototype, "lastUpdated", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Object }),
    __metadata("design:type", Object)
], ConversationSummary.prototype, "sentiment", void 0);
exports.ConversationSummary = ConversationSummary = __decorate([
    (0, mongoose_1.Schema)({
        timestamps: true,
        collection: 'conversation_summaries',
    })
], ConversationSummary);
exports.ConversationSummarySchema = mongoose_1.SchemaFactory.createForClass(ConversationSummary);
exports.ConversationSummarySchema.index({ userId: 1, createdAt: -1 });
exports.ConversationSummarySchema.index({ userCategory: 1 });
let SavedSearch = class SavedSearch {
    userId;
    sessionId;
    name;
    filters;
    isActive;
    notificationsEnabled;
    notificationFrequency;
    lastNotifiedAt;
    matchCount;
    lastMatchAt;
    source;
    metadata;
};
exports.SavedSearch = SavedSearch;
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'User', required: true, index: true }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], SavedSearch.prototype, "userId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String, ref: 'ChatSession', index: true }),
    __metadata("design:type", String)
], SavedSearch.prototype, "sessionId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], SavedSearch.prototype, "name", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Object, required: true }),
    __metadata("design:type", Object)
], SavedSearch.prototype, "filters", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Boolean, default: true }),
    __metadata("design:type", Boolean)
], SavedSearch.prototype, "isActive", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Boolean, default: false }),
    __metadata("design:type", Boolean)
], SavedSearch.prototype, "notificationsEnabled", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String, enum: ['instant', 'daily', 'weekly'], default: 'daily' }),
    __metadata("design:type", String)
], SavedSearch.prototype, "notificationFrequency", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Date }),
    __metadata("design:type", Date)
], SavedSearch.prototype, "lastNotifiedAt", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Number, default: 0 }),
    __metadata("design:type", Number)
], SavedSearch.prototype, "matchCount", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Date }),
    __metadata("design:type", Date)
], SavedSearch.prototype, "lastMatchAt", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String, enum: ['chat', 'manual', 'api'], default: 'chat' }),
    __metadata("design:type", String)
], SavedSearch.prototype, "source", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Object }),
    __metadata("design:type", Object)
], SavedSearch.prototype, "metadata", void 0);
exports.SavedSearch = SavedSearch = __decorate([
    (0, mongoose_1.Schema)({
        timestamps: true,
        collection: 'saved_searches',
    })
], SavedSearch);
exports.SavedSearchSchema = mongoose_1.SchemaFactory.createForClass(SavedSearch);
exports.SavedSearchSchema.index({ userId: 1, isActive: 1 });
exports.SavedSearchSchema.index({ userId: 1, createdAt: -1 });
exports.schemas = [
    { name: LeadActivity.name, schema: exports.LeadActivitySchema },
    { name: ChatAnalytics.name, schema: exports.ChatAnalyticsSchema },
    { name: ConversationSummary.name, schema: exports.ConversationSummarySchema },
    { name: SavedSearch.name, schema: exports.SavedSearchSchema },
];
//# sourceMappingURL=lead-activity.schema.js.map