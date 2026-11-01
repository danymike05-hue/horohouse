import { UsersService } from './users.service';
import { CreateUserDto, UpdateUserDto, UpdatePreferencesDto, CreateTenantDto, UpdateTenantDto, SetRoleDto, UpdateHostProfileDto, VerifyHostDto, RecordHostPayoutDto, UpdateOwnProfileDto } from './dto';
import { User, UserRole } from './schemas/user.schema';
export declare class UsersController {
    private readonly usersService;
    constructor(usersService: UsersService);
    getMyViewedProperties(req: any, page?: number, limit?: number, sortBy?: string, sortOrder?: 'asc' | 'desc'): Promise<{
        properties: any[];
        total: number;
        page: number;
        totalPages: number;
        lastViewed?: Date;
    }>;
    removeFromMyViewingHistory(req: any, propertyId: string): Promise<{
        message: string;
    }>;
    clearMyViewingHistory(req: any): Promise<{
        message: string;
    }>;
    getFavorites(req: any): Promise<User>;
    addToFavorites(req: any, propertyId: string): Promise<User>;
    removeFromFavorites(req: any, propertyId: string): Promise<User>;
    getRecentlyViewed(req: any, limit?: number): Promise<any[]>;
    getSearchHistory(req: any, limit?: number): Promise<any[]>;
    updatePreferences(req: any, preferences: UpdatePreferencesDto): Promise<User>;
    uploadProfilePicture(req: any): Promise<User>;
    updateMe(req: any, updateUserDto: UpdateOwnProfileDto): Promise<User>;
    setMyRole(req: any, body: SetRoleDto): Promise<User>;
    getMyTenants(req: any): Promise<{
        tenants: import("./schemas/user.schema").TenantRecord[];
    }>;
    addTenant(req: any, tenantData: CreateTenantDto): Promise<any>;
    updateTenant(req: any, tenantId: string, tenantData: UpdateTenantDto): Promise<any>;
    removeTenant(req: any, tenantId: string): Promise<any>;
    getMyLeaseInfo(req: any): Promise<any>;
    getMe(req: any): Promise<User>;
    create(createUserDto: CreateUserDto): Promise<User>;
    findAll(page?: number, limit?: number, role?: UserRole, isActive?: boolean, search?: string): Promise<{
        users: User[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    }>;
    getStats(): Promise<any>;
    getAgents(page?: number, limit?: number): Promise<any>;
    getAgentById(id: string): Promise<any>;
    getAgentStats(id: string): Promise<any>;
    getAgentProperties(id: string, status?: string, page?: number, limit?: number): Promise<any>;
    getAgentReviews(id: string, page?: number, limit?: number): Promise<any>;
    getLandlords(page?: number, limit?: number): Promise<any>;
    getLandlordById(id: string): Promise<any>;
    getLandlordStats(id: string): Promise<any>;
    getLandlordProperties(id: string, status?: string, page?: number, limit?: number): Promise<any>;
    getHosts(page?: number, limit?: number): Promise<any>;
    getHostById(id: string): Promise<any>;
    getHostStats(id: string): Promise<any>;
    updateHostProfile(id: string, body: UpdateHostProfileDto): Promise<any>;
    verifyHost(id: string, body: VerifyHostDto): Promise<any>;
    recalculateSuperhostStatus(id: string): Promise<{
        isSuperhost: boolean;
        reason?: string;
        superhostSince?: Date;
    }>;
    recordHostPayout(id: string, record: RecordHostPayoutDto): Promise<any>;
    findOne(id: string): Promise<Partial<User>>;
    findOneFull(id: string): Promise<User>;
    update(id: string, updateUserDto: UpdateUserDto): Promise<User>;
    remove(id: string): Promise<void>;
}
