import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ConfigService } from '@nestjs/config';

import { Onboarding, OnboardingDocument } from './schemas/onboarding.schema';
import { UpdateOnboardingStepDto, CompleteOnboardingDto } from './dto/onboarding.dto';
import { EmailService } from '../email/email.service';
import { UsersService } from '../users/users.service';

@Injectable()
export class OnboardingService {
  private readonly logger = new Logger(OnboardingService.name);

  constructor(
    @InjectModel(Onboarding.name) private onboardingModel: Model<OnboardingDocument>,
    private emailService: EmailService,
    private usersService: UsersService,
    private configService: ConfigService,
  ) {}

  /**
   * Initialize onboarding for a new user
   */
  async initializeOnboarding(userId: string, userRole: string): Promise<Onboarding> {
  const totalSteps = userRole === 'agent' ? 5 : 4;

  const onboarding = await this.onboardingModel.findOneAndUpdate(
    { userId: new Types.ObjectId(userId) }, // match by userId
    {
      $setOnInsert: {
        userId: new Types.ObjectId(userId),
        isCompleted: false,
        currentStep: 1,
        totalSteps,
        completedSteps: [],
        lastActivityAt: new Date(),
        welcomeEmailSent: false,
        completionEmailSent: false,
      },
    },
    { new: true, upsert: true } // create if not exists, return the doc
  );

  this.logger.log(`✅ Onboarding initialized for user: ${userId}`);
  return onboarding;
}


  /**
   * Get onboarding status for a user
   */
  async getOnboardingStatus(userId: string): Promise<Onboarding> {
    const onboarding = await this.onboardingModel.findOne({ 
      userId: new Types.ObjectId(userId) 
    }).exec();

    if (!onboarding) {
      throw new NotFoundException('Onboarding not found for this user');
    }

    return onboarding;
  }

  /**
   * Update onboarding step
   */
  async updateOnboardingStep(userId: string, updateDto: UpdateOnboardingStepDto): Promise<Onboarding> {
    const onboarding = await this.onboardingModel.findOne({ 
      userId: new Types.ObjectId(userId) 
    }).exec();

    if (!onboarding) {
      throw new NotFoundException('Onboarding not found for this user');
    }

    // Update step information
    onboarding.currentStep = updateDto.currentStep;
    onboarding.lastActivityAt = new Date();

    // Add step to completed steps if not already there
    if (!onboarding.completedSteps.includes(updateDto.stepName)) {
      onboarding.completedSteps.push(updateDto.stepName);
    }

    // Update preferences if provided
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

  /**
   * Complete onboarding
   */
  async completeOnboarding(userId: string, completeDto: CompleteOnboardingDto): Promise<Onboarding> {
    const onboarding = await this.onboardingModel.findOne({ 
      userId: new Types.ObjectId(userId) 
    }).exec();

    if (!onboarding) {
      throw new NotFoundException('Onboarding not found for this user');
    }

    // Update completion status
    onboarding.isCompleted = completeDto.isCompleted;
    onboarding.currentStep = onboarding.totalSteps;
    onboarding.completedAt = new Date();
    onboarding.lastActivityAt = new Date();

    // Update preferences if provided
    if (completeDto.propertyPreferences) {
      onboarding.propertyPreferences = completeDto.propertyPreferences;
    }

    if (completeDto.agentPreferences) {
      onboarding.agentPreferences = completeDto.agentPreferences;
    }

    await onboarding.save();

    // Send completion email if not already sent
    if (!onboarding.completionEmailSent) {
      try {
        const user = await this.usersService.findOne(userId);
        const userRole = user.role === 'agent' ? 'Real Estate Agent' : 'Property Seeker';
        
        if (!user.email) {
          throw new Error('User email is missing');
        }
        await this.emailService.sendOnboardingComplete(
          user.email,
          user.name,
          userRole
        );

        onboarding.completionEmailSent = true;
        await onboarding.save();
      } catch (error) {
        this.logger.error('Failed to send completion email', error);
      }
    }

    // Update user preferences in user document
    try {
      await this.usersService.updateOnboardingPreferences(userId, {
        propertyPreferences: onboarding.propertyPreferences,
        agentPreferences: onboarding.agentPreferences,
        onboardingCompleted: true,
      });
    } catch (error) {
      this.logger.error('Failed to update user preferences', error);
    }

    this.logger.log(`✅ Onboarding completed for user: ${userId}`);
    return onboarding;
  }

  /**
   * Send welcome email for onboarding
   */
  async sendOnboardingWelcomeEmail(userId: string): Promise<void> {
    const onboarding = await this.onboardingModel.findOne({ 
      userId: new Types.ObjectId(userId) 
    }).exec();

    if (!onboarding) {
      throw new NotFoundException('Onboarding not found for this user');
    }

    if (onboarding.welcomeEmailSent) {
      return; // Already sent
    }

    try {
      const user = await this.usersService.findOne(userId);
      const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:3001');
      const onboardingUrl = `${frontendUrl}/onboarding`;

      if (!user.email) {
        throw new Error('User email is missing');
      }
      await this.emailService.sendOnboardingWelcome(
        user.email,
        user.name,
        onboardingUrl
      );

      onboarding.welcomeEmailSent = true;
      await onboarding.save();

      this.logger.log(`✅ Onboarding welcome email sent to user: ${userId}`);
    } catch (error) {
      this.logger.error('Failed to send onboarding welcome email', error);
      throw error;
    }
  }

  /**
   * Get onboarding progress percentage
   */
  async getOnboardingProgress(userId: string): Promise<{ progress: number; currentStep: number; totalSteps: number }> {
    const onboarding = await this.getOnboardingStatus(userId);
    
    const progress = Math.round((onboarding.currentStep / onboarding.totalSteps) * 100);
    
    return {
      progress,
      currentStep: onboarding.currentStep,
      totalSteps: onboarding.totalSteps,
    };
  }

  /**
   * Reset onboarding for a user
   */
  async resetOnboarding(userId: string): Promise<Onboarding> {
    const onboarding = await this.onboardingModel.findOne({ 
      userId: new Types.ObjectId(userId) 
    }).exec();

    if (!onboarding) {
      throw new NotFoundException('Onboarding not found for this user');
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

  /**
   * Get incomplete onboarding users (for admin purposes)
   */
  async getIncompleteOnboardings(limit = 10): Promise<Onboarding[]> {
    return this.onboardingModel
      .find({ isCompleted: false })
      .sort({ lastActivityAt: -1 })
      .limit(limit)
      .populate('userId', 'name email role')
      .exec();
  }
}
