import { Model } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { Onboarding, OnboardingDocument } from './schemas/onboarding.schema';
import { UpdateOnboardingStepDto, CompleteOnboardingDto } from './dto/onboarding.dto';
import { EmailService } from '../email/email.service';
import { UsersService } from '../users/users.service';
export declare class OnboardingService {
    private onboardingModel;
    private emailService;
    private usersService;
    private configService;
    private readonly logger;
    constructor(onboardingModel: Model<OnboardingDocument>, emailService: EmailService, usersService: UsersService, configService: ConfigService);
    initializeOnboarding(userId: string, userRole: string): Promise<Onboarding>;
    getOnboardingStatus(userId: string): Promise<Onboarding>;
    updateOnboardingStep(userId: string, updateDto: UpdateOnboardingStepDto): Promise<Onboarding>;
    completeOnboarding(userId: string, completeDto: CompleteOnboardingDto): Promise<Onboarding>;
    sendOnboardingWelcomeEmail(userId: string): Promise<void>;
    getOnboardingProgress(userId: string): Promise<{
        progress: number;
        currentStep: number;
        totalSteps: number;
    }>;
    resetOnboarding(userId: string): Promise<Onboarding>;
    getIncompleteOnboardings(limit?: number): Promise<Onboarding[]>;
}
