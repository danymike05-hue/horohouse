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
exports.SplitRentCalculatorDto = exports.InitiateTenantChargeDto = exports.RecordTenantPaymentDto = exports.CreateSplitPaymentDto = exports.TenantShareInputDto = void 0;
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
const swagger_1 = require("@nestjs/swagger");
const split_payment_schema_1 = require("../schemas/split-payment.schema");
class TenantShareInputDto {
    tenantUserId;
    tenantName;
    tenantPhone;
    amountDue;
    momoPhone;
    momoProvider;
    dueDate;
}
exports.TenantShareInputDto = TenantShareInputDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: '64abc123...', description: 'Tenant User ID' }),
    (0, class_validator_1.IsMongoId)(),
    __metadata("design:type", String)
], TenantShareInputDto.prototype, "tenantUserId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Jean Dupont' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(2, 100),
    __metadata("design:type", String)
], TenantShareInputDto.prototype, "tenantName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '+237612345678' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], TenantShareInputDto.prototype, "tenantPhone", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 50000, description: 'Amount this tenant owes in XAF' }),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], TenantShareInputDto.prototype, "amountDue", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '+237612345678', description: 'MoMo phone to send payment request to' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], TenantShareInputDto.prototype, "momoPhone", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: split_payment_schema_1.MoMoProvider }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(split_payment_schema_1.MoMoProvider),
    __metadata("design:type", String)
], TenantShareInputDto.prototype, "momoProvider", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2025-09-05', description: 'Due date for this tenant share' }),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], TenantShareInputDto.prototype, "dueDate", void 0);
class CreateSplitPaymentDto {
    propertyId;
    leaseId;
    cycleLabel;
    cycleStart;
    cycleEnd;
    totalRent;
    tenantShares;
}
exports.CreateSplitPaymentDto = CreateSplitPaymentDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: '64abc123...' }),
    (0, class_validator_1.IsMongoId)(),
    __metadata("design:type", String)
], CreateSplitPaymentDto.prototype, "propertyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '64abc123...', description: 'DigitalLease ID this cycle belongs to' }),
    (0, class_validator_1.IsMongoId)(),
    __metadata("design:type", String)
], CreateSplitPaymentDto.prototype, "leaseId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'September 2025' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(3, 50),
    __metadata("design:type", String)
], CreateSplitPaymentDto.prototype, "cycleLabel", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2025-09-01' }),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], CreateSplitPaymentDto.prototype, "cycleStart", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2025-09-30' }),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], CreateSplitPaymentDto.prototype, "cycleEnd", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 100000, description: 'Total monthly rent for the property in XAF' }),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], CreateSplitPaymentDto.prototype, "totalRent", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: [TenantShareInputDto], description: 'One entry per tenant — amounts must sum to totalRent' }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMinSize)(1),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => TenantShareInputDto),
    __metadata("design:type", Array)
], CreateSplitPaymentDto.prototype, "tenantShares", void 0);
class RecordTenantPaymentDto {
    tenantUserId;
    amountPaid;
    momoTransactionId;
    momoProvider;
}
exports.RecordTenantPaymentDto = RecordTenantPaymentDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: '64abc123...', description: 'Tenant User ID who paid' }),
    (0, class_validator_1.IsMongoId)(),
    __metadata("design:type", String)
], RecordTenantPaymentDto.prototype, "tenantUserId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 50000, description: 'Amount paid in XAF' }),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], RecordTenantPaymentDto.prototype, "amountPaid", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'TXN-MTN-2025090112345', description: 'MoMo transaction reference from Flutterwave' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], RecordTenantPaymentDto.prototype, "momoTransactionId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: split_payment_schema_1.MoMoProvider }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(split_payment_schema_1.MoMoProvider),
    __metadata("design:type", String)
], RecordTenantPaymentDto.prototype, "momoProvider", void 0);
class InitiateTenantChargeDto {
    tenantUserId;
    momoPhone;
    momoProvider;
}
exports.InitiateTenantChargeDto = InitiateTenantChargeDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: '64abc123...', description: 'Tenant User ID to charge' }),
    (0, class_validator_1.IsMongoId)(),
    __metadata("design:type", String)
], InitiateTenantChargeDto.prototype, "tenantUserId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '+237612345678', description: 'MoMo phone number to debit' }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], InitiateTenantChargeDto.prototype, "momoPhone", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: split_payment_schema_1.MoMoProvider }),
    (0, class_validator_1.IsEnum)(split_payment_schema_1.MoMoProvider),
    __metadata("design:type", String)
], InitiateTenantChargeDto.prototype, "momoProvider", void 0);
class SplitRentCalculatorDto {
    totalRent;
    numberOfTenants;
    customPercentages;
}
exports.SplitRentCalculatorDto = SplitRentCalculatorDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 100000, description: 'Total monthly rent in XAF' }),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], SplitRentCalculatorDto.prototype, "totalRent", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 3, description: 'Number of tenants splitting the rent' }),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], SplitRentCalculatorDto.prototype, "numberOfTenants", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        example: [60, 40],
        description: 'Optional custom split percentages per tenant (must sum to 100). Omit for equal split.',
        type: [Number],
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsNumber)({}, { each: true }),
    (0, class_validator_1.Min)(1, { each: true }),
    (0, class_validator_1.Max)(99, { each: true }),
    __metadata("design:type", Array)
], SplitRentCalculatorDto.prototype, "customPercentages", void 0);
//# sourceMappingURL=split-payment.dto.js.map