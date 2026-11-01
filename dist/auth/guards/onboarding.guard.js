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
exports.OnboardingGuard = exports.AllowIncompleteOnboarding = exports.SKIP_ONBOARDING_KEY = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const user_schema_1 = require("../../users/schemas/user.schema");
exports.SKIP_ONBOARDING_KEY = 'skipOnboardingCheck';
const AllowIncompleteOnboarding = () => (0, common_1.SetMetadata)(exports.SKIP_ONBOARDING_KEY, true);
exports.AllowIncompleteOnboarding = AllowIncompleteOnboarding;
let OnboardingGuard = class OnboardingGuard {
    reflector;
    constructor(reflector) {
        this.reflector = reflector;
    }
    canActivate(context) {
        const isPublic = this.reflector.getAllAndOverride('isPublic', [
            context.getHandler(),
            context.getClass(),
        ]);
        if (isPublic) {
            return true;
        }
        const skipOnboarding = this.reflector.getAllAndOverride(exports.SKIP_ONBOARDING_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);
        if (skipOnboarding) {
            return true;
        }
        const { user } = context.switchToHttp().getRequest();
        if (!user) {
            return true;
        }
        if (user.onboardingStatus && user.onboardingStatus !== user_schema_1.OnboardingStatus.COMPLETED) {
            throw new common_1.ForbiddenException({
                statusCode: 403,
                error: 'Forbidden',
                code: 'ONBOARDING_INCOMPLETE',
                message: 'Please complete your onboarding profile before accessing this resource.',
                onboardingStatus: user.onboardingStatus,
            });
        }
        return true;
    }
};
exports.OnboardingGuard = OnboardingGuard;
exports.OnboardingGuard = OnboardingGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.Reflector])
], OnboardingGuard);
//# sourceMappingURL=onboarding.guard.js.map