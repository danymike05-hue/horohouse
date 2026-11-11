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
exports.default = exports.RespondReviewDto = exports.UpdateReviewDto = exports.CreateReviewDto = exports.GuestSubRatingsDto = exports.StaySubRatingsDto = void 0;
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
const swagger_1 = require("@nestjs/swagger");
const review_schema_1 = require("../schemas/review.schema");
class StaySubRatingsDto {
    cleanliness;
    accuracy;
    checkIn;
    communication;
    location;
    value;
}
exports.StaySubRatingsDto = StaySubRatingsDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 5, description: 'Cleanliness of the property (1–5)' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(5),
    __metadata("design:type", Number)
], StaySubRatingsDto.prototype, "cleanliness", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 4, description: 'Did the listing match the description? (1–5)' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(5),
    __metadata("design:type", Number)
], StaySubRatingsDto.prototype, "accuracy", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 5, description: 'Smoothness of check-in (1–5)' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(5),
    __metadata("design:type", Number)
], StaySubRatingsDto.prototype, "checkIn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 5, description: 'Host communication (1–5)' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(5),
    __metadata("design:type", Number)
], StaySubRatingsDto.prototype, "communication", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 4, description: 'Neighbourhood / location (1–5)' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(5),
    __metadata("design:type", Number)
], StaySubRatingsDto.prototype, "location", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 4, description: 'Value for money (1–5)' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(5),
    __metadata("design:type", Number)
], StaySubRatingsDto.prototype, "value", void 0);
class GuestSubRatingsDto {
    cleanliness;
    communication;
    rulesFollowed;
    wouldHostAgain;
}
exports.GuestSubRatingsDto = GuestSubRatingsDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 5, description: 'Did the guest leave the place clean? (1–5)' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(5),
    __metadata("design:type", Number)
], GuestSubRatingsDto.prototype, "cleanliness", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 5, description: 'Was the guest easy to communicate with? (1–5)' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(5),
    __metadata("design:type", Number)
], GuestSubRatingsDto.prototype, "communication", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 5, description: 'Did they respect house rules? (1–5)' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(5),
    __metadata("design:type", Number)
], GuestSubRatingsDto.prototype, "rulesFollowed", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: true, description: 'Would you host this guest again?' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], GuestSubRatingsDto.prototype, "wouldHostAgain", void 0);
class CreateReviewDto {
    reviewType;
    propertyId;
    agentId;
    bookingId;
    insightId;
    rating;
    staySubRatings;
    guestSubRatings;
    comment;
    images;
}
exports.CreateReviewDto = CreateReviewDto;
exports.default = CreateReviewDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        enum: review_schema_1.ReviewType,
        description: 'property | agent — existing types. ' +
            'stay — guest reviews the property after a completed booking. ' +
            'guest — host reviews the guest after a completed booking.',
    }),
    (0, class_validator_1.IsEnum)(review_schema_1.ReviewType),
    __metadata("design:type", String)
], CreateReviewDto.prototype, "reviewType", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Required for reviewType = property' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsMongoId)(),
    __metadata("design:type", String)
], CreateReviewDto.prototype, "propertyId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Required for reviewType = agent' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsMongoId)(),
    __metadata("design:type", String)
], CreateReviewDto.prototype, "agentId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Required for reviewType = stay or guest. ' +
            'Must reference a COMPLETED booking where the caller is the guest (stay) or host (guest).',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsMongoId)(),
    __metadata("design:type", String)
], CreateReviewDto.prototype, "bookingId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Required for reviewType = insight' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsMongoId)(),
    __metadata("design:type", String)
], CreateReviewDto.prototype, "insightId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 5, description: 'Overall rating 1–5' }),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(5),
    __metadata("design:type", Number)
], CreateReviewDto.prototype, "rating", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: StaySubRatingsDto,
        description: 'Granular sub-ratings — only for reviewType = stay',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => StaySubRatingsDto),
    __metadata("design:type", StaySubRatingsDto)
], CreateReviewDto.prototype, "staySubRatings", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: GuestSubRatingsDto,
        description: 'Sub-ratings for the guest — only for reviewType = guest',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => GuestSubRatingsDto),
    __metadata("design:type", GuestSubRatingsDto)
], CreateReviewDto.prototype, "guestSubRatings", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'Wonderful place, very clean and exactly as described.' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(10, { message: 'Review must be at least 10 characters' }),
    (0, class_validator_1.MaxLength)(1000, { message: 'Review must not exceed 1000 characters' }),
    __metadata("design:type", String)
], CreateReviewDto.prototype, "comment", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: [String], description: 'Optional photo URLs' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], CreateReviewDto.prototype, "images", void 0);
class UpdateReviewDto {
    rating;
    staySubRatings;
    guestSubRatings;
    comment;
    images;
}
exports.UpdateReviewDto = UpdateReviewDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 4 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(5),
    __metadata("design:type", Number)
], UpdateReviewDto.prototype, "rating", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: StaySubRatingsDto }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => StaySubRatingsDto),
    __metadata("design:type", StaySubRatingsDto)
], UpdateReviewDto.prototype, "staySubRatings", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: GuestSubRatingsDto }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => GuestSubRatingsDto),
    __metadata("design:type", GuestSubRatingsDto)
], UpdateReviewDto.prototype, "guestSubRatings", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(10),
    (0, class_validator_1.MaxLength)(1000),
    __metadata("design:type", String)
], UpdateReviewDto.prototype, "comment", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: [String] }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], UpdateReviewDto.prototype, "images", void 0);
class RespondReviewDto {
    response;
}
exports.RespondReviewDto = RespondReviewDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Thank you for staying with us! We hope to see you again.' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(10, { message: 'Response must be at least 10 characters' }),
    (0, class_validator_1.MaxLength)(500, { message: 'Response must not exceed 500 characters' }),
    __metadata("design:type", String)
], RespondReviewDto.prototype, "response", void 0);
//# sourceMappingURL=index.js.map