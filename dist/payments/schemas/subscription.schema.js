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
exports.SubscriptionSchema = exports.Subscription = exports.SubscriptionStatus = exports.SubscriptionPlan = exports.BillingCycle = void 0;
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
var BillingCycle;
(function (BillingCycle) {
    BillingCycle["WEEKLY"] = "weekly";
    BillingCycle["MONTHLY"] = "monthly";
    BillingCycle["QUARTERLY"] = "quarterly";
    BillingCycle["YEARLY"] = "yearly";
})(BillingCycle || (exports.BillingCycle = BillingCycle = {}));
var SubscriptionPlan;
(function (SubscriptionPlan) {
    SubscriptionPlan["STUDENT_FREE"] = "student_free";
    SubscriptionPlan["USER_FREE"] = "user_free";
    SubscriptionPlan["USER_PREMIUM"] = "user_premium";
    SubscriptionPlan["AGENT_FREE"] = "agent_free";
    SubscriptionPlan["AGENT_BASIC"] = "agent_basic";
    SubscriptionPlan["AGENT_PRO"] = "agent_pro";
    SubscriptionPlan["AGENT_ELITE"] = "agent_elite";
    SubscriptionPlan["LANDLORD_FREE"] = "landlord_free";
    SubscriptionPlan["LANDLORD_BASIC"] = "landlord_basic";
    SubscriptionPlan["LANDLORD_PRO"] = "landlord_pro";
    SubscriptionPlan["HOST_FREE"] = "host_free";
    SubscriptionPlan["HOST_STARTER"] = "host_starter";
    SubscriptionPlan["HOST_GROWTH"] = "host_growth";
    SubscriptionPlan["HOST_PRO"] = "host_pro";
    SubscriptionPlan["HOST_ELITE"] = "host_elite";
})(SubscriptionPlan || (exports.SubscriptionPlan = SubscriptionPlan = {}));
var SubscriptionStatus;
(function (SubscriptionStatus) {
    SubscriptionStatus["PENDING"] = "pending";
    SubscriptionStatus["ACTIVE"] = "active";
    SubscriptionStatus["EXPIRED"] = "expired";
    SubscriptionStatus["CANCELLED"] = "cancelled";
    SubscriptionStatus["SUSPENDED"] = "suspended";
})(SubscriptionStatus || (exports.SubscriptionStatus = SubscriptionStatus = {}));
let Subscription = class Subscription {
    userId;
    plan;
    status;
    billingCycle;
    price;
    currency;
    features;
    startDate;
    endDate;
    nextBillingDate;
    autoRenew;
    listingsUsed;
    boostsUsed;
    lastPaymentTransactionId;
    lastPaymentDate;
    cancelledAt;
    cancellationReason;
    scheduledCancellationDate;
    previousSubscriptionId;
    upgradedFrom;
    providerSubscriptionId;
    metadata;
    createdAt;
    updatedAt;
};
exports.Subscription = Subscription;
__decorate([
    (0, mongoose_1.Prop)({ required: true, type: mongoose_2.Types.ObjectId, ref: 'User' }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], Subscription.prototype, "userId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, type: String, enum: SubscriptionPlan }),
    __metadata("design:type", String)
], Subscription.prototype, "plan", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, type: String, enum: SubscriptionStatus, default: SubscriptionStatus.PENDING }),
    __metadata("design:type", String)
], Subscription.prototype, "status", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String, enum: BillingCycle, required: true }),
    __metadata("design:type", String)
], Subscription.prototype, "billingCycle", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", Number)
], Subscription.prototype, "price", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 'XAF' }),
    __metadata("design:type", String)
], Subscription.prototype, "currency", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Object, required: true }),
    __metadata("design:type", Object)
], Subscription.prototype, "features", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Date)
], Subscription.prototype, "startDate", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Date)
], Subscription.prototype, "endDate", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Date)
], Subscription.prototype, "nextBillingDate", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: true }),
    __metadata("design:type", Boolean)
], Subscription.prototype, "autoRenew", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 0 }),
    __metadata("design:type", Number)
], Subscription.prototype, "listingsUsed", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 0 }),
    __metadata("design:type", Number)
], Subscription.prototype, "boostsUsed", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'Transaction' }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], Subscription.prototype, "lastPaymentTransactionId", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Date)
], Subscription.prototype, "lastPaymentDate", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Date)
], Subscription.prototype, "cancelledAt", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], Subscription.prototype, "cancellationReason", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Date)
], Subscription.prototype, "scheduledCancellationDate", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'Subscription' }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], Subscription.prototype, "previousSubscriptionId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String, enum: SubscriptionPlan }),
    __metadata("design:type", String)
], Subscription.prototype, "upgradedFrom", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], Subscription.prototype, "providerSubscriptionId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Object }),
    __metadata("design:type", Object)
], Subscription.prototype, "metadata", void 0);
exports.Subscription = Subscription = __decorate([
    (0, mongoose_1.Schema)({ timestamps: true })
], Subscription);
exports.SubscriptionSchema = mongoose_1.SchemaFactory.createForClass(Subscription);
exports.SubscriptionSchema.index({ userId: 1 });
exports.SubscriptionSchema.index({ plan: 1, status: 1 });
exports.SubscriptionSchema.index({ status: 1, endDate: 1 });
exports.SubscriptionSchema.index({ scheduledCancellationDate: 1 }, { sparse: true });
//# sourceMappingURL=subscription.schema.js.map