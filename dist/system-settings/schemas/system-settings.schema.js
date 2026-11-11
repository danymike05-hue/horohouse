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
exports.SystemSettingsSchema = exports.SystemSettings = void 0;
const mongoose_1 = require("@nestjs/mongoose");
let SocialLinks = class SocialLinks {
    facebook;
    instagram;
    twitter;
    linkedin;
};
__decorate([
    (0, mongoose_1.Prop)({ default: '' }),
    __metadata("design:type", String)
], SocialLinks.prototype, "facebook", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: '' }),
    __metadata("design:type", String)
], SocialLinks.prototype, "instagram", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: '' }),
    __metadata("design:type", String)
], SocialLinks.prototype, "twitter", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: '' }),
    __metadata("design:type", String)
], SocialLinks.prototype, "linkedin", void 0);
SocialLinks = __decorate([
    (0, mongoose_1.Schema)({ _id: false })
], SocialLinks);
let FeatureFlags = class FeatureFlags {
    enableAiChat;
    enableRecommendations;
    enableWhatsAppBot;
    enableBooking;
};
__decorate([
    (0, mongoose_1.Prop)({ default: true }),
    __metadata("design:type", Boolean)
], FeatureFlags.prototype, "enableAiChat", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: true }),
    __metadata("design:type", Boolean)
], FeatureFlags.prototype, "enableRecommendations", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: true }),
    __metadata("design:type", Boolean)
], FeatureFlags.prototype, "enableWhatsAppBot", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: false }),
    __metadata("design:type", Boolean)
], FeatureFlags.prototype, "enableBooking", void 0);
FeatureFlags = __decorate([
    (0, mongoose_1.Schema)({ _id: false })
], FeatureFlags);
let SystemSettings = class SystemSettings {
    siteName;
    siteDescription;
    supportEmail;
    supportPhone;
    socialLinks;
    maintenanceMode;
    maintenanceMessage;
    allowRegistration;
    featureFlags;
    version;
};
exports.SystemSettings = SystemSettings;
__decorate([
    (0, mongoose_1.Prop)({ default: 'HoroHouse' }),
    __metadata("design:type", String)
], SystemSettings.prototype, "siteName", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 'Real Estate Platform for Cameroon' }),
    __metadata("design:type", String)
], SystemSettings.prototype, "siteDescription", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 'support@horohouse.com' }),
    __metadata("design:type", String)
], SystemSettings.prototype, "supportEmail", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: '+237 000 000 000' }),
    __metadata("design:type", String)
], SystemSettings.prototype, "supportPhone", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: SocialLinks, default: () => ({}) }),
    __metadata("design:type", SocialLinks)
], SystemSettings.prototype, "socialLinks", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: false }),
    __metadata("design:type", Boolean)
], SystemSettings.prototype, "maintenanceMode", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 'We are currently performing maintenance. Please check back later.' }),
    __metadata("design:type", String)
], SystemSettings.prototype, "maintenanceMessage", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: true }),
    __metadata("design:type", Boolean)
], SystemSettings.prototype, "allowRegistration", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: FeatureFlags, default: () => ({}) }),
    __metadata("design:type", FeatureFlags)
], SystemSettings.prototype, "featureFlags", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 'v1.0.0' }),
    __metadata("design:type", String)
], SystemSettings.prototype, "version", void 0);
exports.SystemSettings = SystemSettings = __decorate([
    (0, mongoose_1.Schema)({ timestamps: true })
], SystemSettings);
exports.SystemSettingsSchema = mongoose_1.SchemaFactory.createForClass(SystemSettings);
//# sourceMappingURL=system-settings.schema.js.map