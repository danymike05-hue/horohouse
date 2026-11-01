import { CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
export declare const SKIP_ONBOARDING_KEY = "skipOnboardingCheck";
export declare const AllowIncompleteOnboarding: () => import("@nestjs/common").CustomDecorator<string>;
export declare class OnboardingGuard implements CanActivate {
    private reflector;
    constructor(reflector: Reflector);
    canActivate(context: ExecutionContext): boolean;
}
