import { Document, Types } from 'mongoose';
export type RoommateProfileDocument = RoommateProfile & Document;
export declare enum SleepSchedule {
    EARLY_BIRD = "early_bird",
    NIGHT_OWL = "night_owl",
    FLEXIBLE = "flexible"
}
export declare enum CleanlinessLevel {
    VERY_NEAT = "very_neat",
    NEAT = "neat",
    RELAXED = "relaxed"
}
export declare enum SocialHabit {
    INTROVERTED = "introverted",
    BALANCED = "balanced",
    SOCIAL = "social"
}
export declare enum StudyHabit {
    HOME_STUDIER = "home_studier",
    LIBRARY_GOER = "library_goer",
    MIXED = "mixed"
}
export declare enum RoommateMode {
    HAVE_ROOM = "have_room",
    NEED_ROOM = "need_room"
}
export declare enum MatchStatus {
    PENDING = "pending",
    MATCHED = "matched",
    REJECTED = "rejected",
    EXPIRED = "expired"
}
export declare class RoommateProfile {
    userId: Types.ObjectId;
    studentProfileId: Types.ObjectId;
    mode: RoommateMode;
    propertyId?: Types.ObjectId;
    campusCity: string;
    preferredNeighborhood?: string;
    budgetPerPersonMax: number;
    budgetPerPersonMin: number;
    moveInDate: Date;
    moveInFlexibilityDays: number;
    sleepSchedule: SleepSchedule;
    cleanlinessLevel: CleanlinessLevel;
    socialHabit: SocialHabit;
    studyHabit: StudyHabit;
    isSmoker: boolean;
    acceptsSmoker: boolean;
    hasPet: boolean;
    acceptsPet: boolean;
    preferredRoommateGender: 'male' | 'female' | 'any';
    bio?: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}
export declare const RoommateProfileSchema: import("mongoose").Schema<RoommateProfile, import("mongoose").Model<RoommateProfile, any, any, any, Document<unknown, any, RoommateProfile, any, {}> & RoommateProfile & {
    _id: Types.ObjectId;
} & {
    __v: number;
}, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, RoommateProfile, Document<unknown, {}, import("mongoose").FlatRecord<RoommateProfile>, {}, import("mongoose").DefaultSchemaOptions> & import("mongoose").FlatRecord<RoommateProfile> & {
    _id: Types.ObjectId;
} & {
    __v: number;
}>;
