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
exports.RoomAvailabilityQueryDto = exports.SetIcalUrlDto = exports.UnblockRoomDatesDto = exports.BlockRoomDatesDto = exports.UpdateRoomDto = exports.CreateRoomDto = exports.RoomDateRangeDto = exports.RoomAmenitiesDto = void 0;
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
const swagger_1 = require("@nestjs/swagger");
const room_schema_1 = require("../schemas/room.schema");
class RoomAmenitiesDto {
    hasWifi;
    hasAirConditioning;
    hasHeating;
    hasTv;
    hasBalcony;
    hasPrivateBathroom;
    hasKitchenette;
    hasDesk;
    hasSafe;
    hasMinibar;
    wheelchairAccessible;
    selfCheckIn;
    checkInTime;
    checkOutTime;
}
exports.RoomAmenitiesDto = RoomAmenitiesDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], RoomAmenitiesDto.prototype, "hasWifi", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], RoomAmenitiesDto.prototype, "hasAirConditioning", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], RoomAmenitiesDto.prototype, "hasHeating", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], RoomAmenitiesDto.prototype, "hasTv", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], RoomAmenitiesDto.prototype, "hasBalcony", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], RoomAmenitiesDto.prototype, "hasPrivateBathroom", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], RoomAmenitiesDto.prototype, "hasKitchenette", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], RoomAmenitiesDto.prototype, "hasDesk", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], RoomAmenitiesDto.prototype, "hasSafe", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], RoomAmenitiesDto.prototype, "hasMinibar", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], RoomAmenitiesDto.prototype, "wheelchairAccessible", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], RoomAmenitiesDto.prototype, "selfCheckIn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '14:00' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(5, 5),
    __metadata("design:type", String)
], RoomAmenitiesDto.prototype, "checkInTime", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '11:00' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(5, 5),
    __metadata("design:type", String)
], RoomAmenitiesDto.prototype, "checkOutTime", void 0);
class RoomDateRangeDto {
    from;
    to;
    reason;
}
exports.RoomDateRangeDto = RoomDateRangeDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-04-01' }),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], RoomDateRangeDto.prototype, "from", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-04-07' }),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], RoomDateRangeDto.prototype, "to", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'maintenance' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(0, 100),
    __metadata("design:type", String)
], RoomDateRangeDto.prototype, "reason", void 0);
class CreateRoomDto {
    propertyId;
    name;
    roomNumber;
    roomType;
    maxGuests;
    bedCount;
    bedType;
    price;
    cleaningFee;
    amenities;
}
exports.CreateRoomDto = CreateRoomDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: '507f1f77bcf86cd799439011', description: 'Parent property ID (must be a hotel/hostel/motel)' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(24, 24, { message: 'propertyId must be a valid 24-character ObjectId' }),
    __metadata("design:type", String)
], CreateRoomDto.prototype, "propertyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Deluxe Double — Pool View' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(2, 100),
    __metadata("design:type", String)
], CreateRoomDto.prototype, "name", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '101' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(1, 20),
    __metadata("design:type", String)
], CreateRoomDto.prototype, "roomNumber", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: room_schema_1.RoomType, example: room_schema_1.RoomType.DOUBLE }),
    (0, class_validator_1.IsEnum)(room_schema_1.RoomType),
    __metadata("design:type", String)
], CreateRoomDto.prototype, "roomType", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 2, description: 'Maximum guests allowed in this room' }),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(50),
    __metadata("design:type", Number)
], CreateRoomDto.prototype, "maxGuests", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 1 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(10),
    __metadata("design:type", Number)
], CreateRoomDto.prototype, "bedCount", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: room_schema_1.BedType, example: room_schema_1.BedType.QUEEN }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(room_schema_1.BedType),
    __metadata("design:type", String)
], CreateRoomDto.prototype, "bedType", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 35000, description: 'Nightly price for this room (overrides property price)' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], CreateRoomDto.prototype, "price", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 3000 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], CreateRoomDto.prototype, "cleaningFee", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: RoomAmenitiesDto }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => RoomAmenitiesDto),
    __metadata("design:type", RoomAmenitiesDto)
], CreateRoomDto.prototype, "amenities", void 0);
class UpdateRoomDto extends (0, swagger_1.PartialType)(CreateRoomDto) {
    isActive;
}
exports.UpdateRoomDto = UpdateRoomDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpdateRoomDto.prototype, "isActive", void 0);
class BlockRoomDatesDto {
    ranges;
}
exports.BlockRoomDatesDto = BlockRoomDatesDto;
__decorate([
    (0, swagger_1.ApiProperty)({ type: [RoomDateRangeDto], description: 'Date ranges to block on this room' }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => RoomDateRangeDto),
    __metadata("design:type", Array)
], BlockRoomDatesDto.prototype, "ranges", void 0);
class UnblockRoomDatesDto {
    fromDates;
}
exports.UnblockRoomDatesDto = UnblockRoomDatesDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        example: ['2026-04-01'],
        description: 'Block start dates (ISO) identifying ranges to remove',
    }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsDateString)({}, { each: true }),
    __metadata("design:type", Array)
], UnblockRoomDatesDto.prototype, "fromDates", void 0);
class SetIcalUrlDto {
    icalUrl;
}
exports.SetIcalUrlDto = SetIcalUrlDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 'https://www.airbnb.com/calendar/ical/XXXXXX.ics',
        description: 'Public iCal (.ics) feed URL from an external booking platform',
    }),
    (0, class_validator_1.IsUrl)({ protocols: ['http', 'https'] }),
    __metadata("design:type", String)
], SetIcalUrlDto.prototype, "icalUrl", void 0);
class RoomAvailabilityQueryDto {
    from;
    to;
}
exports.RoomAvailabilityQueryDto = RoomAvailabilityQueryDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-04-01' }),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], RoomAvailabilityQueryDto.prototype, "from", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-04-30' }),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], RoomAvailabilityQueryDto.prototype, "to", void 0);
//# sourceMappingURL=room.dto.js.map