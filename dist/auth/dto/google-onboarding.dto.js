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
exports.ONBOARDING_ROLES = exports.CompleteOnboardingDto = exports.SetPhoneDto = exports.SelectRoleDto = void 0;
const class_validator_1 = require("class-validator");
const user_schema_1 = require("../../users/schemas/user.schema");
const ONBOARDING_ROLES = [
    user_schema_1.UserRole.REGISTERED_USER,
    user_schema_1.UserRole.HOST,
    user_schema_1.UserRole.LANDLORD,
    user_schema_1.UserRole.AGENT,
];
exports.ONBOARDING_ROLES = ONBOARDING_ROLES;
class SelectRoleDto {
    role;
}
exports.SelectRoleDto = SelectRoleDto;
__decorate([
    (0, class_validator_1.IsEnum)(user_schema_1.UserRole, {
        message: `Role must be one of: ${ONBOARDING_ROLES.join(', ')}`,
    }),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], SelectRoleDto.prototype, "role", void 0);
class SetPhoneDto {
    phoneNumber;
}
exports.SetPhoneDto = SetPhoneDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)({ message: 'Phone number is required' }),
    (0, class_validator_1.Matches)(/^\+[1-9]\d{6,14}$/, {
        message: 'Phone number must be in E.164 format (e.g. +237612345678)',
    }),
    __metadata("design:type", String)
], SetPhoneDto.prototype, "phoneNumber", void 0);
class CompleteOnboardingDto {
}
exports.CompleteOnboardingDto = CompleteOnboardingDto;
//# sourceMappingURL=google-onboarding.dto.js.map