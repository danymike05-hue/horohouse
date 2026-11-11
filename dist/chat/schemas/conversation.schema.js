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
exports.ConversationSchema = exports.Conversation = void 0;
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
let Conversation = class Conversation {
    _id;
    participants;
    propertyId;
    lastMessage;
    messagesCount;
    typingUsers;
    onlineStatus;
    isArchived;
    archivedAt;
    archivedBy;
    isBlocked;
    blockedBy;
    blockedAt;
    metadata;
    createdAt;
    updatedAt;
};
exports.Conversation = Conversation;
__decorate([
    (0, mongoose_1.Prop)({
        type: [{
                userId: { type: mongoose_2.Types.ObjectId, ref: 'User', required: true },
                unreadCount: { type: Number, default: 0 },
                lastReadAt: { type: Date },
                mutedUntil: { type: Date },
                joinedAt: { type: Date, default: Date.now },
            }],
        required: true,
    }),
    __metadata("design:type", Array)
], Conversation.prototype, "participants", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'Property' }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], Conversation.prototype, "propertyId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Object }),
    __metadata("design:type", Object)
], Conversation.prototype, "lastMessage", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 0 }),
    __metadata("design:type", Number)
], Conversation.prototype, "messagesCount", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Map, of: Boolean, default: {} }),
    __metadata("design:type", Map)
], Conversation.prototype, "typingUsers", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Map, of: String, default: {} }),
    __metadata("design:type", Map)
], Conversation.prototype, "onlineStatus", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: false }),
    __metadata("design:type", Boolean)
], Conversation.prototype, "isArchived", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Date }),
    __metadata("design:type", Date)
], Conversation.prototype, "archivedAt", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [mongoose_2.Types.ObjectId], default: [] }),
    __metadata("design:type", Array)
], Conversation.prototype, "archivedBy", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: false }),
    __metadata("design:type", Boolean)
], Conversation.prototype, "isBlocked", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'User' }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], Conversation.prototype, "blockedBy", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Date }),
    __metadata("design:type", Date)
], Conversation.prototype, "blockedAt", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Object }),
    __metadata("design:type", Object)
], Conversation.prototype, "metadata", void 0);
exports.Conversation = Conversation = __decorate([
    (0, mongoose_1.Schema)({ timestamps: true })
], Conversation);
exports.ConversationSchema = mongoose_1.SchemaFactory.createForClass(Conversation);
exports.ConversationSchema.index({ 'participants.userId': 1 });
exports.ConversationSchema.index({ propertyId: 1 });
exports.ConversationSchema.index({ 'lastMessage.createdAt': -1 });
exports.ConversationSchema.index({ isArchived: 1, 'lastMessage.createdAt': -1 });
exports.ConversationSchema.index({
    'participants.userId': 1,
    propertyId: 1
});
//# sourceMappingURL=conversation.schema.js.map