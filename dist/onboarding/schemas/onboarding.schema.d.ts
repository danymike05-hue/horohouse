import { Document, Types } from 'mongoose';
export type OnboardingDocument = Onboarding & Document;
export interface PropertyPreferences {
    propertyType: string[];
    budget: {
        min: number;
        max: number;
        currency: string;
    };
    location: string[];
    bedrooms: number[];
    bathrooms: number[];
    features: string[];
}
export interface AgentPreferences {
    licenseNumber: string;
    agency: string;
    experience: number;
    specializations: string[];
    serviceAreas: string[];
}
export declare class Onboarding {
    userId: Types.ObjectId;
    isCompleted: boolean;
    currentStep: number;
    totalSteps: number;
    propertyPreferences?: PropertyPreferences;
    agentPreferences?: AgentPreferences;
    completedSteps: string[];
    completedAt?: Date;
    lastActivityAt: Date;
    welcomeEmailSent: boolean;
    completionEmailSent: boolean;
}
export declare const OnboardingSchema: import("mongoose").Schema<Onboarding, import("mongoose").Model<Onboarding, any, any, any, Document<unknown, any, Onboarding, any, {}> & Onboarding & {
    _id: Types.ObjectId;
} & {
    __v: number;
}, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, Onboarding, Document<unknown, {}, import("mongoose").FlatRecord<Onboarding>, {}, import("mongoose").DefaultSchemaOptions> & import("mongoose").FlatRecord<Onboarding> & {
    _id: Types.ObjectId;
} & {
    __v: number;
}>;
