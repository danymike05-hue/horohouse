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
exports.VerifyEmailDto = exports.OAuthExchangeDto = exports.CheckEmailDto = exports.ChangePasswordDto = exports.RefreshTokenDto = exports.VerifyPhoneRequestDto = exports.LoginPhoneDto = exports.SendPhoneCodeRequestDto = exports.LoginEmailDto = exports.RegisterPhoneDto = exports.RegisterEmailDto = exports.PASSWORD_MAX = exports.PASSWORD_MIN = void 0;
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
const swagger_1 = require("@nestjs/swagger");
const user_schema_1 = require("../../users/schemas/user.schema");
exports.PASSWORD_MIN = 8;
exports.PASSWORD_MAX = 72;
const E164 = /^\+[1-9]\d{6,14}$/;
const trimLower = ({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value);
const trim = ({ value }) => (typeof value === 'string' ? value.trim() : value);
class RegisterEmailDto {
    name;
    email;
    password;
    phoneNumber;
    role;
    deviceInfo;
}
exports.RegisterEmailDto = RegisterEmailDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_transformer_1.Transform)(trim),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.MaxLength)(80),
    __metadata("design:type", String)
], RegisterEmailDto.prototype, "name", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_transformer_1.Transform)(trimLower),
    (0, class_validator_1.IsEmail)(),
    (0, class_validator_1.MaxLength)(254),
    __metadata("design:type", String)
], RegisterEmailDto.prototype, "email", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(exports.PASSWORD_MIN, { message: `Password must be at least ${exports.PASSWORD_MIN} characters` }),
    (0, class_validator_1.MaxLength)(exports.PASSWORD_MAX, { message: `Password must be at most ${exports.PASSWORD_MAX} characters` }),
    __metadata("design:type", String)
], RegisterEmailDto.prototype, "password", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(E164, { message: 'Phone number must be in international format, e.g. +237612345678' }),
    __metadata("design:type", String)
], RegisterEmailDto.prototype, "phoneNumber", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: user_schema_1.UserRole }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(user_schema_1.UserRole),
    __metadata("design:type", String)
], RegisterEmailDto.prototype, "role", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], RegisterEmailDto.prototype, "deviceInfo", void 0);
class RegisterPhoneDto {
    name;
    phoneNumber;
    email;
    role;
    deviceInfo;
}
exports.RegisterPhoneDto = RegisterPhoneDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_transformer_1.Transform)(trim),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.MaxLength)(80),
    __metadata("design:type", String)
], RegisterPhoneDto.prototype, "name", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(E164, { message: 'Phone number must be in international format, e.g. +237612345678' }),
    __metadata("design:type", String)
], RegisterPhoneDto.prototype, "phoneNumber", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(trimLower),
    (0, class_validator_1.IsEmail)(),
    (0, class_validator_1.MaxLength)(254),
    __metadata("design:type", String)
], RegisterPhoneDto.prototype, "email", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: user_schema_1.UserRole }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(user_schema_1.UserRole),
    __metadata("design:type", String)
], RegisterPhoneDto.prototype, "role", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], RegisterPhoneDto.prototype, "deviceInfo", void 0);
class LoginEmailDto {
    email;
    password;
    deviceInfo;
}
exports.LoginEmailDto = LoginEmailDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_transformer_1.Transform)(trimLower),
    (0, class_validator_1.IsEmail)(),
    (0, class_validator_1.MaxLength)(254),
    __metadata("design:type", String)
], LoginEmailDto.prototype, "email", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.MaxLength)(256),
    __metadata("design:type", String)
], LoginEmailDto.prototype, "password", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], LoginEmailDto.prototype, "deviceInfo", void 0);
class SendPhoneCodeRequestDto {
    phoneNumber;
}
exports.SendPhoneCodeRequestDto = SendPhoneCodeRequestDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.MaxLength)(20),
    __metadata("design:type", String)
], SendPhoneCodeRequestDto.prototype, "phoneNumber", void 0);
class LoginPhoneDto {
    phoneNumber;
    verificationCode;
    deviceInfo;
}
exports.LoginPhoneDto = LoginPhoneDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.MaxLength)(20),
    __metadata("design:type", String)
], LoginPhoneDto.prototype, "phoneNumber", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(4, 8),
    __metadata("design:type", String)
], LoginPhoneDto.prototype, "verificationCode", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], LoginPhoneDto.prototype, "deviceInfo", void 0);
class VerifyPhoneRequestDto {
    phoneNumber;
    verificationCode;
}
exports.VerifyPhoneRequestDto = VerifyPhoneRequestDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.MaxLength)(20),
    __metadata("design:type", String)
], VerifyPhoneRequestDto.prototype, "phoneNumber", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(4, 8),
    __metadata("design:type", String)
], VerifyPhoneRequestDto.prototype, "verificationCode", void 0);
class RefreshTokenDto {
    refreshToken;
}
exports.RefreshTokenDto = RefreshTokenDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(4096),
    __metadata("design:type", String)
], RefreshTokenDto.prototype, "refreshToken", void 0);
class ChangePasswordDto {
    currentPassword;
    newPassword;
}
exports.ChangePasswordDto = ChangePasswordDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.MaxLength)(256),
    __metadata("design:type", String)
], ChangePasswordDto.prototype, "currentPassword", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(exports.PASSWORD_MIN, { message: `Password must be at least ${exports.PASSWORD_MIN} characters` }),
    (0, class_validator_1.MaxLength)(exports.PASSWORD_MAX, { message: `Password must be at most ${exports.PASSWORD_MAX} characters` }),
    __metadata("design:type", String)
], ChangePasswordDto.prototype, "newPassword", void 0);
class CheckEmailDto {
    email;
}
exports.CheckEmailDto = CheckEmailDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_transformer_1.Transform)(trimLower),
    (0, class_validator_1.IsEmail)(),
    (0, class_validator_1.MaxLength)(254),
    __metadata("design:type", String)
], CheckEmailDto.prototype, "email", void 0);
class OAuthExchangeDto {
    code;
    codeVerifier;
    deviceInfo;
}
exports.OAuthExchangeDto = OAuthExchangeDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(20, 128),
    __metadata("design:type", String)
], OAuthExchangeDto.prototype, "code", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(43, 128),
    (0, class_validator_1.Matches)(/^[A-Za-z0-9\-._~]+$/),
    __metadata("design:type", String)
], OAuthExchangeDto.prototype, "codeVerifier", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], OAuthExchangeDto.prototype, "deviceInfo", void 0);
class VerifyEmailDto {
    token;
}
exports.VerifyEmailDto = VerifyEmailDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(16, 128),
    __metadata("design:type", String)
], VerifyEmailDto.prototype, "token", void 0);
//# sourceMappingURL=auth.dto.js.map