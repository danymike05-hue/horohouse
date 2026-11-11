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
exports.SplitPaymentSchema = exports.SplitPayment = exports.MoMoProvider = exports.TenantShareStatus = exports.SplitPaymentStatus = void 0;
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
var SplitPaymentStatus;
(function (SplitPaymentStatus) {
    SplitPaymentStatus["PENDING"] = "pending";
    SplitPaymentStatus["PARTIAL"] = "partial";
    SplitPaymentStatus["COMPLETE"] = "complete";
    SplitPaymentStatus["DISBURSED"] = "disbursed";
    SplitPaymentStatus["OVERDUE"] = "overdue";
})(SplitPaymentStatus || (exports.SplitPaymentStatus = SplitPaymentStatus = {}));
var TenantShareStatus;
(function (TenantShareStatus) {
    TenantShareStatus["UNPAID"] = "unpaid";
    TenantShareStatus["PAID"] = "paid";
    TenantShareStatus["OVERDUE"] = "overdue";
    TenantShareStatus["WAIVED"] = "waived";
})(TenantShareStatus || (exports.TenantShareStatus = TenantShareStatus = {}));
var MoMoProvider;
(function (MoMoProvider) {
    MoMoProvider["MTN"] = "mtn";
    MoMoProvider["ORANGE"] = "orange";
})(MoMoProvider || (exports.MoMoProvider = MoMoProvider = {}));
let SplitPayment = class SplitPayment {
    propertyId;
    leaseId;
    landlordUserId;
    cycleLabel;
    cycleStart;
    cycleEnd;
    totalRent;
    tenantShares;
    status;
    totalCollected;
    disbursedAt;
    disbursementTransactionId;
    createdAt;
    updatedAt;
};
exports.SplitPayment = SplitPayment;
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'Property', required: true, index: true }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], SplitPayment.prototype, "propertyId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'DigitalLease', required: true, index: true }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], SplitPayment.prototype, "leaseId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'User', required: true, index: true }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], SplitPayment.prototype, "landlordUserId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, trim: true }),
    __metadata("design:type", String)
], SplitPayment.prototype, "cycleLabel", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, index: true }),
    __metadata("design:type", Date)
], SplitPayment.prototype, "cycleStart", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", Date)
], SplitPayment.prototype, "cycleEnd", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, min: 0 }),
    __metadata("design:type", Number)
], SplitPayment.prototype, "totalRent", void 0);
__decorate([
    (0, mongoose_1.Prop)({
        type: [
            {
                tenantUserId: { type: mongoose_2.Types.ObjectId, ref: 'User', required: true },
                tenantName: { type: String, required: true },
                tenantPhone: { type: String },
                amountDue: { type: Number, required: true, min: 0 },
                amountPaid: { type: Number, default: 0, min: 0 },
                status: {
                    type: String,
                    enum: Object.values(TenantShareStatus),
                    default: TenantShareStatus.UNPAID,
                },
                momoPhone: { type: String },
                momoProvider: { type: String, enum: Object.values(MoMoProvider) },
                momoTransactionId: { type: String },
                paidAt: { type: Date },
                dueDate: { type: Date, required: true },
            },
        ],
        required: true,
    }),
    __metadata("design:type", Array)
], SplitPayment.prototype, "tenantShares", void 0);
__decorate([
    (0, mongoose_1.Prop)({
        type: String,
        enum: Object.values(SplitPaymentStatus),
        default: SplitPaymentStatus.PENDING,
        index: true,
    }),
    __metadata("design:type", String)
], SplitPayment.prototype, "status", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 0, min: 0 }),
    __metadata("design:type", Number)
], SplitPayment.prototype, "totalCollected", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Date)
], SplitPayment.prototype, "disbursedAt", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], SplitPayment.prototype, "disbursementTransactionId", void 0);
exports.SplitPayment = SplitPayment = __decorate([
    (0, mongoose_1.Schema)({ timestamps: true })
], SplitPayment);
exports.SplitPaymentSchema = mongoose_1.SchemaFactory.createForClass(SplitPayment);
exports.SplitPaymentSchema.index({ leaseId: 1, cycleStart: 1 }, { unique: true });
exports.SplitPaymentSchema.index({ landlordUserId: 1, status: 1, cycleStart: -1 });
exports.SplitPaymentSchema.index({ 'tenantShares.tenantUserId': 1, status: 1 });
exports.SplitPaymentSchema.index({ status: 1, 'tenantShares.dueDate': 1 });
//# sourceMappingURL=split-payment.schema.js.map