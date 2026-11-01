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
exports.AdminSendNotificationDto = exports.AdminNotifTarget = exports.AdminNotifChannel = void 0;
const class_validator_1 = require("class-validator");
const swagger_1 = require("@nestjs/swagger");
const notification_schema_1 = require("../schemas/notification.schema");
var AdminNotifChannel;
(function (AdminNotifChannel) {
    AdminNotifChannel["PUSH"] = "push";
    AdminNotifChannel["EMAIL"] = "email";
    AdminNotifChannel["BOTH"] = "both";
})(AdminNotifChannel || (exports.AdminNotifChannel = AdminNotifChannel = {}));
var AdminNotifTarget;
(function (AdminNotifTarget) {
    AdminNotifTarget["ALL"] = "all";
    AdminNotifTarget["ROLE"] = "role";
    AdminNotifTarget["USERS"] = "users";
})(AdminNotifTarget || (exports.AdminNotifTarget = AdminNotifTarget = {}));
class AdminSendNotificationDto {
    target;
    role;
    userIds;
    title;
    message;
    type = notification_schema_1.NotificationType.SYSTEM;
    link;
    channel = AdminNotifChannel.PUSH;
    metadata;
}
exports.AdminSendNotificationDto = AdminSendNotificationDto;
__decorate([
    (0, swagger_1.ApiProperty)({ enum: AdminNotifTarget, description: 'Who should receive this notification' }),
    (0, class_validator_1.IsEnum)(AdminNotifTarget),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], AdminSendNotificationDto.prototype, "target", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Role filter (required when target = "role")', example: 'host' }),
    (0, class_validator_1.ValidateIf)(o => o.target === AdminNotifTarget.ROLE),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], AdminSendNotificationDto.prototype, "role", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'User IDs (required when target = "users")',
        example: ['64abc123...', '64def456...'],
    }),
    (0, class_validator_1.ValidateIf)(o => o.target === AdminNotifTarget.USERS),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], AdminSendNotificationDto.prototype, "userIds", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Platform Maintenance 🔧' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], AdminSendNotificationDto.prototype, "title", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'We will be performing scheduled maintenance tonight from 2 AM to 4 AM.' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], AdminSendNotificationDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: notification_schema_1.NotificationType, default: notification_schema_1.NotificationType.SYSTEM }),
    (0, class_validator_1.IsEnum)(notification_schema_1.NotificationType),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], AdminSendNotificationDto.prototype, "type", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Deep link route', example: '/support' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], AdminSendNotificationDto.prototype, "link", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: AdminNotifChannel, default: AdminNotifChannel.PUSH }),
    (0, class_validator_1.IsEnum)(AdminNotifChannel),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], AdminSendNotificationDto.prototype, "channel", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Arbitrary metadata attached to the notification' }),
    (0, class_validator_1.IsObject)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Object)
], AdminSendNotificationDto.prototype, "metadata", void 0);
//# sourceMappingURL=admin-send-notification.dto.js.map