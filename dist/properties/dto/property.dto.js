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
exports.AddExternalCalendarDto = exports.SetCalendarPricesDto = exports.UpdateCalendarSettingsDto = exports.UnblockDatesDto = exports.BlockDatesDto = exports.UpdatePropertyDto = exports.CreatePropertyDto = exports.UnavailableDateRangeDto = exports.ShortTermAmenitiesDto = void 0;
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
const swagger_1 = require("@nestjs/swagger");
const property_schema_1 = require("../schemas/property.schema");
class ShortTermAmenitiesDto {
    hasWifi;
    hasBreakfast;
    hasParking;
    hasTv;
    hasKitchen;
    hasKitchenette;
    hasWasher;
    hasDryer;
    hasAirConditioning;
    hasHeating;
    petsAllowed;
    smokingAllowed;
    partiesAllowed;
    wheelchairAccessible;
    selfCheckIn;
    airportTransfer;
    conciergeService;
    dailyHousekeeping;
    maxGuests;
    checkInTime;
    checkOutTime;
}
exports.ShortTermAmenitiesDto = ShortTermAmenitiesDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], ShortTermAmenitiesDto.prototype, "hasWifi", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], ShortTermAmenitiesDto.prototype, "hasBreakfast", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], ShortTermAmenitiesDto.prototype, "hasParking", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], ShortTermAmenitiesDto.prototype, "hasTv", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], ShortTermAmenitiesDto.prototype, "hasKitchen", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], ShortTermAmenitiesDto.prototype, "hasKitchenette", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], ShortTermAmenitiesDto.prototype, "hasWasher", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], ShortTermAmenitiesDto.prototype, "hasDryer", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], ShortTermAmenitiesDto.prototype, "hasAirConditioning", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], ShortTermAmenitiesDto.prototype, "hasHeating", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], ShortTermAmenitiesDto.prototype, "petsAllowed", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], ShortTermAmenitiesDto.prototype, "smokingAllowed", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], ShortTermAmenitiesDto.prototype, "partiesAllowed", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], ShortTermAmenitiesDto.prototype, "wheelchairAccessible", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], ShortTermAmenitiesDto.prototype, "selfCheckIn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], ShortTermAmenitiesDto.prototype, "airportTransfer", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], ShortTermAmenitiesDto.prototype, "conciergeService", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], ShortTermAmenitiesDto.prototype, "dailyHousekeeping", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 4, description: 'Maximum number of guests allowed' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(50),
    __metadata("design:type", Number)
], ShortTermAmenitiesDto.prototype, "maxGuests", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '14:00', description: 'Check-in time (HH:mm)' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(5, 5),
    __metadata("design:type", String)
], ShortTermAmenitiesDto.prototype, "checkInTime", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '11:00', description: 'Check-out time (HH:mm)' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(5, 5),
    __metadata("design:type", String)
], ShortTermAmenitiesDto.prototype, "checkOutTime", void 0);
class UnavailableDateRangeDto {
    from;
    to;
    reason;
}
exports.UnavailableDateRangeDto = UnavailableDateRangeDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-04-01', description: 'Block start date (ISO 8601)' }),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], UnavailableDateRangeDto.prototype, "from", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-04-07', description: 'Block end date (ISO 8601)' }),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], UnavailableDateRangeDto.prototype, "to", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'owner_use', description: 'Reason for blocking' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(0, 100),
    __metadata("design:type", String)
], UnavailableDateRangeDto.prototype, "reason", void 0);
class CreatePropertyDto {
    title;
    price;
    originalPrice;
    currency;
    type;
    listingType;
    description;
    city;
    address;
    state;
    neighborhood;
    country;
    latitude;
    longitude;
    amenities;
    pricingUnit;
    minNights;
    maxNights;
    cleaningFee;
    serviceFee;
    weeklyDiscountPercent;
    monthlyDiscountPercent;
    customDiscountNights;
    customDiscountPercent;
    shortTermAmenities;
    isInstantBookable;
    cancellationPolicy;
    advanceNoticeDays;
    bookingWindowDays;
    area;
    yearBuilt;
    floorNumber;
    totalFloors;
    pricePerSqm;
    depositAmount;
    maintenanceFee;
    contactPhone;
    contactWhatsApp;
    contactEmail;
    keywords;
    nearbyAmenities;
    transportAccess;
    virtualTourUrl;
    videoUrl;
    tourType;
    tourThumbnail;
    starRating;
    status;
    images;
    videos;
}
exports.CreatePropertyDto = CreatePropertyDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Cozy Studio near Airport' }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreatePropertyDto.prototype, "title", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 25000, description: 'Price in base currency (per pricingUnit for short-term)' }),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], CreatePropertyDto.prototype, "price", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 30000, description: 'Original price before price reduction' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], CreatePropertyDto.prototype, "originalPrice", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'XAF' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreatePropertyDto.prototype, "currency", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: property_schema_1.PropertyType }),
    (0, class_validator_1.IsEnum)(property_schema_1.PropertyType),
    __metadata("design:type", String)
], CreatePropertyDto.prototype, "type", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: property_schema_1.ListingType, description: 'Use short_term for hotels, vacation rentals, etc.' }),
    (0, class_validator_1.IsEnum)(property_schema_1.ListingType),
    __metadata("design:type", String)
], CreatePropertyDto.prototype, "listingType", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreatePropertyDto.prototype, "description", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Douala' }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreatePropertyDto.prototype, "city", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '123 Rue de la Paix' }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreatePropertyDto.prototype, "address", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'Littoral' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreatePropertyDto.prototype, "state", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'Akwa' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreatePropertyDto.prototype, "neighborhood", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'Cameroon' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreatePropertyDto.prototype, "country", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 4.0511 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], CreatePropertyDto.prototype, "latitude", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 9.7679 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], CreatePropertyDto.prototype, "longitude", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], CreatePropertyDto.prototype, "amenities", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        enum: property_schema_1.PricingUnit,
        description: 'How the price is charged — required when listingType is short_term',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(property_schema_1.PricingUnit),
    __metadata("design:type", String)
], CreatePropertyDto.prototype, "pricingUnit", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 2, description: 'Minimum number of nights per booking' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], CreatePropertyDto.prototype, "minNights", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 14, description: 'Maximum number of nights per booking' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], CreatePropertyDto.prototype, "maxNights", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 5000, description: 'One-time cleaning fee added to the booking total' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], CreatePropertyDto.prototype, "cleaningFee", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 2000, description: 'Additional service fee per booking' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], CreatePropertyDto.prototype, "serviceFee", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 10, description: 'Weekly discount % applied for stays ≥7 nights (0–100)' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.Max)(100),
    __metadata("design:type", Number)
], CreatePropertyDto.prototype, "weeklyDiscountPercent", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 15, description: 'Monthly discount % applied for stays ≥28 nights (0–100)' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.Max)(100),
    __metadata("design:type", Number)
], CreatePropertyDto.prototype, "monthlyDiscountPercent", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 4, description: 'Minimum number of nights required to qualify for custom stay discount' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], CreatePropertyDto.prototype, "customDiscountNights", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 5, description: 'Custom discount percentage applied when stay duration reaches customDiscountNights' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.Max)(100),
    __metadata("design:type", Number)
], CreatePropertyDto.prototype, "customDiscountPercent", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: ShortTermAmenitiesDto }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => ShortTermAmenitiesDto),
    __metadata("design:type", ShortTermAmenitiesDto)
], CreatePropertyDto.prototype, "shortTermAmenities", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        example: false,
        description: 'If true, bookings are auto-confirmed (Instant Book)',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CreatePropertyDto.prototype, "isInstantBookable", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        enum: property_schema_1.CancellationPolicy,
        description: 'Refund policy applied when a guest cancels',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(property_schema_1.CancellationPolicy),
    __metadata("design:type", String)
], CreatePropertyDto.prototype, "cancellationPolicy", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 1, description: 'Days of advance notice required before check-in' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], CreatePropertyDto.prototype, "advanceNoticeDays", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 180, description: 'How many days ahead guests can book' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], CreatePropertyDto.prototype, "bookingWindowDays", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 45 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], CreatePropertyDto.prototype, "area", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 2020 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], CreatePropertyDto.prototype, "yearBuilt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], CreatePropertyDto.prototype, "floorNumber", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], CreatePropertyDto.prototype, "totalFloors", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], CreatePropertyDto.prototype, "pricePerSqm", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], CreatePropertyDto.prototype, "depositAmount", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], CreatePropertyDto.prototype, "maintenanceFee", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreatePropertyDto.prototype, "contactPhone", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'WhatsApp number (primary contact channel in Cameroon)' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreatePropertyDto.prototype, "contactWhatsApp", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreatePropertyDto.prototype, "contactEmail", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: [String] }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], CreatePropertyDto.prototype, "keywords", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: [String] }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], CreatePropertyDto.prototype, "nearbyAmenities", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: [String] }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], CreatePropertyDto.prototype, "transportAccess", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreatePropertyDto.prototype, "virtualTourUrl", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreatePropertyDto.prototype, "videoUrl", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        enum: ['kuula', 'youtube', 'images', 'none'],
        description: 'Which tour renderer to use',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(['kuula', 'youtube', 'images', 'none']),
    __metadata("design:type", String)
], CreatePropertyDto.prototype, "tourType", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Cloudinary URL for tour preview thumbnail' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreatePropertyDto.prototype, "tourThumbnail", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 4, description: 'Star rating (hotels only): 1–5' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(5),
    __metadata("design:type", Number)
], CreatePropertyDto.prototype, "starRating", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: property_schema_1.PropertyStatus }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(property_schema_1.PropertyStatus),
    __metadata("design:type", String)
], CreatePropertyDto.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: [Object] }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    __metadata("design:type", Array)
], CreatePropertyDto.prototype, "images", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: [Object] }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    __metadata("design:type", Array)
], CreatePropertyDto.prototype, "videos", void 0);
class UpdatePropertyDto extends (0, swagger_1.PartialType)(CreatePropertyDto) {
    availability;
    isVerified;
    isFeatured;
    isActive;
}
exports.UpdatePropertyDto = UpdatePropertyDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: property_schema_1.PropertyStatus }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(property_schema_1.PropertyStatus),
    __metadata("design:type", String)
], UpdatePropertyDto.prototype, "availability", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpdatePropertyDto.prototype, "isVerified", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpdatePropertyDto.prototype, "isFeatured", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpdatePropertyDto.prototype, "isActive", void 0);
class BlockDatesDto {
    ranges;
}
exports.BlockDatesDto = BlockDatesDto;
__decorate([
    (0, swagger_1.ApiProperty)({ type: [UnavailableDateRangeDto], description: 'Date ranges to block' }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => UnavailableDateRangeDto),
    __metadata("design:type", Array)
], BlockDatesDto.prototype, "ranges", void 0);
class UnblockDatesDto {
    fromDates;
}
exports.UnblockDatesDto = UnblockDatesDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        example: ['2026-04-01', '2026-04-07'],
        description: 'Block start dates to remove (identifies the range to remove)',
    }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsDateString)({}, { each: true }),
    __metadata("design:type", Array)
], UnblockDatesDto.prototype, "fromDates", void 0);
class UpdateCalendarSettingsDto {
    basePrice;
    weekendPrice;
    minNights;
    maxNights;
    noticeDays;
    windowMonths;
}
exports.UpdateCalendarSettingsDto = UpdateCalendarSettingsDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 50000, description: 'Base price per night in XAF' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], UpdateCalendarSettingsDto.prototype, "basePrice", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 60000, description: 'Weekend price per night (null = same as base)' }),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Object)
], UpdateCalendarSettingsDto.prototype, "weekendPrice", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 2, description: 'Minimum nights stay' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], UpdateCalendarSettingsDto.prototype, "minNights", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 30, description: 'Maximum nights stay (null = no limit)' }),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Object)
], UpdateCalendarSettingsDto.prototype, "maxNights", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 0, description: 'Advance notice in days before check-in' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], UpdateCalendarSettingsDto.prototype, "noticeDays", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 12, description: 'How far ahead guests can book in months (null = no limit)' }),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Object)
], UpdateCalendarSettingsDto.prototype, "windowMonths", void 0);
class SetCalendarPricesDto {
    from;
    to;
    price;
}
exports.SetCalendarPricesDto = SetCalendarPricesDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-05-01', description: 'Range start (YYYY-MM-DD)' }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SetCalendarPricesDto.prototype, "from", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-05-05', description: 'Range end (YYYY-MM-DD)' }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SetCalendarPricesDto.prototype, "to", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 45000, description: 'Override price per night (null to remove override)' }),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Object)
], SetCalendarPricesDto.prototype, "price", void 0);
class AddExternalCalendarDto {
    name;
    url;
}
exports.AddExternalCalendarDto = AddExternalCalendarDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Airbnb', description: 'Calendar feed name' }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], AddExternalCalendarDto.prototype, "name", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'https://airbnb.com/calendar/ical/...', description: 'iCal URL' }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], AddExternalCalendarDto.prototype, "url", void 0);
//# sourceMappingURL=property.dto.js.map