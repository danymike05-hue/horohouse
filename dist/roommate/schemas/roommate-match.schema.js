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
exports.RoommateMatchSchema = exports.RoommateMatch = void 0;
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const roommate_profile_schema_1 = require("./roommate-profile.schema");
let RoommateMatch = class RoommateMatch {
    initiatorId;
    receiverId;
    initiatorProfileId;
    receiverProfileId;
    status;
    compatibilityScore;
    chatRoomId;
    matchedAt;
    expiresAt;
    createdAt;
    updatedAt;
};
exports.RoommateMatch = RoommateMatch;
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'User', required: true, index: true }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], RoommateMatch.prototype, "initiatorId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'User', required: true, index: true }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], RoommateMatch.prototype, "receiverId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'RoommateProfile', required: true }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], RoommateMatch.prototype, "initiatorProfileId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'RoommateProfile', required: true }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], RoommateMatch.prototype, "receiverProfileId", void 0);
__decorate([
    (0, mongoose_1.Prop)({
        type: String,
        enum: Object.values(roommate_profile_schema_1.MatchStatus),
        default: roommate_profile_schema_1.MatchStatus.PENDING,
        index: true,
    }),
    __metadata("design:type", String)
], RoommateMatch.prototype, "status", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 0, min: 0, max: 100 }),
    __metadata("design:type", Number)
], RoommateMatch.prototype, "compatibilityScore", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'ChatRoom', sparse: true }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], RoommateMatch.prototype, "chatRoomId", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Date)
], RoommateMatch.prototype, "matchedAt", void 0);
__decorate([
    (0, mongoose_1.Prop)({ index: true }),
    __metadata("design:type", Date)
], RoommateMatch.prototype, "expiresAt", void 0);
exports.RoommateMatch = RoommateMatch = __decorate([
    (0, mongoose_1.Schema)({ timestamps: true })
], RoommateMatch);
exports.RoommateMatchSchema = mongoose_1.SchemaFactory.createForClass(RoommateMatch);
exports.RoommateMatchSchema.index({ initiatorId: 1, receiverId: 1 }, { unique: true, partialFilterExpression: { status: roommate_profile_schema_1.MatchStatus.PENDING } });
exports.RoommateMatchSchema.index({ receiverId: 1, status: 1, createdAt: -1 });
exports.RoommateMatchSchema.index({ initiatorId: 1, status: 1, createdAt: -1 });
exports.RoommateMatchSchema.index({ status: 1, expiresAt: 1 });
//# sourceMappingURL=roommate-match.schema.js.map