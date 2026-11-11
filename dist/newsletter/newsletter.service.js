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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var NewsletterService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.NewsletterService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const newsletter_schema_1 = require("./schemas/newsletter.schema");
const email_service_1 = require("../email/email.service");
let NewsletterService = NewsletterService_1 = class NewsletterService {
    newsletterModel;
    emailService;
    logger = new common_1.Logger(NewsletterService_1.name);
    constructor(newsletterModel, emailService) {
        this.newsletterModel = newsletterModel;
        this.emailService = emailService;
    }
    async subscribe(dto) {
        const existing = await this.newsletterModel.findOne({ email: dto.email });
        if (existing) {
            if (existing.isActive) {
                throw new common_1.ConflictException('This email is already subscribed.');
            }
            existing.isActive = true;
            await existing.save();
        }
        else {
            await this.newsletterModel.create({ email: dto.email });
        }
        this.emailService.sendNewsletterWelcome(dto.email).catch((err) => this.logger.error(`Failed to send newsletter welcome: ${err.message}`));
        return { message: 'Successfully subscribed to the newsletter!' };
    }
    async unsubscribe(email) {
        await this.newsletterModel.updateOne({ email }, { isActive: false });
        return { message: 'Successfully unsubscribed.' };
    }
};
exports.NewsletterService = NewsletterService;
exports.NewsletterService = NewsletterService = NewsletterService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(newsletter_schema_1.Newsletter.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        email_service_1.EmailService])
], NewsletterService);
//# sourceMappingURL=newsletter.service.js.map