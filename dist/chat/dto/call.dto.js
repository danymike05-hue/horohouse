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
exports.UpdateCallQualityDto = exports.IceCandidateDto = exports.EndCallDto = exports.DeclineCallDto = exports.AnswerCallDto = exports.InitiateCallDto = void 0;
const class_validator_1 = require("class-validator");
const swagger_1 = require("@nestjs/swagger");
const call_schema_1 = require("../schemas/call.schema");
class InitiateCallDto {
    conversationId;
    type;
    sdpOffer;
}
exports.InitiateCallDto = InitiateCallDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], InitiateCallDto.prototype, "conversationId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: call_schema_1.CallType }),
    (0, class_validator_1.IsEnum)(call_schema_1.CallType),
    __metadata("design:type", String)
], InitiateCallDto.prototype, "type", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], InitiateCallDto.prototype, "sdpOffer", void 0);
class AnswerCallDto {
    callId;
    sdpAnswer;
}
exports.AnswerCallDto = AnswerCallDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], AnswerCallDto.prototype, "callId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], AnswerCallDto.prototype, "sdpAnswer", void 0);
class DeclineCallDto {
    callId;
    reason;
}
exports.DeclineCallDto = DeclineCallDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], DeclineCallDto.prototype, "callId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], DeclineCallDto.prototype, "reason", void 0);
class EndCallDto {
    callId;
    reason;
    duration;
}
exports.EndCallDto = EndCallDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], EndCallDto.prototype, "callId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: call_schema_1.CallEndReason }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(call_schema_1.CallEndReason),
    __metadata("design:type", String)
], EndCallDto.prototype, "reason", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], EndCallDto.prototype, "duration", void 0);
class IceCandidateDto {
    callId;
    candidate;
}
exports.IceCandidateDto = IceCandidateDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], IceCandidateDto.prototype, "callId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], IceCandidateDto.prototype, "candidate", void 0);
class UpdateCallQualityDto {
    callId;
    audioQuality;
    videoQuality;
    networkIssues;
}
exports.UpdateCallQualityDto = UpdateCallQualityDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateCallQualityDto.prototype, "callId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], UpdateCallQualityDto.prototype, "audioQuality", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], UpdateCallQualityDto.prototype, "videoQuality", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], UpdateCallQualityDto.prototype, "networkIssues", void 0);
//# sourceMappingURL=call.dto.js.map