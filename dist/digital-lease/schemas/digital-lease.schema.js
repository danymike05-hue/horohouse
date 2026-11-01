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
exports.DigitalLeaseSchema = exports.DigitalLease = exports.ConditionRating = exports.LeaseStatus = void 0;
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
var LeaseStatus;
(function (LeaseStatus) {
    LeaseStatus["DRAFT"] = "draft";
    LeaseStatus["PENDING_TENANT"] = "pending_tenant";
    LeaseStatus["ACTIVE"] = "active";
    LeaseStatus["EXPIRED"] = "expired";
    LeaseStatus["TERMINATED"] = "terminated";
})(LeaseStatus || (exports.LeaseStatus = LeaseStatus = {}));
var ConditionRating;
(function (ConditionRating) {
    ConditionRating["EXCELLENT"] = "excellent";
    ConditionRating["GOOD"] = "good";
    ConditionRating["FAIR"] = "fair";
    ConditionRating["POOR"] = "poor";
})(ConditionRating || (exports.ConditionRating = ConditionRating = {}));
let DigitalLease = class DigitalLease {
    propertyId;
    landlordUserId;
    tenants;
    leaseStart;
    leaseEnd;
    monthlyRent;
    depositAmount;
    advanceMonths;
    status;
    landlordSignatureUrl;
    landlordSignedAt;
    clauses;
    customClauses;
    conditionLogs;
    terminationReason;
    terminatedAt;
    terminatedByUserId;
    createdAt;
    updatedAt;
};
exports.DigitalLease = DigitalLease;
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'Property', required: true, index: true }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], DigitalLease.prototype, "propertyId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'User', required: true, index: true }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], DigitalLease.prototype, "landlordUserId", void 0);
__decorate([
    (0, mongoose_1.Prop)({
        type: [
            {
                tenantUserId: { type: mongoose_2.Types.ObjectId, ref: 'User', required: true },
                tenantName: { type: String, required: true },
                tenantEmail: { type: String },
                tenantPhone: { type: String },
                signatureUrl: { type: String },
                signedAt: { type: Date },
                rentShare: { type: Number, required: true, min: 0 },
            },
        ],
        required: true,
    }),
    __metadata("design:type", Array)
], DigitalLease.prototype, "tenants", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", Date)
], DigitalLease.prototype, "leaseStart", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", Date)
], DigitalLease.prototype, "leaseEnd", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, min: 0 }),
    __metadata("design:type", Number)
], DigitalLease.prototype, "monthlyRent", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 0, min: 0 }),
    __metadata("design:type", Number)
], DigitalLease.prototype, "depositAmount", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 1, min: 1, max: 12 }),
    __metadata("design:type", Number)
], DigitalLease.prototype, "advanceMonths", void 0);
__decorate([
    (0, mongoose_1.Prop)({
        type: String,
        enum: Object.values(LeaseStatus),
        default: LeaseStatus.DRAFT,
        index: true,
    }),
    __metadata("design:type", String)
], DigitalLease.prototype, "status", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], DigitalLease.prototype, "landlordSignatureUrl", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Date)
], DigitalLease.prototype, "landlordSignedAt", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [Object], default: [] }),
    __metadata("design:type", Array)
], DigitalLease.prototype, "clauses", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [Object], default: [] }),
    __metadata("design:type", Array)
], DigitalLease.prototype, "customClauses", void 0);
__decorate([
    (0, mongoose_1.Prop)({
        type: [
            {
                loggedByUserId: { type: mongoose_2.Types.ObjectId, ref: 'User', required: true },
                loggedAt: { type: Date, required: true },
                type: { type: String, enum: ['move_in', 'move_out'], required: true },
                overallNotes: { type: String },
                items: [
                    {
                        label: { type: String, required: true },
                        rating: {
                            type: String,
                            enum: Object.values(ConditionRating),
                            required: true,
                        },
                        notes: { type: String },
                        photoUrls: [{ type: String }],
                    },
                ],
            },
        ],
        default: [],
    }),
    __metadata("design:type", Array)
], DigitalLease.prototype, "conditionLogs", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], DigitalLease.prototype, "terminationReason", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Date)
], DigitalLease.prototype, "terminatedAt", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'User' }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], DigitalLease.prototype, "terminatedByUserId", void 0);
exports.DigitalLease = DigitalLease = __decorate([
    (0, mongoose_1.Schema)({ timestamps: true })
], DigitalLease);
exports.DigitalLeaseSchema = mongoose_1.SchemaFactory.createForClass(DigitalLease);
exports.DigitalLeaseSchema.index({ landlordUserId: 1, status: 1, leaseStart: -1 });
exports.DigitalLeaseSchema.index({ 'tenants.tenantUserId': 1, status: 1 });
exports.DigitalLeaseSchema.index({ status: 1, leaseEnd: 1 });
//# sourceMappingURL=digital-lease.schema.js.map