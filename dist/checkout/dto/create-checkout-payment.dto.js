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
exports.CheckoutQuoteQueryDto = exports.CreateCheckoutPaymentDto = void 0;
const class_validator_1 = require("class-validator");
class CreateCheckoutPaymentDto {
    purpose;
    bookingId;
    planName;
    billingCycle;
    propertyId;
    boostType;
    duration;
    method;
    operator;
    phone;
    returnUrl;
}
exports.CreateCheckoutPaymentDto = CreateCheckoutPaymentDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['booking', 'subscription', 'boost']),
    __metadata("design:type", String)
], CreateCheckoutPaymentDto.prototype, "purpose", void 0);
__decorate([
    (0, class_validator_1.ValidateIf)((o) => !o.purpose || o.purpose === 'booking'),
    (0, class_validator_1.IsMongoId)(),
    __metadata("design:type", String)
], CreateCheckoutPaymentDto.prototype, "bookingId", void 0);
__decorate([
    (0, class_validator_1.ValidateIf)((o) => o.purpose === 'subscription'),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(40),
    __metadata("design:type", String)
], CreateCheckoutPaymentDto.prototype, "planName", void 0);
__decorate([
    (0, class_validator_1.ValidateIf)((o) => o.purpose === 'subscription'),
    (0, class_validator_1.IsIn)(['monthly', 'quarterly', 'yearly']),
    __metadata("design:type", String)
], CreateCheckoutPaymentDto.prototype, "billingCycle", void 0);
__decorate([
    (0, class_validator_1.ValidateIf)((o) => o.purpose === 'boost'),
    (0, class_validator_1.IsMongoId)(),
    __metadata("design:type", String)
], CreateCheckoutPaymentDto.prototype, "propertyId", void 0);
__decorate([
    (0, class_validator_1.ValidateIf)((o) => o.purpose === 'boost'),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(30),
    __metadata("design:type", String)
], CreateCheckoutPaymentDto.prototype, "boostType", void 0);
__decorate([
    (0, class_validator_1.ValidateIf)((o) => o.purpose === 'boost'),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.IsIn)([24, 168, 720]),
    __metadata("design:type", Number)
], CreateCheckoutPaymentDto.prototype, "duration", void 0);
__decorate([
    (0, class_validator_1.IsIn)(['mobile_money', 'card', 'wallet', 'plan_credit']),
    __metadata("design:type", String)
], CreateCheckoutPaymentDto.prototype, "method", void 0);
__decorate([
    (0, class_validator_1.ValidateIf)((o) => o.method === 'mobile_money'),
    (0, class_validator_1.IsIn)(['orange_money', 'mtn_momo']),
    __metadata("design:type", String)
], CreateCheckoutPaymentDto.prototype, "operator", void 0);
__decorate([
    (0, class_validator_1.ValidateIf)((o) => o.method === 'mobile_money'),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(/^[+\d\s]{9,16}$/),
    __metadata("design:type", String)
], CreateCheckoutPaymentDto.prototype, "phone", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(300),
    __metadata("design:type", String)
], CreateCheckoutPaymentDto.prototype, "returnUrl", void 0);
class CheckoutQuoteQueryDto {
    purpose;
    planName;
    billingCycle;
    propertyId;
    boostType;
    duration;
}
exports.CheckoutQuoteQueryDto = CheckoutQuoteQueryDto;
__decorate([
    (0, class_validator_1.IsIn)(['subscription', 'boost']),
    __metadata("design:type", String)
], CheckoutQuoteQueryDto.prototype, "purpose", void 0);
__decorate([
    (0, class_validator_1.ValidateIf)((o) => o.purpose === 'subscription'),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(40),
    __metadata("design:type", String)
], CheckoutQuoteQueryDto.prototype, "planName", void 0);
__decorate([
    (0, class_validator_1.ValidateIf)((o) => o.purpose === 'subscription'),
    (0, class_validator_1.IsIn)(['monthly', 'quarterly', 'yearly']),
    __metadata("design:type", String)
], CheckoutQuoteQueryDto.prototype, "billingCycle", void 0);
__decorate([
    (0, class_validator_1.ValidateIf)((o) => o.purpose === 'boost'),
    (0, class_validator_1.IsMongoId)(),
    __metadata("design:type", String)
], CheckoutQuoteQueryDto.prototype, "propertyId", void 0);
__decorate([
    (0, class_validator_1.ValidateIf)((o) => o.purpose === 'boost'),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(30),
    __metadata("design:type", String)
], CheckoutQuoteQueryDto.prototype, "boostType", void 0);
__decorate([
    (0, class_validator_1.ValidateIf)((o) => o.purpose === 'boost'),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.IsIn)([24, 168, 720]),
    __metadata("design:type", Number)
], CheckoutQuoteQueryDto.prototype, "duration", void 0);
//# sourceMappingURL=create-checkout-payment.dto.js.map