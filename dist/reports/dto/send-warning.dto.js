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
exports.SendWarningDto = exports.WarningSeverity = void 0;
const class_validator_1 = require("class-validator");
const swagger_1 = require("@nestjs/swagger");
var WarningSeverity;
(function (WarningSeverity) {
    WarningSeverity["WARNING"] = "warning";
    WarningSeverity["FINAL_WARNING"] = "final_warning";
})(WarningSeverity || (exports.WarningSeverity = WarningSeverity = {}));
class SendWarningDto {
    message;
    severity;
}
exports.SendWarningDto = SendWarningDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'The custom message to send to the property owner',
        example: 'Your listing has been reported for misleading information. Please review and update it.',
    }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.MaxLength)(2000),
    __metadata("design:type", String)
], SendWarningDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Severity level of the warning',
        enum: WarningSeverity,
        default: WarningSeverity.WARNING,
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(WarningSeverity),
    __metadata("design:type", String)
], SendWarningDto.prototype, "severity", void 0);
//# sourceMappingURL=send-warning.dto.js.map