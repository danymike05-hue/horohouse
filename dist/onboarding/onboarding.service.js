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
var OnboardingService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.OnboardingService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const config_1 = require("@nestjs/config");
const onboarding_schema_1 = require("./schemas/onboarding.schema");
const email_service_1 = require("../email/email.service");
const users_service_1 = require("../users/users.service");
let OnboardingService = OnboardingService_1 = class OnboardingService {
    onboardingModel;
    emailService;
    usersService;
    configService;
    logger = new common_1.Logger(OnboardingService_1.name);
    constructor(onboardingModel, emailService, usersService, configService) {
        this.onboardingModel = onboardingModel;
        this.emailService = emailService;
        this.usersService = usersService;
        this.configService = configService;
    }
    async initializeOnboarding(userId, userRole) {
        const totalSteps = userRole === 'agent' ? 5 : 4;
        const onboarding = await this.onboardingModel.findOneAndUpdate({ userId: new mongoose_2.Types.ObjectId(userId) }, {
            $setOnInsert: {
                userId: new mongoose_2.Types.ObjectId(userId),
                isCompleted: false,
                currentStep: 1,
                totalSteps,
                completedSteps: [],
                lastActivityAt: new Date(),
                welcomeEmailSent: false,
                completionEmailSent: false,
            },
        }, { new: true, upsert: true });
        this.logger.log(`✅ Onboarding initialized for user: ${userId}`);
        return onboarding;
    }
    async getOnboardingStatus(userId) {
        const onboarding = await this.onboardingModel.findOne({
            userId: new mongoose_2.Types.ObjectId(userId)
        }).exec();
        if (!onboarding) {
            throw new common_1.NotFoundException('Onboarding not found for this user');
        }
        return onboarding;
    }
    async updateOnboardingStep(userId, updateDto) {
        const onboarding = await this.onboardingModel.findOne({
            userId: new mongoose_2.Types.ObjectId(userId)
        }).exec();
        if (!onboarding) {
            throw new common_1.NotFoundException('Onboarding not found for this user');
        }
        onboarding.currentStep = updateDto.currentStep;
        onboarding.lastActivityAt = new Date();
        if (!onboarding.completedSteps.includes(updateDto.stepName)) {
            onboarding.completedSteps.push(updateDto.stepName);
        }
        if (updateDto.propertyPreferences) {
            onboarding.propertyPreferences = updateDto.propertyPreferences;
        }
        if (updateDto.agentPreferences) {
            onboarding.agentPreferences = updateDto.agentPreferences;
        }
        await onboarding.save();
        this.logger.log(`✅ Onboarding step updated for user: ${userId}, step: ${updateDto.currentStep}`);
        return onboarding;
    }
    async completeOnboarding(userId, completeDto) {
        const onboarding = await this.onboardingModel.findOne({
            userId: new mongoose_2.Types.ObjectId(userId)
        }).exec();
        if (!onboarding) {
            throw new common_1.NotFoundException('Onboarding not found for this user');
        }
        onboarding.isCompleted = completeDto.isCompleted;
        onboarding.currentStep = onboarding.totalSteps;
        onboarding.completedAt = new Date();
        onboarding.lastActivityAt = new Date();
        if (completeDto.propertyPreferences) {
            onboarding.propertyPreferences = completeDto.propertyPreferences;
        }
        if (completeDto.agentPreferences) {
            onboarding.agentPreferences = completeDto.agentPreferences;
        }
        await onboarding.save();
        if (!onboarding.completionEmailSent) {
            try {
                const user = await this.usersService.findOne(userId);
                const userRole = user.role === 'agent' ? 'Real Estate Agent' : 'Property Seeker';
                if (!user.email) {
                    throw new Error('User email is missing');
                }
                await this.emailService.sendOnboardingComplete(user.email, user.name, userRole);
                onboarding.completionEmailSent = true;
                await onboarding.save();
            }
            catch (error) {
                this.logger.error('Failed to send completion email', error);
            }
        }
        try {
            await this.usersService.updateOnboardingPreferences(userId, {
                propertyPreferences: onboarding.propertyPreferences,
                agentPreferences: onboarding.agentPreferences,
                onboardingCompleted: true,
            });
        }
        catch (error) {
            this.logger.error('Failed to update user preferences', error);
        }
        this.logger.log(`✅ Onboarding completed for user: ${userId}`);
        return onboarding;
    }
    async sendOnboardingWelcomeEmail(userId) {
        const onboarding = await this.onboardingModel.findOne({
            userId: new mongoose_2.Types.ObjectId(userId)
        }).exec();
        if (!onboarding) {
            throw new common_1.NotFoundException('Onboarding not found for this user');
        }
        if (onboarding.welcomeEmailSent) {
            return;
        }
        try {
            const user = await this.usersService.findOne(userId);
            const frontendUrl = this.configService.get('FRONTEND_URL', 'http://localhost:3001');
            const onboardingUrl = `${frontendUrl}/onboarding`;
            if (!user.email) {
                throw new Error('User email is missing');
            }
            await this.emailService.sendOnboardingWelcome(user.email, user.name, onboardingUrl);
            onboarding.welcomeEmailSent = true;
            await onboarding.save();
            this.logger.log(`✅ Onboarding welcome email sent to user: ${userId}`);
        }
        catch (error) {
            this.logger.error('Failed to send onboarding welcome email', error);
            throw error;
        }
    }
    async getOnboardingProgress(userId) {
        const onboarding = await this.getOnboardingStatus(userId);
        const progress = Math.round((onboarding.currentStep / onboarding.totalSteps) * 100);
        return {
            progress,
            currentStep: onboarding.currentStep,
            totalSteps: onboarding.totalSteps,
        };
    }
    async resetOnboarding(userId) {
        const onboarding = await this.onboardingModel.findOne({
            userId: new mongoose_2.Types.ObjectId(userId)
        }).exec();
        if (!onboarding) {
            throw new common_1.NotFoundException('Onboarding not found for this user');
        }
        onboarding.isCompleted = false;
        onboarding.currentStep = 1;
        onboarding.completedSteps = [];
        onboarding.completedAt = undefined;
        onboarding.lastActivityAt = new Date();
        onboarding.welcomeEmailSent = false;
        onboarding.completionEmailSent = false;
        await onboarding.save();
        this.logger.log(`✅ Onboarding reset for user: ${userId}`);
        return onboarding;
    }
    async getIncompleteOnboardings(limit = 10) {
        return this.onboardingModel
            .find({ isCompleted: false })
            .sort({ lastActivityAt: -1 })
            .limit(limit)
            .populate('userId', 'name email role')
            .exec();
    }
};
exports.OnboardingService = OnboardingService;
exports.OnboardingService = OnboardingService = OnboardingService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(onboarding_schema_1.Onboarding.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        email_service_1.EmailService,
        users_service_1.UsersService,
        config_1.ConfigService])
], OnboardingService);
//# sourceMappingURL=onboarding.service.js.map