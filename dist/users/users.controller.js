"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UsersController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const users_service_1 = require("./users.service");
const dto_1 = require("./dto");
const user_schema_1 = require("./schemas/user.schema");
const roles_guard_1 = require("../auth/guards/roles.guard");
const roles_guard_2 = require("../auth/guards/roles.guard");
const jwt_auth_guard_1 = require("../auth/guards/jwt.auth.guard");
let UsersController = class UsersController {
    usersService;
    constructor(usersService) {
        this.usersService = usersService;
    }
    async getMyViewedProperties(req, page, limit, sortBy, sortOrder) {
        return this.usersService.getViewedPropertiesWithPagination(req.user.id, {
            page: page ? parseInt(page.toString()) : 1,
            limit: limit ? parseInt(limit.toString()) : 20,
            sortBy: sortBy || 'viewedAt',
            sortOrder: sortOrder || 'desc',
        });
    }
    async removeFromMyViewingHistory(req, propertyId) {
        return this.usersService.removeFromViewingHistory(req.user.id, propertyId);
    }
    async clearMyViewingHistory(req) {
        return this.usersService.clearViewingHistory(req.user.id);
    }
    async getFavorites(req) {
        const user = await this.usersService.findOne(req.user.id);
        return user;
    }
    async addToFavorites(req, propertyId) {
        return this.usersService.addToFavorites(req.user.id, propertyId);
    }
    async removeFromFavorites(req, propertyId) {
        return this.usersService.removeFromFavorites(req.user.id, propertyId);
    }
    async getRecentlyViewed(req, limit) {
        return this.usersService.getRecentlyViewed(req.user.id, limit ? parseInt(limit.toString()) : 10);
    }
    async getSearchHistory(req, limit) {
        return this.usersService.getSearchHistory(req.user.id, limit ? parseInt(limit.toString()) : 20);
    }
    async updatePreferences(req, preferences) {
        return this.usersService.updatePreferences(req.user.id, preferences);
    }
    async uploadProfilePicture(req) {
        console.log('Content-Type header:', req.headers['content-type']);
        const data = await req.file();
        if (!data) {
            throw new common_1.BadRequestException('No file uploaded');
        }
        const buffer = await data.toBuffer();
        const file = {
            buffer,
            mimetype: data.mimetype,
            fieldname: data.fieldname,
            originalname: data.filename,
            encoding: data.encoding,
        };
        return this.usersService.uploadProfilePicture(req.user.id, file);
    }
    async updateMe(req, updateUserDto) {
        return this.usersService.update(req.user.id, updateUserDto);
    }
    async setMyRole(req, body) {
        if (!body.role) {
            throw new common_1.BadRequestException('role is required in request body');
        }
        return this.usersService.setRole(req.user.id, body.role);
    }
    async getMyTenants(req) {
        const user = await this.usersService.findOne(req.user.id);
        return { tenants: user.tenants || [] };
    }
    async addTenant(req, tenantData) {
        return this.usersService.addTenant(req.user.id, tenantData);
    }
    async updateTenant(req, tenantId, tenantData) {
        return this.usersService.updateTenant(req.user.id, tenantId, tenantData);
    }
    async removeTenant(req, tenantId) {
        return this.usersService.removeTenant(req.user.id, tenantId);
    }
    async getMyLeaseInfo(req) {
        return this.usersService.getMyLeaseInfo(req.user.id);
    }
    async getMe(req) {
        return this.usersService.findOne(req.user.id);
    }
    async create(createUserDto) {
        return this.usersService.create(createUserDto);
    }
    async findAll(page, limit, role, isActive, search) {
        return this.usersService.findAll(page ? parseInt(page.toString()) : 1, limit ? parseInt(limit.toString()) : 10, role, isActive, search);
    }
    async getStats() {
        return this.usersService.getStats();
    }
    async getAgents(page, limit) {
        return this.usersService.getAgents(page ? parseInt(page.toString()) : 1, limit ? parseInt(limit.toString()) : 10);
    }
    async getAgentById(id) {
        return this.usersService.getAgentById(id);
    }
    async getAgentStats(id) {
        return this.usersService.getAgentStats(id);
    }
    async getAgentProperties(id, status, page, limit) {
        return this.usersService.getAgentProperties(id, {
            status,
            page: page ? parseInt(page.toString()) : 1,
            limit: limit ? parseInt(limit.toString()) : 100,
        });
    }
    async getAgentReviews(id, page, limit) {
        return this.usersService.getAgentReviews(id, {
            page: page ? parseInt(page.toString()) : 1,
            limit: limit ? parseInt(limit.toString()) : 20,
        });
    }
    async getLandlords(page, limit) {
        return this.usersService.getLandlords(page ? parseInt(page.toString()) : 1, limit ? parseInt(limit.toString()) : 10);
    }
    async getLandlordById(id) {
        return this.usersService.getLandlordById(id);
    }
    async getLandlordStats(id) {
        return this.usersService.getLandlordStats(id);
    }
    async getLandlordProperties(id, status, page, limit) {
        return this.usersService.getAgentProperties(id, {
            status,
            page: page ? parseInt(page.toString()) : 1,
            limit: limit ? parseInt(limit.toString()) : 100,
        });
    }
    async getHosts(page, limit) {
        return this.usersService.getHosts(page ? parseInt(page.toString()) : 1, limit ? parseInt(limit.toString()) : 10);
    }
    async getHostById(id) {
        return this.usersService.getHostById(id);
    }
    async getHostStats(id) {
        return this.usersService.getHostStats(id);
    }
    async updateHostProfile(id, body) {
        return this.usersService.updateHostProfile(id, body);
    }
    async verifyHost(id, body) {
        return this.usersService.verifyHost(id, body.decision, body.rejectionReason);
    }
    async recalculateSuperhostStatus(id) {
        return this.usersService.recalculateSuperhostStatus(id);
    }
    async recordHostPayout(id, record) {
        return this.usersService.recordHostPayout(id, record);
    }
    async findOne(id) {
        return this.usersService.findPublicProfile(id);
    }
    async findOneFull(id) {
        return this.usersService.findOne(id);
    }
    async update(id, updateUserDto) {
        return this.usersService.update(id, updateUserDto);
    }
    async remove(id) {
        return this.usersService.remove(id);
    }
};
exports.UsersController = UsersController;
__decorate([
    (0, common_1.Get)('me/viewed-properties'),
    (0, swagger_1.ApiOperation)({ summary: 'Get current user\'s recently viewed properties with pagination' }),
    (0, swagger_1.ApiQuery)({ name: 'page', required: false, type: Number, description: 'Page number' }),
    (0, swagger_1.ApiQuery)({ name: 'limit', required: false, type: Number, description: 'Items per page' }),
    (0, swagger_1.ApiQuery)({ name: 'sortBy', required: false, type: String, description: 'Sort by field' }),
    (0, swagger_1.ApiQuery)({ name: 'sortOrder', required: false, enum: ['asc', 'desc'], description: 'Sort order' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Viewed properties retrieved successfully' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('page')),
    __param(2, (0, common_1.Query)('limit')),
    __param(3, (0, common_1.Query)('sortBy')),
    __param(4, (0, common_1.Query)('sortOrder')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number, Number, String, String]),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "getMyViewedProperties", null);
__decorate([
    (0, common_1.Delete)('me/viewed-properties/:propertyId'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Remove specific property from viewing history' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Property removed from viewing history' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('propertyId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "removeFromMyViewingHistory", null);
__decorate([
    (0, common_1.Delete)('me/viewed-properties'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Clear viewing history' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Viewing history cleared successfully' }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "clearMyViewingHistory", null);
__decorate([
    (0, common_1.Get)('me/favorites'),
    (0, swagger_1.ApiOperation)({ summary: 'Get current user favorites' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'User favorites' }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "getFavorites", null);
__decorate([
    (0, common_1.Post)('me/favorites/:propertyId'),
    (0, swagger_1.ApiOperation)({ summary: 'Add property to favorites' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Property added to favorites' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('propertyId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "addToFavorites", null);
__decorate([
    (0, common_1.Delete)('me/favorites/:propertyId'),
    (0, swagger_1.ApiOperation)({ summary: 'Remove property from favorites' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Property removed from favorites' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('propertyId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "removeFromFavorites", null);
__decorate([
    (0, common_1.Get)('me/recently-viewed'),
    (0, swagger_1.ApiOperation)({ summary: 'Get recently viewed properties' }),
    (0, swagger_1.ApiQuery)({ name: 'limit', required: false, type: Number, description: 'Number of items to return' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Recently viewed properties' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number]),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "getRecentlyViewed", null);
__decorate([
    (0, common_1.Get)('me/search-history'),
    (0, swagger_1.ApiOperation)({ summary: 'Get user search history' }),
    (0, swagger_1.ApiQuery)({ name: 'limit', required: false, type: Number, description: 'Number of items to return' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'User search history' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number]),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "getSearchHistory", null);
__decorate([
    (0, common_1.Patch)('me/preferences'),
    (0, swagger_1.ApiOperation)({ summary: 'Update user preferences' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Preferences updated successfully' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, dto_1.UpdatePreferencesDto]),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "updatePreferences", null);
__decorate([
    (0, common_1.Post)('me/profile-picture'),
    (0, swagger_1.ApiConsumes)('multipart/form-data'),
    (0, swagger_1.ApiOperation)({ summary: 'Upload profile picture' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Profile picture uploaded successfully' }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "uploadProfilePicture", null);
__decorate([
    (0, common_1.Patch)('me'),
    (0, swagger_1.ApiOperation)({ summary: 'Update current user profile' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Profile updated successfully' }),
    (0, swagger_1.ApiResponse)({ status: 400, description: 'Attempted to set a restricted field' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, dto_1.UpdateOwnProfileDto]),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "updateMe", null);
__decorate([
    (0, common_1.Patch)('me/role'),
    (0, swagger_1.ApiOperation)({ summary: 'Set role explicitly (REGISTERED_USER | AGENT | LANDLORD | HOST | GUEST | STUDENT). ADMIN cannot be assigned here.' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Role updated successfully' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, dto_1.SetRoleDto]),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "setMyRole", null);
__decorate([
    (0, common_1.Get)('me/tenants'),
    (0, roles_guard_1.Roles)(user_schema_1.UserRole.LANDLORD, user_schema_1.UserRole.ADMIN),
    (0, swagger_1.ApiOperation)({ summary: 'Get current landlord\'s tenants' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Tenants retrieved successfully' }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "getMyTenants", null);
__decorate([
    (0, common_1.Post)('me/tenants'),
    (0, roles_guard_1.Roles)(user_schema_1.UserRole.LANDLORD, user_schema_1.UserRole.ADMIN),
    (0, swagger_1.ApiOperation)({ summary: 'Add a tenant' }),
    (0, swagger_1.ApiResponse)({ status: 201, description: 'Tenant added successfully' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, dto_1.CreateTenantDto]),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "addTenant", null);
__decorate([
    (0, common_1.Patch)('me/tenants/:tenantId'),
    (0, roles_guard_1.Roles)(user_schema_1.UserRole.LANDLORD, user_schema_1.UserRole.ADMIN),
    (0, swagger_1.ApiOperation)({ summary: 'Update a tenant' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Tenant updated successfully' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('tenantId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, dto_1.UpdateTenantDto]),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "updateTenant", null);
__decorate([
    (0, common_1.Delete)('me/tenants/:tenantId'),
    (0, roles_guard_1.Roles)(user_schema_1.UserRole.LANDLORD, user_schema_1.UserRole.ADMIN),
    (0, swagger_1.ApiOperation)({ summary: 'Remove a tenant' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Tenant removed successfully' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('tenantId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "removeTenant", null);
__decorate([
    (0, common_1.Get)('me/lease-info'),
    (0, swagger_1.ApiOperation)({ summary: 'Get lease info for the logged-in user if they are a tenant' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Lease info retrieved successfully' }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "getMyLeaseInfo", null);
__decorate([
    (0, common_1.Get)('me'),
    (0, swagger_1.ApiOperation)({ summary: 'Get current user profile' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Current user profile' }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "getMe", null);
__decorate([
    (0, common_1.Post)(),
    (0, roles_guard_1.Roles)(user_schema_1.UserRole.ADMIN),
    (0, swagger_1.ApiOperation)({ summary: 'Create a new user (Admin only)' }),
    (0, swagger_1.ApiResponse)({ status: 201, description: 'User created successfully' }),
    (0, swagger_1.ApiResponse)({ status: 400, description: 'Bad request' }),
    (0, swagger_1.ApiResponse)({ status: 403, description: 'Forbidden - Admin access required' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.CreateUserDto]),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(),
    (0, roles_guard_1.Roles)(user_schema_1.UserRole.ADMIN),
    (0, swagger_1.ApiOperation)({ summary: 'Get all users with pagination (Admin only)' }),
    (0, swagger_1.ApiQuery)({ name: 'page', required: false, type: Number, description: 'Page number' }),
    (0, swagger_1.ApiQuery)({ name: 'limit', required: false, type: Number, description: 'Items per page' }),
    (0, swagger_1.ApiQuery)({ name: 'role', required: false, enum: user_schema_1.UserRole, description: 'Filter by role' }),
    (0, swagger_1.ApiQuery)({ name: 'isActive', required: false, type: Boolean, description: 'Filter by active status' }),
    (0, swagger_1.ApiQuery)({ name: 'search', required: false, type: String, description: 'Search by name, email, or phone' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Users retrieved successfully' }),
    __param(0, (0, common_1.Query)('page')),
    __param(1, (0, common_1.Query)('limit')),
    __param(2, (0, common_1.Query)('role')),
    __param(3, (0, common_1.Query)('isActive')),
    __param(4, (0, common_1.Query)('search')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Number, String, Boolean, String]),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)('stats'),
    (0, roles_guard_1.Roles)(user_schema_1.UserRole.ADMIN),
    (0, swagger_1.ApiOperation)({ summary: 'Get user statistics (Admin only)' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'User statistics' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "getStats", null);
__decorate([
    (0, common_1.Get)('agents'),
    (0, roles_guard_2.Public)(),
    (0, swagger_1.ApiOperation)({ summary: 'Get all agents with their statistics' }),
    (0, swagger_1.ApiQuery)({ name: 'page', required: false, type: Number }),
    (0, swagger_1.ApiQuery)({ name: 'limit', required: false, type: Number }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Agents retrieved successfully' }),
    __param(0, (0, common_1.Query)('page')),
    __param(1, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Number]),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "getAgents", null);
__decorate([
    (0, common_1.Get)('agents/:id'),
    (0, roles_guard_2.Public)(),
    (0, swagger_1.ApiOperation)({ summary: 'Get agent by ID with full details' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Agent details retrieved successfully' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Agent not found' }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "getAgentById", null);
__decorate([
    (0, common_1.Get)('agents/:id/stats'),
    (0, roles_guard_2.Public)(),
    (0, swagger_1.ApiOperation)({ summary: 'Get agent statistics' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Agent stats retrieved successfully' }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "getAgentStats", null);
__decorate([
    (0, common_1.Get)('agents/:id/properties'),
    (0, roles_guard_2.Public)(),
    (0, swagger_1.ApiOperation)({ summary: 'Get agent properties' }),
    (0, swagger_1.ApiQuery)({ name: 'status', required: false, type: String }),
    (0, swagger_1.ApiQuery)({ name: 'page', required: false, type: Number }),
    (0, swagger_1.ApiQuery)({ name: 'limit', required: false, type: Number }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Agent properties retrieved successfully' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Query)('status')),
    __param(2, (0, common_1.Query)('page')),
    __param(3, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Number, Number]),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "getAgentProperties", null);
__decorate([
    (0, common_1.Get)('agents/:id/reviews'),
    (0, roles_guard_2.Public)(),
    (0, swagger_1.ApiOperation)({ summary: 'Get agent reviews' }),
    (0, swagger_1.ApiQuery)({ name: 'page', required: false, type: Number }),
    (0, swagger_1.ApiQuery)({ name: 'limit', required: false, type: Number }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Agent reviews retrieved successfully' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Query)('page')),
    __param(2, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Number, Number]),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "getAgentReviews", null);
__decorate([
    (0, common_1.Get)('landlords'),
    (0, roles_guard_2.Public)(),
    (0, swagger_1.ApiOperation)({ summary: 'Get all landlords with their statistics' }),
    (0, swagger_1.ApiQuery)({ name: 'page', required: false, type: Number }),
    (0, swagger_1.ApiQuery)({ name: 'limit', required: false, type: Number }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Landlords retrieved successfully' }),
    __param(0, (0, common_1.Query)('page')),
    __param(1, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Number]),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "getLandlords", null);
__decorate([
    (0, common_1.Get)('landlords/:id'),
    (0, roles_guard_2.Public)(),
    (0, swagger_1.ApiOperation)({ summary: 'Get landlord by ID with full details' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Landlord details retrieved successfully' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Landlord not found' }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "getLandlordById", null);
__decorate([
    (0, common_1.Get)('landlords/:id/stats'),
    (0, roles_guard_2.Public)(),
    (0, swagger_1.ApiOperation)({ summary: 'Get landlord statistics' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Landlord stats retrieved successfully' }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "getLandlordStats", null);
__decorate([
    (0, common_1.Get)('landlords/:id/properties'),
    (0, roles_guard_2.Public)(),
    (0, swagger_1.ApiOperation)({ summary: 'Get landlord properties' }),
    (0, swagger_1.ApiQuery)({ name: 'status', required: false, type: String }),
    (0, swagger_1.ApiQuery)({ name: 'page', required: false, type: Number }),
    (0, swagger_1.ApiQuery)({ name: 'limit', required: false, type: Number }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Landlord properties retrieved successfully' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Query)('status')),
    __param(2, (0, common_1.Query)('page')),
    __param(3, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Number, Number]),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "getLandlordProperties", null);
__decorate([
    (0, common_1.Get)('hosts'),
    (0, roles_guard_2.Public)(),
    (0, swagger_1.ApiOperation)({ summary: 'Get all active hosts with short-term listing stats' }),
    (0, swagger_1.ApiQuery)({ name: 'page', required: false, type: Number }),
    (0, swagger_1.ApiQuery)({ name: 'limit', required: false, type: Number }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Hosts retrieved successfully' }),
    __param(0, (0, common_1.Query)('page')),
    __param(1, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Number]),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "getHosts", null);
__decorate([
    (0, common_1.Get)('hosts/:id'),
    (0, roles_guard_2.Public)(),
    (0, swagger_1.ApiOperation)({ summary: 'Get host by ID with full profile (sensitive fields stripped)' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Host profile retrieved successfully' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Host not found' }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "getHostById", null);
__decorate([
    (0, common_1.Get)('hosts/:id/stats'),
    (0, swagger_1.ApiOperation)({ summary: 'Get live dashboard stats for a host' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Host stats retrieved successfully' }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "getHostStats", null);
__decorate([
    (0, common_1.Patch)('hosts/:id/profile'),
    (0, roles_guard_1.Roles)(user_schema_1.UserRole.HOST, user_schema_1.UserRole.ADMIN),
    (0, swagger_1.ApiOperation)({
        summary: 'Update host profile fields — preferences, house rules, payout accounts, co-hosts, bio',
    }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Host profile updated' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, dto_1.UpdateHostProfileDto]),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "updateHostProfile", null);
__decorate([
    (0, common_1.Patch)('hosts/:id/verify'),
    (0, roles_guard_1.Roles)(user_schema_1.UserRole.ADMIN),
    (0, swagger_1.ApiOperation)({ summary: 'Approve or reject a host identity verification (Admin only)' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Verification decision applied' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, dto_1.VerifyHostDto]),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "verifyHost", null);
__decorate([
    (0, common_1.Post)('hosts/:id/superhost/recalculate'),
    (0, roles_guard_1.Roles)(user_schema_1.UserRole.ADMIN),
    (0, swagger_1.ApiOperation)({ summary: 'Manually trigger Superhost status recalculation (Admin only)' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Superhost status recalculated' }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "recalculateSuperhostStatus", null);
__decorate([
    (0, common_1.Post)('hosts/:id/payouts'),
    (0, roles_guard_1.Roles)(user_schema_1.UserRole.ADMIN),
    (0, swagger_1.ApiOperation)({ summary: 'Record a host payout — called internally by payments service (Admin only)' }),
    (0, swagger_1.ApiResponse)({ status: 201, description: 'Payout recorded successfully' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, dto_1.RecordHostPayoutDto]),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "recordHostPayout", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, roles_guard_2.Public)(),
    (0, swagger_1.ApiOperation)({ summary: 'Get public-safe user profile by ID' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Public profile found' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'User not found' }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "findOne", null);
__decorate([
    (0, common_1.Get)(':id/full'),
    (0, roles_guard_1.Roles)(user_schema_1.UserRole.ADMIN),
    (0, swagger_1.ApiOperation)({ summary: 'Get full user profile by ID (Admin only)' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Full user profile' }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "findOneFull", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, roles_guard_1.Roles)(user_schema_1.UserRole.ADMIN),
    (0, swagger_1.ApiOperation)({ summary: 'Update user by ID (Admin only)' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'User updated successfully' }),
    (0, swagger_1.ApiResponse)({ status: 403, description: 'Forbidden - Admin access required' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'User not found' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, dto_1.UpdateUserDto]),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, roles_guard_1.Roles)(user_schema_1.UserRole.ADMIN),
    (0, swagger_1.ApiOperation)({ summary: 'Deactivate user (Admin only)' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'User deactivated successfully' }),
    (0, swagger_1.ApiResponse)({ status: 403, description: 'Forbidden - Admin access required' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'User not found' }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "remove", null);
exports.UsersController = UsersController = __decorate([
    (0, swagger_1.ApiTags)('Users'),
    (0, swagger_1.ApiBearerAuth)('JWT-auth'),
    (0, common_1.Controller)('users'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    __metadata("design:paramtypes", [users_service_1.UsersService])
], UsersController);
//# sourceMappingURL=users.controller.js.map