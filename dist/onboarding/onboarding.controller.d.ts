import { OnboardingService } from './onboarding.service';
import { UpdateOnboardingStepDto, CompleteOnboardingDto } from './dto/onboarding.dto';
export declare class OnboardingController {
    private readonly onboardingService;
    constructor(onboardingService: OnboardingService);
    initializeOnboarding(req: any, body: {
        userRole: string;
    }): Promise<import("./schemas/onboarding.schema").Onboarding>;
    getOnboardingStatus(req: any): Promise<import("./schemas/onboarding.schema").Onboarding>;
    getOnboardingProgress(req: any): Promise<{
        progress: number;
        currentStep: number;
        totalSteps: number;
    }>;
    updateOnboardingStep(req: any, updateDto: UpdateOnboardingStepDto): Promise<import("./schemas/onboarding.schema").Onboarding>;
    completeOnboarding(req: any, completeDto: CompleteOnboardingDto): Promise<import("./schemas/onboarding.schema").Onboarding>;
    sendWelcomeEmail(req: any): Promise<void>;
    resetOnboarding(req: any): Promise<import("./schemas/onboarding.schema").Onboarding>;
    getIncompleteOnboardings(req: any): Promise<import("./schemas/onboarding.schema").Onboarding[]>;
}
