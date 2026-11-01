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
var UsersService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.UsersService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const config_1 = require("@nestjs/config");
const cloudinary_1 = require("cloudinary");
const user_schema_1 = require("./schemas/user.schema");
const property_schema_1 = require("../properties/schemas/property.schema");
const reviews_service_1 = require("../reviews/reviews.service");
let UsersService = UsersService_1 = class UsersService {
    userModel;
    propertyModel;
    configService;
    reviewsService;
    logger = new common_1.Logger(UsersService_1.name);
    constructor(userModel, propertyModel, configService, reviewsService) {
        this.userModel = userModel;
        this.propertyModel = propertyModel;
        this.configService = configService;
        this.reviewsService = reviewsService;
        cloudinary_1.v2.config({
            cloud_name: this.configService.get('CLOUDINARY_CLOUD_NAME'),
            api_key: this.configService.get('CLOUDINARY_API_KEY'),
            api_secret: this.configService.get('CLOUDINARY_API_SECRET'),
        });
    }
    async create(createUserDto) {
        try {
            const createdUser = new this.userModel(createUserDto);
            await createdUser.save();
            this.logger.log(`✅ User created: ${createdUser._id}`);
            return createdUser;
        }
        catch (error) {
            if (error.code === 11000) {
                const field = Object.keys(error.keyPattern)[0];
                throw new common_1.BadRequestException(`${field} already exists`);
            }
            throw error;
        }
    }
    async findAll(page = 1, limit = 10, role, isActive, search) {
        const skip = (page - 1) * limit;
        const filter = {};
        if (role)
            filter.role = role;
        if (typeof isActive === 'boolean')
            filter.isActive = isActive;
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
    async findOne(id) {
        if (!mongoose_2.Types.ObjectId.isValid(id)) {
            throw new common_1.BadRequestException('Invalid user ID');
        }
        const user = await this.userModel
            .findById(id)
            .select('-firebaseUid')
            .populate('favorites', 'title images price city address bedrooms bathrooms area type listingType isVerified')
            .exec();
        if (!user) {
            throw new common_1.NotFoundException('User not found');
        }
        return user;
    }
    async findPublicProfile(id) {
        if (!mongoose_2.Types.ObjectId.isValid(id)) {
            throw new common_1.BadRequestException('Invalid user ID');
        }
        const user = await this.userModel
            .findById(id)
            .select('name profilePicture bio city country role createdAt emailVerified phoneVerified languages')
            .exec();
        if (!user) {
            throw new common_1.NotFoundException('User not found');
        }
        return user;
    }
    async findByFirebaseUid(firebaseUid) {
        return this.userModel.findOne({ firebaseUid }).exec();
    }
    async findByEmail(email) {
        return this.userModel.findOne({ email }).exec();
    }
    async findByPhoneNumber(phoneNumber) {
        return this.userModel.findOne({ phoneNumber }).exec();
    }
    async update(id, updateUserDto) {
        if (!mongoose_2.Types.ObjectId.isValid(id)) {
            throw new common_1.BadRequestException('Invalid user ID');
        }
        const user = await this.userModel
            .findByIdAndUpdate(id, updateUserDto, { new: true })
            .select('-firebaseUid')
            .exec();
        if (!user) {
            throw new common_1.NotFoundException('User not found');
        }
        this.logger.log(`✅ User updated: ${id}`);
        return user;
    }
    async setRole(id, newRole) {
        if (!mongoose_2.Types.ObjectId.isValid(id)) {
            throw new common_1.BadRequestException('Invalid user ID');
        }
        if (newRole === user_schema_1.UserRole.ADMIN) {
            throw new common_1.BadRequestException('Cannot assign ADMIN role via this endpoint');
        }
        const allowedRoles = [
            user_schema_1.UserRole.REGISTERED_USER,
            user_schema_1.UserRole.AGENT,
            user_schema_1.UserRole.LANDLORD,
            user_schema_1.UserRole.HOST,
            user_schema_1.UserRole.GUEST,
            user_schema_1.UserRole.STUDENT,
        ];
        if (!allowedRoles.includes(newRole)) {
            throw new common_1.BadRequestException(`Invalid role: ${newRole}`);
        }
        const user = await this.userModel.findById(id).exec();
        if (!user) {
            throw new common_1.NotFoundException('User not found');
        }
        if (user.role === user_schema_1.UserRole.ADMIN) {
            throw new common_1.BadRequestException('Cannot change the role of an ADMIN user via this endpoint');
        }
        const extraUpdate = {};
        if (newRole === user_schema_1.UserRole.HOST && !user.hostProfile) {
            extraUpdate.hostProfile = {
                verificationStatus: user_schema_1.HostVerificationStatus.UNVERIFIED,
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
        return updatedUser;
    }
    async updatePreferences(id, preferences) {
        const user = await this.userModel
            .findByIdAndUpdate(id, { $set: { preferences } }, { new: true })
            .select('-firebaseUid')
            .exec();
        if (!user) {
            throw new common_1.NotFoundException('User not found');
        }
        return user;
    }
    async uploadProfilePicture(userId, file) {
        try {
            const result = await cloudinary_1.v2.uploader.upload_stream({
                folder: 'horohouse/profiles',
                transformation: [
                    { width: 300, height: 300, crop: 'fill', gravity: 'face' },
                    { quality: 'auto', fetch_format: 'auto' },
                ],
            }, async (error, result) => {
                if (error) {
                    this.logger.error('Cloudinary upload error:', error);
                    throw new common_1.BadRequestException('Failed to upload profile picture');
                }
                return result;
            });
            const uploadResult = await new Promise((resolve, reject) => {
                const uploadStream = cloudinary_1.v2.uploader.upload_stream({
                    folder: 'horohouse/profiles',
                    transformation: [
                        { width: 300, height: 300, crop: 'fill', gravity: 'face' },
                        { quality: 'auto', fetch_format: 'auto' },
                    ],
                }, (error, result) => {
                    if (error)
                        reject(error);
                    else
                        resolve(result);
                });
                uploadStream.end(file.buffer);
            });
            const user = await this.userModel
                .findByIdAndUpdate(userId, { profilePicture: uploadResult.secure_url }, { new: true })
                .select('-firebaseUid')
                .exec();
            if (!user) {
                throw new common_1.NotFoundException('User not found');
            }
            this.logger.log(`✅ Profile picture updated for user: ${userId}`);
            return user;
        }
        catch (error) {
            this.logger.error('Failed to upload profile picture:', error.message || error);
            throw new common_1.BadRequestException('Failed to upload profile picture');
        }
    }
    async addToFavorites(userId, propertyId) {
        if (!mongoose_2.Types.ObjectId.isValid(propertyId)) {
            throw new common_1.BadRequestException('Invalid property ID');
        }
        const user = await this.userModel
            .findByIdAndUpdate(userId, { $addToSet: { favorites: new mongoose_2.Types.ObjectId(propertyId) } }, { new: true })
            .select('-firebaseUid')
            .populate('favorites', 'title images price city address bedrooms bathrooms area type listingType isVerified')
            .exec();
        if (!user) {
            throw new common_1.NotFoundException('User not found');
        }
        return user;
    }
    async removeFromFavorites(userId, propertyId) {
        const user = await this.userModel
            .findByIdAndUpdate(userId, { $pull: { favorites: new mongoose_2.Types.ObjectId(propertyId) } }, { new: true })
            .select('-firebaseUid')
            .populate('favorites', 'title images price city address bedrooms bathrooms area type listingType isVerified')
            .exec();
        if (!user) {
            throw new common_1.NotFoundException('User not found');
        }
        return user;
    }
    async addToRecentlyViewed(userId, propertyId) {
        if (!mongoose_2.Types.ObjectId.isValid(propertyId)) {
            throw new common_1.BadRequestException('Invalid property ID');
        }
        await this.userModel.updateOne({ _id: userId }, {
            $pull: { recentlyViewed: { propertyId: new mongoose_2.Types.ObjectId(propertyId) } },
        });
        await this.userModel.updateOne({ _id: userId }, {
            $push: {
                recentlyViewed: {
                    $each: [{ propertyId: new mongoose_2.Types.ObjectId(propertyId), viewedAt: new Date() }],
                    $position: 0,
                    $slice: 50,
                },
            },
        });
    }
    async getRecentlyViewed(userId, limit = 10) {
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
            throw new common_1.NotFoundException('User not found');
        }
        return user.recentlyViewed
            .slice(0, limit)
            .filter((item) => item.propertyId && item.propertyId.title)
            .map((item) => ({
            ...item.propertyId.toObject?.() ?? item.propertyId,
            viewedAt: item.viewedAt,
        }));
    }
    async getViewedPropertiesWithPagination(userId, options = {}) {
        try {
            const { page = 1, limit = 20, sortBy = 'viewedAt', sortOrder = 'desc', } = options;
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
                throw new common_1.NotFoundException('User not found');
            }
            const validViewedProperties = user.recentlyViewed.filter((item) => item.propertyId !== null);
            const sortedProperties = [...validViewedProperties].sort((a, b) => {
                if (sortBy === 'viewedAt') {
                    return sortOrder === 'asc'
                        ? new Date(a.viewedAt).getTime() - new Date(b.viewedAt).getTime()
                        : new Date(b.viewedAt).getTime() - new Date(a.viewedAt).getTime();
                }
                return 0;
            });
            const paginatedProperties = sortedProperties.slice(skip, skip + limit);
            const properties = paginatedProperties.map((item) => ({
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
        }
        catch (error) {
            this.logger.error(`Error getting viewed properties for user ${userId}:`, error);
            throw error;
        }
    }
    async clearViewingHistory(userId) {
        try {
            await this.userModel.findByIdAndUpdate(userId, {
                recentlyViewed: [],
            });
            this.logger.log(`Cleared viewing history for user ${userId}`);
            return { message: 'Viewing history cleared successfully' };
        }
        catch (error) {
            this.logger.error(`Error clearing viewing history for user ${userId}:`, error);
            throw error;
        }
    }
    async removeFromViewingHistory(userId, propertyId) {
        try {
            await this.userModel.findByIdAndUpdate(userId, {
                $pull: { recentlyViewed: { propertyId: new mongoose_2.Types.ObjectId(propertyId) } },
            });
            this.logger.log(`Removed property ${propertyId} from viewing history for user ${userId}`);
            return { message: 'Property removed from viewing history' };
        }
        catch (error) {
            this.logger.error(`Error removing property from viewing history:`, error);
            throw error;
        }
    }
    async addSearchToHistory(userId, searchData) {
        await this.userModel.updateOne({ _id: userId }, {
            $push: {
                searchHistory: {
                    $each: [searchData],
                    $position: 0,
                    $slice: 100,
                },
            },
        });
    }
    async getSearchHistory(userId, limit = 20) {
        const user = await this.userModel
            .findById(userId)
            .select('searchHistory')
            .exec();
        if (!user) {
            throw new common_1.NotFoundException('User not found');
        }
        return user.searchHistory.slice(0, limit);
    }
    async remove(id) {
        const result = await this.userModel.updateOne({ _id: id }, { isActive: false });
        if (result.matchedCount === 0) {
            throw new common_1.NotFoundException('User not found');
        }
        this.logger.log(`✅ User deactivated: ${id}`);
    }
    async getStats() {
        const [totalUsers, activeUsers, agentUsers, landlordUsers, hostUsers, studentUsers, guestUsers, registeredUsers, verifiedUsers, recentUsers,] = await Promise.all([
            this.userModel.countDocuments(),
            this.userModel.countDocuments({ isActive: true }),
            this.userModel.countDocuments({ role: user_schema_1.UserRole.AGENT }),
            this.userModel.countDocuments({ role: user_schema_1.UserRole.LANDLORD }),
            this.userModel.countDocuments({ role: user_schema_1.UserRole.HOST }),
            this.userModel.countDocuments({ role: user_schema_1.UserRole.STUDENT }),
            this.userModel.countDocuments({ role: user_schema_1.UserRole.GUEST }),
            this.userModel.countDocuments({ role: user_schema_1.UserRole.REGISTERED_USER }),
            this.userModel.countDocuments({
                $or: [{ emailVerified: true }, { phoneVerified: true }],
            }),
            this.userModel.countDocuments({
                createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
            }),
        ]);
        const superhostUsers = await this.userModel.countDocuments({
            role: user_schema_1.UserRole.HOST,
            'hostProfile.isSuperhost': true,
        });
        const pendingHostVerifications = await this.userModel.countDocuments({
            role: user_schema_1.UserRole.HOST,
            'hostProfile.verificationStatus': user_schema_1.HostVerificationStatus.PENDING,
        });
        return {
            total: totalUsers,
            active: activeUsers,
            verified: verifiedUsers,
            recent: recentUsers,
            byRole: {
                [user_schema_1.UserRole.REGISTERED_USER]: registeredUsers,
                [user_schema_1.UserRole.AGENT]: agentUsers,
                [user_schema_1.UserRole.LANDLORD]: landlordUsers,
                [user_schema_1.UserRole.HOST]: hostUsers,
                [user_schema_1.UserRole.STUDENT]: studentUsers,
                [user_schema_1.UserRole.GUEST]: guestUsers,
            },
            agents: agentUsers,
            landlords: landlordUsers,
            hosts: hostUsers,
            students: studentUsers,
            guests: guestUsers,
            superhosts: superhostUsers,
            pendingHostVerifications,
        };
    }
    async getAgents(page = 1, limit = 10) {
        const skip = (page - 1) * limit;
        const agents = await this.userModel.aggregate([
            { $match: { role: user_schema_1.UserRole.AGENT, isActive: true } },
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
            role: user_schema_1.UserRole.AGENT,
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
    async getLandlords(page = 1, limit = 10) {
        const skip = (page - 1) * limit;
        const landlords = await this.userModel.aggregate([
            { $match: { role: user_schema_1.UserRole.LANDLORD, isActive: true } },
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
            role: user_schema_1.UserRole.LANDLORD,
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
    async getAgentById(id) {
        if (!mongoose_2.Types.ObjectId.isValid(id)) {
            throw new common_1.BadRequestException('Invalid agent ID');
        }
        const agent = await this.userModel
            .findOne({ _id: id, role: user_schema_1.UserRole.AGENT, isActive: true })
            .select('-password -sessions -searchHistory')
            .exec();
        if (!agent) {
            throw new common_1.NotFoundException('Agent not found');
        }
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
    async getLandlordById(id) {
        if (!mongoose_2.Types.ObjectId.isValid(id)) {
            throw new common_1.BadRequestException('Invalid landlord ID');
        }
        const landlord = await this.userModel
            .findOne({ _id: id, role: user_schema_1.UserRole.LANDLORD, isActive: true })
            .select('-password -sessions -searchHistory')
            .exec();
        if (!landlord) {
            throw new common_1.NotFoundException('Landlord not found');
        }
        const stats = await this.getAgentPropertyStats(id);
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
    async getLandlordStats(id) {
        if (!mongoose_2.Types.ObjectId.isValid(id)) {
            throw new common_1.BadRequestException('Invalid landlord ID');
        }
        const landlord = await this.userModel
            .findOne({ _id: id, role: user_schema_1.UserRole.LANDLORD, isActive: true })
            .exec();
        if (!landlord) {
            throw new common_1.NotFoundException('Landlord not found');
        }
        const properties = await this.propertyModel.find({ ownerId: new mongoose_2.Types.ObjectId(id), isActive: true }).exec();
        const tenants = landlord.tenants || [];
        const activeTenants = tenants.filter(t => t.status === 'active');
        const pendingTenants = tenants.filter(t => t.status === 'pending');
        const totalRentalIncome = activeTenants.reduce((sum, t) => sum + (t.monthlyRent || 0), 0);
        const occupiedPropertyIds = new Set(activeTenants.map(t => t.propertyId?.toString()));
        const totalProperties = properties.length;
        const occupiedCount = totalProperties > 0
            ? properties.filter(p => occupiedPropertyIds.has(p._id.toString())).length
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
    async getAgentStats(id) {
        if (!mongoose_2.Types.ObjectId.isValid(id)) {
            throw new common_1.BadRequestException('Invalid agent ID');
        }
        const agent = await this.userModel
            .findOne({ _id: id, role: user_schema_1.UserRole.AGENT, isActive: true })
            .exec();
        if (!agent) {
            throw new common_1.NotFoundException('Agent not found');
        }
        const stats = await this.getAgentPropertyStats(id);
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
    async getAgentProperties(agentId, options = {}) {
        if (!mongoose_2.Types.ObjectId.isValid(agentId)) {
            throw new common_1.BadRequestException('Invalid agent ID');
        }
        const agent = await this.userModel
            .findOne({
            _id: agentId,
            role: { $in: [user_schema_1.UserRole.AGENT, user_schema_1.UserRole.LANDLORD, user_schema_1.UserRole.HOST] },
            isActive: true
        })
            .exec();
        if (!agent) {
            throw new common_1.NotFoundException('User is not an active agent, landlord, or host');
        }
        const { status, page = 1, limit = 100 } = options;
        const skip = (page - 1) * limit;
        const query = {
            $or: [
                { agentId: new mongoose_2.Types.ObjectId(agentId) },
                { ownerId: new mongoose_2.Types.ObjectId(agentId) },
            ],
            isActive: true,
        };
        if (status) {
            const statusMap = {
                'For Sale': property_schema_1.PropertyStatus.ACTIVE,
                'For Rent': property_schema_1.PropertyStatus.ACTIVE,
                'Pending': property_schema_1.PropertyStatus.PENDING,
                'Sold': property_schema_1.PropertyStatus.SOLD,
            };
            if (status === 'For Sale' || status === 'For Rent') {
                query.availability = property_schema_1.PropertyStatus.ACTIVE;
            }
            else if (statusMap[status]) {
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
        const mappedProperties = properties.map(p => {
            const prop = p.toObject();
            return {
                id: p._id.toString(),
                images: (prop.images || []).map((img) => img.url),
                price: prop.price,
                address: prop.address,
                city: prop.city,
                state: prop.country,
                bedrooms: prop.amenities?.bedrooms || 0,
                bathrooms: prop.amenities?.bathrooms || 0,
                squareFeet: prop.area || 0,
                status: this.mapAvailabilityToStatus(prop.availability, prop.listingType),
                propertyType: this.capitalizePropertyType(prop.type),
                soldDate: prop.availability === property_schema_1.PropertyStatus.SOLD ? p.updatedAt.toISOString() : undefined,
                listingType: prop.listingType,
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
    async getAgentReviews(agentId, options = {}) {
        if (!mongoose_2.Types.ObjectId.isValid(agentId)) {
            throw new common_1.BadRequestException('Invalid agent ID');
        }
        const agent = await this.userModel
            .findOne({ _id: agentId, role: user_schema_1.UserRole.AGENT, isActive: true })
            .exec();
        if (!agent) {
            throw new common_1.NotFoundException('Agent not found');
        }
        const { page = 1, limit = 20 } = options;
        return this.reviewsService.getAgentReviews(agentId, { page, limit });
    }
    async getAgentReviewStats(agentId) {
        const stats = await this.reviewsService.getAgentReviewStats(agentId);
        return {
            averageRating: stats.averageRating,
            totalReviews: stats.totalReviews,
        };
    }
    async getAgentPropertyStats(agentId) {
        const agentObjectId = new mongoose_2.Types.ObjectId(agentId);
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
                                { $eq: ['$availability', property_schema_1.PropertyStatus.ACTIVE] },
                                1,
                                0,
                            ],
                        },
                    },
                    propertiesSold: {
                        $sum: {
                            $cond: [
                                { $eq: ['$availability', property_schema_1.PropertyStatus.SOLD] },
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
    calculateYearsOfExperience(createdAt) {
        const years = Math.floor((Date.now() - createdAt.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
        return Math.max(years, 1);
    }
    calculateSuccessRate(stats) {
        if (stats.totalProperties === 0)
            return 95;
        const rate = (stats.propertiesSold / stats.totalProperties) * 100;
        return Math.min(Math.round(rate), 100);
    }
    calculateAwards(stats) {
        let awards = 0;
        if (stats.propertiesSold >= 10)
            awards += 2;
        if (stats.propertiesSold >= 50)
            awards += 3;
        if (stats.propertiesSold >= 100)
            awards += 5;
        if (stats.propertiesSold >= 200)
            awards += 5;
        if (stats.totalProperties >= 20)
            awards += 2;
        if (stats.totalProperties >= 50)
            awards += 3;
        return awards;
    }
    getAgentSpecialties(agent, stats) {
        const specialties = [];
        if (agent.specialties && agent.specialties.length > 0) {
            return agent.specialties;
        }
        if (stats.propertiesSold > 100) {
            specialties.push('Luxury Homes');
        }
        if (stats.totalProperties > 50) {
            specialties.push('Investment Properties');
        }
        if (stats.propertiesSold < 20 && stats.activeProperties > 5) {
            specialties.push('First-Time Buyers');
        }
        if (specialties.length === 0) {
            specialties.push('Residential Properties');
        }
        return specialties;
    }
    getAgentServiceAreas(agent, cities) {
        if (agent.serviceAreas && agent.serviceAreas.length > 0) {
            return agent.serviceAreas;
        }
        if (cities && cities.length > 0) {
            return cities.slice(0, 5);
        }
        if (agent.city) {
            return [agent.city];
        }
        return ['Downtown'];
    }
    mapAvailabilityToStatus(availability, listingType) {
        switch (availability) {
            case property_schema_1.PropertyStatus.ACTIVE:
                return listingType === 'rent' ? 'For Rent' : 'For Sale';
            case property_schema_1.PropertyStatus.SOLD:
                return 'Sold';
            case property_schema_1.PropertyStatus.RENTED:
                return 'Rented';
            case property_schema_1.PropertyStatus.PENDING:
                return 'Pending';
            default:
                return 'For Sale';
        }
    }
    capitalizePropertyType(type) {
        return type.charAt(0).toUpperCase() + type.slice(1);
    }
    async updateOnboardingPreferences(userId, preferences) {
        if (!mongoose_2.Types.ObjectId.isValid(userId)) {
            throw new common_1.BadRequestException('Invalid user ID');
        }
        const updateData = {};
        if (preferences.propertyPreferences) {
            const pp = preferences.propertyPreferences;
            if (pp.propertyType?.length)
                updateData['preferences.propertyTypes'] = pp.propertyType;
            if (pp.location?.length)
                updateData['preferences.cities'] = pp.location;
            if (pp.features?.length)
                updateData['preferences.amenities'] = pp.features;
            if (pp.bedrooms?.length)
                updateData['preferences.bedrooms'] = pp.bedrooms;
            if (pp.bathrooms?.length)
                updateData['preferences.bathrooms'] = pp.bathrooms;
            if (pp.budget) {
                if (pp.budget.min !== undefined)
                    updateData['preferences.minPrice'] = pp.budget.min;
                if (pp.budget.max !== undefined)
                    updateData['preferences.maxPrice'] = pp.budget.max;
                if (pp.budget.currency)
                    updateData['preferences.currency'] = pp.budget.currency;
            }
        }
        if (preferences.agentPreferences) {
            const ap = preferences.agentPreferences;
            updateData.agentPreferences = ap;
            if (ap.licenseNumber)
                updateData.licenseNumber = ap.licenseNumber;
            if (ap.agency)
                updateData.agency = ap.agency;
        }
        if (preferences.onboardingCompleted !== undefined) {
            updateData.onboardingCompleted = preferences.onboardingCompleted;
        }
        const updatedUser = await this.userModel.findByIdAndUpdate(userId, { $set: updateData }, { new: true }).exec();
        if (!updatedUser) {
            throw new common_1.NotFoundException('User not found');
        }
        this.logger.log(`✅ Onboarding preferences updated for user: ${userId}`);
        return updatedUser;
    }
    hasLeaseOverlap(tenants, propertyId, leaseStart, leaseEnd, excludeTenantId) {
        return tenants.some(t => {
            if (excludeTenantId && t._id?.toString() === excludeTenantId)
                return false;
            if (t.status === 'ended')
                return false;
            if (t.propertyId?.toString() !== propertyId)
                return false;
            const existingStart = new Date(t.leaseStart);
            const existingEnd = new Date(t.leaseEnd);
            return leaseStart < existingEnd && leaseEnd > existingStart;
        });
    }
    sanitizeTenantResponse(tenant) {
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
    async addTenant(landlordId, tenantData) {
        if (!mongoose_2.Types.ObjectId.isValid(landlordId)) {
            throw new common_1.BadRequestException('Invalid landlord ID');
        }
        const propertyObjectId = new mongoose_2.Types.ObjectId(tenantData.propertyId);
        const property = await this.propertyModel.findOne({
            _id: propertyObjectId,
            $or: [
                { ownerId: new mongoose_2.Types.ObjectId(landlordId) },
                { agentId: new mongoose_2.Types.ObjectId(landlordId) },
            ],
            isActive: true,
        }).exec();
        if (!property) {
            throw new common_1.BadRequestException('Property not found or does not belong to you. Please verify the property ID.');
        }
        const leaseStart = new Date(tenantData.leaseStart);
        const leaseEnd = new Date(tenantData.leaseEnd);
        if (isNaN(leaseStart.getTime()) || isNaN(leaseEnd.getTime())) {
            throw new common_1.BadRequestException('Invalid lease dates. Please provide valid dates.');
        }
        if (leaseEnd <= leaseStart) {
            throw new common_1.BadRequestException('Lease end date must be after the start date.');
        }
        const landlord = await this.userModel.findById(landlordId).exec();
        if (!landlord) {
            throw new common_1.NotFoundException('Landlord not found');
        }
        if (this.hasLeaseOverlap(landlord.tenants || [], tenantData.propertyId, leaseStart, leaseEnd)) {
            throw new common_1.BadRequestException('There is an overlapping active or pending lease on this property for the given dates.');
        }
        let tenantUserId;
        if (tenantData.tenantEmail) {
            const existingUser = await this.userModel
                .findOne({ email: tenantData.tenantEmail.toLowerCase() })
                .select('_id')
                .exec();
            if (existingUser) {
                tenantUserId = existingUser._id;
                this.logger.log(`🔗 Auto-linked tenant to user ${tenantUserId}`);
            }
        }
        const tenant = {
            _id: new mongoose_2.Types.ObjectId(),
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
            .findByIdAndUpdate(landlordId, { $push: { tenants: tenant } }, { new: true })
            .select('tenants')
            .exec();
        if (!user) {
            throw new common_1.NotFoundException('User not found');
        }
        this.logger.log(`✅ Tenant added for landlord ${landlordId}`);
        const createdTenant = user.tenants?.find(t => t._id?.toString() === tenant._id.toString());
        return {
            message: 'Tenant added successfully',
            tenant: createdTenant ? this.sanitizeTenantResponse(createdTenant) : tenant,
        };
    }
    async updateTenant(landlordId, tenantId, tenantData) {
        if (!mongoose_2.Types.ObjectId.isValid(landlordId) || !mongoose_2.Types.ObjectId.isValid(tenantId)) {
            throw new common_1.BadRequestException('Invalid ID');
        }
        if (tenantData.propertyId !== undefined) {
            const property = await this.propertyModel.findOne({
                _id: new mongoose_2.Types.ObjectId(tenantData.propertyId),
                $or: [
                    { ownerId: new mongoose_2.Types.ObjectId(landlordId) },
                    { agentId: new mongoose_2.Types.ObjectId(landlordId) },
                ],
                isActive: true,
            }).exec();
            if (!property) {
                throw new common_1.BadRequestException('Property not found or does not belong to you.');
            }
        }
        if (tenantData.leaseStart !== undefined || tenantData.leaseEnd !== undefined) {
            const landlord = await this.userModel.findById(landlordId).exec();
            if (!landlord)
                throw new common_1.NotFoundException('Landlord not found');
            const existingTenant = landlord.tenants?.find(t => t._id?.toString() === tenantId);
            if (!existingTenant)
                throw new common_1.NotFoundException('Tenant not found');
            const newStart = tenantData.leaseStart
                ? new Date(tenantData.leaseStart)
                : new Date(existingTenant.leaseStart);
            const newEnd = tenantData.leaseEnd
                ? new Date(tenantData.leaseEnd)
                : new Date(existingTenant.leaseEnd);
            if (newEnd <= newStart) {
                throw new common_1.BadRequestException('Lease end date must be after the start date.');
            }
            const targetPropertyId = tenantData.propertyId || existingTenant.propertyId?.toString();
            if (this.hasLeaseOverlap(landlord.tenants || [], targetPropertyId, newStart, newEnd, tenantId)) {
                throw new common_1.BadRequestException('There is an overlapping active or pending lease on this property for the given dates.');
            }
        }
        const updateFields = {};
        if (tenantData.tenantName !== undefined)
            updateFields['tenants.$.tenantName'] = tenantData.tenantName;
        if (tenantData.tenantEmail !== undefined)
            updateFields['tenants.$.tenantEmail'] = tenantData.tenantEmail;
        if (tenantData.tenantPhone !== undefined)
            updateFields['tenants.$.tenantPhone'] = tenantData.tenantPhone;
        if (tenantData.propertyId !== undefined)
            updateFields['tenants.$.propertyId'] = new mongoose_2.Types.ObjectId(tenantData.propertyId);
        if (tenantData.leaseStart !== undefined)
            updateFields['tenants.$.leaseStart'] = new Date(tenantData.leaseStart);
        if (tenantData.leaseEnd !== undefined)
            updateFields['tenants.$.leaseEnd'] = new Date(tenantData.leaseEnd);
        if (tenantData.monthlyRent !== undefined)
            updateFields['tenants.$.monthlyRent'] = tenantData.monthlyRent;
        if (tenantData.depositAmount !== undefined)
            updateFields['tenants.$.depositAmount'] = tenantData.depositAmount;
        if (tenantData.status !== undefined)
            updateFields['tenants.$.status'] = tenantData.status;
        if (tenantData.notes !== undefined)
            updateFields['tenants.$.notes'] = tenantData.notes;
        if (Object.keys(updateFields).length === 0) {
            throw new common_1.BadRequestException('No fields to update');
        }
        const user = await this.userModel
            .findOneAndUpdate({ _id: landlordId, 'tenants._id': new mongoose_2.Types.ObjectId(tenantId) }, { $set: updateFields }, { new: true })
            .select('tenants')
            .exec();
        if (!user) {
            throw new common_1.NotFoundException('User or tenant not found');
        }
        const updatedTenant = user.tenants?.find(t => t._id?.toString() === tenantId);
        this.logger.log(`✅ Tenant ${tenantId} updated for landlord ${landlordId}`);
        return {
            message: 'Tenant updated successfully',
            tenant: updatedTenant ? this.sanitizeTenantResponse(updatedTenant) : null,
        };
    }
    async removeTenant(landlordId, tenantId) {
        if (!mongoose_2.Types.ObjectId.isValid(landlordId) || !mongoose_2.Types.ObjectId.isValid(tenantId)) {
            throw new common_1.BadRequestException('Invalid ID');
        }
        const user = await this.userModel
            .findByIdAndUpdate(landlordId, { $pull: { tenants: { _id: new mongoose_2.Types.ObjectId(tenantId) } } }, { new: true })
            .select('tenants')
            .exec();
        if (!user) {
            throw new common_1.NotFoundException('User not found');
        }
        this.logger.log(`✅ Tenant ${tenantId} removed for landlord ${landlordId}`);
        return {
            message: 'Tenant removed successfully',
            remainingTenants: (user.tenants || []).length,
        };
    }
    async getMyLeaseInfo(userId) {
        if (!mongoose_2.Types.ObjectId.isValid(userId)) {
            throw new common_1.BadRequestException('Invalid user ID');
        }
        const userObjectId = new mongoose_2.Types.ObjectId(userId);
        const landlords = await this.userModel
            .find({
            'tenants.tenantUserId': userObjectId,
        })
            .select('name email phoneNumber profilePicture tenants')
            .exec();
        if (!landlords || landlords.length === 0) {
            return { leases: [] };
        }
        const leases = [];
        for (const landlord of landlords) {
            const matchingTenants = (landlord.tenants || []).filter(t => t.tenantUserId?.toString() === userId);
            for (const tenant of matchingTenants) {
                let propertyInfo = null;
                if (tenant.propertyId) {
                    const property = await this.propertyModel
                        .findById(tenant.propertyId)
                        .select('title address city country images type')
                        .exec();
                    if (property) {
                        const prop = property.toObject();
                        propertyInfo = {
                            id: property._id.toString(),
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
                        id: landlord._id.toString(),
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
    async getHosts(page = 1, limit = 10) {
        const skip = (page - 1) * limit;
        const hosts = await this.userModel.aggregate([
            { $match: { role: user_schema_1.UserRole.HOST, isActive: true } },
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
            role: user_schema_1.UserRole.HOST,
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
    async getHostById(id) {
        if (!mongoose_2.Types.ObjectId.isValid(id)) {
            throw new common_1.BadRequestException('Invalid host ID');
        }
        const host = await this.userModel
            .findOne({ _id: id, role: user_schema_1.UserRole.HOST, isActive: true })
            .select('-firebaseUid -password -sessions -searchHistory')
            .exec();
        if (!host) {
            throw new common_1.NotFoundException('Host not found');
        }
        const [listingStats, reviewStats] = await Promise.all([
            this.getHostListingStats(id),
            this.getAgentReviewStats(id).catch(() => ({ averageRating: 0, totalReviews: 0 })),
        ]);
        const hp = host.hostProfile ? { ...host.hostProfile } : null;
        if (hp?.governmentIdPublicId)
            delete hp.governmentIdPublicId;
        const payoutAccountsSummary = (hp?.payoutAccounts ?? []).map((acc) => ({
            method: acc.method,
            providerName: acc.providerName,
            isDefault: acc.isDefault,
            currency: acc.currency,
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
            totalListings: listingStats.totalListings,
            activeListings: listingStats.activeListings,
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
    async getHostStats(id) {
        if (!mongoose_2.Types.ObjectId.isValid(id)) {
            throw new common_1.BadRequestException('Invalid host ID');
        }
        const host = await this.userModel
            .findOne({ _id: id, role: user_schema_1.UserRole.HOST, isActive: true })
            .exec();
        if (!host) {
            throw new common_1.NotFoundException('Host not found');
        }
        const [listingStats, reviewStats] = await Promise.all([
            this.getHostListingStats(id),
            this.getAgentReviewStats(id).catch(() => ({ averageRating: 0, totalReviews: 0 })),
        ]);
        const hp = host.hostProfile;
        const occupancyRate = listingStats.totalListings > 0
            ? Math.min(Math.round(((hp?.completedStays ?? 0) / (listingStats.totalListings * 30)) * 100), 100)
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
            verificationStatus: hp?.verificationStatus ?? user_schema_1.HostVerificationStatus.UNVERIFIED,
            responseRate: hp?.responseRate ?? null,
            responseTimeMinutes: hp?.responseTimeMinutes ?? null,
            occupancyRate,
        };
    }
    async updateHostProfile(id, updates) {
        if (!mongoose_2.Types.ObjectId.isValid(id)) {
            throw new common_1.BadRequestException('Invalid host ID');
        }
        const host = await this.userModel.findOne({ _id: id, role: user_schema_1.UserRole.HOST, isActive: true }).exec();
        if (!host) {
            throw new common_1.NotFoundException('Host not found');
        }
        const setFields = {};
        const arrayPushOps = {};
        const arrayPullOps = {};
        if (updates.governmentIdBuffer) {
            const uploadResult = await new Promise((resolve, reject) => {
                const stream = cloudinary_1.v2.uploader.upload_stream({ folder: 'horohouse/host-ids', resource_type: 'image' }, (err, result) => {
                    if (err)
                        reject(err);
                    else
                        resolve(result);
                });
                stream.end(updates.governmentIdBuffer);
            });
            setFields['hostProfile.governmentIdUrl'] = uploadResult.secure_url;
            setFields['hostProfile.governmentIdPublicId'] = uploadResult.public_id;
            setFields['hostProfile.verificationStatus'] = user_schema_1.HostVerificationStatus.PENDING;
            setFields['hostProfile.verificationSubmittedAt'] = new Date();
            this.logger.log(`📄 Government ID uploaded for host ${id}`);
        }
        const scalarMap = {
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
            if (updates[key] !== undefined) {
                setFields[dbPath] = updates[key];
            }
        }
        if (updates.addPayoutAccount) {
            const acc = updates.addPayoutAccount;
            if (acc.isDefault) {
                await this.userModel.updateOne({ _id: id }, { $set: { 'hostProfile.payoutAccounts.$[].isDefault': false } });
            }
            arrayPushOps['hostProfile.payoutAccounts'] = {
                method: acc.method,
                accountIdentifier: acc.accountIdentifier,
                providerName: acc.providerName,
                isDefault: acc.isDefault ?? false,
                currency: acc.currency ?? 'XAF',
            };
        }
        if (updates.removePayoutAccountIdentifier) {
            arrayPullOps['hostProfile.payoutAccounts'] = {
                accountIdentifier: updates.removePayoutAccountIdentifier,
            };
        }
        if (updates.addCoHostId) {
            if (!mongoose_2.Types.ObjectId.isValid(updates.addCoHostId)) {
                throw new common_1.BadRequestException('Invalid co-host user ID');
            }
            arrayPushOps['hostProfile.coHostIds'] = new mongoose_2.Types.ObjectId(updates.addCoHostId);
        }
        if (updates.removeCoHostId) {
            if (!mongoose_2.Types.ObjectId.isValid(updates.removeCoHostId)) {
                throw new common_1.BadRequestException('Invalid co-host user ID');
            }
            arrayPullOps['hostProfile.coHostIds'] = new mongoose_2.Types.ObjectId(updates.removeCoHostId);
        }
        const updateCmd = {};
        if (Object.keys(setFields).length > 0)
            updateCmd.$set = setFields;
        if (Object.keys(arrayPushOps).length > 0) {
            updateCmd.$push = {};
            for (const [k, v] of Object.entries(arrayPushOps)) {
                updateCmd.$push[k] = { $each: [v] };
            }
        }
        if (Object.keys(arrayPullOps).length > 0)
            updateCmd.$pull = arrayPullOps;
        if (Object.keys(updateCmd).length === 0) {
            throw new common_1.BadRequestException('No host profile fields to update');
        }
        const updated = await this.userModel
            .findOneAndUpdate({ _id: id }, updateCmd, { new: true })
            .select('-firebaseUid -password -sessions -searchHistory')
            .exec();
        this.logger.log(`✅ Host profile updated for ${id}`);
        return updated;
    }
    async verifyHost(id, decision, rejectionReason) {
        if (!mongoose_2.Types.ObjectId.isValid(id)) {
            throw new common_1.BadRequestException('Invalid host ID');
        }
        const host = await this.userModel.findOne({ _id: id, role: user_schema_1.UserRole.HOST }).exec();
        if (!host) {
            throw new common_1.NotFoundException('Host not found');
        }
        if (!host.hostProfile) {
            throw new common_1.BadRequestException('Host has no hostProfile sub-document');
        }
        if (host.hostProfile.verificationStatus !== user_schema_1.HostVerificationStatus.PENDING) {
            throw new common_1.BadRequestException(`Cannot ${decision} a verification that is not in PENDING state (current: ${host.hostProfile.verificationStatus})`);
        }
        const newStatus = decision === 'approve' ? user_schema_1.HostVerificationStatus.VERIFIED : user_schema_1.HostVerificationStatus.REJECTED;
        const setFields = {
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
    async recalculateSuperhostStatus(id) {
        if (!mongoose_2.Types.ObjectId.isValid(id)) {
            throw new common_1.BadRequestException('Invalid host ID');
        }
        const host = await this.userModel.findOne({ _id: id, role: user_schema_1.UserRole.HOST }).exec();
        if (!host) {
            throw new common_1.NotFoundException('Host not found');
        }
        const hp = host.hostProfile;
        if (!hp) {
            throw new common_1.BadRequestException('Host has no hostProfile sub-document');
        }
        const reviewStats = await this.getAgentReviewStats(id).catch(() => ({
            averageRating: 0,
            totalReviews: 0,
        }));
        const meetsResponseRate = (hp.responseRate ?? 0) >= 90;
        const meetsRating = reviewStats.averageRating >= 4.8;
        const meetsStays = (hp.completedStays ?? 0) >= 10;
        const meetsCancellation = true;
        const qualifies = meetsResponseRate && meetsRating && meetsStays && meetsCancellation;
        const wasAlreadySuperhost = hp.isSuperhost;
        const setFields = { 'hostProfile.isSuperhost': qualifies };
        if (qualifies && !wasAlreadySuperhost) {
            setFields['hostProfile.superhostSince'] = new Date();
        }
        else if (!qualifies && wasAlreadySuperhost) {
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
        this.logger.log(`🏅 Superhost recalculated for ${id}: ${qualifies ? 'GRANTED' : 'DENIED'}${reason ? ` (${reason})` : ''}`);
        return {
            isSuperhost: qualifies,
            reason,
            superhostSince: qualifies ? setFields['hostProfile.superhostSince'] ?? hp.superhostSince : undefined,
        };
    }
    async recordHostPayout(id, record) {
        if (!mongoose_2.Types.ObjectId.isValid(id)) {
            throw new common_1.BadRequestException('Invalid host ID');
        }
        const host = await this.userModel.findOne({ _id: id, role: user_schema_1.UserRole.HOST }).exec();
        if (!host) {
            throw new common_1.NotFoundException('Host not found');
        }
        if (!host.hostProfile) {
            throw new common_1.BadRequestException('Host has no hostProfile sub-document');
        }
        const payoutEntry = {
            _id: new mongoose_2.Types.ObjectId(),
            ...record,
        };
        const now = new Date();
        const initiatedAt = new Date(record.initiatedAt);
        const isCurrentMonth = initiatedAt.getFullYear() === now.getFullYear() &&
            initiatedAt.getMonth() === now.getMonth();
        const setFields = {
            'hostProfile.totalEarnings': (host.hostProfile.totalEarnings ?? 0) + record.amount,
        };
        if (isCurrentMonth) {
            setFields['hostProfile.currentMonthEarnings'] =
                (host.hostProfile.currentMonthEarnings ?? 0) + record.amount;
        }
        if (record.status === 'paid') {
            setFields['hostProfile.completedStays'] = (host.hostProfile.completedStays ?? 0) + 1;
        }
        await this.userModel.updateOne({ _id: id }, {
            $set: setFields,
            $push: {
                'hostProfile.payoutHistory': {
                    $each: [payoutEntry],
                    $position: 0,
                    $slice: 50,
                },
            },
        });
        this.logger.log(`💰 Payout recorded for host ${id}: ${record.amount} ${record.currency} (${record.status})`);
        return {
            message: 'Payout recorded successfully',
            payout: payoutEntry,
            newTotalEarnings: setFields['hostProfile.totalEarnings'],
        };
    }
    async getHostListingStats(hostId) {
        const hostObjectId = new mongoose_2.Types.ObjectId(hostId);
        const result = await this.propertyModel.aggregate([
            {
                $match: {
                    ownerId: hostObjectId,
                    isActive: true,
                    listingType: 'short-term',
                },
            },
            {
                $group: {
                    _id: null,
                    totalListings: { $sum: 1 },
                    activeListings: {
                        $sum: {
                            $cond: [{ $eq: ['$availability', 'available'] }, 1, 0],
                        },
                    },
                },
            },
        ]);
        if (!result || result.length === 0) {
            return { totalListings: 0, activeListings: 0 };
        }
        return {
            totalListings: result[0].totalListings ?? 0,
            activeListings: result[0].activeListings ?? 0,
        };
    }
};
exports.UsersService = UsersService;
exports.UsersService = UsersService = UsersService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(user_schema_1.User.name)),
    __param(1, (0, mongoose_1.InjectModel)(property_schema_1.Property.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Model,
        config_1.ConfigService,
        reviews_service_1.ReviewsService])
], UsersService);
//# sourceMappingURL=users.service.js.map