import { Document, Types } from 'mongoose';
import { StudentVerificationStatus } from '../../users/schemas/user.schema';
export type StudentProfileDocument = StudentProfile & Document;
export declare class StudentProfile {
    userId: Types.ObjectId;
    universityName: string;
    faculty?: string;
    studyLevel?: string;
    enrollmentYear?: number;
    studentIdUrl?: string;
    studentIdPublicId?: string;
    verificationStatus: StudentVerificationStatus;
    verificationSubmittedAt?: Date;
    verificationReviewedAt?: Date;
    verificationRejectionReason?: string;
    verificationReviewedBy?: Types.ObjectId;
    campusCity: string;
    campusName: string;
    campusLatitude?: number;
    campusLongitude?: number;
    isSeekingRoommate: boolean;
    roommateMode?: 'have_room' | 'need_room' | null;
    roommateProfileId?: Types.ObjectId;
    isAmbassador: boolean;
    ambassadorCode?: string;
    ambassadorEarnings: number;
    referralCount: number;
    landlordReferralCount: number;
    createdAt: Date;
    updatedAt: Date;
}
export declare const StudentProfileSchema: import("mongoose").Schema<StudentProfile, import("mongoose").Model<StudentProfile, any, any, any, Document<unknown, any, StudentProfile, any, {}> & StudentProfile & {
    _id: Types.ObjectId;
} & {
    __v: number;
}, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, StudentProfile, Document<unknown, {}, import("mongoose").FlatRecord<StudentProfile>, {}, import("mongoose").DefaultSchemaOptions> & import("mongoose").FlatRecord<StudentProfile> & {
    _id: Types.ObjectId;
} & {
    __v: number;
}>;
