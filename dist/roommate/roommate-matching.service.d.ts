import { Model } from 'mongoose';
import { RoommateProfile, RoommateProfileDocument, MatchStatus } from './schemas/roommate-profile.schema';
import { RoommateMatch, RoommateMatchDocument } from './schemas/roommate-match.schema';
import { CreateRoommateProfileDto, UpdateRoommateProfileDto, SearchRoommatesDto } from './dto/roommate.dto';
import { StudentProfileDocument } from '../student-profiles/schemas/student-profile.schema';
import { UserDocument } from '../users/schemas/user.schema';
import { NotificationsService } from '../notifications/notifications.service';
import { ChatService } from '../chat/chat.service';
export declare class RoommateMatchingService {
    private roommateProfileModel;
    private roommateMatchModel;
    private studentProfileModel;
    private userModel;
    private notificationsService;
    private chatService;
    private readonly logger;
    private readonly MATCH_EXPIRY_DAYS;
    constructor(roommateProfileModel: Model<RoommateProfileDocument>, roommateMatchModel: Model<RoommateMatchDocument>, studentProfileModel: Model<StudentProfileDocument>, userModel: Model<UserDocument>, notificationsService: NotificationsService, chatService: ChatService);
    createProfile(userId: string, dto: CreateRoommateProfileDto): Promise<RoommateProfile>;
    findMyProfile(userId: string): Promise<RoommateProfile>;
    findProfileById(profileId: string): Promise<RoommateProfile>;
    updateProfile(userId: string, dto: UpdateRoommateProfileDto): Promise<RoommateProfile>;
    deactivateProfile(userId: string): Promise<{
        message: string;
    }>;
    reactivateProfile(userId: string): Promise<RoommateProfile>;
    searchProfiles(requestingUserId: string, dto: SearchRoommatesDto): Promise<{
        profiles: Array<RoommateProfile & {
            compatibilityScore: number;
        }>;
        total: number;
        page: number;
        totalPages: number;
    }>;
    expressInterest(initiatorUserId: string, receiverUserId: string): Promise<{
        status: MatchStatus;
        chatRoomId?: string;
        message: string;
    }>;
    acceptMatch(receiverUserId: string, matchId: string): Promise<{
        status: MatchStatus;
        chatRoomId: string;
        message: string;
    }>;
    rejectMatch(receiverUserId: string, matchId: string): Promise<{
        message: string;
    }>;
    getMyMatches(userId: string): Promise<{
        pending: RoommateMatch[];
        matched: RoommateMatch[];
    }>;
    computeCompatibilityScore(a: RoommateProfile, b: RoommateProfile): number;
    expireStaleMatches(): Promise<void>;
    private confirmMatch;
}
