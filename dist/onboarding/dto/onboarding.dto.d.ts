export declare class BudgetDto {
    min: number;
    max: number;
    currency: string;
}
export declare class PropertyPreferencesDto {
    propertyType: string[];
    budget: BudgetDto;
    location: string[];
    bedrooms: number[];
    bathrooms: number[];
    features: string[];
}
export declare class AgentPreferencesDto {
    licenseNumber: string;
    agency: string;
    experience: number;
    specializations: string[];
    serviceAreas: string[];
}
export declare class UpdateOnboardingStepDto {
    currentStep: number;
    stepName: string;
    propertyPreferences?: PropertyPreferencesDto;
    agentPreferences?: AgentPreferencesDto;
}
export declare class CompleteOnboardingDto {
    isCompleted: boolean;
    propertyPreferences?: PropertyPreferencesDto;
    agentPreferences?: AgentPreferencesDto;
}
