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
exports.CompleteOnboardingDto = exports.UpdateOnboardingStepDto = exports.AgentPreferencesDto = exports.PropertyPreferencesDto = exports.BudgetDto = void 0;
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
class BudgetDto {
    min;
    max;
    currency;
}
exports.BudgetDto = BudgetDto;
__decorate([
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], BudgetDto.prototype, "min", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], BudgetDto.prototype, "max", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], BudgetDto.prototype, "currency", void 0);
class PropertyPreferencesDto {
    propertyType;
    budget;
    location;
    bedrooms;
    bathrooms;
    features;
}
exports.PropertyPreferencesDto = PropertyPreferencesDto;
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], PropertyPreferencesDto.prototype, "propertyType", void 0);
__decorate([
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => BudgetDto),
    __metadata("design:type", BudgetDto)
], PropertyPreferencesDto.prototype, "budget", void 0);
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], PropertyPreferencesDto.prototype, "location", void 0);
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsNumber)({}, { each: true }),
    __metadata("design:type", Array)
], PropertyPreferencesDto.prototype, "bedrooms", void 0);
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsNumber)({}, { each: true }),
    __metadata("design:type", Array)
], PropertyPreferencesDto.prototype, "bathrooms", void 0);
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], PropertyPreferencesDto.prototype, "features", void 0);
class AgentPreferencesDto {
    licenseNumber;
    agency;
    experience;
    specializations;
    serviceAreas;
}
exports.AgentPreferencesDto = AgentPreferencesDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], AgentPreferencesDto.prototype, "licenseNumber", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], AgentPreferencesDto.prototype, "agency", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.Max)(50),
    __metadata("design:type", Number)
], AgentPreferencesDto.prototype, "experience", void 0);
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], AgentPreferencesDto.prototype, "specializations", void 0);
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], AgentPreferencesDto.prototype, "serviceAreas", void 0);
class UpdateOnboardingStepDto {
    currentStep;
    stepName;
    propertyPreferences;
    agentPreferences;
}
exports.UpdateOnboardingStepDto = UpdateOnboardingStepDto;
__decorate([
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], UpdateOnboardingStepDto.prototype, "currentStep", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateOnboardingStepDto.prototype, "stepName", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", PropertyPreferencesDto)
], UpdateOnboardingStepDto.prototype, "propertyPreferences", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", AgentPreferencesDto)
], UpdateOnboardingStepDto.prototype, "agentPreferences", void 0);
class CompleteOnboardingDto {
    isCompleted;
    propertyPreferences;
    agentPreferences;
}
exports.CompleteOnboardingDto = CompleteOnboardingDto;
__decorate([
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CompleteOnboardingDto.prototype, "isCompleted", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", PropertyPreferencesDto)
], CompleteOnboardingDto.prototype, "propertyPreferences", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", AgentPreferencesDto)
], CompleteOnboardingDto.prototype, "agentPreferences", void 0);
//# sourceMappingURL=onboarding.dto.js.map