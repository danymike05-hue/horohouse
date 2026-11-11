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
exports.HostMessageDeliverySchema = exports.HostMessageDelivery = exports.HostMessageTemplateSchema = exports.HostMessageTemplate = exports.MessageTrigger = exports.TemplateKind = void 0;
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
var TemplateKind;
(function (TemplateKind) {
    TemplateKind["QUICK_REPLY"] = "quick_reply";
    TemplateKind["SCHEDULED"] = "scheduled";
})(TemplateKind || (exports.TemplateKind = TemplateKind = {}));
var MessageTrigger;
(function (MessageTrigger) {
    MessageTrigger["BOOKING_CONFIRMED"] = "booking_confirmed";
    MessageTrigger["BEFORE_CHECKIN"] = "before_checkin";
    MessageTrigger["CHECKIN_DAY"] = "checkin_day";
    MessageTrigger["BEFORE_CHECKOUT"] = "before_checkout";
    MessageTrigger["AFTER_CHECKOUT"] = "after_checkout";
})(MessageTrigger || (exports.MessageTrigger = MessageTrigger = {}));
let HostMessageTemplate = class HostMessageTemplate {
    _id;
    hostId;
    kind;
    title;
    body;
    trigger;
    daysOffset;
    sendTime;
    propertyIds;
    isActive;
    createdAt;
    updatedAt;
};
exports.HostMessageTemplate = HostMessageTemplate;
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'User', required: true, index: true }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], HostMessageTemplate.prototype, "hostId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String, enum: Object.values(TemplateKind), required: true }),
    __metadata("design:type", String)
], HostMessageTemplate.prototype, "kind", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String, required: true, maxlength: 60 }),
    __metadata("design:type", String)
], HostMessageTemplate.prototype, "title", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String, required: true, maxlength: 2000 }),
    __metadata("design:type", String)
], HostMessageTemplate.prototype, "body", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String, enum: Object.values(MessageTrigger) }),
    __metadata("design:type", String)
], HostMessageTemplate.prototype, "trigger", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Number, default: 1, min: 0, max: 14 }),
    __metadata("design:type", Number)
], HostMessageTemplate.prototype, "daysOffset", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String, default: '10:00' }),
    __metadata("design:type", String)
], HostMessageTemplate.prototype, "sendTime", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [mongoose_2.Types.ObjectId], ref: 'Property', default: [] }),
    __metadata("design:type", Array)
], HostMessageTemplate.prototype, "propertyIds", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: true }),
    __metadata("design:type", Boolean)
], HostMessageTemplate.prototype, "isActive", void 0);
exports.HostMessageTemplate = HostMessageTemplate = __decorate([
    (0, mongoose_1.Schema)({ timestamps: true, collection: 'host_message_templates' })
], HostMessageTemplate);
exports.HostMessageTemplateSchema = mongoose_1.SchemaFactory.createForClass(HostMessageTemplate);
exports.HostMessageTemplateSchema.index({ kind: 1, isActive: 1 });
let HostMessageDelivery = class HostMessageDelivery {
    _id;
    templateId;
    bookingId;
    hostId;
    guestId;
    title;
    body;
    sentAt;
    createdAt;
};
exports.HostMessageDelivery = HostMessageDelivery;
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'HostMessageTemplate', required: true }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], HostMessageDelivery.prototype, "templateId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'Booking', required: true, index: true }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], HostMessageDelivery.prototype, "bookingId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'User', required: true }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], HostMessageDelivery.prototype, "hostId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'User', required: true }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], HostMessageDelivery.prototype, "guestId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String, required: true }),
    __metadata("design:type", String)
], HostMessageDelivery.prototype, "title", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String, required: true }),
    __metadata("design:type", String)
], HostMessageDelivery.prototype, "body", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Date, required: true }),
    __metadata("design:type", Date)
], HostMessageDelivery.prototype, "sentAt", void 0);
exports.HostMessageDelivery = HostMessageDelivery = __decorate([
    (0, mongoose_1.Schema)({ timestamps: true, collection: 'host_message_deliveries' })
], HostMessageDelivery);
exports.HostMessageDeliverySchema = mongoose_1.SchemaFactory.createForClass(HostMessageDelivery);
exports.HostMessageDeliverySchema.index({ templateId: 1, bookingId: 1 }, { unique: true });
//# sourceMappingURL=host-message.schema.js.map