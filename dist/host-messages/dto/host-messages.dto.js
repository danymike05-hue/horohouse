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
exports.GuidePhotoCaptionDto = exports.CheckInGuideDto = exports.UpdateTemplateDto = exports.CreateTemplateDto = void 0;
const class_validator_1 = require("class-validator");
const swagger_1 = require("@nestjs/swagger");
const host_message_schema_1 = require("../schemas/host-message.schema");
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
class CreateTemplateDto {
    kind;
    title;
    body;
    trigger;
    daysOffset;
    sendTime;
    propertyIds;
    isActive;
}
exports.CreateTemplateDto = CreateTemplateDto;
__decorate([
    (0, swagger_1.ApiProperty)({ enum: host_message_schema_1.TemplateKind }),
    (0, class_validator_1.IsEnum)(host_message_schema_1.TemplateKind),
    __metadata("design:type", String)
], CreateTemplateDto.prototype, "kind", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 60 }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(60),
    __metadata("design:type", String)
], CreateTemplateDto.prototype, "title", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 2000 }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(2000),
    __metadata("design:type", String)
], CreateTemplateDto.prototype, "body", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: host_message_schema_1.MessageTrigger }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(host_message_schema_1.MessageTrigger),
    __metadata("design:type", String)
], CreateTemplateDto.prototype, "trigger", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ minimum: 0, maximum: 14 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.Max)(14),
    __metadata("design:type", Number)
], CreateTemplateDto.prototype, "daysOffset", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '10:00', description: 'Cameroon time' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.Matches)(HHMM, { message: 'sendTime must be HH:mm' }),
    __metadata("design:type", String)
], CreateTemplateDto.prototype, "sendTime", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: [String] }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(100),
    (0, class_validator_1.IsMongoId)({ each: true }),
    __metadata("design:type", Array)
], CreateTemplateDto.prototype, "propertyIds", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CreateTemplateDto.prototype, "isActive", void 0);
class UpdateTemplateDto extends (0, swagger_1.PartialType)(CreateTemplateDto) {
}
exports.UpdateTemplateDto = UpdateTemplateDto;
class CheckInGuideDto {
    wifiName;
    wifiPassword;
    directions;
    accessInstructions;
    parking;
    houseManual;
    emergencyPhone;
}
exports.CheckInGuideDto = CheckInGuideDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(64),
    __metadata("design:type", String)
], CheckInGuideDto.prototype, "wifiName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(64),
    __metadata("design:type", String)
], CheckInGuideDto.prototype, "wifiPassword", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(1500),
    __metadata("design:type", String)
], CheckInGuideDto.prototype, "directions", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(1000),
    __metadata("design:type", String)
], CheckInGuideDto.prototype, "accessInstructions", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(500),
    __metadata("design:type", String)
], CheckInGuideDto.prototype, "parking", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(2000),
    __metadata("design:type", String)
], CheckInGuideDto.prototype, "houseManual", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(30),
    __metadata("design:type", String)
], CheckInGuideDto.prototype, "emergencyPhone", void 0);
class GuidePhotoCaptionDto {
    caption;
}
exports.GuidePhotoCaptionDto = GuidePhotoCaptionDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], GuidePhotoCaptionDto.prototype, "caption", void 0);
//# sourceMappingURL=host-messages.dto.js.map