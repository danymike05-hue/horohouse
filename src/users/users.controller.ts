import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  Req,
  UseGuards,
  BadRequestException,
  HttpCode,
  HttpStatus,
  ForbiddenException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiConsumes,
  ApiBearerAuth,
} from '@nestjs/swagger';

import { UsersService } from './users.service';
import { CreateUserDto, UpdateUserDto, UpdatePreferencesDto, CreateTenantDto, UpdateTenantDto, SetRoleDto, UpdateHostProfileDto, VerifyHostDto, RecordHostPayoutDto, UpdateOwnProfileDto } from './dto';
import { User, UserRole } from './schemas/user.schema';
import { Roles, RolesGuard } from '../auth/guards/roles.guard';
import { Public } from '../auth/guards/roles.guard';
import { JwtAuthGuard } from '../auth/guards/jwt.auth.guard';

@ApiTags('Users')
@ApiBearerAuth('JWT-auth')
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) { }

  // ==========================================
  // SPECIFIC /me/* ROUTES FIRST (Most specific to least specific)
  // ==========================================

  @Get('me/viewed-properties')
  @ApiOperation({ summary: 'Get current user\'s recently viewed properties with pagination' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page' })
  @ApiQuery({ name: 'sortBy', required: false, type: String, description: 'Sort by field' })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['asc', 'desc'], description: 'Sort order' })
  @ApiResponse({ status: 200, description: 'Viewed properties retrieved successfully' })
  async getMyViewedProperties(
    @Req() req: any,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: 'asc' | 'desc',
  ) {
    return this.usersService.getViewedPropertiesWithPagination(req.user.id, {
      page: page ? parseInt(page.toString()) : 1,
      limit: limit ? parseInt(limit.toString()) : 20,
      sortBy: sortBy || 'viewedAt',
      sortOrder: sortOrder || 'desc',
    });
  }

  @Delete('me/viewed-properties/:propertyId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove specific property from viewing history' })
  @ApiResponse({ status: 200, description: 'Property removed from viewing history' })
  async removeFromMyViewingHistory(
    @Req() req: any,
    @Param('propertyId') propertyId: string,
  ) {
    return this.usersService.removeFromViewingHistory(req.user.id, propertyId);
  }

  @Delete('me/viewed-properties')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Clear viewing history' })
  @ApiResponse({ status: 200, description: 'Viewing history cleared successfully' })
  async clearMyViewingHistory(@Req() req: any) {
    return this.usersService.clearViewingHistory(req.user.id);
  }

  @Get('me/favorites')
  @ApiOperation({ summary: 'Get current user favorites' })
  @ApiResponse({ status: 200, description: 'User favorites' })
  async getFavorites(@Req() req: any): Promise<User> {
    const user = await this.usersService.findOne(req.user.id);
    return user;
  }

  @Post('me/favorites/:propertyId')
  @ApiOperation({ summary: 'Add property to favorites' })
  @ApiResponse({ status: 200, description: 'Property added to favorites' })
  async addToFavorites(
    @Req() req: any,
    @Param('propertyId') propertyId: string,
  ): Promise<User> {
    return this.usersService.addToFavorites(req.user.id, propertyId);
  }

  @Delete('me/favorites/:propertyId')
  @ApiOperation({ summary: 'Remove property from favorites' })
  @ApiResponse({ status: 200, description: 'Property removed from favorites' })
  async removeFromFavorites(
    @Req() req: any,
    @Param('propertyId') propertyId: string,
  ): Promise<User> {
    return this.usersService.removeFromFavorites(req.user.id, propertyId);
  }

  @Get('me/recently-viewed')
  @ApiOperation({ summary: 'Get recently viewed properties' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Number of items to return' })
  @ApiResponse({ status: 200, description: 'Recently viewed properties' })
  async getRecentlyViewed(
    @Req() req: any,
    @Query('limit') limit?: number,
  ) {
    return this.usersService.getRecentlyViewed(
      req.user.id,
      limit ? parseInt(limit.toString()) : 10,
    );
  }

  @Get('me/search-history')
  @ApiOperation({ summary: 'Get user search history' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Number of items to return' })
  @ApiResponse({ status: 200, description: 'User search history' })
  async getSearchHistory(
    @Req() req: any,
    @Query('limit') limit?: number,
  ) {
    return this.usersService.getSearchHistory(
      req.user.id,
      limit ? parseInt(limit.toString()) : 20,
    );
  }

  @Patch('me/preferences')
  @ApiOperation({ summary: 'Update user preferences' })
  @ApiResponse({ status: 200, description: 'Preferences updated successfully' })
  async updatePreferences(
    @Req() req: any,
    @Body() preferences: UpdatePreferencesDto,
  ): Promise<User> {
    return this.usersService.updatePreferences(req.user.id, preferences);
  }

  @Post('me/profile-picture')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload profile picture' })
  @ApiResponse({ status: 200, description: 'Profile picture uploaded successfully' })
  async uploadProfilePicture(@Req() req: any): Promise<User> {
    // Await the multipart file (Fastify multipart)
    console.log('Content-Type header:', req.headers['content-type']);
    const data = await req.file();

    if (!data) {
      throw new BadRequestException('No file uploaded');
    }

    // Convert file stream to buffer (Fastify gives a stream, so buffer is async)
    const buffer = await data.toBuffer();

    // Create an object to pass to service:
    const file = {
      buffer,
      mimetype: data.mimetype,
      fieldname: data.fieldname,
      originalname: data.filename,
      encoding: data.encoding,
    };

    // Pass user id and file object to service
    return this.usersService.uploadProfilePicture(req.user.id, file);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update current user profile' })
  @ApiResponse({ status: 200, description: 'Profile updated successfully' })
  @ApiResponse({ status: 400, description: 'Attempted to set a restricted field' })
  async updateMe(
    @Req() req: any,
    @Body() updateUserDto: UpdateOwnProfileDto,
  ): Promise<User> {
    return this.usersService.update(req.user.id, updateUserDto);
  }

  @Patch('me/role')
  @ApiOperation({ summary: 'Set role explicitly (REGISTERED_USER | AGENT | LANDLORD | HOST | GUEST | STUDENT). ADMIN cannot be assigned here.' })
  @ApiResponse({ status: 200, description: 'Role updated successfully' })
  async setMyRole(
    @Req() req: any,
    @Body() body: SetRoleDto,
  ): Promise<User> {
    if (!body.role) {
      throw new BadRequestException('role is required in request body');
    }
    return this.usersService.setRole(req.user.id, body.role);
  }

  @Delete('me/profile-picture')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove profile picture' })
  async removeProfilePicture(@Req() req: any): Promise<User> {
    return this.usersService.removeProfilePicture(req.user.id);
  }

  // ==========================================
  // TENANT MANAGEMENT (Landlord-specific)
  // ==========================================

  @Get('me/tenants')
  @Roles(UserRole.LANDLORD, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get current landlord\'s tenants' })
  @ApiResponse({ status: 200, description: 'Tenants retrieved successfully' })
  async getMyTenants(@Req() req: any) {
    const user = await this.usersService.findOne(req.user.id);
    return { tenants: user.tenants || [] };
  }

  @Post('me/tenants')
  @Roles(UserRole.LANDLORD, UserRole.ADMIN)
  @ApiOperation({ summary: 'Add a tenant' })
  @ApiResponse({ status: 201, description: 'Tenant added successfully' })
  async addTenant(@Req() req: any, @Body() tenantData: CreateTenantDto) {
    return this.usersService.addTenant(req.user.id, tenantData);
  }

  @Patch('me/tenants/:tenantId')
  @Roles(UserRole.LANDLORD, UserRole.ADMIN)
  @ApiOperation({ summary: 'Update a tenant' })
  @ApiResponse({ status: 200, description: 'Tenant updated successfully' })
  async updateTenant(
    @Req() req: any,
    @Param('tenantId') tenantId: string,
    @Body() tenantData: UpdateTenantDto,
  ) {
    return this.usersService.updateTenant(req.user.id, tenantId, tenantData);
  }

  @Delete('me/tenants/:tenantId')
  @Roles(UserRole.LANDLORD, UserRole.ADMIN)
  @ApiOperation({ summary: 'Remove a tenant' })
  @ApiResponse({ status: 200, description: 'Tenant removed successfully' })
  async removeTenant(
    @Req() req: any,
    @Param('tenantId') tenantId: string,
  ) {
    return this.usersService.removeTenant(req.user.id, tenantId);
  }

  // ==========================================
  // REGULAR USER - TENANT ROUTES
  // ==========================================

  @Get('me/lease-info')
  @ApiOperation({ summary: 'Get lease info for the logged-in user if they are a tenant' })
  @ApiResponse({ status: 200, description: 'Lease info retrieved successfully' })
  async getMyLeaseInfo(@Req() req: any) {
    return this.usersService.getMyLeaseInfo(req.user.id);
  }

  // ==========================================
  // GENERIC /me ROUTE LAST
  // ==========================================

  @Get('me')
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, description: 'Current user profile' })
  async getMe(@Req() req: any): Promise<User> {
    return this.usersService.findOne(req.user.id);
  }

  // ==========================================
  // ADMIN AND PUBLIC ROUTES
  // ==========================================

  @Post()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Create a new user (Admin only)' })
  @ApiResponse({ status: 201, description: 'User created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin access required' })
  async create(@Body() createUserDto: CreateUserDto): Promise<User> {
    return this.usersService.create(createUserDto);
  }

  @Get()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get all users with pagination (Admin only)' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page' })
  @ApiQuery({ name: 'role', required: false, enum: UserRole, description: 'Filter by role' })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean, description: 'Filter by active status' })
  @ApiQuery({ name: 'search', required: false, type: String, description: 'Search by name, email, or phone' })
  @ApiResponse({ status: 200, description: 'Users retrieved successfully' })
  async findAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('role') role?: UserRole,
    @Query('isActive') isActive?: boolean,
    @Query('search') search?: string,
  ) {
    return this.usersService.findAll(
      page ? parseInt(page.toString()) : 1,
      limit ? parseInt(limit.toString()) : 10,
      role,
      isActive,
      search,
    );
  }

  @Get('stats')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get user statistics (Admin only)' })
  @ApiResponse({ status: 200, description: 'User statistics' })
  async getStats() {
    return this.usersService.getStats();
  }

  @Get('agents')
  @Public()
  @ApiOperation({ summary: 'Get all agents with their statistics' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Agents retrieved successfully' })
  async getAgents(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.usersService.getAgents(
      page ? parseInt(page.toString()) : 1,
      limit ? parseInt(limit.toString()) : 10,
    );
  }

  @Get('agents/:id')
  @Public()
  @ApiOperation({ summary: 'Get agent by ID with full details' })
  @ApiResponse({ status: 200, description: 'Agent details retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Agent not found' })
  async getAgentById(@Param('id') id: string) {
    return this.usersService.getAgentById(id);
  }

  @Get('agents/:id/stats')
  @Public()
  @ApiOperation({ summary: 'Get agent statistics' })
  @ApiResponse({ status: 200, description: 'Agent stats retrieved successfully' })
  async getAgentStats(@Param('id') id: string) {
    return this.usersService.getAgentStats(id);
  }

  @Get('agents/:id/properties')
  @Public()
  @ApiOperation({ summary: 'Get agent properties' })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Agent properties retrieved successfully' })
  async getAgentProperties(
    @Param('id') id: string,
    @Query('status') status?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.usersService.getAgentProperties(id, {
      status,
      page: page ? parseInt(page.toString()) : 1,
      limit: limit ? parseInt(limit.toString()) : 100,
    });
  }

  @Get('agents/:id/reviews')
  @Public()
  @ApiOperation({ summary: 'Get agent reviews' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Agent reviews retrieved successfully' })
  async getAgentReviews(
    @Param('id') id: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.usersService.getAgentReviews(id, {
      page: page ? parseInt(page.toString()) : 1,
      limit: limit ? parseInt(limit.toString()) : 20,
    });
  }

  // ==========================================
  // LANDLORD PUBLIC ROUTES
  // ==========================================

  @Get('landlords')
  @Public()
  @ApiOperation({ summary: 'Get all landlords with their statistics' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Landlords retrieved successfully' })
  async getLandlords(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.usersService.getLandlords(
      page ? parseInt(page.toString()) : 1,
      limit ? parseInt(limit.toString()) : 10,
    );
  }

  @Get('landlords/:id')
  @Public()
  @ApiOperation({ summary: 'Get landlord by ID with full details' })
  @ApiResponse({ status: 200, description: 'Landlord details retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Landlord not found' })
  async getLandlordById(@Param('id') id: string) {
    return this.usersService.getLandlordById(id);
  }

  @Get('landlords/:id/stats')
  @Public()
  @ApiOperation({ summary: 'Get landlord statistics' })
  @ApiResponse({ status: 200, description: 'Landlord stats retrieved successfully' })
  async getLandlordStats(@Param('id') id: string) {
    return this.usersService.getLandlordStats(id);
  }

  @Get('landlords/:id/properties')
  @Public()
  @ApiOperation({ summary: 'Get landlord properties' })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Landlord properties retrieved successfully' })
  async getLandlordProperties(
    @Param('id') id: string,
    @Query('status') status?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.usersService.getAgentProperties(id, {
      status,
      page: page ? parseInt(page.toString()) : 1,
      limit: limit ? parseInt(limit.toString()) : 100,
    });
  }

  // ==========================================
  // HOST PUBLIC ROUTES
  // ==========================================

  @Get('hosts')
  @Public()
  @ApiOperation({ summary: 'Get all active hosts with short-term listing stats' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Hosts retrieved successfully' })
  async getHosts(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.usersService.getHosts(
      page ? parseInt(page.toString()) : 1,
      limit ? parseInt(limit.toString()) : 10,
    );
  }

  @Get('hosts/:id')
  @Public()
  @ApiOperation({ summary: 'Get host by ID with full profile (sensitive fields stripped)' })
  @ApiResponse({ status: 200, description: 'Host profile retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Host not found' })
  async getHostById(@Param('id') id: string) {
    return this.usersService.getHostById(id);
  }

  @Get('hosts/:id/stats')
  @Roles(UserRole.HOST, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get live dashboard stats for a host (owner or admin)' })
  async getHostStats(@Param('id') id: string, @Req() req: any) {
    if (req.user.role !== UserRole.ADMIN && String(req.user.id) !== id) {
      throw new ForbiddenException('You can only view your own host stats');
    }
    return this.usersService.getHostStats(id);
  }

  // ==========================================
  // HOST MANAGEMENT — authenticated host actions
  // ==========================================

  @Patch('hosts/:id/profile')
  @Roles(UserRole.HOST, UserRole.ADMIN)
  @ApiOperation({ summary: 'Update host profile (owner or admin)' })
  async updateHostProfile(
    @Param('id') id: string,
    @Body() body: UpdateHostProfileDto,
    @Req() req: any,
  ) {
    if (req.user.role !== UserRole.ADMIN && String(req.user.id) !== id) {
      throw new ForbiddenException('You can only edit your own host profile');
    }
    return this.usersService.updateHostProfile(id, body);
  }

  // ==========================================
  // HOST ADMIN ROUTES
  // ==========================================

  @Patch('hosts/:id/verify')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Approve or reject a host identity verification (Admin only)' })
  @ApiResponse({ status: 200, description: 'Verification decision applied' })
  async verifyHost(
    @Param('id') id: string,
    @Body() body: VerifyHostDto,
  ) {
    return this.usersService.verifyHost(id, body.decision, body.rejectionReason);
  }

  @Post('hosts/:id/superhost/recalculate')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Manually trigger Superhost status recalculation (Admin only)' })
  @ApiResponse({ status: 200, description: 'Superhost status recalculated' })
  async recalculateSuperhostStatus(@Param('id') id: string) {
    return this.usersService.recalculateSuperhostStatus(id);
  }

  @Post('hosts/:id/payouts')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Record a host payout — called internally by payments service (Admin only)' })
  @ApiResponse({ status: 201, description: 'Payout recorded successfully' })
  async recordHostPayout(
    @Param('id') id: string,
    @Body() record: RecordHostPayoutDto,
  ) {
    return this.usersService.recordHostPayout(id, record);
  }

  // ==========================================
  // GENERIC ADMIN ROUTES — keep at end to avoid shadowing named routes
  // ==========================================

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Get public-safe user profile by ID' })
  @ApiResponse({ status: 200, description: 'Public profile found' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async findOne(@Param('id') id: string): Promise<Partial<User>> {
    return this.usersService.findPublicProfile(id);
  }

  @Get(':id/full')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get full user profile by ID (Admin only)' })
  @ApiResponse({ status: 200, description: 'Full user profile' })
  async findOneFull(@Param('id') id: string): Promise<User> {
    return this.usersService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Update user by ID (Admin only)' })
  @ApiResponse({ status: 200, description: 'User updated successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin access required' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async update(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
  ): Promise<User> {
    return this.usersService.update(id, updateUserDto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Deactivate user (Admin only)' })
  @ApiResponse({ status: 200, description: 'User deactivated successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin access required' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async remove(@Param('id') id: string): Promise<void> {
    return this.usersService.remove(id);
  }
}