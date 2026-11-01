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
Object.defineProperty(exports, "__esModule", { value: true });
exports.OnboardingController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const onboarding_service_1 = require("./onboarding.service");
const onboarding_dto_1 = require("./dto/onboarding.dto");
const jwt_auth_guard_1 = require("../auth/guards/jwt.auth.guard");
let OnboardingController = class OnboardingController {
    onboardingService;
    constructor(onboardingService) {
        this.onboardingService = onboardingService;
    }
    async initializeOnboarding(req, body) {
        const userId = req.user.id;
        return this.onboardingService.initializeOnboarding(userId, body.userRole);
    }
    async getOnboardingStatus(req) {
        const userId = req.user.id;
        return this.onboardingService.getOnboardingStatus(userId);
    }
    async getOnboardingProgress(req) {
        const userId = req.user.id;
        return this.onboardingService.getOnboardingProgress(userId);
    }
    async updateOnboardingStep(req, updateDto) {
        const userId = req.user.id;
        return this.onboardingService.updateOnboardingStep(userId, updateDto);
    }
    async completeOnboarding(req, completeDto) {
        const userId = req.user.id;
        return this.onboardingService.completeOnboarding(userId, completeDto);
    }
    async sendWelcomeEmail(req) {
        const userId = req.user.id;
        return this.onboardingService.sendOnboardingWelcomeEmail(userId);
    }
    async resetOnboarding(req) {
        const userId = req.user.id;
        return this.onboardingService.resetOnboarding(userId);
    }
    async getIncompleteOnboardings(req) {
        const limit = 10;
        return this.onboardingService.getIncompleteOnboardings(limit);
    }
};
exports.OnboardingController = OnboardingController;
__decorate([
    (0, common_1.Post)('initialize'),
    (0, common_1.HttpCode)(common_1.HttpStatus.CREATED),
    (0, swagger_1.ApiOperation)({ summary: 'Initialize onboarding for a new user' }),
    (0, swagger_1.ApiResponse)({ status: 201, description: 'Onboarding initialized successfully' }),
    (0, swagger_1.ApiResponse)({ status: 400, description: 'Bad request' }),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], OnboardingController.prototype, "initializeOnboarding", null);
__decorate([
    (0, common_1.Get)('status'),
    (0, swagger_1.ApiOperation)({ summary: 'Get onboarding status for current user' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Onboarding status retrieved successfully' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Onboarding not found' }),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], OnboardingController.prototype, "getOnboardingStatus", null);
__decorate([
    (0, common_1.Get)('progress'),
    (0, swagger_1.ApiOperation)({ summary: 'Get onboarding progress percentage' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Progress retrieved successfully' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Onboarding not found' }),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], OnboardingController.prototype, "getOnboardingProgress", null);
__decorate([
    (0, common_1.Put)('step'),
    (0, swagger_1.ApiOperation)({ summary: 'Update onboarding step' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Step updated successfully' }),
    (0, swagger_1.ApiResponse)({ status: 400, description: 'Bad request' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Onboarding not found' }),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, onboarding_dto_1.UpdateOnboardingStepDto]),
    __metadata("design:returntype", Promise)
], OnboardingController.prototype, "updateOnboardingStep", null);
__decorate([
    (0, common_1.Put)('complete'),
    (0, swagger_1.ApiOperation)({ summary: 'Complete onboarding' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Onboarding completed successfully' }),
    (0, swagger_1.ApiResponse)({ status: 400, description: 'Bad request' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Onboarding not found' }),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, onboarding_dto_1.CompleteOnboardingDto]),
    __metadata("design:returntype", Promise)
], OnboardingController.prototype, "completeOnboarding", null);
__decorate([
    (0, common_1.Post)('send-welcome-email'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Send onboarding welcome email' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Welcome email sent successfully' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Onboarding not found' }),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], OnboardingController.prototype, "sendWelcomeEmail", null);
__decorate([
    (0, common_1.Post)('reset'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Reset onboarding for current user' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Onboarding reset successfully' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Onboarding not found' }),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], OnboardingController.prototype, "resetOnboarding", null);
__decorate([
    (0, common_1.Get)('admin/incomplete'),
    (0, swagger_1.ApiOperation)({ summary: 'Get incomplete onboardings (Admin only)' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Incomplete onboardings retrieved successfully' }),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], OnboardingController.prototype, "getIncompleteOnboardings", null);
exports.OnboardingController = OnboardingController = __decorate([
    (0, swagger_1.ApiTags)('Onboarding'),
    (0, common_1.Controller)('onboarding'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, swagger_1.ApiBearerAuth)(),
    __metadata("design:paramtypes", [onboarding_service_1.OnboardingService])
], OnboardingController);
//# sourceMappingURL=onboarding.controller.js.map