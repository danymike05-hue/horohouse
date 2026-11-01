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
exports.SearchRoommatesDto = exports.UpdateRoommateProfileDto = exports.CreateRoommateProfileDto = void 0;
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
const swagger_1 = require("@nestjs/swagger");
const roommate_profile_schema_1 = require("../schemas/roommate-profile.schema");
class CreateRoommateProfileDto {
    mode;
    propertyId;
    campusCity;
    preferredNeighborhood;
    budgetPerPersonMax;
    budgetPerPersonMin;
    moveInDate;
    moveInFlexibilityDays;
    sleepSchedule;
    cleanlinessLevel;
    socialHabit;
    studyHabit;
    isSmoker;
    acceptsSmoker;
    hasPet;
    acceptsPet;
    preferredRoommateGender;
    bio;
}
exports.CreateRoommateProfileDto = CreateRoommateProfileDto;
__decorate([
    (0, swagger_1.ApiProperty)({ enum: roommate_profile_schema_1.RoommateMode, description: 'have_room = spare bed available; need_room = looking for a place' }),
    (0, class_validator_1.IsEnum)(roommate_profile_schema_1.RoommateMode),
    __metadata("design:type", String)
], CreateRoommateProfileDto.prototype, "mode", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '64abc123...', description: 'Required when mode is have_room — your property listing ID' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsMongoId)(),
    __metadata("design:type", String)
], CreateRoommateProfileDto.prototype, "propertyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Buea' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(2, 50),
    __metadata("design:type", String)
], CreateRoommateProfileDto.prototype, "campusCity", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'Molyko' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(2, 80),
    __metadata("design:type", String)
], CreateRoommateProfileDto.prototype, "preferredNeighborhood", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 45000, description: 'Max budget per person per month in XAF' }),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], CreateRoommateProfileDto.prototype, "budgetPerPersonMax", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 20000, description: 'Min budget per person (optional floor)' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], CreateRoommateProfileDto.prototype, "budgetPerPersonMin", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2025-09-01', description: 'Target move-in date (ISO 8601)' }),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], CreateRoommateProfileDto.prototype, "moveInDate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 14, description: 'Flexibility in days around the move-in date' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], CreateRoommateProfileDto.prototype, "moveInFlexibilityDays", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: roommate_profile_schema_1.SleepSchedule }),
    (0, class_validator_1.IsEnum)(roommate_profile_schema_1.SleepSchedule),
    __metadata("design:type", String)
], CreateRoommateProfileDto.prototype, "sleepSchedule", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: roommate_profile_schema_1.CleanlinessLevel }),
    (0, class_validator_1.IsEnum)(roommate_profile_schema_1.CleanlinessLevel),
    __metadata("design:type", String)
], CreateRoommateProfileDto.prototype, "cleanlinessLevel", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: roommate_profile_schema_1.SocialHabit }),
    (0, class_validator_1.IsEnum)(roommate_profile_schema_1.SocialHabit),
    __metadata("design:type", String)
], CreateRoommateProfileDto.prototype, "socialHabit", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: roommate_profile_schema_1.StudyHabit }),
    (0, class_validator_1.IsEnum)(roommate_profile_schema_1.StudyHabit),
    __metadata("design:type", String)
], CreateRoommateProfileDto.prototype, "studyHabit", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: false }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CreateRoommateProfileDto.prototype, "isSmoker", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: false }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CreateRoommateProfileDto.prototype, "acceptsSmoker", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: false }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CreateRoommateProfileDto.prototype, "hasPet", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: false }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CreateRoommateProfileDto.prototype, "acceptsPet", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: ['male', 'female', 'any'], example: 'any' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(['male', 'female', 'any']),
    __metadata("design:type", String)
], CreateRoommateProfileDto.prototype, "preferredRoommateGender", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'L3 CS student. I study late but keep the place tidy.', maxLength: 300 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(0, 300),
    __metadata("design:type", String)
], CreateRoommateProfileDto.prototype, "bio", void 0);
class UpdateRoommateProfileDto extends (0, swagger_1.PartialType)(CreateRoommateProfileDto) {
}
exports.UpdateRoommateProfileDto = UpdateRoommateProfileDto;
class SearchRoommatesDto {
    page = 1;
    limit = 20;
    campusCity;
    mode;
    maxBudget;
    sleepSchedule;
    cleanlinessLevel;
    preferredRoommateGender;
    acceptsSmoker;
    acceptsPet;
}
exports.SearchRoommatesDto = SearchRoommatesDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 1 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], SearchRoommatesDto.prototype, "page", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 20 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(50),
    __metadata("design:type", Number)
], SearchRoommatesDto.prototype, "limit", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'Buea', description: 'Filter by campus city' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SearchRoommatesDto.prototype, "campusCity", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: roommate_profile_schema_1.RoommateMode }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(roommate_profile_schema_1.RoommateMode),
    __metadata("design:type", String)
], SearchRoommatesDto.prototype, "mode", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 50000, description: 'Max budget per person filter' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], SearchRoommatesDto.prototype, "maxBudget", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: roommate_profile_schema_1.SleepSchedule }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(roommate_profile_schema_1.SleepSchedule),
    __metadata("design:type", String)
], SearchRoommatesDto.prototype, "sleepSchedule", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: roommate_profile_schema_1.CleanlinessLevel }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(roommate_profile_schema_1.CleanlinessLevel),
    __metadata("design:type", String)
], SearchRoommatesDto.prototype, "cleanlinessLevel", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: ['male', 'female', 'any'] }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(['male', 'female', 'any']),
    __metadata("design:type", String)
], SearchRoommatesDto.prototype, "preferredRoommateGender", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: false }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Boolean),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], SearchRoommatesDto.prototype, "acceptsSmoker", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: false }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Boolean),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], SearchRoommatesDto.prototype, "acceptsPet", void 0);
//# sourceMappingURL=roommate.dto.js.map