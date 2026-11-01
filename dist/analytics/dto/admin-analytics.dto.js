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
exports.RevenueQueryDto = exports.OccupancyQueryDto = exports.AdminAnalyticsQueryDto = exports.AdminDateRangeDto = void 0;
const class_validator_1 = require("class-validator");
const swagger_1 = require("@nestjs/swagger");
class AdminDateRangeDto {
    startDate;
    endDate;
}
exports.AdminDateRangeDto = AdminDateRangeDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '2026-01-01', description: 'Start date (ISO 8601). Defaults to 30 days ago.' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], AdminDateRangeDto.prototype, "startDate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '2026-03-02', description: 'End date (ISO 8601). Defaults to today.' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], AdminDateRangeDto.prototype, "endDate", void 0);
class AdminAnalyticsQueryDto extends AdminDateRangeDto {
    granularity = 'day';
}
exports.AdminAnalyticsQueryDto = AdminAnalyticsQueryDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: ['day', 'week', 'month'], default: 'day' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['day', 'week', 'month']),
    __metadata("design:type", String)
], AdminAnalyticsQueryDto.prototype, "granularity", void 0);
class OccupancyQueryDto extends AdminDateRangeDto {
    propertyId;
    city;
    granularity = 'month';
}
exports.OccupancyQueryDto = OccupancyQueryDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Filter by property ID' }),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], OccupancyQueryDto.prototype, "propertyId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Filter by city' }),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], OccupancyQueryDto.prototype, "city", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: ['day', 'week', 'month'], default: 'month' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['day', 'week', 'month']),
    __metadata("design:type", String)
], OccupancyQueryDto.prototype, "granularity", void 0);
class RevenueQueryDto extends AdminDateRangeDto {
    granularity = 'month';
    hostId;
    propertyType;
}
exports.RevenueQueryDto = RevenueQueryDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: ['day', 'week', 'month'], default: 'month' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['day', 'week', 'month']),
    __metadata("design:type", String)
], RevenueQueryDto.prototype, "granularity", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Filter by host user ID' }),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], RevenueQueryDto.prototype, "hostId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Filter by property type' }),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], RevenueQueryDto.prototype, "propertyType", void 0);
//# sourceMappingURL=admin-analytics.dto.js.map