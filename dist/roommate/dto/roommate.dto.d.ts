import { SleepSchedule, CleanlinessLevel, SocialHabit, StudyHabit, RoommateMode } from '../schemas/roommate-profile.schema';
export declare class CreateRoommateProfileDto {
    mode: RoommateMode;
    propertyId?: string;
    campusCity: string;
    preferredNeighborhood?: string;
    budgetPerPersonMax: number;
    budgetPerPersonMin?: number;
    moveInDate: string;
    moveInFlexibilityDays?: number;
    sleepSchedule: SleepSchedule;
    cleanlinessLevel: CleanlinessLevel;
    socialHabit: SocialHabit;
    studyHabit: StudyHabit;
    isSmoker?: boolean;
    acceptsSmoker?: boolean;
    hasPet?: boolean;
    acceptsPet?: boolean;
    preferredRoommateGender?: 'male' | 'female' | 'any';
    bio?: string;
}
declare const UpdateRoommateProfileDto_base: import("@nestjs/common").Type<Partial<CreateRoommateProfileDto>>;
export declare class UpdateRoommateProfileDto extends UpdateRoommateProfileDto_base {
}
export declare class SearchRoommatesDto {
    page?: number;
    limit?: number;
    campusCity?: string;
    mode?: RoommateMode;
    maxBudget?: number;
    sleepSchedule?: SleepSchedule;
    cleanlinessLevel?: CleanlinessLevel;
    preferredRoommateGender?: 'male' | 'female' | 'any';
    acceptsSmoker?: boolean;
    acceptsPet?: boolean;
}
export {};
