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
exports.TransactionQueryDto = exports.FlutterwaveWebhookDto = exports.InitiateBookingPaymentDto = exports.WithdrawFundsDto = exports.CancelSubscriptionDto = exports.CreateListingBoostDto = exports.CreateSubscriptionDto = exports.VerifyPaymentDto = exports.InitializePaymentDto = void 0;
const class_validator_1 = require("class-validator");
const swagger_1 = require("@nestjs/swagger");
const transaction_schema_1 = require("../schemas/transaction.schema");
const transaction_schema_2 = require("../schemas/transaction.schema");
const listing_boost_schema_1 = require("../schemas/listing-boost.schema");
class InitializePaymentDto {
    type;
    amount;
    currency;
    paymentMethod;
    propertyId;
    subscriptionPlan;
    billingCycle;
    boostType;
    boostDuration;
    description;
    metadata;
    redirectUrl;
    customerEmail;
    customerPhone;
    customerName;
}
exports.InitializePaymentDto = InitializePaymentDto;
__decorate([
    (0, swagger_1.ApiProperty)({ enum: transaction_schema_1.TransactionType }),
    (0, class_validator_1.IsEnum)(transaction_schema_1.TransactionType),
    __metadata("design:type", String)
], InitializePaymentDto.prototype, "type", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], InitializePaymentDto.prototype, "amount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: transaction_schema_1.Currency, default: transaction_schema_1.Currency.XAF }),
    (0, class_validator_1.IsEnum)(transaction_schema_1.Currency),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], InitializePaymentDto.prototype, "currency", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: transaction_schema_1.PaymentMethod }),
    (0, class_validator_1.IsEnum)(transaction_schema_1.PaymentMethod),
    __metadata("design:type", String)
], InitializePaymentDto.prototype, "paymentMethod", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], InitializePaymentDto.prototype, "propertyId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], InitializePaymentDto.prototype, "subscriptionPlan", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: transaction_schema_2.BillingCycle }),
    (0, class_validator_1.IsEnum)(transaction_schema_2.BillingCycle),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], InitializePaymentDto.prototype, "billingCycle", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: listing_boost_schema_1.BoostType }),
    (0, class_validator_1.IsEnum)(listing_boost_schema_1.BoostType),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], InitializePaymentDto.prototype, "boostType", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], InitializePaymentDto.prototype, "boostDuration", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], InitializePaymentDto.prototype, "description", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsObject)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Object)
], InitializePaymentDto.prototype, "metadata", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], InitializePaymentDto.prototype, "redirectUrl", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsEmail)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], InitializePaymentDto.prototype, "customerEmail", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], InitializePaymentDto.prototype, "customerPhone", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], InitializePaymentDto.prototype, "customerName", void 0);
class VerifyPaymentDto {
    transactionId;
    flutterwaveReference;
}
exports.VerifyPaymentDto = VerifyPaymentDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], VerifyPaymentDto.prototype, "transactionId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], VerifyPaymentDto.prototype, "flutterwaveReference", void 0);
class CreateSubscriptionDto {
    planName;
    billingCycle;
    discountCode;
    paymentMethod;
}
exports.CreateSubscriptionDto = CreateSubscriptionDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateSubscriptionDto.prototype, "planName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: transaction_schema_2.BillingCycle }),
    (0, class_validator_1.IsEnum)(transaction_schema_2.BillingCycle),
    __metadata("design:type", String)
], CreateSubscriptionDto.prototype, "billingCycle", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateSubscriptionDto.prototype, "discountCode", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        enum: transaction_schema_1.PaymentMethod,
        description: 'Payment method: mtn_momo, orange_money, card, bank_transfer, or wallet'
    }),
    (0, class_validator_1.IsEnum)(transaction_schema_1.PaymentMethod, {
        message: 'paymentMethod must be one of: mtn_momo, orange_money, card, bank_transfer, wallet'
    }),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateSubscriptionDto.prototype, "paymentMethod", void 0);
class CreateListingBoostDto {
    propertyId;
    boostType;
    duration;
    metadata;
}
exports.CreateListingBoostDto = CreateListingBoostDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateListingBoostDto.prototype, "propertyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: listing_boost_schema_1.BoostType }),
    (0, class_validator_1.IsEnum)(listing_boost_schema_1.BoostType),
    __metadata("design:type", String)
], CreateListingBoostDto.prototype, "boostType", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], CreateListingBoostDto.prototype, "duration", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsObject)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Object)
], CreateListingBoostDto.prototype, "metadata", void 0);
class CancelSubscriptionDto {
    reason;
    feedback;
    cancelImmediately;
}
exports.CancelSubscriptionDto = CancelSubscriptionDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CancelSubscriptionDto.prototype, "reason", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CancelSubscriptionDto.prototype, "feedback", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsBoolean)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Boolean)
], CancelSubscriptionDto.prototype, "cancelImmediately", void 0);
class WithdrawFundsDto {
    amount;
    withdrawalMethod;
    accountNumber;
    accountName;
    bankCode;
}
exports.WithdrawFundsDto = WithdrawFundsDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], WithdrawFundsDto.prototype, "amount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: transaction_schema_1.PaymentMethod }),
    (0, class_validator_1.IsEnum)(transaction_schema_1.PaymentMethod),
    __metadata("design:type", String)
], WithdrawFundsDto.prototype, "withdrawalMethod", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], WithdrawFundsDto.prototype, "accountNumber", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], WithdrawFundsDto.prototype, "accountName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], WithdrawFundsDto.prototype, "bankCode", void 0);
class InitiateBookingPaymentDto {
    paymentMethod;
    phone;
}
exports.InitiateBookingPaymentDto = InitiateBookingPaymentDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: transaction_schema_1.PaymentMethod, description: 'User-selected operator: mtn_momo or orange_money' }),
    (0, class_validator_1.IsEnum)(transaction_schema_1.PaymentMethod),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], InitiateBookingPaymentDto.prototype, "paymentMethod", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Mobile money number to charge, if different from profile phone' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], InitiateBookingPaymentDto.prototype, "phone", void 0);
class FlutterwaveWebhookDto {
    event;
    data;
}
exports.FlutterwaveWebhookDto = FlutterwaveWebhookDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], FlutterwaveWebhookDto.prototype, "event", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Object)
], FlutterwaveWebhookDto.prototype, "data", void 0);
class TransactionQueryDto {
    status;
    type;
    paymentMethod;
    page;
    limit;
    startDate;
    endDate;
}
exports.TransactionQueryDto = TransactionQueryDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], TransactionQueryDto.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], TransactionQueryDto.prototype, "type", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], TransactionQueryDto.prototype, "paymentMethod", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], TransactionQueryDto.prototype, "page", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], TransactionQueryDto.prototype, "limit", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], TransactionQueryDto.prototype, "startDate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], TransactionQueryDto.prototype, "endDate", void 0);
//# sourceMappingURL=payment.dto.js.map