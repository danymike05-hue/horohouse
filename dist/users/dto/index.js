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
exports.RecordHostPayoutDto = exports.VerifyHostDto = exports.UpdateHostProfileDto = exports.PayoutAccountDto = exports.SetRoleDto = exports.UpdateTenantDto = exports.CreateTenantDto = exports.UserStatsDto = exports.PaginatedAgentsResponseDto = exports.AgentResponseDto = exports.AgentStatsDto = exports.PaginatedUsersResponseDto = exports.UserResponseDto = exports.GetUsersQueryDto = exports.SearchQueryDto = exports.UpdatePreferencesDto = exports.UpdateOwnProfileDto = exports.UpdateUserDto = exports.CreateUserDto = exports.UserPreferencesDto = exports.GetViewedPropertiesDto = exports.LocationDto = void 0;
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
const swagger_1 = require("@nestjs/swagger");
const user_schema_1 = require("../schemas/user.schema");
class LocationDto {
    type = 'Point';
    coordinates;
}
exports.LocationDto = LocationDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Point' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], LocationDto.prototype, "type", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: [9.2, 45.4],
        description: 'Coordinates in [longitude, latitude] format'
    }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsNumber)({}, { each: true }),
    (0, class_validator_1.ArrayMaxSize)(2),
    __metadata("design:type", Array)
], LocationDto.prototype, "coordinates", void 0);
class GetViewedPropertiesDto {
    page = 1;
    limit = 20;
    sortBy = 'viewedAt';
    sortOrder = 'desc';
}
exports.GetViewedPropertiesDto = GetViewedPropertiesDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], GetViewedPropertiesDto.prototype, "page", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(100),
    __metadata("design:type", Number)
], GetViewedPropertiesDto.prototype, "limit", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], GetViewedPropertiesDto.prototype, "sortBy", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['asc', 'desc']),
    __metadata("design:type", String)
], GetViewedPropertiesDto.prototype, "sortOrder", void 0);
class UserPreferencesDto {
    minPrice;
    maxPrice;
    currency;
    propertyTypes;
    cities;
    amenities;
    bedrooms;
    bathrooms;
    maxRadius;
    minArea;
    maxArea;
    preferredLocation;
}
exports.UserPreferencesDto = UserPreferencesDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 100000, description: 'Minimum price in currency units' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], UserPreferencesDto.prototype, "minPrice", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 500000, description: 'Maximum price in currency units' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], UserPreferencesDto.prototype, "maxPrice", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'XAF', description: 'Preferred currency code' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UserPreferencesDto.prototype, "currency", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: ['Apartment', 'House'], description: 'Preferred property types' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], UserPreferencesDto.prototype, "propertyTypes", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: ['Douala', 'Yaoundé'], description: 'Preferred cities / areas' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], UserPreferencesDto.prototype, "cities", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: ['Parking', 'Gym'], description: 'Preferred features / amenities' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], UserPreferencesDto.prototype, "amenities", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: [2, 3], description: 'Preferred number of bedrooms (multi-select)' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsNumber)({}, { each: true }),
    __metadata("design:type", Array)
], UserPreferencesDto.prototype, "bedrooms", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: [1, 2], description: 'Preferred number of bathrooms (multi-select)' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsNumber)({}, { each: true }),
    __metadata("design:type", Array)
], UserPreferencesDto.prototype, "bathrooms", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 10, description: 'Maximum search radius in kilometres' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(100),
    __metadata("design:type", Number)
], UserPreferencesDto.prototype, "maxRadius", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 50, description: 'Minimum area in m²' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], UserPreferencesDto.prototype, "minArea", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 5000, description: 'Maximum area in m²' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], UserPreferencesDto.prototype, "maxArea", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: LocationDto, description: 'Preferred location coordinates' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => LocationDto),
    __metadata("design:type", LocationDto)
], UserPreferencesDto.prototype, "preferredLocation", void 0);
class CreateUserDto {
    name;
    email;
    phoneNumber;
    role;
    firebaseUid;
    googleId;
    licenseNumber;
    agency;
    bio;
    website;
    address;
    city;
    country;
    location;
    preferences;
    emailNotifications;
    smsNotifications;
    pushNotifications;
}
exports.CreateUserDto = CreateUserDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 'John Doe',
        description: 'Full name of the user'
    }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(2, 100),
    (0, class_transformer_1.Transform)(({ value }) => value?.trim()),
    __metadata("design:type", String)
], CreateUserDto.prototype, "name", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        example: 'john.doe@example.com',
        description: 'Email address (optional)'
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEmail)(),
    (0, class_transformer_1.Transform)(({ value }) => value?.toLowerCase()?.trim()),
    __metadata("design:type", String)
], CreateUserDto.prototype, "email", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: '+237123456789',
        description: 'Phone number with country code'
    }),
    (0, class_validator_1.IsPhoneNumber)(),
    __metadata("design:type", String)
], CreateUserDto.prototype, "phoneNumber", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        enum: user_schema_1.UserRole,
        example: user_schema_1.UserRole.REGISTERED_USER,
        description: 'User role'
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(user_schema_1.UserRole),
    __metadata("design:type", String)
], CreateUserDto.prototype, "role", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 'firebase-uid-123',
        description: 'Firebase UID for authentication'
    }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(10, 128),
    __metadata("design:type", String)
], CreateUserDto.prototype, "firebaseUid", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        example: 'google-id-123',
        description: 'Google OAuth ID (optional)'
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateUserDto.prototype, "googleId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        example: 'LIC123456789',
        description: 'Real estate license number (for agents)'
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(5, 50),
    __metadata("design:type", String)
], CreateUserDto.prototype, "licenseNumber", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        example: 'Century 21',
        description: 'Real estate agency name (for agents)'
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(2, 100),
    __metadata("design:type", String)
], CreateUserDto.prototype, "agency", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        example: 'Experienced real estate agent with 10+ years in the field',
        description: 'Professional bio (for agents)'
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(10, 1000),
    __metadata("design:type", String)
], CreateUserDto.prototype, "bio", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        example: 'https://www.myagency.com',
        description: 'Website URL (for agents)'
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(/^https?:\/\/.+\..+$/i, {
        message: 'Website must be a valid URL'
    }),
    __metadata("design:type", String)
], CreateUserDto.prototype, "website", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        example: '123 Main Street, Downtown',
        description: 'Office or home address'
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(5, 200),
    __metadata("design:type", String)
], CreateUserDto.prototype, "address", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        example: 'Douala',
        description: 'City'
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(2, 50),
    __metadata("design:type", String)
], CreateUserDto.prototype, "city", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        example: 'Cameroon',
        description: 'Country'
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(2, 50),
    __metadata("design:type", String)
], CreateUserDto.prototype, "country", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: LocationDto,
        description: 'Geographic location coordinates'
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => LocationDto),
    __metadata("design:type", LocationDto)
], CreateUserDto.prototype, "location", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: UserPreferencesDto,
        description: 'User preferences for property searches'
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => UserPreferencesDto),
    __metadata("design:type", UserPreferencesDto)
], CreateUserDto.prototype, "preferences", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        example: true,
        description: 'Enable email notifications'
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CreateUserDto.prototype, "emailNotifications", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        example: true,
        description: 'Enable SMS notifications'
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CreateUserDto.prototype, "smsNotifications", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        example: true,
        description: 'Enable push notifications'
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CreateUserDto.prototype, "pushNotifications", void 0);
class UpdateUserDto extends (0, swagger_1.PartialType)(CreateUserDto) {
    isActive;
    emailVerified;
    phoneVerified;
    profilePicture;
    propertiesListed;
    propertiesSold;
}
exports.UpdateUserDto = UpdateUserDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        example: false,
        description: 'Mark user as active/inactive'
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpdateUserDto.prototype, "isActive", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        example: true,
        description: 'Email verification status'
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpdateUserDto.prototype, "emailVerified", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        example: true,
        description: 'Phone verification status'
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpdateUserDto.prototype, "phoneVerified", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        example: 'https://example.com/profile.jpg',
        description: 'Profile picture URL'
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(/^https?:\/\/.+\.(jpg|jpeg|png|gif|webp)$/i, {
        message: 'Profile picture must be a valid image URL'
    }),
    __metadata("design:type", String)
], UpdateUserDto.prototype, "profilePicture", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        example: 25,
        description: 'Number of properties listed (for agents)'
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], UpdateUserDto.prototype, "propertiesListed", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        example: 12,
        description: 'Number of properties sold (for agents)'
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], UpdateUserDto.prototype, "propertiesSold", void 0);
class UpdateOwnProfileDto extends (0, swagger_1.OmitType)(UpdateUserDto, [
    'isActive',
    'emailVerified',
    'phoneVerified',
    'propertiesListed',
    'propertiesSold',
    'role',
]) {
}
exports.UpdateOwnProfileDto = UpdateOwnProfileDto;
class UpdatePreferencesDto extends UserPreferencesDto {
}
exports.UpdatePreferencesDto = UpdatePreferencesDto;
class SearchQueryDto {
    query;
    filters;
    location;
    resultsCount;
}
exports.SearchQueryDto = SearchQueryDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 'apartment in douala',
        description: 'Search query string'
    }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(1, 200),
    __metadata("design:type", String)
], SearchQueryDto.prototype, "query", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: { minPrice: 100000, maxPrice: 500000, type: 'apartment' },
        description: 'Search filters object'
    }),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], SearchQueryDto.prototype, "filters", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: LocationDto,
        description: 'Search location coordinates'
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => LocationDto),
    __metadata("design:type", LocationDto)
], SearchQueryDto.prototype, "location", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 25,
        description: 'Number of results returned'
    }),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], SearchQueryDto.prototype, "resultsCount", void 0);
