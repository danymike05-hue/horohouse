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
exports.ValidateResetTokenDto = exports.ResetPasswordDto = exports.ForgotPasswordDto = void 0;
const class_validator_1 = require("class-validator");
const swagger_1 = require("@nestjs/swagger");
const auth_dto_1 = require("./auth.dto");
class ForgotPasswordDto {
    email;
}
exports.ForgotPasswordDto = ForgotPasswordDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 'john.doe@example.com',
        description: 'Email address to send password reset link'
    }),
    (0, class_validator_1.IsEmail)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.MaxLength)(254),
    __metadata("design:type", String)
], ForgotPasswordDto.prototype, "email", void 0);
class ResetPasswordDto {
    token;
    newPassword;
}
exports.ResetPasswordDto = ResetPasswordDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 'abc123token456',
        description: 'Password reset token from email'
    }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.MaxLength)(256),
    __metadata("design:type", String)
], ResetPasswordDto.prototype, "token", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 'newPassword123',
        description: 'New password (8 to 72 characters)'
    }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.MinLength)(auth_dto_1.PASSWORD_MIN, { message: `Password must be at least ${auth_dto_1.PASSWORD_MIN} characters long` }),
    (0, class_validator_1.MaxLength)(auth_dto_1.PASSWORD_MAX, { message: `Password must be at most ${auth_dto_1.PASSWORD_MAX} characters long` }),
    __metadata("design:type", String)
], ResetPasswordDto.prototype, "newPassword", void 0);
class ValidateResetTokenDto {
    token;
}
exports.ValidateResetTokenDto = ValidateResetTokenDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 'abc123token456',
        description: 'Password reset token to validate'
    }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.MaxLength)(256),
    __metadata("design:type", String)
], ValidateResetTokenDto.prototype, "token", void 0);
//# sourceMappingURL=password-reset.dto.js.map