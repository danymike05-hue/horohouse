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
exports.NotificationSchema = exports.Notification = exports.NotificationType = void 0;
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
var NotificationType;
(function (NotificationType) {
    NotificationType["INQUIRY"] = "inquiry";
    NotificationType["FAVORITE"] = "favorite";
    NotificationType["PROPERTY_UPDATE"] = "property_update";
    NotificationType["MESSAGE"] = "message";
    NotificationType["SYSTEM"] = "system";
    NotificationType["BOOKING_REQUEST"] = "booking_request";
    NotificationType["BOOKING_CONFIRMED"] = "booking_confirmed";
    NotificationType["BOOKING_REJECTED"] = "booking_rejected";
    NotificationType["BOOKING_CANCELLED"] = "booking_cancelled";
    NotificationType["BOOKING_REMINDER"] = "booking_reminder";
    NotificationType["BOOKING_COMPLETED"] = "booking_completed";
    NotificationType["REVIEW_REQUEST"] = "review_request";
    NotificationType["REVIEW_RECEIVED"] = "review_received";
    NotificationType["REVIEW_PUBLISHED"] = "review_published";
    NotificationType["REVIEW_RESPONSE"] = "review_response";
    NotificationType["PAYMENT_RECEIVED"] = "payment_received";
    NotificationType["REFUND_PROCESSED"] = "refund_processed";
})(NotificationType || (exports.NotificationType = NotificationType = {}));
let Notification = class Notification {
    userId;
    type;
    title;
    message;
    read;
    link;
    metadata;
    createdAt;
    updatedAt;
};
exports.Notification = Notification;
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'User', required: true, index: true }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], Notification.prototype, "userId", void 0);
__decorate([
    (0, mongoose_1.Prop)({
        type: String,
        enum: Object.values(NotificationType),
        required: true,
        index: true,
    }),
    __metadata("design:type", String)
], Notification.prototype, "type", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], Notification.prototype, "title", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], Notification.prototype, "message", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: false, index: true }),
    __metadata("design:type", Boolean)
], Notification.prototype, "read", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String }),
    __metadata("design:type", String)
], Notification.prototype, "link", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Object }),
    __metadata("design:type", Object)
], Notification.prototype, "metadata", void 0);
exports.Notification = Notification = __decorate([
    (0, mongoose_1.Schema)({ timestamps: true })
], Notification);
exports.NotificationSchema = mongoose_1.SchemaFactory.createForClass(Notification);
exports.NotificationSchema.index({ userId: 1, read: 1 });
exports.NotificationSchema.index({ userId: 1, createdAt: -1 });
exports.NotificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 2592000 });
exports.NotificationSchema.index({ userId: 1, type: 1, createdAt: -1 });
exports.NotificationSchema.index({ type: 1, 'metadata.checkIn': 1, read: 1 });
//# sourceMappingURL=notification.schema.js.map