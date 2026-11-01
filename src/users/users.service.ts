import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';

import { User, UserDocument, UserRole, UserPreferences, TenantRecord, HostVerificationStatus, PayoutMethod, HostPayoutRecord } from './schemas/user.schema';
import { CreateUserDto, UpdateUserDto, UpdatePreferencesDto, CreateTenantDto, UpdateTenantDto } from './dto';
import { Property, PropertyDocument, PropertyImages, PropertyStatus, ListingType } from 'src/properties/schemas/property.schema';
import { ReviewsService } from 'src/reviews/reviews.service';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Property.name) private propertyModel: Model<PropertyDocument>,
    private configService: ConfigService,
    private reviewsService: ReviewsService,
  ) {
    // Configure Cloudinary
    cloudinary.config({
      cloud_name: this.configService.get<string>('CLOUDINARY_CLOUD_NAME'),
      api_key: this.configService.get<string>('CLOUDINARY_API_KEY'),
      api_secret: this.configService.get<string>('CLOUDINARY_API_SECRET'),
    });
  }

  /**
   * Create a new user
   */
  async create(createUserDto: CreateUserDto): Promise<User> {
    try {
      const createdUser = new this.userModel(createUserDto);
      await createdUser.save();

      this.logger.log(`✅ User created: ${createdUser._id}`);
      return createdUser;
    } catch (error) {
      if (error.code === 11000) {
        const field = Object.keys(error.keyPattern)[0];
        throw new BadRequestException(`${field} already exists`);
      }
      throw error;
    }
  }

  /**
   * Find all users with pagination and filters
   */
  async findAll(
    page = 1,
    limit = 10,
    role?: UserRole,
    isActive?: boolean,
    search?: string,
  ): Promise<{
    users: User[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const skip = (page - 1) * limit;
    const filter: any = {};

    if (role) filter.role = role;
    if (typeof isActive === 'boolean') filter.isActive = isActive;
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phoneNumber: { $regex: search, $options: 'i' } },
      ];
    }

    const [users, total] = await Promise.all([
      this.userModel
        .find(filter)
        .select('-firebaseUid -searchHistory')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.userModel.countDocuments(filter),
    ]);

    return {
      users,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Find user by ID
   */
  async findOne(id: string): Promise<User> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid user ID');
    }

    const user = await this.userModel
      .findById(id)
      .select('-firebaseUid')
      .populate('favorites', 'title images price city address bedrooms bathrooms area type listingType isVerified')
      .exec();

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  /**
   * Public-safe profile — no email, phone, sessions, favorites, history, or tokens.
   * This is what anonymous/unauthenticated visitors and other users can see.
   */
  async findPublicProfile(id: string): Promise<Partial<User>> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid user ID');
    }

    const user = await this.userModel
      .findById(id)
      .select('name profilePicture bio city country role createdAt emailVerified phoneVerified languages')
      .exec();

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  /**
   * Find user by Firebase UID
   */
  async findByFirebaseUid(firebaseUid: string): Promise<User | null> {
    return this.userModel.findOne({ firebaseUid }).exec();
  }

  /**
   * Find user by email
   */
  async findByEmail(email: string): Promise<User | null> {
    return this.userModel.findOne({ email }).exec();
  }

  /**
   * Find user by phone number
   */
  async findByPhoneNumber(phoneNumber: string): Promise<User | null> {
    return this.userModel.findOne({ phoneNumber }).exec();
  }

  /**
   * Update user
   */
  async update(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid user ID');
    }

    const user = await this.userModel
      .findByIdAndUpdate(id, updateUserDto, { new: true })
      .select('-firebaseUid')
      .exec();

    if (!user) {
      throw new NotFoundException('User not found');
    }

    this.logger.log(`✅ User updated: ${id}`);
    return user;
  }

  /**
   * Explicitly set a user's role.
   * Replaces the old single-cycle toggleRole — now that HOST, GUEST, and STUDENT
   * exist as distinct first-class roles, a deterministic target is cleaner.
   * ADMIN role cannot be assigned through this endpoint.
   */
  async setRole(id: string, newRole: UserRole): Promise<User> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid user ID');
    }

    if (newRole === UserRole.ADMIN) {
      throw new BadRequestException('Cannot assign ADMIN role via this endpoint');
    }

    const allowedRoles: UserRole[] = [
      UserRole.REGISTERED_USER,
      UserRole.AGENT,
      UserRole.LANDLORD,
      UserRole.HOST,
      UserRole.GUEST,
      UserRole.STUDENT,
    ];
    if (!allowedRoles.includes(newRole)) {
      throw new BadRequestException(`Invalid role: ${newRole}`);
    }

    const user = await this.userModel.findById(id).exec();
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.role === UserRole.ADMIN) {
      throw new BadRequestException('Cannot change the role of an ADMIN user via this endpoint');
    }

    // When assigning HOST, ensure a default hostProfile sub-document exists
    const extraUpdate: any = {};
    if (newRole === UserRole.HOST && !user.hostProfile) {
      extraUpdate.hostProfile = {
        verificationStatus: HostVerificationStatus.UNVERIFIED,
        isSuperhost: false,
        instantBookEnabled: false,
        minNightsDefault: 1,
        maxNightsDefault: 0,
        advanceNoticeHours: 24,
        bookingWindowMonths: 12,
        totalEarnings: 0,
        currentMonthEarnings: 0,
        completedStays: 0,
        commissionRate: 0.12,
        payoutAccounts: [],
        payoutHistory: [],
        petsAllowedDefault: false,
        smokingAllowedDefault: false,
        eventsAllowedDefault: false,
        checkInTimeDefault: '15:00',
        checkOutTimeDefault: '11:00',
        coHostIds: [],
        hostLanguages: [],
      };
    }

    const updatedUser = await this.userModel
      .findByIdAndUpdate(id, { $set: { role: newRole, ...extraUpdate } }, { new: true })
      .select('-firebaseUid')
      .exec();

    this.logger.log(`✅ User role set for ${id}: ${user.role} -> ${newRole}`);
    return updatedUser!;
  }

  /**
   * Update user preferences
   */
  async updatePreferences(id: string, preferences: UpdatePreferencesDto): Promise<User> {
    const user = await this.userModel
      .findByIdAndUpdate(
        id,
        { $set: { preferences } },
        { new: true }
      )
      .select('-firebaseUid')
      .exec();

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  /**
   * Upload profile picture
   */
  async uploadProfilePicture(userId: string, file: { buffer: Buffer }): Promise<User> {
    try {
      // Upload image buffer to Cloudinary
      const result = await cloudinary.uploader.upload_stream(
        {
          folder: 'horohouse/profiles',
          transformation: [
            { width: 300, height: 300, crop: 'fill', gravity: 'face' },
            { quality: 'auto', fetch_format: 'auto' },
          ],
        },
        async (error, result) => {
          if (error) {
            this.logger.error('Cloudinary upload error:', error);
            throw new BadRequestException('Failed to upload profile picture');
          }
          return result;
        },
      );

      // Because upload_stream is callback-based, we wrap it in a Promise:
      const uploadResult = await new Promise<any>((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder: 'horohouse/profiles',
            transformation: [
              { width: 300, height: 300, crop: 'fill', gravity: 'face' },
              { quality: 'auto', fetch_format: 'auto' },
            ],
          },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          },
        );

        // Push the buffer to the uploadStream
        uploadStream.end(file.buffer);
      });

      // Update user profile picture URL
      const user = await this.userModel
        .findByIdAndUpdate(userId, { profilePicture: uploadResult.secure_url }, { new: true })
        .select('-firebaseUid')
        .exec();

      if (!user) {
        throw new NotFoundException('User not found');
      }

      this.logger.log(`✅ Profile picture updated for user: ${userId}`);
      return user;
    } catch (error) {
      this.logger.error('Failed to upload profile picture:', error.message || error);
      throw new BadRequestException('Failed to upload profile picture');
    }
  }

  async removeProfilePicture(userId: string): Promise<User> {
    const user = await this.userModel
      .findByIdAndUpdate(userId, { $unset: { profilePicture: '' } }, { new: true })
      .select('-firebaseUid')
      .exec();
    if (!user) throw new NotFoundException('User not found');
    this.logger.log(`✅ Profile picture removed for user: ${userId}`);
    return user;
  }

  /**
   * Add property to favorites
   */
  async addToFavorites(userId: string, propertyId: string): Promise<User> {
    if (!Types.ObjectId.isValid(propertyId)) {
      throw new BadRequestException('Invalid property ID');
    }

    const user = await this.userModel
      .findByIdAndUpdate(
        userId,
        { $addToSet: { favorites: new Types.ObjectId(propertyId) } },
        { new: true }
      )
      .select('-firebaseUid')
      .populate('favorites', 'title images price city address bedrooms bathrooms area type listingType isVerified')
      .exec();

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  /**
   * Remove property from favorites
   */
  async removeFromFavorites(userId: string, propertyId: string): Promise<User> {
    const user = await this.userModel
      .findByIdAndUpdate(
        userId,
        { $pull: { favorites: new Types.ObjectId(propertyId) } },
        { new: true }
      )
      .select('-firebaseUid')
      .populate('favorites', 'title images price city address bedrooms bathrooms area type listingType isVerified')
      .exec();

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  /**
   * Add to recently viewed properties
   */
  async addToRecentlyViewed(userId: string, propertyId: string): Promise<void> {
    if (!Types.ObjectId.isValid(propertyId)) {
      throw new BadRequestException('Invalid property ID');
    }

    await this.userModel.updateOne(
      { _id: userId },
      {
        $pull: { recentlyViewed: { propertyId: new Types.ObjectId(propertyId) } },
      }
    );

    await this.userModel.updateOne(
      { _id: userId },
      {
        $push: {
          recentlyViewed: {
            $each: [{ propertyId: new Types.ObjectId(propertyId), viewedAt: new Date() }],
            $position: 0,
            $slice: 50, // Keep only last 50 viewed properties
          },
        },
      }
    );
  }

  /**
   * Get recently viewed properties
   */
  async getRecentlyViewed(userId: string, limit = 10): Promise<any[]> {
    const user = await this.userModel
      .findById(userId)
      .select('recentlyViewed')
      .populate({
        path: 'recentlyViewed.propertyId',
        select: 'title images price currency address city neighborhood country type propertyType listingType amenities shortTermAmenities averageRating reviewCount isFeatured isVerified availability approvalStatus isActive pricingUnit ownerId agentId createdAt',
        populate: [
          { path: 'ownerId', select: 'name profilePicture' },
          { path: 'agentId', select: 'name profilePicture agency' },
        ],
        options: { limit },
      })
      .exec();

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user.recentlyViewed
      .slice(0, limit)
      .filter((item: any) => item.propertyId && (item.propertyId as any).title) // Filter out deleted / sparse stubs
      .map((item: any) => ({
        ...(item.propertyId as any).toObject?.() ?? item.propertyId,
        viewedAt: item.viewedAt,
      }));
  }

  /**
 * Get viewed properties with pagination and full details
 */
  async getViewedPropertiesWithPagination(
    userId: string,
    options: {
      page?: number;
      limit?: number;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
    } = {},
  ): Promise<{
    properties: any[];
    total: number;
    page: number;
    totalPages: number;
    lastViewed?: Date;
  }> {
    try {
      const {
        page = 1,
        limit = 20,
        sortBy = 'viewedAt',
        sortOrder = 'desc',
      } = options;

      const skip = (page - 1) * limit;

      const user = await this.userModel
        .findById(userId)
        .select('recentlyViewed')
        .populate({
          path: 'recentlyViewed.propertyId',
          match: { isActive: true },
          populate: [
            { path: 'ownerId', select: 'name email phoneNumber profilePicture' },
            { path: 'agentId', select: 'name email phoneNumber profilePicture agency' }
          ],
        })
        .exec();

      if (!user) {
        throw new NotFoundException('User not found');
      }

      const validViewedProperties = user.recentlyViewed.filter(
        (item: any) => item.propertyId !== null
      );

      const sortedProperties = [...validViewedProperties].sort((a: any, b: any) => {
        if (sortBy === 'viewedAt') {
          return sortOrder === 'asc'
            ? new Date(a.viewedAt).getTime() - new Date(b.viewedAt).getTime()
            : new Date(b.viewedAt).getTime() - new Date(a.viewedAt).getTime();
        }
        return 0;
      });

      const paginatedProperties = sortedProperties.slice(skip, skip + limit);

      const properties = paginatedProperties.map((item: any) => ({
        ...item.propertyId.toObject(),
        viewedAt: item.viewedAt,
      }));

      const total = validViewedProperties.length;
      const lastViewed = validViewedProperties.length > 0
        ? validViewedProperties[0].viewedAt
        : undefined;

      this.logger.log(`Retrieved ${properties.length} viewed properties for user ${userId}`);

      return {
        properties,
        total,
        page,
        totalPages: Math.ceil(total / limit),
        lastViewed,
      };
    } catch (error) {
      this.logger.error(`Error getting viewed properties for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Clear user's viewing history
   */
  async clearViewingHistory(userId: string): Promise<{ message: string }> {
    try {
      await this.userModel.findByIdAndUpdate(userId, {
        recentlyViewed: [],
      });

      this.logger.log(`Cleared viewing history for user ${userId}`);

      return { message: 'Viewing history cleared successfully' };
    } catch (error) {
      this.logger.error(`Error clearing viewing history for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Remove specific property from viewing history
   */
  async removeFromViewingHistory(
    userId: string,
    propertyId: string,
  ): Promise<{ message: string }> {
    try {
      await this.userModel.findByIdAndUpdate(userId, {
        $pull: { recentlyViewed: { propertyId: new Types.ObjectId(propertyId) } },
      });

      this.logger.log(`Removed property ${propertyId} from viewing history for user ${userId}`);

      return { message: 'Property removed from viewing history' };
    } catch (error) {
      this.logger.error(`Error removing property from viewing history:`, error);
      throw error;
    }
  }

  /**
   * Add search to history
   */
  async addSearchToHistory(userId: string, searchData: any): Promise<void> {
    await this.userModel.updateOne(
      { _id: userId },
      {
        $push: {
          searchHistory: {
            $each: [searchData],
            $position: 0,
            $slice: 100, // Keep only last 100 searches
          },
        },
      }
    );
  }

  /**
   * Get search history
   */
  async getSearchHistory(userId: string, limit = 20): Promise<any[]> {
    const user = await this.userModel
      .findById(userId)
      .select('searchHistory')
      .exec();

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user.searchHistory.slice(0, limit);
  }

  /**
   * Delete user (soft delete)
   */
  async remove(id: string): Promise<void> {
    const result = await this.userModel.updateOne(
      { _id: id },
      { isActive: false }
    );

    if (result.matchedCount === 0) {
      throw new NotFoundException('User not found');
    }

    this.logger.log(`✅ User deactivated: ${id}`);
  }

  /**
   * Get user statistics — full role breakdown for the admin dashboard.
   */
  async getStats(): Promise<any> {
    const [
      totalUsers,
      activeUsers,
      agentUsers,
      landlordUsers,
      hostUsers,
      studentUsers,
      guestUsers,
      registeredUsers,
      verifiedUsers,
      recentUsers,
    ] = await Promise.all([
      this.userModel.countDocuments(),
      this.userModel.countDocuments({ isActive: true }),
      this.userModel.countDocuments({ role: UserRole.AGENT }),
      this.userModel.countDocuments({ role: UserRole.LANDLORD }),
      this.userModel.countDocuments({ role: UserRole.HOST }),
      this.userModel.countDocuments({ role: UserRole.STUDENT }),
      this.userModel.countDocuments({ role: UserRole.GUEST }),
      this.userModel.countDocuments({ role: UserRole.REGISTERED_USER }),
      this.userModel.countDocuments({
        $or: [{ emailVerified: true }, { phoneVerified: true }],
      }),
      this.userModel.countDocuments({
        createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      }),
    ]);

    // Superhost count — useful KPI for host quality
    const superhostUsers = await this.userModel.countDocuments({
      role: UserRole.HOST,
      'hostProfile.isSuperhost': true,
    });

    // Pending host verifications — action queue for admins
    const pendingHostVerifications = await this.userModel.countDocuments({
      role: UserRole.HOST,
      'hostProfile.verificationStatus': HostVerificationStatus.PENDING,
    });

    return {
      total: totalUsers,
      active: activeUsers,
      verified: verifiedUsers,
      recent: recentUsers,
      byRole: {
        [UserRole.REGISTERED_USER]: registeredUsers,
        [UserRole.AGENT]: agentUsers,
        [UserRole.LANDLORD]: landlordUsers,
        [UserRole.HOST]: hostUsers,
        [UserRole.STUDENT]: studentUsers,
        [UserRole.GUEST]: guestUsers,
      },
      // Legacy flat fields kept for backward-compat
      agents: agentUsers,
      landlords: landlordUsers,
      hosts: hostUsers,
      students: studentUsers,
      guests: guestUsers,
      superhosts: superhostUsers,
      pendingHostVerifications,
    };
  }

  /**
   * Get agents with their stats
   */
  async getAgents(page = 1, limit = 10): Promise<any> {
    const skip = (page - 1) * limit;

    const agents = await this.userModel.aggregate([
      { $match: { role: UserRole.AGENT, isActive: true } },
      {
        $lookup: {
          from: 'properties',
          localField: '_id',
          foreignField: 'agentId',
          as: 'properties',
        },
      },
      {
        $addFields: {
          totalProperties: { $size: '$properties' },
          activeProperties: {
            $size: {
              $filter: {
                input: '$properties',
                cond: { $eq: ['$$this.availability', PropertyStatus.ACTIVE] },
              },
            },
          },
        },
      },
      {
        $project: {
          name: 1,
          profilePicture: 1,
          agency: 1,
          bio: 1,
          city: 1,
          totalProperties: 1,
          activeProperties: 1,
          propertiesListed: 1,
          propertiesSold: 1,
          createdAt: 1,
        },
      },
      { $sort: { totalProperties: -1 } },
      { $skip: skip },
      { $limit: limit },
    ]);

    const total = await this.userModel.countDocuments({
      role: UserRole.AGENT,
      isActive: true
    });

    return {
      agents,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get landlords with their stats
   */
  async getLandlords(page = 1, limit = 10): Promise<any> {
    const skip = (page - 1) * limit;

    const landlords = await this.userModel.aggregate([
      { $match: { role: UserRole.LANDLORD, isActive: true } },
      {
        $lookup: {
          from: 'properties',
          localField: '_id',
          foreignField: 'ownerId',
          as: 'properties',
        },
      },
      {
        $addFields: {
          totalProperties: { $size: '$properties' },
          activeProperties: {
            $size: {
              $filter: {
                input: '$properties',
                cond: { $eq: ['$$this.availability', PropertyStatus.ACTIVE] },
              },
            },
          },
        },
      },
      {
        $project: {
          name: 1,
          profilePicture: 1,
          bio: 1,
          city: 1,
          totalProperties: 1,
          activeProperties: 1,
          createdAt: 1,
        },
      },
      { $sort: { totalProperties: -1 } },
      { $skip: skip },
      { $limit: limit },
    ]);

    const total = await this.userModel.countDocuments({
      role: UserRole.LANDLORD,
      isActive: true
    });

    return {
      landlords,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
 * Get agent by ID with full details
 */
  async getAgentById(id: string): Promise<any> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid agent ID');
    }

    const agent = await this.userModel
      .findOne({ _id: id, role: UserRole.AGENT, isActive: true })
      .select('-password -sessions -searchHistory')
      .exec();

    if (!agent) {
      throw new NotFoundException('Agent not found');
    }

    // Get real property stats from database
    const stats = await this.getAgentPropertyStats(id);

    return {
      id: agent._id.toString(),
      name: agent.name,
      profilePicture: agent.profilePicture,
      agency: agent.agency,
      bio: agent.bio,
      city: agent.city,
      country: agent.country,
      totalProperties: stats.totalProperties,
      activeProperties: stats.activeProperties,
      propertiesSold: stats.propertiesSold,
      propertiesListed: stats.totalProperties,
      yearsOfExperience: this.calculateYearsOfExperience(agent.createdAt),
      specialties: this.getAgentSpecialties(agent, stats),
      languages: agent.languages || ['English', 'French'],
      serviceAreas: this.getAgentServiceAreas(agent, stats.cities),
      createdAt: agent.createdAt,
    };
  }

  /**
   * Get landlord by ID with full details
   */
  async getLandlordById(id: string): Promise<any> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid landlord ID');
    }

    const landlord = await this.userModel
      .findOne({ _id: id, role: UserRole.LANDLORD, isActive: true })
      .select('-password -sessions -searchHistory')
      .exec();

    if (!landlord) {
      throw new NotFoundException('Landlord not found');
    }

    const stats = await this.getAgentPropertyStats(id); // Using the same stat method for properties

    return {
      id: landlord._id.toString(),
      name: landlord.name,
      profilePicture: landlord.profilePicture,
      bio: landlord.bio,
      city: landlord.city,
      country: landlord.country,
      totalProperties: stats.totalProperties,
      activeProperties: stats.activeProperties,
      propertiesSold: stats.propertiesSold,
      createdAt: landlord.createdAt,
    };
  }

  /**
   * Get landlord explicit stats (for dashboard cards)
   * Dynamically computes occupancyRate and totalRentalIncome from real data
   */
  async getLandlordStats(id: string): Promise<any> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid landlord ID');
    }

    const landlord = await this.userModel
      .findOne({ _id: id, role: UserRole.LANDLORD, isActive: true })
      .exec();

    if (!landlord) {
      throw new NotFoundException('Landlord not found');
    }

    const properties = await this.propertyModel.find({ ownerId: new Types.ObjectId(id), isActive: true }).exec();

    const tenants = landlord.tenants || [];
    const activeTenants = tenants.filter(t => t.status === 'active');
    const pendingTenants = tenants.filter(t => t.status === 'pending');

    // Dynamically compute monthly rental income from active tenants
    const totalRentalIncome = activeTenants.reduce((sum, t) => sum + (t.monthlyRent || 0), 0);

    // Dynamically compute occupancy rate
    // Occupied = properties that have at least one active tenant
    const occupiedPropertyIds = new Set(
      activeTenants.map(t => t.propertyId?.toString()),
    );
    const totalProperties = properties.length;
    const occupiedCount = totalProperties > 0
      ? properties.filter(p => occupiedPropertyIds.has((p._id as Types.ObjectId).toString())).length
      : 0;
    const occupancyRate = totalProperties > 0
      ? Math.round((occupiedCount / totalProperties) * 100)
      : 0;

    const vacantProperties = totalProperties - occupiedCount;

    return {
      totalProperties,
      vacantProperties,
      occupancyRate,
      totalRentalIncome,
      activeTenants: activeTenants.length,
      pendingTenants: pendingTenants.length,
    };
  }

  /**
   * Get agent statistics from real data
   */
  async getAgentStats(id: string): Promise<any> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid agent ID');
    }

    const agent = await this.userModel
      .findOne({ _id: id, role: UserRole.AGENT, isActive: true })
      .exec();

    if (!agent) {
      throw new NotFoundException('Agent not found');
    }

    const stats = await this.getAgentPropertyStats(id);

    // Calculate average rating from reviews (when review system is implemented)
    // For now using a calculated rating based on performance
    const reviewStats = await this.getAgentReviewStats(id);

    return {
      rating: reviewStats.averageRating,
      reviewCount: reviewStats.totalReviews,
      propertiesSold: stats.propertiesSold,
      experience: this.calculateYearsOfExperience(agent.createdAt),
      successRate: this.calculateSuccessRate(stats),
      awards: this.calculateAwards(stats),
    };
  }

  /**
   * Get agent properties with real database queries
   */
  async getAgentProperties(
    agentId: string,
    options: {
      status?: string;
      page?: number;
      limit?: number;
    } = {},
  ): Promise<any> {
    if (!Types.ObjectId.isValid(agentId)) {
      throw new BadRequestException('Invalid agent ID');
    }

    const agent = await this.userModel
      .findOne({
        _id: agentId,
        role: { $in: [UserRole.AGENT, UserRole.LANDLORD, UserRole.HOST] },
        isActive: true
      })
      .exec();

    if (!agent) {
      throw new NotFoundException('User is not an active agent, landlord, or host');
    }

    const { status, page = 1, limit = 100 } = options;
    const skip = (page - 1) * limit;

    // Build query to find properties where user is agent or owner
    const query: any = {
      $or: [
        { agentId: new Types.ObjectId(agentId) },
        { ownerId: new Types.ObjectId(agentId) },
      ],
      isActive: true,
    };

    // Map frontend status to backend availability
    if (status) {
      const statusMap: { [key: string]: PropertyStatus } = {
        'For Sale': PropertyStatus.ACTIVE,
        'For Rent': PropertyStatus.ACTIVE,
        'Pending': PropertyStatus.PENDING,
        'Sold': PropertyStatus.SOLD,
      };

      if (status === 'For Sale' || status === 'For Rent') {
        query.availability = PropertyStatus.ACTIVE;
        // No additional filter - will show both
      } else if (statusMap[status]) {
        query.availability = statusMap[status];
      }
    }

    const [properties, total] = await Promise.all([
      this.propertyModel
        .find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('ownerId', 'name email phoneNumber profilePicture')
        .populate('agentId', 'name email phoneNumber profilePicture agency')
        .exec(),
      this.propertyModel.countDocuments(query),
    ]);

    // Map properties to frontend format
    const mappedProperties = properties.map((p) => {
      const prop: any = p.toObject();
      const pid = (p._id as Types.ObjectId).toString();
      return {
        id: pid,
        _id: pid,
        title: prop.title,
        images: prop.images || [], // keep [{url}] like the rest of the API; the card handles both
        price: prop.price,
        originalPrice: prop.originalPrice,
        currency: prop.currency,
        pricingUnit: prop.pricingUnit,
        address: prop.address,
        city: prop.city,
        neighborhood: prop.neighborhood,
        country: prop.country,
        type: prop.type,
        listingType: prop.listingType,
        amenities: prop.amenities,
        bedrooms: prop.amenities?.bedrooms || 0,
        bathrooms: prop.amenities?.bathrooms || 0,
        squareFeet: prop.area || 0,
        averageRating: prop.averageRating,
        reviewCount: prop.reviewCount,
        isVerified: prop.isVerified,
        isFeatured: prop.isFeatured,
        customDiscountNights: prop.customDiscountNights,
        customDiscountPercent: prop.customDiscountPercent,
        weeklyDiscountPercent: prop.weeklyDiscountPercent,
        monthlyDiscountPercent: prop.monthlyDiscountPercent,
        createdAt: prop.createdAt,
        updatedAt: prop.updatedAt,
        status: this.mapAvailabilityToStatus(prop.availability, prop.listingType),
        soldDate: prop.availability === PropertyStatus.SOLD ? p.updatedAt.toISOString() : undefined,
        latitude: prop.location?.coordinates?.[1] || prop.latitude,
        longitude: prop.location?.coordinates?.[0] || prop.longitude,
      };
    });

    this.logger.log(`Retrieved ${mappedProperties.length} properties for agent ${agentId}`);

    return {
      properties: mappedProperties,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get agent reviews - Real implementation
   * NOTE: You'll need to create a Review schema. For now, returning empty array.
   * Uncomment the real implementation once Review model is created.
   */
  /**
 * Get agent reviews - Real implementation
 */
  async getAgentReviews(
    agentId: string,
    options: {
      page?: number;
      limit?: number;
    } = {},
  ): Promise<any> {
    if (!Types.ObjectId.isValid(agentId)) {
      throw new BadRequestException('Invalid agent ID');
    }

    const agent = await this.userModel
      .findOne({ _id: agentId, role: UserRole.AGENT, isActive: true })
      .exec();

    if (!agent) {
      throw new NotFoundException('Agent not found');
    }

    // This will now work with the Review model
    // Import ReviewsService and inject it in the constructor
    const { page = 1, limit = 20 } = options;

    return this.reviewsService.getAgentReviews(agentId, { page, limit });
  }

  /**
   * Get review statistics (real implementation)
   */
  private async getAgentReviewStats(agentId: string): Promise<{
    averageRating: number;
    totalReviews: number;
  }> {
    // Use the ReviewsService instead of placeholder
    const stats = await this.reviewsService.getAgentReviewStats(agentId);

    return {
      averageRating: stats.averageRating,
      totalReviews: stats.totalReviews,
    };
  }
  // ==========================================
  // PRIVATE HELPER METHODS
  // ==========================================

  /**
   * Get agent property statistics from real database
   */
  private async getAgentPropertyStats(agentId: string): Promise<{
    totalProperties: number;
    activeProperties: number;
    propertiesSold: number;
    cities: string[];
  }> {
    const agentObjectId = new Types.ObjectId(agentId);

    const stats = await this.propertyModel.aggregate([
      {
        $match: {
          $or: [
            { agentId: agentObjectId },
            { ownerId: agentObjectId },
          ],
          isActive: true,
        },
      },
      {
        $group: {
          _id: null,
          totalProperties: { $sum: 1 },
          activeProperties: {
            $sum: {
              $cond: [
                { $eq: ['$availability', PropertyStatus.ACTIVE] },
                1,
                0,
              ],
            },
          },
          propertiesSold: {
            $sum: {
              $cond: [
                { $eq: ['$availability', PropertyStatus.SOLD] },
                1,
                0,
              ],
            },
          },
          cities: { $addToSet: '$city' },
        },
      },
    ]);

    if (!stats || stats.length === 0) {
      return {
        totalProperties: 0,
        activeProperties: 0,
        propertiesSold: 0,
        cities: [],
      };
    }

    return {
      totalProperties: stats[0].totalProperties || 0,
      activeProperties: stats[0].activeProperties || 0,
      propertiesSold: stats[0].propertiesSold || 0,
      cities: stats[0].cities || [],
    };
  }

  /**
   * Get review statistics (placeholder until Review model is created)
   */


  /**
   * Calculate years of experience based on account creation
   */
  private calculateYearsOfExperience(createdAt: Date): number {
    const years = Math.floor((Date.now() - createdAt.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
    return Math.max(years, 1); // Minimum 1 year for display purposes
  }

  /**
   * Calculate success rate from property stats
   */
  private calculateSuccessRate(stats: { totalProperties: number; propertiesSold: number }): number {
    if (stats.totalProperties === 0) return 95; // Default for new agents
    const rate = (stats.propertiesSold / stats.totalProperties) * 100;
    return Math.min(Math.round(rate), 100);
  }

  /**
   * Calculate awards based on performance metrics
   */
  private calculateAwards(stats: { propertiesSold: number; totalProperties: number }): number {
    let awards = 0;

    // Awards for properties sold
    if (stats.propertiesSold >= 10) awards += 2;
    if (stats.propertiesSold >= 50) awards += 3;
    if (stats.propertiesSold >= 100) awards += 5;
    if (stats.propertiesSold >= 200) awards += 5;

    // Awards for total listings
    if (stats.totalProperties >= 20) awards += 2;
    if (stats.totalProperties >= 50) awards += 3;

    return awards;
  }

  /**
   * Get agent specialties based on their property portfolio
   */
  private getAgentSpecialties(agent: any, stats: any): string[] {
    const specialties: string[] = [];

    // Use stored specialties if available
    if (agent.specialties && agent.specialties.length > 0) {
      return agent.specialties;
    }

    // Otherwise, generate based on performance
    if (stats.propertiesSold > 100) {
      specialties.push('Luxury Homes');
    }

    if (stats.totalProperties > 50) {
      specialties.push('Investment Properties');
    }

    if (stats.propertiesSold < 20 && stats.activeProperties > 5) {
      specialties.push('First-Time Buyers');
    }

    // Default specialty if none match
    if (specialties.length === 0) {
      specialties.push('Residential Properties');
    }

    return specialties;
  }

  /**
   * Get agent service areas from their property locations
   */
  private getAgentServiceAreas(agent: any, cities: string[]): string[] {
    // Use stored service areas if available
    if (agent.serviceAreas && agent.serviceAreas.length > 0) {
      return agent.serviceAreas;
    }

    // Otherwise, use cities where they have properties
    if (cities && cities.length > 0) {
      return cities.slice(0, 5); // Top 5 cities
    }

    // Fallback to agent's city
    if (agent.city) {
      return [agent.city];
    }

    return ['Downtown']; // Default
  }

  /**
   * Map backend availability status to frontend display status
   */
  private mapAvailabilityToStatus(availability: PropertyStatus, listingType: string): string {
    switch (availability) {
      case PropertyStatus.ACTIVE:
        return listingType === 'rent' ? 'For Rent' : 'For Sale';
      case PropertyStatus.SOLD:
        return 'Sold';
      case PropertyStatus.RENTED:
        return 'Rented';
      case PropertyStatus.PENDING:
        return 'Pending';
      default:
        return 'For Sale';
    }
  }

  /**
   * Capitalize property type for display
   */
  private capitalizePropertyType(type: string): string {
    return type.charAt(0).toUpperCase() + type.slice(1);
  }

  /**
   * Update onboarding preferences for a user.
   * Maps from the onboarding schema field names into the User preferences schema field names.
   */
  async updateOnboardingPreferences(userId: string, preferences: {
    propertyPreferences?: any;
    agentPreferences?: any;
    onboardingCompleted?: boolean;
  }): Promise<User> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user ID');
    }

    const updateData: any = {};

    // ── Map propertyPreferences (onboarding schema) → preferences (User schema) ──
    // Onboarding uses: propertyType[], location[], features[], budget{min,max,currency}
    // User schema uses: propertyTypes[], cities[], amenities[], minPrice, maxPrice, currency
    if (preferences.propertyPreferences) {
      const pp = preferences.propertyPreferences;

      if (pp.propertyType?.length) updateData['preferences.propertyTypes'] = pp.propertyType;
      if (pp.location?.length) updateData['preferences.cities'] = pp.location;
      if (pp.features?.length) updateData['preferences.amenities'] = pp.features;
      if (pp.bedrooms?.length) updateData['preferences.bedrooms'] = pp.bedrooms;
      if (pp.bathrooms?.length) updateData['preferences.bathrooms'] = pp.bathrooms;
      if (pp.budget) {
        if (pp.budget.min !== undefined) updateData['preferences.minPrice'] = pp.budget.min;
        if (pp.budget.max !== undefined) updateData['preferences.maxPrice'] = pp.budget.max;
        if (pp.budget.currency) updateData['preferences.currency'] = pp.budget.currency;
      }
    }

    // ── Store agentPreferences on the new agentPreferences User field ──
    // Also mirror flat fields (licenseNumber, agency) for backward compatibility
    if (preferences.agentPreferences) {
      const ap = preferences.agentPreferences;
      updateData.agentPreferences = ap;
      if (ap.licenseNumber) updateData.licenseNumber = ap.licenseNumber;
      if (ap.agency) updateData.agency = ap.agency;
    }

    if (preferences.onboardingCompleted !== undefined) {
      updateData.onboardingCompleted = preferences.onboardingCompleted;
    }

    const updatedUser = await this.userModel.findByIdAndUpdate(
      userId,
      { $set: updateData },
      { new: true }
    ).exec();

    if (!updatedUser) {
      throw new NotFoundException('User not found');
    }

    this.logger.log(`✅ Onboarding preferences updated for user: ${userId}`);
    return updatedUser;
  }

  // ==========================================
  // TENANT MANAGEMENT (Landlord-specific)
  // ==========================================

  /**
   * Check if a lease overlaps with existing active/pending tenants on the same property
   */
  private hasLeaseOverlap(
    tenants: TenantRecord[],
    propertyId: string,
    leaseStart: Date,
    leaseEnd: Date,
    excludeTenantId?: string,
  ): boolean {
    return tenants.some(t => {
      // Skip the tenant being updated
      if (excludeTenantId && t._id?.toString() === excludeTenantId) return false;
      // Only check active or pending leases
      if (t.status === 'ended') return false;
      // Must be the same property
      if (t.propertyId?.toString() !== propertyId) return false;
      // Overlap: new lease starts before existing ends AND new lease ends after existing starts
      const existingStart = new Date(t.leaseStart);
      const existingEnd = new Date(t.leaseEnd);
      return leaseStart < existingEnd && leaseEnd > existingStart;
    });
  }

  /**
   * Sanitize tenant for API response (strip from full User document)
   */
  private sanitizeTenantResponse(tenant: any) {
    return {
      _id: tenant._id?.toString(),
      tenantName: tenant.tenantName,
      tenantEmail: tenant.tenantEmail,
      tenantPhone: tenant.tenantPhone,
      tenantUserId: tenant.tenantUserId?.toString() || null,
      propertyId: tenant.propertyId?.toString(),
      leaseStart: tenant.leaseStart,
      leaseEnd: tenant.leaseEnd,
      monthlyRent: tenant.monthlyRent,
      depositAmount: tenant.depositAmount,
      status: tenant.status,
      notes: tenant.notes,
    };
  }

  /**
   * Add a tenant to a landlord's record
   * Validates property ownership and checks for lease overlaps
   */
  async addTenant(landlordId: string, tenantData: CreateTenantDto): Promise<any> {
    if (!Types.ObjectId.isValid(landlordId)) {
      throw new BadRequestException('Invalid landlord ID');
    }

    // Validate the property exists and belongs to this landlord
    const propertyObjectId = new Types.ObjectId(tenantData.propertyId);
    const property = await this.propertyModel.findOne({
      _id: propertyObjectId,
      $or: [
        { ownerId: new Types.ObjectId(landlordId) },
        { agentId: new Types.ObjectId(landlordId) },
      ],
      isActive: true,
    }).exec();

    if (!property) {
      throw new BadRequestException(
        'Property not found or does not belong to you. Please verify the property ID.',
      );
    }

    // Validate lease dates
    const leaseStart = new Date(tenantData.leaseStart);
    const leaseEnd = new Date(tenantData.leaseEnd);

    if (isNaN(leaseStart.getTime()) || isNaN(leaseEnd.getTime())) {
      throw new BadRequestException('Invalid lease dates. Please provide valid dates.');
    }

    if (leaseEnd <= leaseStart) {
      throw new BadRequestException('Lease end date must be after the start date.');
    }

    // Check for lease overlaps on the same property
    const landlord = await this.userModel.findById(landlordId).exec();
    if (!landlord) {
      throw new NotFoundException('Landlord not found');
    }

    if (this.hasLeaseOverlap(
      landlord.tenants || [],
      tenantData.propertyId,
      leaseStart,
      leaseEnd,
    )) {
      throw new BadRequestException(
        'There is an overlapping active or pending lease on this property for the given dates.',
      );
    }

    // Auto-link: if tenantEmail is provided, find matching platform user
    let tenantUserId: Types.ObjectId | undefined;
    if (tenantData.tenantEmail) {
      const existingUser = await this.userModel
        .findOne({ email: tenantData.tenantEmail.toLowerCase() })
        .select('_id')
        .exec();
      if (existingUser) {
        tenantUserId = existingUser._id as Types.ObjectId;
        this.logger.log(`🔗 Auto-linked tenant to user ${tenantUserId}`);
      }
    }

    const tenant = {
      _id: new Types.ObjectId(),
      tenantName: tenantData.tenantName,
      tenantEmail: tenantData.tenantEmail,
      tenantPhone: tenantData.tenantPhone,
      tenantUserId,
      propertyId: propertyObjectId,
      leaseStart,
      leaseEnd,
      monthlyRent: tenantData.monthlyRent,
      depositAmount: tenantData.depositAmount,
      status: tenantData.status || 'active',
      notes: tenantData.notes,
    };

    const user = await this.userModel
      .findByIdAndUpdate(
        landlordId,
        { $push: { tenants: tenant } },
        { new: true },
      )
      .select('tenants')
      .exec();

    if (!user) {
      throw new NotFoundException('User not found');
    }

    this.logger.log(`✅ Tenant added for landlord ${landlordId}`);

    // Return only the newly created tenant
    const createdTenant = user.tenants?.find(
      t => t._id?.toString() === tenant._id.toString(),
    );

    return {
      message: 'Tenant added successfully',
      tenant: createdTenant ? this.sanitizeTenantResponse(createdTenant) : tenant,
    };
  }

  /**
   * Update a tenant in a landlord's record
   * Uses !== undefined checks so optional fields can be cleared
   */
  async updateTenant(landlordId: string, tenantId: string, tenantData: UpdateTenantDto): Promise<any> {
    if (!Types.ObjectId.isValid(landlordId) || !Types.ObjectId.isValid(tenantId)) {
      throw new BadRequestException('Invalid ID');
    }

    // Validate property ownership if propertyId is being changed
    if (tenantData.propertyId !== undefined) {
      const property = await this.propertyModel.findOne({
        _id: new Types.ObjectId(tenantData.propertyId),
        $or: [
          { ownerId: new Types.ObjectId(landlordId) },
          { agentId: new Types.ObjectId(landlordId) },
        ],
        isActive: true,
      }).exec();

      if (!property) {
        throw new BadRequestException(
          'Property not found or does not belong to you.',
        );
      }
    }

    // If lease dates are changing, validate and check for overlaps
    if (tenantData.leaseStart !== undefined || tenantData.leaseEnd !== undefined) {
      const landlord = await this.userModel.findById(landlordId).exec();
      if (!landlord) throw new NotFoundException('Landlord not found');

      const existingTenant = landlord.tenants?.find(
        t => t._id?.toString() === tenantId,
      );
      if (!existingTenant) throw new NotFoundException('Tenant not found');

      const newStart = tenantData.leaseStart
        ? new Date(tenantData.leaseStart)
        : new Date(existingTenant.leaseStart);
      const newEnd = tenantData.leaseEnd
        ? new Date(tenantData.leaseEnd)
        : new Date(existingTenant.leaseEnd);

      if (newEnd <= newStart) {
        throw new BadRequestException('Lease end date must be after the start date.');
      }

      const targetPropertyId = tenantData.propertyId || existingTenant.propertyId?.toString();

      if (this.hasLeaseOverlap(
        landlord.tenants || [],
        targetPropertyId,
        newStart,
        newEnd,
        tenantId,
      )) {
        throw new BadRequestException(
          'There is an overlapping active or pending lease on this property for the given dates.',
        );
      }
    }

    // Build update fields — use !== undefined so empty strings and 0 can be set
    const updateFields: any = {};
    if (tenantData.tenantName !== undefined) updateFields['tenants.$.tenantName'] = tenantData.tenantName;
    if (tenantData.tenantEmail !== undefined) updateFields['tenants.$.tenantEmail'] = tenantData.tenantEmail;
    if (tenantData.tenantPhone !== undefined) updateFields['tenants.$.tenantPhone'] = tenantData.tenantPhone;
    if (tenantData.propertyId !== undefined) updateFields['tenants.$.propertyId'] = new Types.ObjectId(tenantData.propertyId);
    if (tenantData.leaseStart !== undefined) updateFields['tenants.$.leaseStart'] = new Date(tenantData.leaseStart);
    if (tenantData.leaseEnd !== undefined) updateFields['tenants.$.leaseEnd'] = new Date(tenantData.leaseEnd);
    if (tenantData.monthlyRent !== undefined) updateFields['tenants.$.monthlyRent'] = tenantData.monthlyRent;
    if (tenantData.depositAmount !== undefined) updateFields['tenants.$.depositAmount'] = tenantData.depositAmount;
    if (tenantData.status !== undefined) updateFields['tenants.$.status'] = tenantData.status;
    if (tenantData.notes !== undefined) updateFields['tenants.$.notes'] = tenantData.notes;

    if (Object.keys(updateFields).length === 0) {
      throw new BadRequestException('No fields to update');
    }

    const user = await this.userModel
      .findOneAndUpdate(
        { _id: landlordId, 'tenants._id': new Types.ObjectId(tenantId) },
        { $set: updateFields },
        { new: true },
      )
      .select('tenants')
      .exec();

    if (!user) {
      throw new NotFoundException('User or tenant not found');
    }

    const updatedTenant = user.tenants?.find(
      t => t._id?.toString() === tenantId,
    );

    this.logger.log(`✅ Tenant ${tenantId} updated for landlord ${landlordId}`);

    return {
      message: 'Tenant updated successfully',
      tenant: updatedTenant ? this.sanitizeTenantResponse(updatedTenant) : null,
    };
  }

  /**
   * Remove a tenant from a landlord's record
   */
  async removeTenant(landlordId: string, tenantId: string): Promise<any> {
    if (!Types.ObjectId.isValid(landlordId) || !Types.ObjectId.isValid(tenantId)) {
      throw new BadRequestException('Invalid ID');
    }

    const user = await this.userModel
      .findByIdAndUpdate(
        landlordId,
        { $pull: { tenants: { _id: new Types.ObjectId(tenantId) } } },
        { new: true },
      )
      .select('tenants')
      .exec();

    if (!user) {
      throw new NotFoundException('User not found');
    }

    this.logger.log(`✅ Tenant ${tenantId} removed for landlord ${landlordId}`);

    return {
      message: 'Tenant removed successfully',
      remainingTenants: (user.tenants || []).length,
    };
  }

  /**
   * Get lease info for a regular user who is linked as a tenant
   * Searches all landlords for tenant records with tenantUserId matching this user
   */
  async getMyLeaseInfo(userId: string): Promise<any> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user ID');
    }

    const userObjectId = new Types.ObjectId(userId);

    // Find all landlords who have this user as a tenant
    const landlords = await this.userModel
      .find({
        'tenants.tenantUserId': userObjectId,
      })
      .select('name email phoneNumber profilePicture tenants')
      .exec();

    if (!landlords || landlords.length === 0) {
      return { leases: [] };
    }

    // Collect all matching lease records across landlords
    const leases: any[] = [];

    for (const landlord of landlords) {
      const matchingTenants = (landlord.tenants || []).filter(
        t => t.tenantUserId?.toString() === userId,
      );

      for (const tenant of matchingTenants) {
        // Fetch property details for this lease
        let propertyInfo: any = null;
        if (tenant.propertyId) {
          const property = await this.propertyModel
            .findById(tenant.propertyId)
            .select('title address city country images type')
            .exec();

          if (property) {
            const prop = property.toObject();
            propertyInfo = {
              id: (property._id as Types.ObjectId).toString(),
              title: prop.title,
              address: prop.address,
              city: prop.city,
              country: prop.country,
              image: prop.images?.[0]?.url || null,
              type: prop.type,
            };
          }
        }

        leases.push({
          _id: tenant._id?.toString(),
          leaseStart: tenant.leaseStart,
          leaseEnd: tenant.leaseEnd,
          monthlyRent: tenant.monthlyRent,
          depositAmount: tenant.depositAmount,
          status: tenant.status,
          notes: tenant.notes,
          property: propertyInfo,
          landlord: {
            id: (landlord._id as Types.ObjectId).toString(),
            name: landlord.name,
            email: landlord.email,
            phoneNumber: landlord.phoneNumber,
            profilePicture: landlord.profilePicture,
          },
        });
      }
    }

    return { leases };
  }

  // ==========================================
  // HOST MANAGEMENT
  // ==========================================

  /**
   * Get all active hosts — aggregated with short-term listing stats.
   * Mirrors getAgents / getLandlords.
   */
  async getHosts(page = 1, limit = 10): Promise<any> {
    const skip = (page - 1) * limit;

    const hosts = await this.userModel.aggregate([
      { $match: { role: UserRole.HOST, isActive: true } },
      {
        $lookup: {
          from: 'properties',
          let: { hostId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ['$ownerId', '$$hostId'] },
                isActive: true,
                listingType: 'short-term',
              },
            },
          ],
          as: 'shortTermProperties',
        },
      },
      {
        $addFields: {
          totalListings: { $size: '$shortTermProperties' },
          activeListings: {
            $size: {
              $filter: {
                input: '$shortTermProperties',
                cond: { $eq: ['$$this.status', 'available'] },
              },
            },
          },
        },
      },
      {
        $project: {
          name: 1,
          profilePicture: 1,
          city: 1,
          country: 1,
          totalListings: 1,
          activeListings: 1,
          'hostProfile.isSuperhost': 1,
          'hostProfile.verificationStatus': 1,
          'hostProfile.completedStays': 1,
          'hostProfile.responseRate': 1,
          averageRating: 1,
          createdAt: 1,
        },
      },
      { $sort: { totalListings: -1 } },
      { $skip: skip },
      { $limit: limit },
    ]);

    const total = await this.userModel.countDocuments({
      role: UserRole.HOST,
      isActive: true,
    });

    return {
      hosts,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get a single host's full profile.
   * Strips sensitive hostProfile fields (governmentIdPublicId) before returning.
   */
  async getHostById(id: string): Promise<any> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid host ID');
    }

    const host = await this.userModel
      .findOne({ _id: id, role: UserRole.HOST, isActive: true })
      .select('-firebaseUid -password -sessions -searchHistory')
      .exec();

    if (!host) {
      throw new NotFoundException('Host not found');
    }

    const [listingStats, reviewStats] = await Promise.all([
      this.getHostListingStats(id),
      this.getAgentReviewStats(id).catch(() => ({ averageRating: 0, totalReviews: 0 })),
    ]);

    // Build sanitised hostProfile — drop server-only public_id
    const hp = host.hostProfile ? { ...host.hostProfile } as any : null;
    if (hp?.governmentIdPublicId) delete hp.governmentIdPublicId;

    // Strip payout account identifiers for non-admin callers;
    // the controller can decide how much to expose.
    const payoutAccountsSummary = (hp?.payoutAccounts ?? []).map((acc: any) => ({
      method: acc.method,
      providerName: acc.providerName,
      isDefault: acc.isDefault,
      currency: acc.currency,
      // accountIdentifier intentionally omitted — sensitive
    }));

    return {
      id: host._id.toString(),
      name: host.name,
      profilePicture: host.profilePicture,
      bio: host.bio,
      city: host.city,
      country: host.country,
      languages: host.languages,
      averageRating: reviewStats.averageRating,
      reviewCount: reviewStats.totalReviews,
      // Listing stats
      totalListings: listingStats.totalListings,
      activeListings: listingStats.activeListings,
      // Host profile (sensitive fields stripped)
      hostProfile: hp
        ? {
          ...hp,
          payoutAccounts: payoutAccountsSummary,
          totalEarnings: undefined,
          currentMonthEarnings: undefined,
        }
        : null,
      createdAt: host.createdAt,
    };
  }

  /**
   * Compute live dashboard stats for a host.
   * Mirrors getLandlordStats — called per-host for the host dashboard.
   */
  async getHostStats(id: string): Promise<any> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid host ID');
    }

    const host = await this.userModel
      .findOne({ _id: id, role: UserRole.HOST, isActive: true })
      .exec();

    if (!host) {
      throw new NotFoundException('Host not found');
    }

    const [listingStats, reviewStats] = await Promise.all([
      this.getHostListingStats(id),
      this.getAgentReviewStats(id).catch(() => ({ averageRating: 0, totalReviews: 0 })),
    ]);

    const hp = host.hostProfile;

    // Occupancy rate: (active short-term properties with at least one stay) / total
    // For now derived from the stored completedStays vs total listings ratio as a proxy.
    const occupancyRate =
      listingStats.totalListings > 0
        ? Math.min(
          Math.round(((hp?.completedStays ?? 0) / (listingStats.totalListings * 30)) * 100),
          100,
        )
        : 0;

    return {
      totalListings: listingStats.totalListings,
      activeListings: listingStats.activeListings,
      completedStays: hp?.completedStays ?? 0,
      currentMonthEarnings: hp?.currentMonthEarnings ?? 0,
      totalEarnings: hp?.totalEarnings ?? 0,
      averageRating: reviewStats.averageRating,
      reviewCount: reviewStats.totalReviews,
      isSuperhost: hp?.isSuperhost ?? false,
      verificationStatus: hp?.verificationStatus ?? HostVerificationStatus.UNVERIFIED,
      responseRate: hp?.responseRate ?? null,
      responseTimeMinutes: hp?.responseTimeMinutes ?? null,
      occupancyRate,
    };
  }

  /**
   * PATCH handler for hostProfile fields.
   *
   * Handles:
   *  - Government ID upload (buffer) → Cloudinary → sets status to PENDING
   *  - instantBookEnabled toggle
   *  - House-rule defaults
   *  - Payout account add / remove
   *  - Co-host add / remove
   *  - Bio / language / operatingCity updates
   */
  async updateHostProfile(
    id: string,
    updates: {
      // Verification
      governmentIdBuffer?: Buffer;
      // Preferences
      instantBookEnabled?: boolean;
      minNightsDefault?: number;
      maxNightsDefault?: number;
      advanceNoticeHours?: number;
      bookingWindowMonths?: number;
      // House rules
      petsAllowedDefault?: boolean;
      smokingAllowedDefault?: boolean;
      eventsAllowedDefault?: boolean;
      checkInTimeDefault?: string;
      checkOutTimeDefault?: string;
      // Payout accounts
      addPayoutAccount?: {
        method: PayoutMethod;
        accountIdentifier: string;
        providerName?: string;
        isDefault?: boolean;
        currency?: string;
      };
      removePayoutAccountIdentifier?: string;
      // Co-hosts
      addCoHostId?: string;
      removeCoHostId?: string;
      // Bio
      hostBio?: string;
      hostLanguages?: string[];
      operatingCity?: string;
    },
  ): Promise<any> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid host ID');
    }

    const host = await this.userModel.findOne({ _id: id, role: UserRole.HOST, isActive: true }).exec();
    if (!host) {
      throw new NotFoundException('Host not found');
    }

    const setFields: any = {};
    const arrayPushOps: any = {};
    const arrayPullOps: any = {};

    // ── Government ID upload ───────────────────────────────────────────────
    if (updates.governmentIdBuffer) {
      const uploadResult = await new Promise<any>((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: 'horohouse/host-ids', resource_type: 'image' },
          (err, result) => {
            if (err) reject(err);
            else resolve(result);
          },
        );
        stream.end(updates.governmentIdBuffer);
      });

      setFields['hostProfile.governmentIdUrl'] = uploadResult.secure_url;
      setFields['hostProfile.governmentIdPublicId'] = uploadResult.public_id;
      setFields['hostProfile.verificationStatus'] = HostVerificationStatus.PENDING;
      setFields['hostProfile.verificationSubmittedAt'] = new Date();
      this.logger.log(`📄 Government ID uploaded for host ${id}`);
    }

    // ── Scalar preference fields ───────────────────────────────────────────
    const scalarMap: Record<string, string> = {
      instantBookEnabled: 'hostProfile.instantBookEnabled',
      minNightsDefault: 'hostProfile.minNightsDefault',
      maxNightsDefault: 'hostProfile.maxNightsDefault',
      advanceNoticeHours: 'hostProfile.advanceNoticeHours',
      bookingWindowMonths: 'hostProfile.bookingWindowMonths',
      petsAllowedDefault: 'hostProfile.petsAllowedDefault',
      smokingAllowedDefault: 'hostProfile.smokingAllowedDefault',
      eventsAllowedDefault: 'hostProfile.eventsAllowedDefault',
      checkInTimeDefault: 'hostProfile.checkInTimeDefault',
      checkOutTimeDefault: 'hostProfile.checkOutTimeDefault',
      hostBio: 'hostProfile.hostBio',
      hostLanguages: 'hostProfile.hostLanguages',
      operatingCity: 'hostProfile.operatingCity',
    };

    for (const [key, dbPath] of Object.entries(scalarMap)) {
      if ((updates as any)[key] !== undefined) {
        setFields[dbPath] = (updates as any)[key];
      }
    }

    // ── Payout account add ─────────────────────────────────────────────────
    if (updates.addPayoutAccount) {
      const acc = updates.addPayoutAccount;
      // If new account is default, clear existing defaults first
      if (acc.isDefault) {
        await this.userModel.updateOne(
          { _id: id },
          { $set: { 'hostProfile.payoutAccounts.$[].isDefault': false } },
        );
      }
      arrayPushOps['hostProfile.payoutAccounts'] = {
        method: acc.method,
        accountIdentifier: acc.accountIdentifier,
        providerName: acc.providerName,
        isDefault: acc.isDefault ?? false,
        currency: acc.currency ?? 'XAF',
      };
    }

    // ── Payout account remove ──────────────────────────────────────────────
    if (updates.removePayoutAccountIdentifier) {
      arrayPullOps['hostProfile.payoutAccounts'] = {
        accountIdentifier: updates.removePayoutAccountIdentifier,
      };
    }

    // ── Co-host add ────────────────────────────────────────────────────────
    if (updates.addCoHostId) {
      if (!Types.ObjectId.isValid(updates.addCoHostId)) {
        throw new BadRequestException('Invalid co-host user ID');
      }
      arrayPushOps['hostProfile.coHostIds'] = new Types.ObjectId(updates.addCoHostId);
    }

    // ── Co-host remove ─────────────────────────────────────────────────────
    if (updates.removeCoHostId) {
      if (!Types.ObjectId.isValid(updates.removeCoHostId)) {
        throw new BadRequestException('Invalid co-host user ID');
      }
      arrayPullOps['hostProfile.coHostIds'] = new Types.ObjectId(updates.removeCoHostId);
    }

    // Build update command
    const updateCmd: any = {};
    if (Object.keys(setFields).length > 0) updateCmd.$set = setFields;
    if (Object.keys(arrayPushOps).length > 0) {
      updateCmd.$push = {};
      for (const [k, v] of Object.entries(arrayPushOps)) {
        updateCmd.$push[k] = { $each: [v] };
      }
    }
    if (Object.keys(arrayPullOps).length > 0) updateCmd.$pull = arrayPullOps;

    if (Object.keys(updateCmd).length === 0) {
      throw new BadRequestException('No host profile fields to update');
    }

    const updated = await this.userModel
      .findOneAndUpdate({ _id: id }, updateCmd, { new: true })
      .select('-firebaseUid -password -sessions -searchHistory')
      .exec();

    this.logger.log(`✅ Host profile updated for ${id}`);
    return updated;
  }

  /**
   * Admin action: approve or reject a host's identity verification.
   */
  async verifyHost(
    id: string,
    decision: 'approve' | 'reject',
    rejectionReason?: string,
  ): Promise<any> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid host ID');
    }

    const host = await this.userModel.findOne({ _id: id, role: UserRole.HOST }).exec();
    if (!host) {
      throw new NotFoundException('Host not found');
    }

    if (!host.hostProfile) {
      throw new BadRequestException('Host has no hostProfile sub-document');
    }

    if (host.hostProfile.verificationStatus !== HostVerificationStatus.PENDING) {
      throw new BadRequestException(
        `Cannot ${decision} a verification that is not in PENDING state (current: ${host.hostProfile.verificationStatus})`,
      );
    }

    const newStatus =
      decision === 'approve' ? HostVerificationStatus.VERIFIED : HostVerificationStatus.REJECTED;

    const setFields: any = {
      'hostProfile.verificationStatus': newStatus,
      'hostProfile.verificationReviewedAt': new Date(),
    };

    if (decision === 'reject' && rejectionReason) {
      setFields['hostProfile.verificationRejectionReason'] = rejectionReason;
    }

    const updated = await this.userModel
      .findByIdAndUpdate(id, { $set: setFields }, { new: true })
      .select('-firebaseUid -password -sessions -searchHistory')
      .exec();

    this.logger.log(`✅ Host ${id} verification ${decision}d by admin`);
    return {
      message: `Host verification ${decision}d`,
      verificationStatus: newStatus,
      verificationReviewedAt: setFields['hostProfile.verificationReviewedAt'],
      user: updated,
    };
  }

  /**
   * Evaluate the 4 Superhost thresholds and update isSuperhost accordingly.
   * Designed to be called by a scheduled job (Cron) or triggered after a booking completes.
   *
   * Thresholds (Airbnb-aligned):
   *  1. responseRate  ≥ 90 %
   *  2. averageRating ≥ 4.8
   *  3. completedStays ≥ 10 in the last 12 months  (approximated from stored completedStays)
   *  4. cancellation rate  < 1 %  (not yet tracked; evaluated as true by default until tracked)
   */
  async recalculateSuperhostStatus(id: string): Promise<{
    isSuperhost: boolean;
    reason?: string;
    superhostSince?: Date;
  }> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid host ID');
    }

    const host = await this.userModel.findOne({ _id: id, role: UserRole.HOST }).exec();
    if (!host) {
      throw new NotFoundException('Host not found');
    }

    const hp = host.hostProfile;
    if (!hp) {
      throw new BadRequestException('Host has no hostProfile sub-document');
    }

    const reviewStats = await this.getAgentReviewStats(id).catch(() => ({
      averageRating: 0,
      totalReviews: 0,
    }));

    const meetsResponseRate = (hp.responseRate ?? 0) >= 90;
    const meetsRating = reviewStats.averageRating >= 4.8;
    const meetsStays = (hp.completedStays ?? 0) >= 10;
    // Cancellation tracking is a future feature; treat as passing for now.
    const meetsCancellation = true;

    const qualifies = meetsResponseRate && meetsRating && meetsStays && meetsCancellation;

    const wasAlreadySuperhost = hp.isSuperhost;
    const setFields: any = { 'hostProfile.isSuperhost': qualifies };

    if (qualifies && !wasAlreadySuperhost) {
      setFields['hostProfile.superhostSince'] = new Date();
    } else if (!qualifies && wasAlreadySuperhost) {
      // Lost Superhost status — clear the date
      setFields['hostProfile.superhostSince'] = null;
    }

    await this.userModel.findByIdAndUpdate(id, { $set: setFields }).exec();

    const reason = qualifies
      ? undefined
      : [
        !meetsResponseRate && `responseRate ${hp.responseRate ?? 0}% < 90%`,
        !meetsRating && `rating ${reviewStats.averageRating} < 4.8`,
        !meetsStays && `completedStays ${hp.completedStays ?? 0} < 10`,
      ]
        .filter(Boolean)
        .join('; ');

    this.logger.log(
      `🏅 Superhost recalculated for ${id}: ${qualifies ? 'GRANTED' : 'DENIED'}${reason ? ` (${reason})` : ''}`,
    );

    return {
      isSuperhost: qualifies,
      reason,
      superhostSince: qualifies ? setFields['hostProfile.superhostSince'] ?? hp.superhostSince : undefined,
    };
  }

  /**
   * Record a completed payout from the bookings/payments service.
   * Appends to payoutHistory (capped at 50) and updates financial summary fields.
   * Called after a stay completes and payment is disbursed to the host.
   */
  async recordHostPayout(
    id: string,
    record: Omit<HostPayoutRecord, '_id'>,
  ): Promise<any> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid host ID');
    }

    const host = await this.userModel.findOne({ _id: id, role: UserRole.HOST }).exec();
    if (!host) {
      throw new NotFoundException('Host not found');
    }

    if (!host.hostProfile) {
      throw new BadRequestException('Host has no hostProfile sub-document');
    }

    const payoutEntry: HostPayoutRecord = {
      _id: new Types.ObjectId(),
      ...record,
    };

    // Determine if this payout falls in the current calendar month
    const now = new Date();
    const initiatedAt = new Date(record.initiatedAt);
    const isCurrentMonth =
      initiatedAt.getFullYear() === now.getFullYear() &&
      initiatedAt.getMonth() === now.getMonth();

    // Build atomic update
    const setFields: any = {
      'hostProfile.totalEarnings': (host.hostProfile.totalEarnings ?? 0) + record.amount,
    };

    if (isCurrentMonth) {
      setFields['hostProfile.currentMonthEarnings'] =
        (host.hostProfile.currentMonthEarnings ?? 0) + record.amount;
    }

    // Increment completedStays only when status is 'paid' (final success)
    if (record.status === 'paid') {
      setFields['hostProfile.completedStays'] = (host.hostProfile.completedStays ?? 0) + 1;
    }

    await this.userModel.updateOne(
      { _id: id },
      {
        $set: setFields,
        $push: {
          'hostProfile.payoutHistory': {
            $each: [payoutEntry],
            $position: 0,
            $slice: 50, // Keep latest 50 records
          },
        },
      },
    );

    this.logger.log(
      `💰 Payout recorded for host ${id}: ${record.amount} ${record.currency} (${record.status})`,
    );

    return {
      message: 'Payout recorded successfully',
      payout: payoutEntry,
      newTotalEarnings: setFields['hostProfile.totalEarnings'],
    };
  }

  // ── Private host helpers ──────────────────────────────────────────────────

  /**
   * Aggregate short-term listing counts for a host.
   */
  private async getHostListingStats(hostId: string): Promise<{
    totalListings: number;
    activeListings: number;
  }> {
    const result = await this.propertyModel.aggregate([
      {
        $match: {
          ownerId: new Types.ObjectId(hostId),
          isActive: true,
          listingType: ListingType.SHORT_TERM,
        },
      },
      {
        $group: {
          _id: null,
          totalListings: { $sum: 1 },
          activeListings: {
            $sum: { $cond: [{ $eq: ['$availability', PropertyStatus.ACTIVE] }, 1, 0] },
          },
        },
      },
    ]);

    return {
      totalListings: result[0]?.totalListings ?? 0,
      activeListings: result[0]?.activeListings ?? 0,
    };
  }
}