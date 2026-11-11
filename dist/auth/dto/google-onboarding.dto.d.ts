import { UserRole } from '../../users/schemas/user.schema';
declare const ONBOARDING_ROLES: UserRole[];
export declare class SelectRoleDto {
    role: UserRole;
}
export declare class SetPhoneDto {
    phoneNumber: string;
}
export declare class CompleteOnboardingDto {
}
export { ONBOARDING_ROLES };
