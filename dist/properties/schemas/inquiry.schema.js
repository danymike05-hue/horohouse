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
exports.InquirySchema = exports.Inquiry = exports.InquiryType = exports.InquiryStatus = void 0;
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
var InquiryStatus;
(function (InquiryStatus) {
    InquiryStatus["PENDING"] = "pending";
    InquiryStatus["RESPONDED"] = "responded";
    InquiryStatus["CLOSED"] = "closed";
})(InquiryStatus || (exports.InquiryStatus = InquiryStatus = {}));
var InquiryType;
(function (InquiryType) {
    InquiryType["GENERAL"] = "general";
    InquiryType["VIEWING_REQUEST"] = "viewing_request";
    InquiryType["PRICE_INQUIRY"] = "price_inquiry";
    InquiryType["AVAILABILITY"] = "availability";
    InquiryType["MORE_INFO"] = "more_info";
})(InquiryType || (exports.InquiryType = InquiryType = {}));
let Inquiry = class Inquiry {
    propertyId;
    userId;
    agentId;
    message;
    type;
    status;
    response;
    respondedAt;
    respondedBy;
    preferredContactMethod;
    preferredContactTime;
    viewingDate;
    budget;
    moveInDate;
    contactEmail;
    contactPhone;
    isRead;
    readAt;
    createdAt;
    updatedAt;
};
exports.Inquiry = Inquiry;
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'Property', required: true }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], Inquiry.prototype, "propertyId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'User', required: true }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], Inquiry.prototype, "userId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'User', required: true }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], Inquiry.prototype, "agentId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, trim: true }),
    __metadata("design:type", String)
], Inquiry.prototype, "message", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String, enum: InquiryType, default: InquiryType.GENERAL }),
    __metadata("design:type", String)
], Inquiry.prototype, "type", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String, enum: InquiryStatus, default: InquiryStatus.PENDING }),
    __metadata("design:type", String)
], Inquiry.prototype, "status", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], Inquiry.prototype, "response", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Date)
], Inquiry.prototype, "respondedAt", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'User' }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], Inquiry.prototype, "respondedBy", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], Inquiry.prototype, "preferredContactMethod", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], Inquiry.prototype, "preferredContactTime", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Date)
], Inquiry.prototype, "viewingDate", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Number)
], Inquiry.prototype, "budget", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Date)
], Inquiry.prototype, "moveInDate", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], Inquiry.prototype, "contactEmail", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], Inquiry.prototype, "contactPhone", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: false }),
    __metadata("design:type", Boolean)
], Inquiry.prototype, "isRead", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Date)
], Inquiry.prototype, "readAt", void 0);
exports.Inquiry = Inquiry = __decorate([
    (0, mongoose_1.Schema)({ timestamps: true })
], Inquiry);
exports.InquirySchema = mongoose_1.SchemaFactory.createForClass(Inquiry);
exports.InquirySchema.index({ propertyId: 1, createdAt: -1 });
exports.InquirySchema.index({ agentId: 1, status: 1, createdAt: -1 });
exports.InquirySchema.index({ userId: 1, createdAt: -1 });
exports.InquirySchema.index({ status: 1, createdAt: -1 });
//# sourceMappingURL=inquiry.schema.js.map