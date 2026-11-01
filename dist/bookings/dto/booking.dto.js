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
exports.AvailabilityQueryDto = exports.BookingQueryDto = exports.UpdatePaymentDto = exports.RespondToBookingDto = exports.CancelBookingDto = exports.CreateBookingDto = exports.BookingGuestsDto = void 0;
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
const swagger_1 = require("@nestjs/swagger");
class BookingGuestsDto {
    adults;
    children;
    infants;
}
exports.BookingGuestsDto = BookingGuestsDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 2, description: 'Number of adult guests' }),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(20),
    __metadata("design:type", Number)
], BookingGuestsDto.prototype, "adults", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 1 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], BookingGuestsDto.prototype, "children", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 0 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], BookingGuestsDto.prototype, "infants", void 0);
class CreateBookingDto {
    propertyId;
    checkIn;
    checkOut;
    guests;
    currency;
    guestNote;
    roomId;
}
exports.CreateBookingDto = CreateBookingDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: '507f1f77bcf86cd799439011', description: 'Property ID to book' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(24, 24, { message: 'propertyId must be a valid 24-character ObjectId' }),
    __metadata("design:type", String)
], CreateBookingDto.prototype, "propertyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-04-10', description: 'Check-in date (ISO 8601)' }),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], CreateBookingDto.prototype, "checkIn", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-04-15', description: 'Check-out date (ISO 8601)' }),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], CreateBookingDto.prototype, "checkOut", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: BookingGuestsDto }),
    (0, class_validator_1.IsObject)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => BookingGuestsDto),
    __metadata("design:type", BookingGuestsDto)
], CreateBookingDto.prototype, "guests", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        example: 'XAF',
        description: 'Currency code (defaults to property currency)',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(3, 3),
    __metadata("design:type", String)
], CreateBookingDto.prototype, "currency", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        example: 'We will arrive around 15:00. Is early check-in possible?',
        description: 'Optional message to the host',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(0, 1000),
    __metadata("design:type", String)
], CreateBookingDto.prototype, "guestNote", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        example: '507f1f77bcf86cd799439022',
        description: 'Specific room ID — required for hotels, hostels, motels with multiple rooms',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(24, 24, { message: 'roomId must be a valid 24-character ObjectId' }),
    __metadata("design:type", String)
], CreateBookingDto.prototype, "roomId", void 0);
class CancelBookingDto {
    reason;
}
exports.CancelBookingDto = CancelBookingDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        example: 'Change of travel plans',
        description: 'Reason for cancellation',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(0, 500),
    __metadata("design:type", String)
], CancelBookingDto.prototype, "reason", void 0);
class RespondToBookingDto {
    hostNote;
    reason;
}
exports.RespondToBookingDto = RespondToBookingDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        example: 'Welcome! I will leave the key under the mat.',
        description: 'Optional message to the guest',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(0, 1000),
    __metadata("design:type", String)
], RespondToBookingDto.prototype, "hostNote", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        example: 'Property is under maintenance those dates.',
        description: 'Reason for rejection (required when rejecting)',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(0, 500),
    __metadata("design:type", String)
], RespondToBookingDto.prototype, "reason", void 0);
class UpdatePaymentDto {
    paymentStatus;
    paymentReference;
    paymentMethod;
}
exports.UpdatePaymentDto = UpdatePaymentDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'paid', enum: ['unpaid', 'paid', 'refunded', 'partial'] }),
    (0, class_validator_1.IsEnum)(['unpaid', 'paid', 'refunded', 'partial']),
    __metadata("design:type", String)
], UpdatePaymentDto.prototype, "paymentStatus", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'TXN_ABC123456' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdatePaymentDto.prototype, "paymentReference", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'mobile_money' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdatePaymentDto.prototype, "paymentMethod", void 0);
class BookingQueryDto {
    page;
    limit;
    status;
    fromDate;
    toDate;
    sortOrder;
}
exports.BookingQueryDto = BookingQueryDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 1 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], BookingQueryDto.prototype, "page", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 20 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(100),
    __metadata("design:type", Number)
], BookingQueryDto.prototype, "limit", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        enum: ['pending', 'confirmed', 'cancelled', 'completed', 'rejected', 'no_show'],
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], BookingQueryDto.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '2026-03-01' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], BookingQueryDto.prototype, "fromDate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '2026-06-30' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], BookingQueryDto.prototype, "toDate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'desc', enum: ['asc', 'desc'] }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], BookingQueryDto.prototype, "sortOrder", void 0);
class AvailabilityQueryDto {
    from;
    to;
    roomId;
}
exports.AvailabilityQueryDto = AvailabilityQueryDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-04-01', description: 'Start of range to check' }),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], AvailabilityQueryDto.prototype, "from", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-04-30', description: 'End of range to check' }),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], AvailabilityQueryDto.prototype, "to", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        example: '507f1f77bcf86cd799439022',
        description: 'Optional room ID — returns room-specific availability instead of property-wide',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(24, 24),
    __metadata("design:type", String)
], AvailabilityQueryDto.prototype, "roomId", void 0);
//# sourceMappingURL=booking.dto.js.map