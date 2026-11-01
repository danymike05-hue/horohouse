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
exports.GetStudentProfilesQueryDto = exports.GrantAmbassadorDto = exports.ReviewStudentIdDto = exports.UpdateStudentProfileDto = exports.CreateStudentProfileDto = void 0;
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
const swagger_1 = require("@nestjs/swagger");
const user_schema_1 = require("../../users/schemas/user.schema");
class CreateStudentProfileDto {
    universityName;
    campusCity;
    campusName;
    faculty;
    studyLevel;
    enrollmentYear;
    campusLatitude;
    campusLongitude;
}
exports.CreateStudentProfileDto = CreateStudentProfileDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'University of Buea', description: 'Full university name' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(2, 100),
    __metadata("design:type", String)
], CreateStudentProfileDto.prototype, "universityName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Yaoundé', description: 'City where the campus is located' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(2, 50),
    __metadata("design:type", String)
], CreateStudentProfileDto.prototype, "campusCity", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'University of Buea Main Campus', description: 'Specific campus name' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(2, 120),
    __metadata("design:type", String)
], CreateStudentProfileDto.prototype, "campusName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'Faculty of Engineering and Technology' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(2, 120),
    __metadata("design:type", String)
], CreateStudentProfileDto.prototype, "faculty", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'L3', description: 'Study level — L1, L2, L3, Master 1, Master 2, PhD' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(1, 20),
    __metadata("design:type", String)
], CreateStudentProfileDto.prototype, "studyLevel", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 2022 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(2000),
    (0, class_validator_1.Max)(new Date().getFullYear()),
    __metadata("design:type", Number)
], CreateStudentProfileDto.prototype, "enrollmentYear", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 4.0511, description: 'Latitude of the nearest campus gate' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], CreateStudentProfileDto.prototype, "campusLatitude", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 9.7679, description: 'Longitude of the nearest campus gate' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], CreateStudentProfileDto.prototype, "campusLongitude", void 0);
class UpdateStudentProfileDto extends (0, swagger_1.PartialType)(CreateStudentProfileDto) {
    roommateMode;
    isSeekingRoommate;
}
exports.UpdateStudentProfileDto = UpdateStudentProfileDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        example: 'need_room',
        enum: ['have_room', 'need_room'],
        description: 'Whether student has a spare room or needs one',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['have_room', 'need_room']),
    __metadata("design:type", String)
], UpdateStudentProfileDto.prototype, "roommateMode", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: true, description: 'Whether student is actively seeking a roommate' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpdateStudentProfileDto.prototype, "isSeekingRoommate", void 0);
class ReviewStudentIdDto {
    decision;
    rejectionReason;
}
exports.ReviewStudentIdDto = ReviewStudentIdDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        enum: [user_schema_1.StudentVerificationStatus.VERIFIED, user_schema_1.StudentVerificationStatus.REJECTED],
        description: 'Approve or reject the submitted student ID',
    }),
    (0, class_validator_1.IsEnum)([user_schema_1.StudentVerificationStatus.VERIFIED, user_schema_1.StudentVerificationStatus.REJECTED]),
    __metadata("design:type", String)
], ReviewStudentIdDto.prototype, "decision", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        example: 'ID appears expired. Please upload a valid document.',
        description: 'Required when decision is rejected — shown to the student',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(5, 500),
    __metadata("design:type", String)
], ReviewStudentIdDto.prototype, "rejectionReason", void 0);
class GrantAmbassadorDto {
    ambassadorCode;
}
exports.GrantAmbassadorDto = GrantAmbassadorDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'UB-PAUL-2025', description: 'Unique referral code for the ambassador' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(4, 30),
    __metadata("design:type", String)
], GrantAmbassadorDto.prototype, "ambassadorCode", void 0);
class GetStudentProfilesQueryDto {
    page = 1;
    limit = 20;
    verificationStatus;
    campusCity;
    isAmbassador;
}
exports.GetStudentProfilesQueryDto = GetStudentProfilesQueryDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 1 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], GetStudentProfilesQueryDto.prototype, "page", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 20 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(100),
    __metadata("design:type", Number)
], GetStudentProfilesQueryDto.prototype, "limit", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: user_schema_1.StudentVerificationStatus }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(user_schema_1.StudentVerificationStatus),
    __metadata("design:type", String)
], GetStudentProfilesQueryDto.prototype, "verificationStatus", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'Buea' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], GetStudentProfilesQueryDto.prototype, "campusCity", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: false }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], GetStudentProfilesQueryDto.prototype, "isAmbassador", void 0);
//# sourceMappingURL=student-profile.dto.js.map