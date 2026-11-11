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
exports.ChatSessionSchema = exports.ChatSession = exports.ConversationContextSchema = exports.ConversationContext = exports.SessionMetadataSchema = exports.SessionMetadata = exports.PropertySearchFiltersSchema = exports.PropertySearchFilters = exports.LeadScoreSchema = exports.LeadScore = exports.ChatMessageSchema = exports.ChatMessage = void 0;
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
let ChatMessage = class ChatMessage {
    role;
    content;
    timestamp;
    properties;
    filters;
    confidence;
    method;
};
exports.ChatMessage = ChatMessage;
__decorate([
    (0, mongoose_1.Prop)({ required: true, enum: ['user', 'assistant', 'system'] }),
    __metadata("design:type", String)
], ChatMessage.prototype, "role", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], ChatMessage.prototype, "content", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, type: Date, default: Date.now }),
    __metadata("design:type", Date)
], ChatMessage.prototype, "timestamp", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Object }),
    __metadata("design:type", Array)
], ChatMessage.prototype, "properties", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Object }),
    __metadata("design:type", Object)
], ChatMessage.prototype, "filters", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Number }),
    __metadata("design:type", Number)
], ChatMessage.prototype, "confidence", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String }),
    __metadata("design:type", String)
], ChatMessage.prototype, "method", void 0);
exports.ChatMessage = ChatMessage = __decorate([
    (0, mongoose_1.Schema)({ _id: false })
], ChatMessage);
exports.ChatMessageSchema = mongoose_1.SchemaFactory.createForClass(ChatMessage);
let LeadScore = class LeadScore {
    score;
    classification;
    priority;
    signals;
    nextAction;
    calculatedAt;
    history;
};
exports.LeadScore = LeadScore;
__decorate([
    (0, mongoose_1.Prop)({ required: true, type: Number, min: 0, max: 100 }),
    __metadata("design:type", Number)
], LeadScore.prototype, "score", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, enum: ['hot', 'warm', 'cold'] }),
    __metadata("design:type", String)
], LeadScore.prototype, "classification", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, enum: ['high', 'medium', 'low'] }),
    __metadata("design:type", String)
], LeadScore.prototype, "priority", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [String], default: [] }),
    __metadata("design:type", Array)
], LeadScore.prototype, "signals", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String }),
    __metadata("design:type", String)
], LeadScore.prototype, "nextAction", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Date, default: Date.now }),
    __metadata("design:type", Date)
], LeadScore.prototype, "calculatedAt", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Object }),
    __metadata("design:type", Array)
], LeadScore.prototype, "history", void 0);
exports.LeadScore = LeadScore = __decorate([
    (0, mongoose_1.Schema)({ _id: false })
], LeadScore);
exports.LeadScoreSchema = mongoose_1.SchemaFactory.createForClass(LeadScore);
let PropertySearchFilters = class PropertySearchFilters {
    propertyType;
    listingType;
    city;
    neighborhood;
    minPrice;
    maxPrice;
    bedrooms;
    bathrooms;
    minArea;
    maxArea;
    furnished;
    amenities;
    status;
    additional;
};
exports.PropertySearchFilters = PropertySearchFilters;
__decorate([
    (0, mongoose_1.Prop)({ type: String }),
    __metadata("design:type", String)
], PropertySearchFilters.prototype, "propertyType", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String }),
    __metadata("design:type", String)
], PropertySearchFilters.prototype, "listingType", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String }),
    __metadata("design:type", String)
], PropertySearchFilters.prototype, "city", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String }),
    __metadata("design:type", String)
], PropertySearchFilters.prototype, "neighborhood", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Number }),
    __metadata("design:type", Number)
], PropertySearchFilters.prototype, "minPrice", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Number }),
    __metadata("design:type", Number)
], PropertySearchFilters.prototype, "maxPrice", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Number }),
    __metadata("design:type", Number)
], PropertySearchFilters.prototype, "bedrooms", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Number }),
    __metadata("design:type", Number)
], PropertySearchFilters.prototype, "bathrooms", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Number }),
    __metadata("design:type", Number)
], PropertySearchFilters.prototype, "minArea", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Number }),
    __metadata("design:type", Number)
], PropertySearchFilters.prototype, "maxArea", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Boolean }),
    __metadata("design:type", Boolean)
], PropertySearchFilters.prototype, "furnished", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [String] }),
    __metadata("design:type", Array)
], PropertySearchFilters.prototype, "amenities", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String }),
    __metadata("design:type", String)
], PropertySearchFilters.prototype, "status", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Object }),
    __metadata("design:type", Object)
], PropertySearchFilters.prototype, "additional", void 0);
exports.PropertySearchFilters = PropertySearchFilters = __decorate([
    (0, mongoose_1.Schema)({ _id: false })
], PropertySearchFilters);
exports.PropertySearchFiltersSchema = mongoose_1.SchemaFactory.createForClass(PropertySearchFilters);
let SessionMetadata = class SessionMetadata {
    userAgent;
    ipAddress;
    device;
    platform;
    language;
    referrer;
    location;
};
exports.SessionMetadata = SessionMetadata;
__decorate([
    (0, mongoose_1.Prop)({ type: String }),
    __metadata("design:type", String)
], SessionMetadata.prototype, "userAgent", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String }),
    __metadata("design:type", String)
], SessionMetadata.prototype, "ipAddress", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String }),
    __metadata("design:type", String)
], SessionMetadata.prototype, "device", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String }),
    __metadata("design:type", String)
], SessionMetadata.prototype, "platform", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String }),
    __metadata("design:type", String)
], SessionMetadata.prototype, "language", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String }),
    __metadata("design:type", String)
], SessionMetadata.prototype, "referrer", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Object }),
    __metadata("design:type", Object)
], SessionMetadata.prototype, "location", void 0);
exports.SessionMetadata = SessionMetadata = __decorate([
    (0, mongoose_1.Schema)({ _id: false })
], SessionMetadata);
exports.SessionMetadataSchema = mongoose_1.SchemaFactory.createForClass(SessionMetadata);
let ConversationContext = class ConversationContext {
    primaryIntent;
    topicsDiscussed;
    propertiesViewed;
    propertiesSaved;
    questionsAsked;
    refinements;
    mentionedBudget;
    mentionedTimeframe;
    askedForViewing;
    askedForAgent;
    preferredLanguage;
    userPreferences;
};
exports.ConversationContext = ConversationContext;
__decorate([
    (0, mongoose_1.Prop)({ type: String }),
    __metadata("design:type", String)
], ConversationContext.prototype, "primaryIntent", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [String], default: [] }),
    __metadata("design:type", Array)
], ConversationContext.prototype, "topicsDiscussed", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [String], default: [] }),
    __metadata("design:type", Array)
], ConversationContext.prototype, "propertiesViewed", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [String], default: [] }),
    __metadata("design:type", Array)
], ConversationContext.prototype, "propertiesSaved", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Number, default: 0 }),
    __metadata("design:type", Number)
], ConversationContext.prototype, "questionsAsked", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Number, default: 0 }),
    __metadata("design:type", Number)
], ConversationContext.prototype, "refinements", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Boolean, default: false }),
    __metadata("design:type", Boolean)
], ConversationContext.prototype, "mentionedBudget", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Boolean, default: false }),
    __metadata("design:type", Boolean)
], ConversationContext.prototype, "mentionedTimeframe", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Boolean, default: false }),
    __metadata("design:type", Boolean)
], ConversationContext.prototype, "askedForViewing", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Boolean, default: false }),
    __metadata("design:type", Boolean)
], ConversationContext.prototype, "askedForAgent", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String }),
    __metadata("design:type", String)
], ConversationContext.prototype, "preferredLanguage", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Object }),
    __metadata("design:type", Object)
], ConversationContext.prototype, "userPreferences", void 0);
exports.ConversationContext = ConversationContext = __decorate([
    (0, mongoose_1.Schema)({ _id: false })
], ConversationContext);
exports.ConversationContextSchema = mongoose_1.SchemaFactory.createForClass(ConversationContext);
let ChatSession = class ChatSession {
    sessionId;
    userId;
    userType;
    messages;
    currentFilters;
    leadScore;
    context;
    metadata;
    status;
    lastActiveAt;
    convertedAt;
    conversionType;
    messageCount;
    propertiesShown;
    isTestSession;
    analytics;
    tags;
    notes;
    expiresAt;
};
exports.ChatSession = ChatSession;
__decorate([
    (0, mongoose_1.Prop)({ required: true, unique: true, index: true }),
    __metadata("design:type", String)
], ChatSession.prototype, "sessionId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'User', index: true }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], ChatSession.prototype, "userId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String, default: 'guest' }),
    __metadata("design:type", String)
], ChatSession.prototype, "userType", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [exports.ChatMessageSchema], default: [] }),
    __metadata("design:type", Array)
], ChatSession.prototype, "messages", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: exports.PropertySearchFiltersSchema }),
    __metadata("design:type", PropertySearchFilters)
], ChatSession.prototype, "currentFilters", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: exports.LeadScoreSchema }),
    __metadata("design:type", LeadScore)
], ChatSession.prototype, "leadScore", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: exports.ConversationContextSchema, default: {} }),
    __metadata("design:type", ConversationContext)
], ChatSession.prototype, "context", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: exports.SessionMetadataSchema }),
    __metadata("design:type", SessionMetadata)
], ChatSession.prototype, "metadata", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String, enum: ['active', 'idle', 'closed', 'converted'], default: 'active', index: true }),
    __metadata("design:type", String)
], ChatSession.prototype, "status", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Date, index: true }),
    __metadata("design:type", Date)
], ChatSession.prototype, "lastActiveAt", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Date }),
    __metadata("design:type", Date)
], ChatSession.prototype, "convertedAt", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String }),
    __metadata("design:type", String)
], ChatSession.prototype, "conversionType", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Number, default: 1 }),
    __metadata("design:type", Number)
], ChatSession.prototype, "messageCount", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Number, default: 0 }),
    __metadata("design:type", Number)
], ChatSession.prototype, "propertiesShown", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Boolean, default: false }),
    __metadata("design:type", Boolean)
], ChatSession.prototype, "isTestSession", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Object }),
    __metadata("design:type", Object)
], ChatSession.prototype, "analytics", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [String], default: [] }),
    __metadata("design:type", Array)
], ChatSession.prototype, "tags", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String }),
    __metadata("design:type", String)
], ChatSession.prototype, "notes", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Date, index: { expires: '30d' } }),
    __metadata("design:type", Date)
], ChatSession.prototype, "expiresAt", void 0);
exports.ChatSession = ChatSession = __decorate([
    (0, mongoose_1.Schema)({
        timestamps: true,
        collection: 'chat_sessions',
    })
], ChatSession);
exports.ChatSessionSchema = mongoose_1.SchemaFactory.createForClass(ChatSession);
exports.ChatSessionSchema.index({ userId: 1, createdAt: -1 });
exports.ChatSessionSchema.index({ 'leadScore.classification': 1, status: 1 });
exports.ChatSessionSchema.index({ status: 1, lastActiveAt: -1 });
exports.ChatSessionSchema.index({ sessionId: 1, userId: 1 });
exports.ChatSessionSchema.index({ createdAt: -1 });
exports.ChatSessionSchema.virtual('duration').get(function () {
    if (this.messages.length < 2)
        return 0;
    const first = this.messages[0].timestamp;
    const last = this.messages[this.messages.length - 1].timestamp;
    return last.getTime() - first.getTime();
});
exports.ChatSessionSchema.methods.addMessage = function (message) {
    this.messages.push(message);
    this.messageCount = this.messages.length;
    this.lastActiveAt = new Date();
    if (this.messages.length > 50) {
        this.messages = this.messages.slice(-50);
    }
};
exports.ChatSessionSchema.methods.updateLeadScore = function (leadScore) {
    if (!this.leadScore) {
        this.leadScore = leadScore;
        this.leadScore.history = [];
    }
    else {
        if (!this.leadScore.history) {
            this.leadScore.history = [];
        }
        this.leadScore.history.push({
            score: this.leadScore.score,
            classification: this.leadScore.classification,
            timestamp: this.leadScore.calculatedAt,
        });
    }
    Object.assign(this.leadScore, leadScore);
    this.leadScore.calculatedAt = new Date();
};
exports.ChatSessionSchema.methods.markAsConverted = function (conversionType) {
    this.status = 'converted';
    this.convertedAt = new Date();
    this.conversionType = conversionType;
};
exports.ChatSessionSchema.statics.findHotLeads = function (limit = 20) {
    return this.find({
        'leadScore.classification': 'hot',
        status: { $in: ['active', 'idle'] },
    })
        .sort({ 'leadScore.score': -1, lastActiveAt: -1 })
        .limit(limit)
        .populate('userId', 'name email phoneNumber profilePicture')
        .exec();
};
exports.ChatSessionSchema.statics.findActiveSessions = function (hours = 24) {
    const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);
    return this.find({
        status: 'active',
        lastActiveAt: { $gte: cutoffTime },
    })
        .sort({ lastActiveAt: -1 })
        .exec();
};
exports.ChatSessionSchema.statics.getStats = async function () {
    const stats = await this.aggregate([
        {
            $facet: {
                total: [{ $count: 'count' }],
                byStatus: [
                    { $group: { _id: '$status', count: { $sum: 1 } } }
                ],
                byLeadClass: [
                    { $group: { _id: '$leadScore.classification', count: { $sum: 1 } } }
                ],
                avgMessages: [
                    { $group: { _id: null, avg: { $avg: '$messageCount' } } }
                ],
                recentActivity: [
                    { $match: { lastActiveAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } } },
                    { $count: 'count' }
                ]
            }
        }
    ]);
    return stats[0];
};
//# sourceMappingURL=chat-session.schema.js.map