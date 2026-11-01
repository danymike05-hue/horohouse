import { 
  Controller, 
  Get, 
  Post, 
  Put, 
  Body, 
  Param, 
  UseGuards, 
  Request,
  HttpStatus,
  HttpCode 
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';

import { OnboardingService } from './onboarding.service';
import { UpdateOnboardingStepDto, CompleteOnboardingDto } from './dto/onboarding.dto';
import { JwtAuthGuard } from '../auth/guards/jwt.auth.guard';

@ApiTags('Onboarding')
@Controller('onboarding')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  @Post('initialize')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Initialize onboarding for a new user' })
  @ApiResponse({ status: 201, description: 'Onboarding initialized successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async initializeOnboarding(@Request() req, @Body() body: { userRole: string }) {
    const userId = req.user.id;
    return this.onboardingService.initializeOnboarding(userId, body.userRole);
  }

  @Get('status')
  @ApiOperation({ summary: 'Get onboarding status for current user' })
  @ApiResponse({ status: 200, description: 'Onboarding status retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Onboarding not found' })
  async getOnboardingStatus(@Request() req) {
    const userId = req.user.id;
    return this.onboardingService.getOnboardingStatus(userId);
  }

  @Get('progress')
  @ApiOperation({ summary: 'Get onboarding progress percentage' })
  @ApiResponse({ status: 200, description: 'Progress retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Onboarding not found' })
  async getOnboardingProgress(@Request() req) {
    const userId = req.user.id;
    return this.onboardingService.getOnboardingProgress(userId);
  }

  @Put('step')
  @ApiOperation({ summary: 'Update onboarding step' })
  @ApiResponse({ status: 200, description: 'Step updated successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 404, description: 'Onboarding not found' })
  async updateOnboardingStep(@Request() req, @Body() updateDto: UpdateOnboardingStepDto) {
    const userId = req.user.id;
    return this.onboardingService.updateOnboardingStep(userId, updateDto);
  }

  @Put('complete')
  @ApiOperation({ summary: 'Complete onboarding' })
  @ApiResponse({ status: 200, description: 'Onboarding completed successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 404, description: 'Onboarding not found' })
  async completeOnboarding(@Request() req, @Body() completeDto: CompleteOnboardingDto) {
    const userId = req.user.id;
    return this.onboardingService.completeOnboarding(userId, completeDto);
  }

  @Post('send-welcome-email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send onboarding welcome email' })
  @ApiResponse({ status: 200, description: 'Welcome email sent successfully' })
  @ApiResponse({ status: 404, description: 'Onboarding not found' })
  async sendWelcomeEmail(@Request() req) {
    const userId = req.user.id;
    return this.onboardingService.sendOnboardingWelcomeEmail(userId);
  }

  @Post('reset')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset onboarding for current user' })
  @ApiResponse({ status: 200, description: 'Onboarding reset successfully' })
  @ApiResponse({ status: 404, description: 'Onboarding not found' })
  async resetOnboarding(@Request() req) {
    const userId = req.user.id;
    return this.onboardingService.resetOnboarding(userId);
  }

  // Admin endpoints
  @Get('admin/incomplete')
  @ApiOperation({ summary: 'Get incomplete onboardings (Admin only)' })
  @ApiResponse({ status: 200, description: 'Incomplete onboardings retrieved successfully' })
  async getIncompleteOnboardings(@Request() req) {
    // TODO: Add admin guard
    const limit = 10;
    return this.onboardingService.getIncompleteOnboardings(limit);
  }
}
