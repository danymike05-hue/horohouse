import { IsString, IsNotEmpty, IsEnum, Matches, IsOptional } from 'class-validator';
import { UserRole } from '../../users/schemas/user.schema';

/**
 * Self-assignable roles during Google onboarding.
 * Admin/Guest/Student are excluded — admin is never self-assignable,
 * guest is implicit, and student has its own verification flow.
 */
const ONBOARDING_ROLES: UserRole[] = [
  UserRole.REGISTERED_USER,
  UserRole.HOST,
  UserRole.LANDLORD,
  UserRole.AGENT,
];

export class SelectRoleDto {
  @IsEnum(UserRole, {
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
