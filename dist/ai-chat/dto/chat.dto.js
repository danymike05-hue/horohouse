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
exports.RefineSearchDto = exports.ChatMessageDto = void 0;
const class_validator_1 = require("class-validator");
const swagger_1 = require("@nestjs/swagger");
class ChatMessageDto {
    message;
    userId;
    sessionId;
    conversationHistory;
    currentFilters;
}
exports.ChatMessageDto = ChatMessageDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'User message text',
        example: 'Je cherche un appartement 3 chambres à Douala',
        minLength: 1,
        maxLength: 1000,
    }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)({ message: 'Message is required and cannot be empty' }),
    (0, class_validator_1.MinLength)(1, { message: 'Message must not be empty' }),
    (0, class_validator_1.MaxLength)(1000, { message: 'Message is too long (max 1000 characters)' }),
    __metadata("design:type", String)
], ChatMessageDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'User ID (automatically populated for authenticated users)',
        example: '507f1f77bcf86cd799439011',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ChatMessageDto.prototype, "userId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Session ID for conversation tracking',
        example: 'session-123',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ChatMessageDto.prototype, "sessionId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Previous conversation messages for context',
        type: [Object],
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    __metadata("design:type", Array)
], ChatMessageDto.prototype, "conversationHistory", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Current active search filters',
        type: Object,
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], ChatMessageDto.prototype, "currentFilters", void 0);
class RefineSearchDto {
    message;
    currentFilters;
    conversationHistory;
}
exports.RefineSearchDto = RefineSearchDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Refinement message',
        example: 'with swimming pool',
        minLength: 1,
        maxLength: 500,
    }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)({ message: 'Refinement message is required' }),
    (0, class_validator_1.MinLength)(1, { message: 'Message must not be empty' }),
    (0, class_validator_1.MaxLength)(500, { message: 'Message is too long (max 500 characters)' }),
    __metadata("design:type", String)
], RefineSearchDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Current search filters to refine',
        example: { city: 'Douala', propertyType: 'villa' },
    }),
    (0, class_validator_1.IsObject)(),
    (0, class_validator_1.IsNotEmpty)({ message: 'Current filters are required' }),
    __metadata("design:type", Object)
], RefineSearchDto.prototype, "currentFilters", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Previous conversation messages',
        type: [Object],
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    __metadata("design:type", Array)
], RefineSearchDto.prototype, "conversationHistory", void 0);
//# sourceMappingURL=chat.dto.js.map