class GetUsersQueryDto {
    page = 1;
    limit = 10;
    role;
    isActive;
    search;
}
exports.GetUsersQueryDto = GetUsersQueryDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        example: 1,
        description: 'Page number'
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], GetUsersQueryDto.prototype, "page", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        example: 10,
        description: 'Number of items per page'
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(100),
    __metadata("design:type", Number)
], GetUsersQueryDto.prototype, "limit", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        enum: user_schema_1.UserRole,
        description: 'Filter by user role'
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(user_schema_1.UserRole),
    __metadata("design:type", String)
], GetUsersQueryDto.prototype, "role", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        example: true,
        description: 'Filter by active status'
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => value === 'true'),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], GetUsersQueryDto.prototype, "isActive", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        example: 'john',
        description: 'Search term for name, email, or phone'
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(1, 50),
    __metadata("design:type", String)
], GetUsersQueryDto.prototype, "search", void 0);
class UserResponseDto {
    id;
    name;
    email;
    phoneNumber;
    role;
    profilePicture;
    isActive;
    emailVerified;
    phoneVerified;
    preferences;
    createdAt;
    updatedAt;
    licenseNumber;
    agency;
    bio;
    propertiesListed;
    propertiesSold;
    city;
    country;
}
exports.UserResponseDto = UserResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: '507f1f77bcf86cd799439011' }),
    __metadata("design:type", String)
], UserResponseDto.prototype, "id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'John Doe' }),
    __metadata("design:type", String)
], UserResponseDto.prototype, "name", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'john.doe@example.com' }),
    __metadata("design:type", String)
], UserResponseDto.prototype, "email", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '+237123456789' }),
    __metadata("design:type", String)
], UserResponseDto.prototype, "phoneNumber", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: user_schema_1.UserRole, example: user_schema_1.UserRole.REGISTERED_USER }),
    __metadata("design:type", String)
], UserResponseDto.prototype, "role", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'https://example.com/profile.jpg' }),
    __metadata("design:type", String)
], UserResponseDto.prototype, "profilePicture", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], UserResponseDto.prototype, "isActive", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], UserResponseDto.prototype, "emailVerified", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], UserResponseDto.prototype, "phoneVerified", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: UserPreferencesDto }),
    __metadata("design:type", UserPreferencesDto)
], UserResponseDto.prototype, "preferences", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2023-01-01T00:00:00.000Z' }),
    __metadata("design:type", Date)
], UserResponseDto.prototype, "createdAt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2023-01-01T00:00:00.000Z' }),
    __metadata("design:type", Date)
], UserResponseDto.prototype, "updatedAt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'LIC123456789' }),
    __metadata("design:type", String)
], UserResponseDto.prototype, "licenseNumber", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'Century 21' }),
    __metadata("design:type", String)
], UserResponseDto.prototype, "agency", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'Experienced agent...' }),
    __metadata("design:type", String)
], UserResponseDto.prototype, "bio", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 25 }),
    __metadata("design:type", Number)
], UserResponseDto.prototype, "propertiesListed", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 12 }),
    __metadata("design:type", Number)
], UserResponseDto.prototype, "propertiesSold", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'Douala' }),
    __metadata("design:type", String)
], UserResponseDto.prototype, "city", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'Cameroon' }),
    __metadata("design:type", String)
], UserResponseDto.prototype, "country", void 0);
class PaginatedUsersResponseDto {
    users;
    total;
    page;
    limit;
    totalPages;
}
exports.PaginatedUsersResponseDto = PaginatedUsersResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)({ type: [UserResponseDto] }),
    __metadata("design:type", Array)
], PaginatedUsersResponseDto.prototype, "users", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 100 }),
    __metadata("design:type", Number)
], PaginatedUsersResponseDto.prototype, "total", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1 }),
    __metadata("design:type", Number)
], PaginatedUsersResponseDto.prototype, "page", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 10 }),
    __metadata("design:type", Number)
], PaginatedUsersResponseDto.prototype, "limit", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 10 }),
    __metadata("design:type", Number)
], PaginatedUsersResponseDto.prototype, "totalPages", void 0);
class AgentStatsDto {
    totalProperties;
    activeProperties;
}
exports.AgentStatsDto = AgentStatsDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 25 }),
    __metadata("design:type", Number)
], AgentStatsDto.prototype, "totalProperties", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 20 }),
    __metadata("design:type", Number)
], AgentStatsDto.prototype, "activeProperties", void 0);
class AgentResponseDto extends UserResponseDto {
    stats;
}
exports.AgentResponseDto = AgentResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)({ type: AgentStatsDto }),
    __metadata("design:type", AgentStatsDto)
], AgentResponseDto.prototype, "stats", void 0);
class PaginatedAgentsResponseDto {
    agents;
    total;
    page;
    limit;
    totalPages;
}
exports.PaginatedAgentsResponseDto = PaginatedAgentsResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)({ type: [AgentResponseDto] }),
    __metadata("design:type", Array)
], PaginatedAgentsResponseDto.prototype, "agents", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 50 }),
    __metadata("design:type", Number)
], PaginatedAgentsResponseDto.prototype, "total", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1 }),
    __metadata("design:type", Number)
], PaginatedAgentsResponseDto.prototype, "page", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 10 }),
    __metadata("design:type", Number)
], PaginatedAgentsResponseDto.prototype, "limit", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 5 }),
    __metadata("design:type", Number)
], PaginatedAgentsResponseDto.prototype, "totalPages", void 0);
class UserStatsDto {
    total;
    active;
    agents;
    landlords;
    hosts;
    students;
    guests;
    superhosts;
    pendingHostVerifications;
    verified;
    recent;
    byRole;
}
exports.UserStatsDto = UserStatsDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1500 }),
    __metadata("design:type", Number)
], UserStatsDto.prototype, "total", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1450 }),
    __metadata("design:type", Number)
], UserStatsDto.prototype, "active", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 50 }),
    __metadata("design:type", Number)
], UserStatsDto.prototype, "agents", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 30 }),
    __metadata("design:type", Number)
], UserStatsDto.prototype, "landlords", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 20 }),
    __metadata("design:type", Number)
], UserStatsDto.prototype, "hosts", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 80 }),
    __metadata("design:type", Number)
], UserStatsDto.prototype, "students", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 40 }),
    __metadata("design:type", Number)
], UserStatsDto.prototype, "guests", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 5 }),
    __metadata("design:type", Number)
], UserStatsDto.prototype, "superhosts", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 3 }),
    __metadata("design:type", Number)
], UserStatsDto.prototype, "pendingHostVerifications", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1200 }),
    __metadata("design:type", Number)
], UserStatsDto.prototype, "verified", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 100 }),
    __metadata("design:type", Number)
], UserStatsDto.prototype, "recent", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: {
            registered_user: 1400,
            agent: 50,
            landlord: 30,
            host: 20,
            student: 80,
            guest: 40,
        },
    }),
    __metadata("design:type", Object)
], UserStatsDto.prototype, "byRole", void 0);
class CreateTenantDto {
    tenantName;
    tenantEmail;
    tenantPhone;
    propertyId;
    leaseStart;
    leaseEnd;
    monthlyRent;
    depositAmount;
    status;
    notes;
}
exports.CreateTenantDto = CreateTenantDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Jean Dupont', description: 'Full name of the tenant' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(2, 100),
    (0, class_transformer_1.Transform)(({ value }) => value?.trim()),
    __metadata("design:type", String)
], CreateTenantDto.prototype, "tenantName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'jean.dupont@example.com', description: 'Tenant email address' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEmail)(),
    (0, class_transformer_1.Transform)(({ value }) => value?.toLowerCase()?.trim()),
    __metadata("design:type", String)
], CreateTenantDto.prototype, "tenantEmail", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '+237612345678', description: 'Tenant phone number' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(5, 20),
    __metadata("design:type", String)
], CreateTenantDto.prototype, "tenantPhone", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '507f1f77bcf86cd799439011', description: 'Property ObjectId the tenant is assigned to' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(24, 24, { message: 'propertyId must be a valid 24-character ObjectId' }),
    __metadata("design:type", String)
], CreateTenantDto.prototype, "propertyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-01-01', description: 'Lease start date (ISO format)' }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateTenantDto.prototype, "leaseStart", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2027-01-01', description: 'Lease end date (ISO format)' }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateTenantDto.prototype, "leaseEnd", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 150000, description: 'Monthly rent amount in XAF' }),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], CreateTenantDto.prototype, "monthlyRent", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 300000, description: 'Security deposit amount in XAF' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], CreateTenantDto.prototype, "depositAmount", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        example: 'active',
        enum: ['active', 'ended', 'pending'],
        description: 'Lease status',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['active', 'ended', 'pending']),
    __metadata("design:type", String)
], CreateTenantDto.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'Pays via mobile money on the 1st.', description: 'Additional notes' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(0, 1000),
    __metadata("design:type", String)
], CreateTenantDto.prototype, "notes", void 0);
class UpdateTenantDto {
    tenantName;
    tenantEmail;
    tenantPhone;
    propertyId;
    leaseStart;
    leaseEnd;
    monthlyRent;
    depositAmount;
    status;
    notes;
}
exports.UpdateTenantDto = UpdateTenantDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'Jean Dupont', description: 'Full name of the tenant' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(2, 100),
    (0, class_transformer_1.Transform)(({ value }) => value?.trim()),
    __metadata("design:type", String)
], UpdateTenantDto.prototype, "tenantName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'jean.dupont@example.com', description: 'Tenant email address' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEmail)(),
    (0, class_transformer_1.Transform)(({ value }) => value?.toLowerCase()?.trim()),
    __metadata("design:type", String)
], UpdateTenantDto.prototype, "tenantEmail", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '+237612345678', description: 'Tenant phone number' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(5, 20),
    __metadata("design:type", String)
], UpdateTenantDto.prototype, "tenantPhone", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '507f1f77bcf86cd799439011', description: 'Property ObjectId' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(24, 24, { message: 'propertyId must be a valid 24-character ObjectId' }),
    __metadata("design:type", String)
], UpdateTenantDto.prototype, "propertyId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '2026-01-01', description: 'Lease start date' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateTenantDto.prototype, "leaseStart", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '2027-01-01', description: 'Lease end date' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateTenantDto.prototype, "leaseEnd", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 150000, description: 'Monthly rent amount in XAF' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], UpdateTenantDto.prototype, "monthlyRent", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 300000, description: 'Security deposit amount in XAF' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], UpdateTenantDto.prototype, "depositAmount", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        example: 'active',
        enum: ['active', 'ended', 'pending'],
        description: 'Lease status',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['active', 'ended', 'pending']),
    __metadata("design:type", String)
], UpdateTenantDto.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'Updated notes.', description: 'Additional notes' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(0, 1000),
    __metadata("design:type", String)
], UpdateTenantDto.prototype, "notes", void 0);
class SetRoleDto {
    role;
}
exports.SetRoleDto = SetRoleDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        enum: user_schema_1.UserRole,
        example: user_schema_1.UserRole.HOST,
        description: 'Target role to assign. ADMIN cannot be set via this endpoint.',
    }),
    (0, class_validator_1.IsEnum)(user_schema_1.UserRole),
    __metadata("design:type", String)
], SetRoleDto.prototype, "role", void 0);
class PayoutAccountDto {
    method;
    accountIdentifier;
    providerName;
    isDefault;
    currency;
}
exports.PayoutAccountDto = PayoutAccountDto;
__decorate([
    (0, swagger_1.ApiProperty)({ enum: user_schema_1.PayoutMethod, example: user_schema_1.PayoutMethod.MOBILE_MONEY }),
    (0, class_validator_1.IsEnum)(user_schema_1.PayoutMethod),
    __metadata("design:type", String)
], PayoutAccountDto.prototype, "method", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '+237670000000', description: 'Phone / account number / PayPal email' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(3, 100),
    __metadata("design:type", String)
], PayoutAccountDto.prototype, "accountIdentifier", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'MTN Cameroon' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(2, 80),
    __metadata("design:type", String)
], PayoutAccountDto.prototype, "providerName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: true, description: 'Mark as the default payout method' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], PayoutAccountDto.prototype, "isDefault", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'XAF', description: 'ISO 4217 currency code' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(3, 3),
    __metadata("design:type", String)
], PayoutAccountDto.prototype, "currency", void 0);
class UpdateHostProfileDto {
    instantBookEnabled;
    minNightsDefault;
    maxNightsDefault;
    advanceNoticeHours;
    bookingWindowMonths;
    petsAllowedDefault;
    smokingAllowedDefault;
    eventsAllowedDefault;
    checkInTimeDefault;
    checkOutTimeDefault;
    addPayoutAccount;
    removePayoutAccountIdentifier;
    addCoHostId;
    removeCoHostId;
    hostBio;
    hostLanguages;
    operatingCity;
}
exports.UpdateHostProfileDto = UpdateHostProfileDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpdateHostProfileDto.prototype, "instantBookEnabled", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 1, description: 'Min nights (default 1)' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], UpdateHostProfileDto.prototype, "minNightsDefault", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 0, description: 'Max nights (0 = no cap)' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], UpdateHostProfileDto.prototype, "maxNightsDefault", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 24, description: 'Advance notice in hours before check-in' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], UpdateHostProfileDto.prototype, "advanceNoticeHours", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 12, description: 'Months ahead the calendar stays open (0 = no limit)' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], UpdateHostProfileDto.prototype, "bookingWindowMonths", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: false }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpdateHostProfileDto.prototype, "petsAllowedDefault", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: false }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpdateHostProfileDto.prototype, "smokingAllowedDefault", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: false }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpdateHostProfileDto.prototype, "eventsAllowedDefault", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '15:00', description: '24 h check-in time, e.g. "15:00"' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'Must be HH:MM in 24-hour format' }),
    __metadata("design:type", String)
], UpdateHostProfileDto.prototype, "checkInTimeDefault", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '11:00', description: '24 h check-out time' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'Must be HH:MM in 24-hour format' }),
    __metadata("design:type", String)
], UpdateHostProfileDto.prototype, "checkOutTimeDefault", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: PayoutAccountDto, description: 'Add a new payout account' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => PayoutAccountDto),
    __metadata("design:type", PayoutAccountDto)
], UpdateHostProfileDto.prototype, "addPayoutAccount", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        example: '+237670000000',
        description: 'accountIdentifier of the payout account to remove',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateHostProfileDto.prototype, "removePayoutAccountIdentifier", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '507f1f77bcf86cd799439011', description: 'User ID to add as co-host' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(24, 24, { message: 'Must be a valid 24-character ObjectId' }),
    __metadata("design:type", String)
], UpdateHostProfileDto.prototype, "addCoHostId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '507f1f77bcf86cd799439011', description: 'User ID to remove from co-hosts' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(24, 24, { message: 'Must be a valid 24-character ObjectId' }),
    __metadata("design:type", String)
], UpdateHostProfileDto.prototype, "removeCoHostId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'Passionate host in Douala with 3 cosy apartments.' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(0, 1000),
    __metadata("design:type", String)
], UpdateHostProfileDto.prototype, "hostBio", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: ['fr', 'en'], description: 'ISO 639-1 language codes spoken by the host' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], UpdateHostProfileDto.prototype, "hostLanguages", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'Douala' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(2, 80),
    __metadata("design:type", String)
], UpdateHostProfileDto.prototype, "operatingCity", void 0);
class VerifyHostDto {
    decision;
    rejectionReason;
}
exports.VerifyHostDto = VerifyHostDto;
__decorate([
    (0, swagger_1.ApiProperty)({ enum: ['approve', 'reject'], example: 'approve' }),
    (0, class_validator_1.IsIn)(['approve', 'reject']),
    __metadata("design:type", String)
], VerifyHostDto.prototype, "decision", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'ID document was expired.' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(1, 500),
    __metadata("design:type", String)
], VerifyHostDto.prototype, "rejectionReason", void 0);
class RecordHostPayoutDto {
    amount;
    currency;
    method;
    reference;
    status;
    initiatedAt;
    completedAt;
    failureReason;
}
exports.RecordHostPayoutDto = RecordHostPayoutDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 55000, description: 'Gross payout amount' }),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], RecordHostPayoutDto.prototype, "amount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'XAF', description: 'ISO 4217 currency code' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(3, 3),
    __metadata("design:type", String)
], RecordHostPayoutDto.prototype, "currency", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: user_schema_1.PayoutMethod, example: user_schema_1.PayoutMethod.MOBILE_MONEY }),
    (0, class_validator_1.IsEnum)(user_schema_1.PayoutMethod),
    __metadata("design:type", String)
], RecordHostPayoutDto.prototype, "method", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'BOOKING-2026-001', description: 'Booking or period reference' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(1, 100),
    __metadata("design:type", String)
], RecordHostPayoutDto.prototype, "reference", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: ['pending', 'processing', 'paid', 'failed'], example: 'paid' }),
    (0, class_validator_1.IsIn)(['pending', 'processing', 'paid', 'failed']),
    __metadata("design:type", String)
], RecordHostPayoutDto.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-04-13T00:00:00.000Z' }),
    (0, class_transformer_1.Type)(() => Date),
    __metadata("design:type", Date)
], RecordHostPayoutDto.prototype, "initiatedAt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '2026-04-14T00:00:00.000Z' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Date),
    __metadata("design:type", Date)
], RecordHostPayoutDto.prototype, "completedAt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'Insufficient balance.' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(1, 300),
    __metadata("design:type", String)
], RecordHostPayoutDto.prototype, "failureReason", void 0);
//# sourceMappingURL=index.js.map