import { IsString, IsNotEmpty, IsIn, Matches } from 'class-validator';
import { UserRole } from '../../users/schemas/user.schema';

/**
 * Self-assignable roles during Google onboarding.
 * Admin and Guest are excluded: admin is never self-assignable and guest is implicit.
 * Students pick their campus and send their student card afterwards (student profile).
 */
const ONBOARDING_ROLES: UserRole[] = [
  UserRole.REGISTERED_USER,
  UserRole.HOST,
  UserRole.LANDLORD,
  UserRole.AGENT,
  UserRole.STUDENT,
];

export class SelectRoleDto {
  // IsIn (not IsEnum): the request is rejected before it reaches the service
  @IsIn(ONBOARDING_ROLES, {
    message: `Role must be one of: ${ONBOARDING_ROLES.join(', ')}`,
  })
  @IsNotEmpty()
  role: UserRole;
}

export class SetPhoneDto {
  @IsString()
  @IsNotEmpty({ message: 'Phone number is required' })
  @Matches(/^\+[1-9]\d{6,14}$/, {
    message: 'Phone number must be in E.164 format (e.g. +237612345678)',
  })
  phoneNumber: string;
}

export class CompleteOnboardingDto {
  // No body required — completion is validated server-side
}

export { ONBOARDING_ROLES };
