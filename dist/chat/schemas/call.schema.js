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
exports.CallSchema = exports.Call = exports.CallEndReason = exports.CallStatus = exports.CallType = void 0;
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
var CallType;
(function (CallType) {
    CallType["AUDIO"] = "audio";
    CallType["VIDEO"] = "video";
})(CallType || (exports.CallType = CallType = {}));
var CallStatus;
(function (CallStatus) {
    CallStatus["INITIATING"] = "initiating";
    CallStatus["RINGING"] = "ringing";
    CallStatus["CONNECTING"] = "connecting";
    CallStatus["CONNECTED"] = "connected";
    CallStatus["ENDED"] = "ended";
    CallStatus["DECLINED"] = "declined";
    CallStatus["MISSED"] = "missed";
    CallStatus["FAILED"] = "failed";
    CallStatus["CANCELLED"] = "cancelled";
})(CallStatus || (exports.CallStatus = CallStatus = {}));
var CallEndReason;
(function (CallEndReason) {
    CallEndReason["COMPLETED"] = "completed";
    CallEndReason["DECLINED"] = "declined";
    CallEndReason["MISSED"] = "missed";
    CallEndReason["CANCELLED"] = "cancelled";
    CallEndReason["FAILED"] = "failed";
    CallEndReason["BUSY"] = "busy";
    CallEndReason["NO_ANSWER"] = "no_answer";
})(CallEndReason || (exports.CallEndReason = CallEndReason = {}));
let Call = class Call {
    _id;
    conversationId;
    initiatorId;
    recipientId;
    type;
    status;
    participants;
    startedAt;
    endedAt;
    duration;
    endReason;
    quality;
    metadata;
    createdAt;
    updatedAt;
};
exports.Call = Call;
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'Conversation', required: true, index: true }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], Call.prototype, "conversationId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'User', required: true, index: true }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], Call.prototype, "initiatorId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'User', required: true, index: true }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], Call.prototype, "recipientId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String, enum: CallType, required: true }),
    __metadata("design:type", String)
], Call.prototype, "type", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String, enum: CallStatus, default: CallStatus.INITIATING }),
    __metadata("design:type", String)
], Call.prototype, "status", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [Object], default: [] }),
    __metadata("design:type", Array)
], Call.prototype, "participants", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Date }),
    __metadata("design:type", Date)
], Call.prototype, "startedAt", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Date }),
    __metadata("design:type", Date)
], Call.prototype, "endedAt", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Number, default: 0 }),
    __metadata("design:type", Number)
], Call.prototype, "duration", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String, enum: CallEndReason }),
    __metadata("design:type", String)
], Call.prototype, "endReason", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Object }),
    __metadata("design:type", Object)
], Call.prototype, "quality", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Object }),
    __metadata("design:type", Object)
], Call.prototype, "metadata", void 0);
exports.Call = Call = __decorate([
    (0, mongoose_1.Schema)({ timestamps: true })
], Call);
exports.CallSchema = mongoose_1.SchemaFactory.createForClass(Call);
exports.CallSchema.index({ conversationId: 1, createdAt: -1 });
exports.CallSchema.index({ initiatorId: 1, status: 1 });
exports.CallSchema.index({ recipientId: 1, status: 1 });
exports.CallSchema.index({ status: 1, createdAt: -1 });
//# sourceMappingURL=call.schema.js.map