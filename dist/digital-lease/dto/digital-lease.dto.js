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
exports.TerminateLeaseDto = exports.AddConditionLogDto = exports.ConditionItemDto = exports.SignLeaseDto = exports.CreateDigitalLeaseDto = exports.LeaseTenantInputDto = void 0;
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
const swagger_1 = require("@nestjs/swagger");
const digital_lease_schema_1 = require("../schemas/digital-lease.schema");
class LeaseTenantInputDto {
    tenantUserId;
    tenantName;
    tenantEmail;
    tenantPhone;
    rentShare;
}
exports.LeaseTenantInputDto = LeaseTenantInputDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: '64abc123...' }),
    (0, class_validator_1.IsMongoId)(),
    __metadata("design:type", String)
], LeaseTenantInputDto.prototype, "tenantUserId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Jean Dupont' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(2, 100),
    __metadata("design:type", String)
], LeaseTenantInputDto.prototype, "tenantName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'jean@example.com' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], LeaseTenantInputDto.prototype, "tenantEmail", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '+237612345678' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], LeaseTenantInputDto.prototype, "tenantPhone", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 50000, description: "This tenant's share of monthly rent in XAF" }),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], LeaseTenantInputDto.prototype, "rentShare", void 0);
class CreateDigitalLeaseDto {
    propertyId;
    tenants;
    leaseStart;
    leaseEnd;
    monthlyRent;
    depositAmount;
    advanceMonths;
    customClauses;
}
exports.CreateDigitalLeaseDto = CreateDigitalLeaseDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: '64abc123...' }),
    (0, class_validator_1.IsMongoId)(),
    __metadata("design:type", String)
], CreateDigitalLeaseDto.prototype, "propertyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: [LeaseTenantInputDto] }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMinSize)(1),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => LeaseTenantInputDto),
    __metadata("design:type", Array)
], CreateDigitalLeaseDto.prototype, "tenants", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2025-10-01' }),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], CreateDigitalLeaseDto.prototype, "leaseStart", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-09-30' }),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], CreateDigitalLeaseDto.prototype, "leaseEnd", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 100000 }),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], CreateDigitalLeaseDto.prototype, "monthlyRent", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 200000 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], CreateDigitalLeaseDto.prototype, "depositAmount", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 3, description: 'Months paid in advance (1–12)' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(12),
    __metadata("design:type", Number)
], CreateDigitalLeaseDto.prototype, "advanceMonths", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: [Object],
        description: 'Additional clauses beyond the standard template',
        example: [{ heading: 'Pets', body: 'No pets allowed on the premises.' }],
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    __metadata("design:type", Array)
], CreateDigitalLeaseDto.prototype, "customClauses", void 0);
class SignLeaseDto {
    signatureBase64;
}
exports.SignLeaseDto = SignLeaseDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 'data:image/png;base64,iVBORw...',
        description: 'Base64-encoded PNG of the signature drawn in the browser',
    }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(10, 100000),
    __metadata("design:type", String)
], SignLeaseDto.prototype, "signatureBase64", void 0);
class ConditionItemDto {
    label;
    rating;
    notes;
}
exports.ConditionItemDto = ConditionItemDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Front door' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(2, 100),
    __metadata("design:type", String)
], ConditionItemDto.prototype, "label", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: digital_lease_schema_1.ConditionRating }),
    (0, class_validator_1.IsEnum)(digital_lease_schema_1.ConditionRating),
    __metadata("design:type", String)
], ConditionItemDto.prototype, "rating", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'Small scratch on lower panel' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(0, 500),
    __metadata("design:type", String)
], ConditionItemDto.prototype, "notes", void 0);
class AddConditionLogDto {
    type;
    items;
    overallNotes;
}
exports.AddConditionLogDto = AddConditionLogDto;
__decorate([
    (0, swagger_1.ApiProperty)({ enum: ['move_in', 'move_out'] }),
    (0, class_validator_1.IsEnum)(['move_in', 'move_out']),
    __metadata("design:type", String)
], AddConditionLogDto.prototype, "type", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: [ConditionItemDto] }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMinSize)(1),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => ConditionItemDto),
    __metadata("design:type", Array)
], AddConditionLogDto.prototype, "items", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'Property in generally good condition.' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(0, 1000),
    __metadata("design:type", String)
], AddConditionLogDto.prototype, "overallNotes", void 0);
class TerminateLeaseDto {
    reason;
}
exports.TerminateLeaseDto = TerminateLeaseDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Tenant vacated early by mutual agreement.' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(5, 500),
    __metadata("design:type", String)
], TerminateLeaseDto.prototype, "reason", void 0);
//# sourceMappingURL=digital-lease.dto.js.map