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
exports.CheckoutPaymentSchema = exports.CheckoutPayment = exports.CHECKOUT_STATUSES = exports.CHECKOUT_METHODS = void 0;
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
exports.CHECKOUT_METHODS = ['mobile_money', 'card', 'wallet', 'plan_credit'];
exports.CHECKOUT_STATUSES = ['pending', 'paid', 'failed', 'expired'];
let CheckoutPayment = class CheckoutPayment {
    purpose;
    bookingId;
    purchase;
    purchaseKey;
    userId;
    method;
    operator;
    phone;
    amount;
    currency;
    status;
    merchantInvoiceId;
    providerReference;
    providerStatus;
    payUrl;
    appReturnUrl;
    expiresAt;
    paidAt;
    failedAt;
    expiredAt;
    refundedAt;
    fulfilledAt;
    fulfillingAt;
    lastWebhookAt;
    failureReason;
    needsReview;
    reviewReason;
    reviewState;
    reviewResolution;
    refundAmount;
    reviewNote;
    reviewedBy;
    reviewedByName;
    reviewedAt;
    reviewError;
    createdAt;
    updatedAt;
};
exports.CheckoutPayment = CheckoutPayment;
__decorate([
    (0, mongoose_1.Prop)({ type: String, enum: ['booking', 'subscription', 'boost'], default: 'booking', index: true }),
    __metadata("design:type", String)
], CheckoutPayment.prototype, "purpose", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, index: true }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], CheckoutPayment.prototype, "bookingId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Object }),
    __metadata("design:type", Object)
], CheckoutPayment.prototype, "purchase", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String }),
    __metadata("design:type", String)
], CheckoutPayment.prototype, "purchaseKey", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, required: true, index: true }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], CheckoutPayment.prototype, "userId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String, enum: exports.CHECKOUT_METHODS, required: true }),
    __metadata("design:type", String)
], CheckoutPayment.prototype, "method", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String, enum: ['orange_money', 'mtn_momo'] }),
    __metadata("design:type", String)
], CheckoutPayment.prototype, "operator", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String }),
    __metadata("design:type", String)
], CheckoutPayment.prototype, "phone", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Number, required: true, min: 0 }),
    __metadata("design:type", Number)
], CheckoutPayment.prototype, "amount", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String, enum: ['XAF'], default: 'XAF' }),
    __metadata("design:type", String)
], CheckoutPayment.prototype, "currency", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String, enum: exports.CHECKOUT_STATUSES, default: 'pending', index: true }),
    __metadata("design:type", String)
], CheckoutPayment.prototype, "status", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String, required: true, unique: true }),
    __metadata("design:type", String)
], CheckoutPayment.prototype, "merchantInvoiceId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String }),
    __metadata("design:type", String)
], CheckoutPayment.prototype, "providerReference", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String }),
    __metadata("design:type", String)
], CheckoutPayment.prototype, "providerStatus", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String }),
    __metadata("design:type", String)
], CheckoutPayment.prototype, "payUrl", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String }),
    __metadata("design:type", String)
], CheckoutPayment.prototype, "appReturnUrl", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Date, required: true }),
    __metadata("design:type", Date)
], CheckoutPayment.prototype, "expiresAt", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Date }),
    __metadata("design:type", Date)
], CheckoutPayment.prototype, "paidAt", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Date }),
    __metadata("design:type", Date)
], CheckoutPayment.prototype, "failedAt", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Date }),
    __metadata("design:type", Date)
], CheckoutPayment.prototype, "expiredAt", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Date }),
    __metadata("design:type", Date)
], CheckoutPayment.prototype, "refundedAt", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Date }),
    __metadata("design:type", Date)
], CheckoutPayment.prototype, "fulfilledAt", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Date }),
    __metadata("design:type", Date)
], CheckoutPayment.prototype, "fulfillingAt", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Date }),
    __metadata("design:type", Date)
], CheckoutPayment.prototype, "lastWebhookAt", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String }),
    __metadata("design:type", String)
], CheckoutPayment.prototype, "failureReason", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Boolean, default: false, index: true }),
    __metadata("design:type", Boolean)
], CheckoutPayment.prototype, "needsReview", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String }),
    __metadata("design:type", String)
], CheckoutPayment.prototype, "reviewReason", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String, enum: ['open', 'refunding', 'resolved'] }),
    __metadata("design:type", String)
], CheckoutPayment.prototype, "reviewState", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String, enum: ['refunded_camerpay', 'refunded_manually', 'no_refund_needed'] }),
    __metadata("design:type", String)
], CheckoutPayment.prototype, "reviewResolution", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Number }),
    __metadata("design:type", Number)
], CheckoutPayment.prototype, "refundAmount", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String }),
    __metadata("design:type", String)
], CheckoutPayment.prototype, "reviewNote", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], CheckoutPayment.prototype, "reviewedBy", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String }),
    __metadata("design:type", String)
], CheckoutPayment.prototype, "reviewedByName", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Date }),
    __metadata("design:type", Date)
], CheckoutPayment.prototype, "reviewedAt", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String }),
    __metadata("design:type", String)
], CheckoutPayment.prototype, "reviewError", void 0);
exports.CheckoutPayment = CheckoutPayment = __decorate([
    (0, mongoose_1.Schema)({ collection: 'checkout_payments', timestamps: true })
], CheckoutPayment);
exports.CheckoutPaymentSchema = mongoose_1.SchemaFactory.createForClass(CheckoutPayment);
exports.CheckoutPaymentSchema.index({ providerReference: 1 }, { unique: true, sparse: true });
exports.CheckoutPaymentSchema.index({ status: 1, expiresAt: 1 });
exports.CheckoutPaymentSchema.index({ reviewState: 1, reviewedAt: -1 }, { sparse: true });
exports.CheckoutPaymentSchema.index({ bookingId: 1 }, {
    unique: true,
    partialFilterExpression: { status: 'pending', bookingId: { $exists: true } },
    name: 'one_pending_per_booking_v2',
});
exports.CheckoutPaymentSchema.index({ purchaseKey: 1 }, {
    unique: true,
    partialFilterExpression: { status: 'pending', purchaseKey: { $exists: true } },
    name: 'one_pending_per_purchase',
});
//# sourceMappingURL=checkout-payment.schema.js.map