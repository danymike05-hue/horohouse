import { Model, Types } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { StudentProfile, StudentProfileDocument } from './schemas/student-profile.schema';
import { CreateStudentProfileDto, UpdateStudentProfileDto, ReviewStudentIdDto, GrantAmbassadorDto, GetStudentProfilesQueryDto } from './dto/student-profile.dto';
import { UserDocument } from '../users/schemas/user.schema';
import { NotificationsService } from '../notifications/notifications.service';
export declare class StudentProfilesService {
    private studentProfileModel;
    private userModel;
    private configService;
    private notificationsService;
    private readonly logger;
    constructor(studentProfileModel: Model<StudentProfileDocument>, userModel: Model<UserDocument>, configService: ConfigService, notificationsService: NotificationsService);
    create(userId: string, dto: CreateStudentProfileDto): Promise<StudentProfile>;
    findMyProfile(userId: string): Promise<StudentProfile>;
    findById(profileId: string): Promise<StudentProfile>;
    findAll(query: GetStudentProfilesQueryDto): Promise<{
        profiles: StudentProfile[];
        total: number;
        page: number;
        totalPages: number;
    }>;
    update(userId: string, dto: UpdateStudentProfileDto): Promise<StudentProfile>;
    uploadStudentId(userId: string, file: {
        buffer: Buffer;
        mimetype: string;
    }): Promise<StudentProfile>;
    reviewStudentId(profileId: string, adminId: string, dto: ReviewStudentIdDto): Promise<StudentProfile>;
    grantAmbassador(profileId: string, dto: GrantAmbassadorDto): Promise<StudentProfile>;
    resolveAmbassadorCode(code: string): Promise<{
        userId: Types.ObjectId;
        profileId: Types.ObjectId;
    } | null>;
    creditAmbassadorEarning(profileId: string, amountXaf: number, type?: 'student' | 'landlord'): Promise<void>;
    getStats(): Promise<{
        total: number;
        byVerificationStatus: Record<string, number>;
        byCampusCity: Array<{
            city: string;
            count: number;
        }>;
        ambassadors: number;
        seekingRoommate: number;
    }>;
    private notifyAdminsOfPendingId;
    private notifyStudentOfReview;
}
