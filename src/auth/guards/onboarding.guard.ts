import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { OnboardingStatus } from '../../users/schemas/user.schema';

export const SKIP_ONBOARDING_KEY = 'skipOnboardingCheck';

/**
 * Decorator to allow users with incomplete onboarding to access specific endpoints
 * (e.g. onboarding status, step endpoints, logout, verify-token).
 */
export const AllowIncompleteOnboarding = () => SetMetadata(SKIP_ONBOARDING_KEY, true);

@Injectable()
export class OnboardingGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Skip for public routes
    const isPublic = this.reflector.getAllAndOverride<boolean>('isPublic', [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    // Skip if endpoint explicitly allows incomplete onboarding
    const skipOnboarding = this.reflector.getAllAndOverride<boolean>(SKIP_ONBOARDING_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (skipOnboarding) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();

    if (!user) {
      return true; // Let authentication guard handle unauthenticated requests
    }

    // Check if user has an incomplete onboarding status
    if (user.onboardingStatus && user.onboardingStatus !== OnboardingStatus.COMPLETED) {
      throw new ForbiddenException({
        statusCode: 403,
        error: 'Forbidden',
        code: 'ONBOARDING_INCOMPLETE',
        message: 'Please complete your onboarding profile before accessing this resource.',
        onboardingStatus: user.onboardingStatus,
      });
    }

    return true;
  }
}
