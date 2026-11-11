import { FastifyRequest } from 'fastify';
import { StudentProfilesService } from './student-profiles.service';
import { CreateStudentProfileDto, UpdateStudentProfileDto, ReviewStudentIdDto, GrantAmbassadorDto, GetStudentProfilesQueryDto } from './dto/student-profile.dto';
import { User } from '../users/schemas/user.schema';
export declare class StudentProfilesController {
    private readonly studentProfilesService;
    constructor(studentProfilesService: StudentProfilesService);
    create(req: FastifyRequest & {
        user: User;
    }, dto: CreateStudentProfileDto): Promise<import("./schemas/student-profile.schema").StudentProfile>;
    getMyProfile(req: FastifyRequest & {
        user: User;
    }): Promise<import("./schemas/student-profile.schema").StudentProfile>;
    updateMyProfile(req: FastifyRequest & {
        user: User;
    }, dto: UpdateStudentProfileDto): Promise<import("./schemas/student-profile.schema").StudentProfile>;
    uploadStudentId(req: FastifyRequest & {
        user: User;
    }): Promise<import("./schemas/student-profile.schema").StudentProfile>;
    getVerificationStatus(req: FastifyRequest & {
        user: User;
    }): Promise<{
        verificationStatus: import("../users/schemas/user.schema").StudentVerificationStatus;
        verificationSubmittedAt: Date | undefined;
        verificationReviewedAt: Date | undefined;
        rejectionReason: string | null;
    }>;
    getAmbassadorStats(req: FastifyRequest & {
        user: User;
    }): Promise<{
        isAmbassador: boolean;
        ambassadorCode: string | null;
        ambassadorEarnings: number;
        referralCount: number;
        landlordReferralCount: number;
    }>;
    verifiedCheck(): {
        verified: boolean;
        message: string;
    };
    resolveAmbassadorCode(code: string): Promise<{
        valid: boolean;
        message: string;
    }>;
    adminFindAll(query: GetStudentProfilesQueryDto): Promise<{
        profiles: import("./schemas/student-profile.schema").StudentProfile[];
        total: number;
        page: number;
        totalPages: number;
    }>;
    adminGetStats(): Promise<{
        total: number;
        byVerificationStatus: Record<string, number>;
        byCampusCity: Array<{
            city: string;
            count: number;
        }>;
        ambassadors: number;
        seekingRoommate: number;
    }>;
    adminFindOne(id: string): Promise<import("./schemas/student-profile.schema").StudentProfile>;
    reviewStudentId(id: string, req: FastifyRequest & {
        user: User;
    }, dto: ReviewStudentIdDto): Promise<import("./schemas/student-profile.schema").StudentProfile>;
    grantAmbassador(id: string, dto: GrantAmbassadorDto): Promise<import("./schemas/student-profile.schema").StudentProfile>;
}
