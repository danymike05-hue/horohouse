import { FastifyRequest } from 'fastify';
import { RoommateMatchingService } from './roommate-matching.service';
import { CreateRoommateProfileDto, UpdateRoommateProfileDto, SearchRoommatesDto } from './dto/roommate.dto';
import { User } from '../users/schemas/user.schema';
export declare class RoommateMatchingController {
    private readonly roommateMatchingService;
    constructor(roommateMatchingService: RoommateMatchingService);
    createProfile(req: FastifyRequest & {
        user: User;
    }, dto: CreateRoommateProfileDto): Promise<import("./schemas/roommate-profile.schema").RoommateProfile>;
    getMyProfile(req: FastifyRequest & {
        user: User;
    }): Promise<import("./schemas/roommate-profile.schema").RoommateProfile>;
    updateMyProfile(req: FastifyRequest & {
        user: User;
    }, dto: UpdateRoommateProfileDto): Promise<import("./schemas/roommate-profile.schema").RoommateProfile>;
    deactivateMyProfile(req: FastifyRequest & {
        user: User;
    }): Promise<{
        message: string;
    }>;
    reactivateMyProfile(req: FastifyRequest & {
        user: User;
    }): Promise<import("./schemas/roommate-profile.schema").RoommateProfile>;
    getProfileById(id: string): Promise<import("./schemas/roommate-profile.schema").RoommateProfile>;
    search(req: FastifyRequest & {
        user: User;
    }, dto: SearchRoommatesDto): Promise<{
        profiles: Array<import("./schemas/roommate-profile.schema").RoommateProfile & {
            compatibilityScore: number;
        }>;
        total: number;
        page: number;
        totalPages: number;
    }>;
    expressInterest(req: FastifyRequest & {
        user: User;
    }, receiverUserId: string): Promise<{
        status: import("./schemas/roommate-profile.schema").MatchStatus;
        chatRoomId?: string;
        message: string;
    }>;
    acceptMatch(req: FastifyRequest & {
        user: User;
    }, matchId: string): Promise<{
        status: import("./schemas/roommate-profile.schema").MatchStatus;
        chatRoomId: string;
        message: string;
    }>;
    rejectMatch(req: FastifyRequest & {
        user: User;
    }, matchId: string): Promise<{
        message: string;
    }>;
    getMyMatches(req: FastifyRequest & {
        user: User;
    }): Promise<{
        pending: import("./schemas/roommate-match.schema").RoommateMatch[];
        matched: import("./schemas/roommate-match.schema").RoommateMatch[];
    }>;
}
