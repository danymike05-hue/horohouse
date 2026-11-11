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
exports.OnboardingSchema = exports.Onboarding = void 0;
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
let Onboarding = class Onboarding {
    userId;
    isCompleted;
    currentStep;
    totalSteps;
    propertyPreferences;
    agentPreferences;
    completedSteps;
    completedAt;
    lastActivityAt;
    welcomeEmailSent;
    completionEmailSent;
};
exports.Onboarding = Onboarding;
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'User', required: true, unique: true }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], Onboarding.prototype, "userId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, default: false }),
    __metadata("design:type", Boolean)
], Onboarding.prototype, "isCompleted", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, default: 0 }),
    __metadata("design:type", Number)
], Onboarding.prototype, "currentStep", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Number, default: 0 }),
    __metadata("design:type", Number)
], Onboarding.prototype, "totalSteps", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Object }),
    __metadata("design:type", Object)
], Onboarding.prototype, "propertyPreferences", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Object }),
    __metadata("design:type", Object)
], Onboarding.prototype, "agentPreferences", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [String], default: [] }),
    __metadata("design:type", Array)
], Onboarding.prototype, "completedSteps", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Date }),
    __metadata("design:type", Date)
], Onboarding.prototype, "completedAt", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Date }),
    __metadata("design:type", Date)
], Onboarding.prototype, "lastActivityAt", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Boolean, default: false }),
    __metadata("design:type", Boolean)
], Onboarding.prototype, "welcomeEmailSent", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Boolean, default: false }),
    __metadata("design:type", Boolean)
], Onboarding.prototype, "completionEmailSent", void 0);
exports.Onboarding = Onboarding = __decorate([
    (0, mongoose_1.Schema)({ timestamps: true })
], Onboarding);
exports.OnboardingSchema = mongoose_1.SchemaFactory.createForClass(Onboarding);
exports.OnboardingSchema.index({ isCompleted: 1 });
exports.OnboardingSchema.index({ lastActivityAt: 1 });
//# sourceMappingURL=onboarding.schema.js.map