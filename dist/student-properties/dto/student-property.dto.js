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
exports.MarkStudentFriendlyDto = exports.StudentPropertySearchDto = void 0;
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
const swagger_1 = require("@nestjs/swagger");
const property_schema_1 = require("../../properties/schemas/property.schema");
class StudentPropertySearchDto {
    page = 1;
    limit = 20;
    sortBy = 'campusProximityMeters';
    sortOrder = 'asc';
    city;
    neighborhood;
    nearestCampus;
    maxCampusProximityMeters;
    minPricePerPerson;
    maxPricePerPerson;
    waterSource;
    electricityBackup;
    furnishingStatus;
    genderRestriction;
    noCurfew;
    visitorsAllowed;
    hasGatedCompound;
    hasNightWatchman;
    studentApprovedOnly;
    acceptsRentAdvanceScheme;
    maxAdvanceMonths;
    hasAvailableBeds;
    minAvailableBeds;
}
exports.StudentPropertySearchDto = StudentPropertySearchDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 1 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], StudentPropertySearchDto.prototype, "page", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 20 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(50),
    __metadata("design:type", Number)
], StudentPropertySearchDto.prototype, "limit", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: ['createdAt', 'price', 'campusProximityMeters', 'pricePerPersonMonthly'], example: 'campusProximityMeters' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], StudentPropertySearchDto.prototype, "sortBy", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: ['asc', 'desc'], example: 'asc' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(['asc', 'desc']),
    __metadata("design:type", String)
], StudentPropertySearchDto.prototype, "sortOrder", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'Buea', description: 'Filter by city' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], StudentPropertySearchDto.prototype, "city", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'Molyko', description: 'Filter by neighborhood' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], StudentPropertySearchDto.prototype, "neighborhood", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'University of Buea', description: 'Filter by nearest campus name' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], StudentPropertySearchDto.prototype, "nearestCampus", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 2000, description: 'Max walking distance to campus in metres' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], StudentPropertySearchDto.prototype, "maxCampusProximityMeters", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 20000, description: 'Min price per person per month in XAF' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], StudentPropertySearchDto.prototype, "minPricePerPerson", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 60000, description: 'Max price per person per month in XAF' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], StudentPropertySearchDto.prototype, "maxPricePerPerson", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: property_schema_1.WaterSource }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(property_schema_1.WaterSource),
    __metadata("design:type", String)
], StudentPropertySearchDto.prototype, "waterSource", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: property_schema_1.ElectricityBackup }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(property_schema_1.ElectricityBackup),
    __metadata("design:type", String)
], StudentPropertySearchDto.prototype, "electricityBackup", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: property_schema_1.FurnishingStatus }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(property_schema_1.FurnishingStatus),
    __metadata("design:type", String)
], StudentPropertySearchDto.prototype, "furnishingStatus", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: property_schema_1.GenderRestriction, example: 'none' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(property_schema_1.GenderRestriction),
    __metadata("design:type", String)
], StudentPropertySearchDto.prototype, "genderRestriction", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: false, description: 'Only show properties with no curfew' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Boolean),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], StudentPropertySearchDto.prototype, "noCurfew", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: true, description: 'Only show properties where visitors are allowed' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Boolean),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], StudentPropertySearchDto.prototype, "visitorsAllowed", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: true, description: 'Only show gated compounds' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Boolean),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], StudentPropertySearchDto.prototype, "hasGatedCompound", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: true, description: 'Only show properties with a night watchman' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Boolean),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], StudentPropertySearchDto.prototype, "hasNightWatchman", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: true, description: 'Only show Student-Approved landlord listings' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Boolean),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], StudentPropertySearchDto.prototype, "studentApprovedOnly", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: true, description: 'Only show landlords who accept the rent-advance scheme' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Boolean),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], StudentPropertySearchDto.prototype, "acceptsRentAdvanceScheme", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 6, description: 'Max advance months the landlord accepts' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(12),
    __metadata("design:type", Number)
], StudentPropertySearchDto.prototype, "maxAdvanceMonths", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: true, description: 'Only show properties with available beds for colocation' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Boolean),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], StudentPropertySearchDto.prototype, "hasAvailableBeds", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 2, description: 'Minimum available beds' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], StudentPropertySearchDto.prototype, "minAvailableBeds", void 0);
class MarkStudentFriendlyDto {
    campusProximityMeters;
    nearestCampus;
    walkingMinutes;
    taxiMinutes;
    waterSource;
    electricityBackup;
    furnishingStatus;
    genderRestriction;
    curfewTime;
    visitorsAllowed;
    cookingAllowed;
    hasGatedCompound;
    hasNightWatchman;
    hasFence;
    maxAdvanceMonths;
    acceptsRentAdvanceScheme;
    availableBeds;
    totalBeds;
    pricePerPersonMonthly;
}
exports.MarkStudentFriendlyDto = MarkStudentFriendlyDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 2000 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], MarkStudentFriendlyDto.prototype, "campusProximityMeters", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'University of Buea' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], MarkStudentFriendlyDto.prototype, "nearestCampus", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 10 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], MarkStudentFriendlyDto.prototype, "walkingMinutes", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 5 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], MarkStudentFriendlyDto.prototype, "taxiMinutes", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: property_schema_1.WaterSource }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(property_schema_1.WaterSource),
    __metadata("design:type", String)
], MarkStudentFriendlyDto.prototype, "waterSource", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: property_schema_1.ElectricityBackup }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(property_schema_1.ElectricityBackup),
    __metadata("design:type", String)
], MarkStudentFriendlyDto.prototype, "electricityBackup", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: property_schema_1.FurnishingStatus }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(property_schema_1.FurnishingStatus),
    __metadata("design:type", String)
], MarkStudentFriendlyDto.prototype, "furnishingStatus", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: property_schema_1.GenderRestriction }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(property_schema_1.GenderRestriction),
    __metadata("design:type", String)
], MarkStudentFriendlyDto.prototype, "genderRestriction", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '22:00' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], MarkStudentFriendlyDto.prototype, "curfewTime", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], MarkStudentFriendlyDto.prototype, "visitorsAllowed", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], MarkStudentFriendlyDto.prototype, "cookingAllowed", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], MarkStudentFriendlyDto.prototype, "hasGatedCompound", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], MarkStudentFriendlyDto.prototype, "hasNightWatchman", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], MarkStudentFriendlyDto.prototype, "hasFence", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 6, description: 'Max advance months the landlord accepts (1–12)' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(12),
    __metadata("design:type", Number)
], MarkStudentFriendlyDto.prototype, "maxAdvanceMonths", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: false }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], MarkStudentFriendlyDto.prototype, "acceptsRentAdvanceScheme", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 1 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], MarkStudentFriendlyDto.prototype, "availableBeds", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 2 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], MarkStudentFriendlyDto.prototype, "totalBeds", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 35000, description: 'Price per person per month in XAF' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], MarkStudentFriendlyDto.prototype, "pricePerPersonMonthly", void 0);
//# sourceMappingURL=student-property.dto.js.map