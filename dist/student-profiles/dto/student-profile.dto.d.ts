import { StudentVerificationStatus } from '../../users/schemas/user.schema';
export declare class CreateStudentProfileDto {
    universityName: string;
    campusCity: string;
    campusName: string;
    faculty?: string;
    studyLevel?: string;
    enrollmentYear?: number;
    campusLatitude?: number;
    campusLongitude?: number;
}
declare const UpdateStudentProfileDto_base: import("@nestjs/common").Type<Partial<CreateStudentProfileDto>>;
export declare class UpdateStudentProfileDto extends UpdateStudentProfileDto_base {
    roommateMode?: 'have_room' | 'need_room';
    isSeekingRoommate?: boolean;
}
export declare class ReviewStudentIdDto {
    decision: StudentVerificationStatus.VERIFIED | StudentVerificationStatus.REJECTED;
    rejectionReason?: string;
}
export declare class GrantAmbassadorDto {
    ambassadorCode: string;
}
export declare class GetStudentProfilesQueryDto {
    page?: number;
    limit?: number;
    verificationStatus?: StudentVerificationStatus;
    campusCity?: string;
    isAmbassador?: boolean;
}
export {};
