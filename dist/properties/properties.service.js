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
var PropertiesService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PropertiesService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const axios_1 = require("axios");
const cloudinary_1 = require("../utils/cloudinary");
const watermark_service_1 = require("../watermark/watermark.service");
const property_schema_1 = require("./schemas/property.schema");
const user_schema_1 = require("../users/schemas/user.schema");
const history_service_1 = require("../history/history.service");
const history_schema_1 = require("../history/schemas/history.schema");
const user_interactions_service_1 = require("../user-interactions/user-interactions.service");
const user_interaction_schema_1 = require("../user-interactions/schemas/user-interaction.schema");
let PropertiesService = PropertiesService_1 = class PropertiesService {
    propertyModel;
    userModel;
    historyService;
    userInteractionsService;
    watermarkService;
    logger = new common_1.Logger(PropertiesService_1.name);
    cache = new Map();
    CACHE_TTL_MS = 60_000;
    POPULAR_CITIES_TTL_MS = 5 * 60_000;
    FEATURED_TTL_MS = 2 * 60_000;
    constructor(propertyModel, userModel, historyService, userInteractionsService, watermarkService) {
        this.propertyModel = propertyModel;
        this.userModel = userModel;
        this.historyService = historyService;
        this.userInteractionsService = userInteractionsService;
        this.watermarkService = watermarkService;
    }
    async onModuleInit() {
        await this.ensureIndexes();
    }
    async ensureIndexes() {
        try {
            const col = this.propertyModel.collection;
            await Promise.all([
                col.createIndex({ location: '2dsphere' }),
                col.createIndex({ title: 'text', description: 'text', city: 'text', neighborhood: 'text', keywords: 'text' }),
                col.createIndex({ isActive: 1, approvalStatus: 1, availability: 1, createdAt: -1 }, { background: true }),
                col.createIndex({ ownerId: 1, createdAt: -1 }, { background: true }),
                col.createIndex({ city: 1, isActive: 1, price: 1 }, { background: true }),
                col.createIndex({ listingType: 1, isActive: 1, approvalStatus: 1, availability: 1, createdAt: -1 }, { background: true }),
                col.createIndex({ viewsCount: -1, isActive: 1 }, { background: true }),
                col.createIndex({ isFeatured: 1, isActive: 1, createdAt: -1 }, { background: true }),
                col.createIndex({ slug: 1 }, { unique: true, sparse: true, background: true }),
            ]);
            this.logger.log('✅ Property indexes ensured');
        }
        catch (err) {
            this.logger.error('Failed to ensure property indexes:', err);
        }
    }
    cacheGet(key) {
        const entry = this.cache.get(key);
        if (!entry)
            return null;
        if (Date.now() > entry.expiresAt) {
            this.cache.delete(key);
            return null;
        }
        return entry.data;
    }
    cacheSet(key, data, ttlMs = this.CACHE_TTL_MS) {
        this.cache.set(key, { data, expiresAt: Date.now() + ttlMs });
    }
    cacheInvalidate(pattern) {
        for (const key of this.cache.keys()) {
            if (key.startsWith(pattern))
                this.cache.delete(key);
        }
    }
    async create(createPropertyDto, user) {
        try {
            const { latitude, longitude, ...restDto } = createPropertyDto;
            if (latitude !== undefined && longitude !== undefined) {
                if (!this.isValidCoordinate(latitude, longitude)) {
                    throw new common_1.BadRequestException('Invalid coordinates provided');
                }
            }
            const locationData = latitude !== undefined && longitude !== undefined
                ? {
                    location: {
                        type: 'Point',
                        coordinates: [Number(longitude), Number(latitude)],
                    },
                }
                : {};
            const isAdmin = user.role === user_schema_1.UserRole.ADMIN;
            if (createPropertyDto.listingType === property_schema_1.ListingType.SHORT_TERM) {
                this.validateShortTermFields(createPropertyDto);
            }
            const property = new this.propertyModel({
                ...restDto,
                ...locationData,
                latitude,
                longitude,
                ownerId: user._id,
                agentId: user.role === user_schema_1.UserRole.AGENT ? user._id : undefined,
                slug: this.generateSlug(createPropertyDto.title),
                keywords: this.generateKeywords(createPropertyDto),
                approvalStatus: isAdmin ? property_schema_1.ApprovalStatus.APPROVED : property_schema_1.ApprovalStatus.PENDING,
                isActive: isAdmin,
                pricingUnit: createPropertyDto.pricingUnit ?? property_schema_1.PricingUnit.NIGHTLY,
                minNights: createPropertyDto.minNights ?? 1,
                maxNights: createPropertyDto.maxNights ?? 365,
                cleaningFee: createPropertyDto.cleaningFee ?? 0,
                serviceFee: createPropertyDto.serviceFee ?? 0,
                city: createPropertyDto.city.trim().toLowerCase(),
                shortTermAmenities: createPropertyDto.shortTermAmenities ?? {},
                isInstantBookable: createPropertyDto.isInstantBookable ?? false,
                cancellationPolicy: createPropertyDto.cancellationPolicy ?? property_schema_1.CancellationPolicy.FLEXIBLE,
                advanceNoticeDays: createPropertyDto.advanceNoticeDays ?? 0,
                bookingWindowDays: createPropertyDto.bookingWindowDays ?? 365,
                originalPrice: createPropertyDto.originalPrice ?? null,
                customDiscountNights: createPropertyDto.customDiscountNights ?? null,
                customDiscountPercent: createPropertyDto.customDiscountPercent ?? null,
                unavailableDates: [],
            });
            const savedProperty = await property.save();
            this.cacheInvalidate('popular_cities');
            this.cacheInvalidate('recent_');
            this.cacheInvalidate('featured_');
            this.logger.log(`Property created: ${savedProperty._id} by user ${user._id} (approvalStatus: ${savedProperty.approvalStatus})`);
            return savedProperty;
        }
        catch (error) {
            this.logger.error('Error creating property:', error);
            throw error;
        }
    }
    async findAll(filters = {}, options = {}, user) {
        try {
            const { page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc', includeInactive = false, } = options;
            const skip = (page - 1) * limit;
            const query = this.buildBaseListQuery(filters, includeInactive);
            const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };
            const availabilityPromise = filters.checkIn && filters.checkOut
                ? this.getBookedPropertyIds(filters.checkIn, filters.checkOut)
                : Promise.resolve([]);
            const bookedIds = await availabilityPromise;
            if (bookedIds.length > 0) {
                query._id = { $nin: bookedIds };
            }
            const [properties, total] = await Promise.all([
                this.propertyModel
                    .find(query)
                    .select(this.listingProjection())
                    .populate('ownerId', 'name email phoneNumber profilePicture')
                    .populate('agentId', 'name email phoneNumber profilePicture agency')
                    .sort(sort)
                    .skip(skip)
                    .limit(limit)
                    .lean()
                    .exec(),
                this.propertyModel.countDocuments(query),
            ]);
            if (user) {
                this.fireAnalytics(user, filters, total);
            }
            return { properties: properties, total, page, totalPages: Math.ceil(total / limit) };
        }
        catch (error) {
            this.logger.error('Error finding properties:', error);
            throw error;
        }
    }
    async findNearby(latitude, longitude, radiusKm = 5, limit = 10, user) {
        try {
            if (!this.isValidCoordinate(latitude, longitude)) {
                throw new common_1.BadRequestException('Invalid coordinates provided');
            }
            const properties = await this.propertyModel
                .find({
                location: {
                    $near: {
                        $geometry: { type: 'Point', coordinates: [longitude, latitude] },
                        $maxDistance: radiusKm * 1000,
                    },
                },
                isActive: true,
                availability: property_schema_1.PropertyStatus.ACTIVE,
            })
                .select(this.listingProjection())
                .populate('ownerId', 'name email phoneNumber')
                .populate('agentId', 'name email phoneNumber agency')
                .limit(limit)
                .lean()
                .exec();
            if (user) {
                this.historyService
                    .logActivity({
                    userId: user._id,
                    activityType: history_schema_1.ActivityType.SEARCH,
                    searchQuery: `nearby:${latitude},${longitude},${radiusKm}km`,
                    resultsCount: properties.length,
                    userLocation: { type: 'Point', coordinates: [longitude, latitude] },
                })
                    .catch((e) => this.logger.error('History log failed', e));
                this.userInteractionsService
                    .trackInteraction({
                    userId: user._id,
                    interactionType: user_interaction_schema_1.InteractionType.MAP_VIEW,
                    source: user_interaction_schema_1.InteractionSource.MAP,
                    location: { type: 'Point', coordinates: [longitude, latitude] },
                    metadata: { resultsCount: properties.length, radius: radiusKm },
                })
                    .catch((e) => this.logger.error('Interaction track failed', e));
            }
            return properties;
        }
        catch (error) {
            this.logger.error('Error finding nearby properties:', error);
            throw error;
        }
    }
    async findOne(id, user) {
        try {
            if (!mongoose_2.Types.ObjectId.isValid(id)) {
                throw new common_1.BadRequestException(`Invalid property ID format: ${id}`);
            }
            const [property] = await Promise.all([
                this.propertyModel
                    .findById(id)
                    .populate('ownerId', 'name email phoneNumber profilePicture')
                    .populate('agentId', 'name email phoneNumber profilePicture agency licenseNumber')
                    .lean()
                    .exec(),
                this.propertyModel.findByIdAndUpdate(id, { $inc: { viewsCount: 1 } }).exec(),
            ]);
            if (!property) {
                throw new common_1.NotFoundException('Property not found');
            }
            const isOwner = user && property.ownerId?._id?.toString() === user._id.toString();
            const isAgent = user && property.agentId?._id?.toString() === user._id.toString();
            const isAdmin = user?.role === user_schema_1.UserRole.ADMIN;
            if (!isOwner && !isAgent && !isAdmin) {
                const isVisible = property.isActive === true &&
                    property.approvalStatus === property_schema_1.ApprovalStatus.APPROVED;
                if (!isVisible) {
                    throw new common_1.NotFoundException('Property not found');
                }
            }
            return property;
        }
        catch (error) {
            this.logger.error(`Error finding property ${id}:`, error);
            throw error;
        }
    }
    async update(id, updatePropertyDto, user) {
        try {
            const property = await this.propertyModel
                .findById(id)
                .select('ownerId agentId title description city type price originalPrice')
                .lean()
                .exec();
            if (!property)
                throw new common_1.NotFoundException('Property not found');
            if (user.role !== user_schema_1.UserRole.ADMIN &&
                property.ownerId.toString() !== user._id.toString() &&
                property.agentId?.toString() !== user._id.toString()) {
                throw new common_1.ForbiddenException('You can only update your own properties');
            }
            if (updatePropertyDto.latitude !== undefined &&
                updatePropertyDto.longitude !== undefined) {
                if (!this.isValidCoordinate(updatePropertyDto.latitude, updatePropertyDto.longitude)) {
                    throw new common_1.BadRequestException('Invalid coordinates provided');
                }
                updatePropertyDto.location = {
                    type: 'Point',
                    coordinates: [updatePropertyDto.longitude, updatePropertyDto.latitude],
                };
            }
            if (updatePropertyDto.title || updatePropertyDto.description) {
                updatePropertyDto.keywords = this.generateKeywords({
                    title: updatePropertyDto.title || property.title,
                    description: updatePropertyDto.description || property.description,
                    city: updatePropertyDto.city || property.city,
                    type: updatePropertyDto.type || property.type,
                });
            }
            if (updatePropertyDto.originalPrice !== undefined) {
                updatePropertyDto.originalPrice = updatePropertyDto.originalPrice;
            }
            else if (updatePropertyDto.price !== undefined) {
                const currentPrice = Number(property.price);
                const currentOriginalPrice = property.originalPrice ? Number(property.originalPrice) : null;
                const newPrice = Number(updatePropertyDto.price);
                if (newPrice < currentPrice) {
                    updatePropertyDto.originalPrice = currentOriginalPrice || currentPrice;
                }
                else if (currentOriginalPrice && newPrice >= currentOriginalPrice) {
                    updatePropertyDto.originalPrice = null;
                }
            }
            const updatedProperty = await this.propertyModel
                .findByIdAndUpdate(id, updatePropertyDto, { new: true })
                .populate('ownerId', 'name email phoneNumber')
                .populate('agentId', 'name email phoneNumber agency')
                .lean()
                .exec();
            if (!updatedProperty)
                throw new common_1.NotFoundException('Property not found after update');
            this.cacheInvalidate(`similar_${id}`);
            this.cacheInvalidate('featured_');
            this.logger.log(`Property updated: ${id} by user ${user._id}`);
            return updatedProperty;
        }
        catch (error) {
            this.logger.error(`Error updating property ${id}:`, error);
            throw error;
        }
    }
    async getAllPropertiesAdmin(filters = {}, options = {}) {
        const { page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc' } = options;
        const skip = (page - 1) * limit;
        const query = {};
        if (filters.approvalStatus)
            query.approvalStatus = filters.approvalStatus;
        if (filters.propertyType)
            query.type = filters.propertyType;
        if (filters.listingType)
            query.listingType = filters.listingType;
        if (filters.city)
            query.city = filters.city.trim().toLowerCase();
        if (filters.ownerId)
            query.ownerId = new mongoose_2.Types.ObjectId(filters.ownerId);
        if (filters.search) {
            query.$or = [
                { title: { $regex: filters.search, $options: 'i' } },
                { city: { $regex: filters.search, $options: 'i' } },
                { address: { $regex: filters.search, $options: 'i' } },
            ];
        }
        const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };
        const [properties, total] = await Promise.all([
            this.propertyModel
                .find(query)
                .populate('ownerId', 'name email phoneNumber profilePicture role agency')
                .populate('agentId', 'name email profilePicture agency')
                .sort(sort)
                .skip(skip)
                .limit(limit)
                .lean()
                .exec(),
            this.propertyModel.countDocuments(query),
        ]);
        return { properties: properties, total, page, totalPages: Math.ceil(total / limit) };
    }
    async approveProperty(id, admin) {
        const property = await this.propertyModel.findById(id).select('_id').lean().exec();
        if (!property)
            throw new common_1.NotFoundException('Property not found');
        if (admin.role !== user_schema_1.UserRole.ADMIN)
            throw new common_1.ForbiddenException('Only admins can approve properties');
        const updated = await this.propertyModel
            .findByIdAndUpdate(id, { approvalStatus: property_schema_1.ApprovalStatus.APPROVED, isActive: true, $unset: { rejectionReason: '' } }, { new: true })
            .populate('ownerId', 'name email phoneNumber')
            .populate('agentId', 'name email agency')
            .lean()
            .exec();
        this.cacheInvalidate('featured_');
        this.cacheInvalidate('recent_');
        this.logger.log(`Property ${id} approved by admin ${admin._id}`);
        return updated;
    }
    async rejectProperty(id, reason, admin) {
        const property = await this.propertyModel.findById(id).select('_id').lean().exec();
        if (!property)
            throw new common_1.NotFoundException('Property not found');
        if (admin.role !== user_schema_1.UserRole.ADMIN)
            throw new common_1.ForbiddenException('Only admins can reject properties');
        const updated = await this.propertyModel
            .findByIdAndUpdate(id, {
            approvalStatus: property_schema_1.ApprovalStatus.REJECTED,
            isActive: false,
            ...(reason ? { rejectionReason: reason } : {}),
        }, { new: true })
            .populate('ownerId', 'name email phoneNumber')
            .populate('agentId', 'name email agency')
            .lean()
            .exec();
        this.logger.log(`Property ${id} rejected by admin ${admin._id}. Reason: ${reason ?? 'none'}`);
        return updated;
    }
    async remove(id, user) {
        try {
            const property = await this.propertyModel
                .findById(id)
                .select('ownerId')
                .lean()
                .exec();
            if (!property)
                throw new common_1.NotFoundException('Property not found');
            if (user.role !== user_schema_1.UserRole.ADMIN &&
                property.ownerId.toString() !== user._id.toString()) {
                throw new common_1.ForbiddenException('You can only delete your own properties');
            }
            await this.propertyModel.findByIdAndDelete(id);
            this.cacheInvalidate(`similar_${id}`);
            this.cacheInvalidate('popular_cities');
            this.logger.log(`Property deleted: ${id} by user ${user._id}`);
        }
        catch (error) {
            this.logger.error(`Error deleting property ${id}:`, error);
            throw error;
        }
    }
    async uploadImages(propertyId, files, user) {
        const property = await this.propertyModel.findById(propertyId);
        if (!property)
            throw new common_1.NotFoundException('Property not found');
        this.assertCanManage(property, user);
        const uploads = await Promise.all(files.map(async (file, index) => {
            const watermarkedBuffer = await this.watermarkService.applyWatermark(file.buffer);
            const publicId = `property_${propertyId}_${Date.now()}_${index}`;
            const result = await (0, cloudinary_1.uploadBufferToCloudinary)(watermarkedBuffer, {
                publicId,
                folder: 'horohouse/properties/images',
                resourceType: 'image',
                transformation: [{ quality: 'auto', fetch_format: 'auto' }],
            });
            return { url: result.secure_url, publicId: result.public_id };
        }));
        property.images = [...(property.images || []), ...uploads];
        await property.save();
        return property;
    }
    async deleteImage(propertyId, imagePublicId, user) {
        const property = await this.propertyModel.findById(propertyId);
        if (!property)
            throw new common_1.NotFoundException('Property not found');
        this.assertCanManage(property, user);
        await (0, cloudinary_1.deleteFromCloudinary)(imagePublicId, 'image');
        property.images = (property.images || []).filter((img) => img.publicId !== imagePublicId);
        await property.save();
        return property;
    }
    async uploadVideos(propertyId, files, user) {
        const property = await this.propertyModel.findById(propertyId);
        if (!property)
            throw new common_1.NotFoundException('Property not found');
        this.assertCanManage(property, user);
        const uploads = await Promise.all(files.map(async (file, index) => {
            const publicId = `property_${propertyId}_video_${Date.now()}_${index}`;
            const result = await (0, cloudinary_1.uploadBufferToCloudinary)(file.buffer, {
                publicId,
                folder: 'horohouse/properties/videos',
                resourceType: 'video',
                transformation: [{ quality: 'auto' }],
            });
            return { url: result.secure_url, publicId: result.public_id };
        }));
        property.videos = [...((property.videos) || []), ...uploads];
        await property.save();
        return property;
    }
    async deleteVideo(propertyId, videoPublicId, user) {
        const property = await this.propertyModel.findById(propertyId);
        if (!property)
            throw new common_1.NotFoundException('Property not found');
        this.assertCanManage(property, user);
        await (0, cloudinary_1.deleteFromCloudinary)(videoPublicId, 'video');
        property.videos = (property.videos || []).filter((vid) => vid.publicId !== videoPublicId);
        await property.save();
        return property;
    }
    async getMostViewed(limit = 10) {
        const key = `most_viewed_${limit}`;
        const cached = this.cacheGet(key);
        if (cached)
            return cached;
        const result = await this.propertyModel
            .find({ isActive: true, availability: property_schema_1.PropertyStatus.ACTIVE })
            .select(this.listingProjection())
            .sort({ viewsCount: -1 })
            .limit(limit)
            .populate('ownerId', 'name profilePicture')
            .populate('agentId', 'name profilePicture agency')
            .lean()
            .exec();
        this.cacheSet(key, result, this.CACHE_TTL_MS);
        return result;
    }
    async getRecent(limit = 10) {
        const key = `recent_${limit}`;
        const cached = this.cacheGet(key);
        if (cached)
            return cached;
        const result = await this.propertyModel
            .find({ isActive: true, availability: property_schema_1.PropertyStatus.ACTIVE })
            .select(this.listingProjection())
            .sort({ createdAt: -1 })
            .limit(limit)
            .populate('ownerId', 'name profilePicture')
            .populate('agentId', 'name profilePicture agency')
            .lean()
            .exec();
        this.cacheSet(key, result, this.CACHE_TTL_MS);
        return result;
    }
    async getFeatured(limit = 10) {
        const key = `featured_${limit}`;
        const cached = this.cacheGet(key);
        if (cached)
            return cached;
        const result = await this.propertyModel
            .find({ isActive: true, isFeatured: true, availability: property_schema_1.PropertyStatus.ACTIVE })
            .select(this.listingProjection())
            .sort({ createdAt: -1 })
            .limit(limit)
            .populate('ownerId', 'name profilePicture')
            .populate('agentId', 'name profilePicture agency')
            .lean()
            .exec();
        this.cacheSet(key, result, this.FEATURED_TTL_MS);
        return result;
    }
    async getPopularCities(limit = 10) {
        const key = `popular_cities_${limit}`;
        const cached = this.cacheGet(key);
        if (cached)
            return cached;
        const result = await this.propertyModel.aggregate([
            { $match: { isActive: true, availability: property_schema_1.PropertyStatus.ACTIVE } },
            { $group: { _id: '$city', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: limit },
            { $project: { _id: 0, city: '$_id', count: 1 } },
        ]);
        this.cacheSet(key, result, this.POPULAR_CITIES_TTL_MS);
        return result;
    }
    async getSimilarProperties(propertyId, limit = 6) {
        const cacheKey = `similar_${propertyId}_${limit}`;
        const cached = this.cacheGet(cacheKey);
        if (cached)
            return cached;
        try {
            if (!mongoose_2.Types.ObjectId.isValid(propertyId)) {
                throw new common_1.BadRequestException('Invalid property ID format');
            }
            const property = await this.propertyModel
                .findById(propertyId)
                .select('type city price listingType location')
                .lean()
                .exec();
            if (!property)
                throw new common_1.NotFoundException('Property not found');
            const priceMin = property.price * 0.7;
            const priceMax = property.price * 1.3;
            const baseExclude = { _id: { $ne: property._id }, isActive: true, availability: property_schema_1.PropertyStatus.ACTIVE };
            const cityFilter = property.city
                ? { city: { $regex: new RegExp(`^${property.city.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } }
                : {};
            const listingFilter = property.listingType ? { listingType: property.listingType } : {};
            const typeFilter = property.type ? { type: property.type } : {};
            const priceFilter = { price: { $gte: priceMin, $lte: priceMax } };
            const populate = [
                { path: 'ownerId', select: 'name profilePicture' },
                { path: 'agentId', select: 'name profilePicture agency' },
            ];
            const loc = property.location?.coordinates;
            const hasValidLocation = Array.isArray(loc) &&
                loc.length === 2 &&
                loc[0] !== 0 &&
                loc[1] !== 0;
            const [geoResults, strictResults, relaxedResults, fallbackResults] = await Promise.all([
                hasValidLocation
                    ? this.propertyModel
                        .find({
                        ...baseExclude,
                        ...cityFilter,
                        ...listingFilter,
                        ...typeFilter,
                        ...priceFilter,
                        location: {
                            $near: {
                                $geometry: { type: 'Point', coordinates: loc },
                                $maxDistance: 10_000,
                            },
                        },
                    })
                        .select(this.listingProjection())
                        .populate(populate)
                        .limit(limit)
                        .lean()
                        .exec()
                        .catch(() => [])
                    : Promise.resolve([]),
                this.propertyModel
                    .find({ ...baseExclude, ...cityFilter, ...listingFilter, ...typeFilter, ...priceFilter })
                    .select(this.listingProjection())
                    .populate(populate)
                    .sort({ createdAt: -1 })
                    .limit(limit)
                    .lean()
                    .exec(),
                this.propertyModel
                    .find({ ...baseExclude, ...cityFilter, ...listingFilter, ...typeFilter })
                    .select(this.listingProjection())
                    .populate(populate)
                    .sort({ createdAt: -1 })
                    .limit(limit)
                    .lean()
                    .exec(),
                this.propertyModel
                    .find({ ...baseExclude, ...cityFilter, ...listingFilter })
                    .select(this.listingProjection())
                    .populate(populate)
                    .sort({ createdAt: -1 })
                    .limit(limit)
                    .lean()
                    .exec(),
            ]);
            const seen = new Set();
            const merged = [];
            for (const batch of [geoResults, strictResults, relaxedResults, fallbackResults]) {
                for (const p of batch) {
                    const idStr = p._id.toString();
                    if (!seen.has(idStr)) {
                        seen.add(idStr);
                        merged.push(p);
                    }
                    if (merged.length >= limit)
                        break;
                }
                if (merged.length >= limit)
                    break;
            }
            const result = merged.slice(0, limit);
            this.cacheSet(cacheKey, result, this.CACHE_TTL_MS);
            return result;
        }
        catch (error) {
            if (error instanceof common_1.NotFoundException || error instanceof common_1.BadRequestException)
                throw error;
            this.logger.error(`Error finding similar properties for ${propertyId}:`, error);
            return [];
        }
    }
    async getUserFavorites(userId, options = {}) {
        try {
            const { page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc' } = options;
            const skip = (page - 1) * limit;
            const userDoc = await this.userModel.findById(userId).select('favorites').lean().exec();
            if (!userDoc)
                throw new common_1.NotFoundException('User not found');
            const favoriteIds = userDoc.favorites || [];
            const total = favoriteIds.length;
            if (total === 0)
                return { properties: [], total: 0, page, totalPages: 0 };
            const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };
            const properties = await this.propertyModel
                .find({ _id: { $in: favoriteIds }, isActive: true })
                .select(this.listingProjection())
                .populate('ownerId', 'name email phoneNumber profilePicture')
                .populate('agentId', 'name email phoneNumber profilePicture agency')
                .sort(sort)
                .skip(skip)
                .limit(limit)
                .lean()
                .exec();
            return {
                properties,
                total,
                page,
                totalPages: Math.ceil(total / limit),
            };
        }
        catch (error) {
            this.logger.error(`Error getting user favorites for ${userId}:`, error);
            throw error;
        }
    }
    async getMyProperties(filters = {}, options = {}, userId) {
        try {
            const { page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc', includeInactive = true } = options;
            const skip = (page - 1) * limit;
            const userObjectId = new mongoose_2.Types.ObjectId(userId);
            const query = {
                $or: [{ ownerId: userObjectId }, { agentId: userObjectId }],
            };
            if (!includeInactive) {
                query.isActive = true;
                query.availability = property_schema_1.PropertyStatus.ACTIVE;
            }
            if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
                query.price = {};
                if (filters.minPrice !== undefined)
                    query.price.$gte = filters.minPrice;
                if (filters.maxPrice !== undefined)
                    query.price.$lte = filters.maxPrice;
            }
            if (filters.propertyType)
                query.type = filters.propertyType;
            if (filters.listingType)
                query.listingType = filters.listingType;
            if (filters.city)
                query.city = filters.city.trim().toLowerCase();
            if (filters.bedrooms)
                query['amenities.bedrooms'] = { $gte: filters.bedrooms };
            if (filters.bathrooms)
                query['amenities.bathrooms'] = { $gte: filters.bathrooms };
            if (filters.amenities?.length) {
                query.$and = filters.amenities.map((a) => ({ [`amenities.${a}`]: true }));
            }
            const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };
            const [properties, total] = await Promise.all([
                this.propertyModel
                    .find(query)
                    .select(this.listingProjection())
                    .populate('ownerId', 'name email phoneNumber profilePicture')
                    .populate('agentId', 'name email phoneNumber profilePicture agency')
                    .sort(sort)
                    .skip(skip)
                    .limit(limit)
                    .lean()
                    .exec(),
                this.propertyModel.countDocuments(query),
            ]);
            return {
                properties: properties,
                total,
                page,
                totalPages: Math.ceil(total / limit),
            };
        }
        catch (error) {
            this.logger.error(`Error getting user properties for ${userId}:`, error);
            throw error;
        }
    }
    async geocodeAddress(address, city, country) {
        try {
            const query = [address, city, country].filter(Boolean).join(', ');
            const response = await axios_1.default.get('https://nominatim.openstreetmap.org/search', {
                params: { q: query, format: 'json', limit: 1 },
                headers: { 'User-Agent': 'HoroHouse-Backend/1.0' },
                timeout: 5000,
            });
            if (response.data?.length > 0) {
                return {
                    latitude: parseFloat(response.data[0].lat),
                    longitude: parseFloat(response.data[0].lon),
                };
            }
            this.logger.warn(`Geocoding returned no results for: ${query}`);
            return null;
        }
        catch (error) {
            this.logger.error('Geocoding failed:', error);
            return null;
        }
    }
    async searchByText(searchText, filters = {}, options = {}, user) {
        try {
            const query = {
                $text: { $search: searchText },
                isActive: true,
                availability: property_schema_1.PropertyStatus.ACTIVE,
                ...this.buildFilterQuery(filters),
            };
            const { page = 1, limit = 20, sortBy = 'score' } = options;
            const skip = (page - 1) * limit;
            const sort = sortBy === 'score'
                ? { score: { $meta: 'textScore' } }
                : { [sortBy]: options.sortOrder === 'asc' ? 1 : -1 };
            const [properties, total] = await Promise.all([
                this.propertyModel
                    .find(query, { score: { $meta: 'textScore' } })
                    .select(this.listingProjection())
                    .populate('ownerId', 'name profilePicture')
                    .populate('agentId', 'name profilePicture agency')
                    .sort(sort)
                    .skip(skip)
                    .limit(limit)
                    .lean(),
                this.propertyModel.countDocuments(query),
            ]);
            if (user) {
                this.historyService
                    .logActivity({
                    userId: user._id,
                    activityType: history_schema_1.ActivityType.SEARCH,
                    searchQuery: searchText,
                    searchFilters: filters,
                    resultsCount: total,
                })
                    .catch((e) => this.logger.error('History log failed', e));
            }
            return { properties, total, page, totalPages: Math.ceil(total / limit) };
        }
        catch (error) {
            this.logger.error('Text search failed:', error);
            throw error;
        }
    }
    async getShortTermListings(filters = {}, options = {}) {
        const { page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc' } = options;
        const skip = (page - 1) * limit;
        const query = {
            listingType: property_schema_1.ListingType.SHORT_TERM,
            isActive: true,
            approvalStatus: property_schema_1.ApprovalStatus.APPROVED,
            availability: property_schema_1.PropertyStatus.ACTIVE,
        };
        if (filters.city)
            query.city = filters.city.trim().toLowerCase();
        if (filters.propertyType)
            query.type = filters.propertyType;
        if (filters.pricingUnit)
            query.pricingUnit = filters.pricingUnit;
        if (filters.cancellationPolicy)
            query.cancellationPolicy = filters.cancellationPolicy;
        if (filters.isInstantBookable !== undefined)
            query.isInstantBookable = filters.isInstantBookable;
        if (filters.minGuests)
            query['shortTermAmenities.maxGuests'] = { $gte: filters.minGuests };
        if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
            query.price = {};
            if (filters.minPrice !== undefined)
                query.price.$gte = filters.minPrice;
            if (filters.maxPrice !== undefined)
                query.price.$lte = filters.maxPrice;
        }
        if (filters.latitude && filters.longitude && filters.radius) {
            query.location = {
                $near: {
                    $geometry: { type: 'Point', coordinates: [filters.longitude, filters.latitude] },
                    $maxDistance: filters.radius * 1000,
                },
            };
        }
        const availabilityPromise = filters.checkIn && filters.checkOut
            ? this.getBookedPropertyIds(filters.checkIn, filters.checkOut)
            : Promise.resolve([]);
        const bookedIds = await availabilityPromise;
        if (bookedIds.length > 0)
            query._id = { $nin: bookedIds };
        const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };
        const [properties, total] = await Promise.all([
            this.propertyModel
                .find(query)
                .select(this.listingProjection())
                .populate('ownerId', 'name email phoneNumber profilePicture')
                .populate('agentId', 'name email phoneNumber profilePicture agency')
                .sort(sort)
                .skip(skip)
                .limit(limit)
                .lean()
                .exec(),
            this.propertyModel.countDocuments(query),
        ]);
        return { properties: properties, total, page, totalPages: Math.ceil(total / limit) };
    }
    async blockDates(propertyId, dto, user) {
        const property = await this.propertyModel.findById(propertyId);
        if (!property)
            throw new common_1.NotFoundException('Property not found');
        this.assertCanManage(property, user);
        if (property.listingType !== property_schema_1.ListingType.SHORT_TERM) {
            throw new common_1.BadRequestException('Date blocking is only available for short-term listings');
        }
        const newRanges = dto.ranges.map((r) => {
            const from = new Date(r.from);
            const to = new Date(r.to);
            if (isNaN(from.getTime()) || isNaN(to.getTime())) {
                throw new common_1.BadRequestException(`Invalid date range: ${r.from} → ${r.to}`);
            }
            if (to < from) {
                throw new common_1.BadRequestException(`"to" must be after or equal to "from" in range: ${r.from} → ${r.to}`);
            }
            return { from, to, reason: r.reason };
        });
        const existingFromSet = new Set((property.unavailableDates ?? []).map((r) => r.from.toISOString()));
        const toAdd = newRanges.filter((r) => !existingFromSet.has(r.from.toISOString()));
        const updated = await this.propertyModel
            .findByIdAndUpdate(propertyId, { $push: { unavailableDates: { $each: toAdd } } }, { new: true })
            .lean()
            .exec();
        this.logger.log(`Blocked ${toAdd.length} date range(s) on property ${propertyId}`);
        return updated;
    }
    async unblockDates(propertyId, dto, user) {
        const property = await this.propertyModel.findById(propertyId).select('ownerId agentId listingType').lean().exec();
        if (!property)
            throw new common_1.NotFoundException('Property not found');
        this.assertCanManage(property, user);
        const fromDatesToRemove = dto.fromDates.map((d) => {
            const parsed = new Date(d);
            if (isNaN(parsed.getTime()))
                throw new common_1.BadRequestException(`Invalid date: ${d}`);
            return parsed;
        });
        const updated = await this.propertyModel
            .findByIdAndUpdate(propertyId, { $pull: { unavailableDates: { from: { $in: fromDatesToRemove } } } }, { new: true })
            .lean()
            .exec();
        this.logger.log(`Unblocked ${fromDatesToRemove.length} date range(s) on property ${propertyId}`);
        return updated;
    }
    async getBlockedDates(propertyId) {
        if (!mongoose_2.Types.ObjectId.isValid(propertyId))
            throw new common_1.BadRequestException('Invalid property ID');
        const property = await this.propertyModel
            .findById(propertyId)
            .select('unavailableDates listingType')
            .lean()
            .exec();
        if (!property)
            throw new common_1.NotFoundException('Property not found');
        return { unavailableDates: property.unavailableDates ?? [] };
    }
    async getCalendarSettings(propertyId, user) {
        if (!mongoose_2.Types.ObjectId.isValid(propertyId))
            throw new common_1.BadRequestException('Invalid property ID');
        const property = await this.propertyModel.findById(propertyId).exec();
        if (!property)
            throw new common_1.NotFoundException('Property not found');
        this.assertCanManage(property, user);
        const baseUrl = process.env.API_URL || process.env.BACKEND_URL || 'https://horohouse.com/api';
        return {
            basePrice: property.price ?? 0,
            weekendPrice: property.weekendPrice ?? null,
            priceOverrides: property.priceOverrides ?? {},
            minNights: property.minNights ?? 1,
            maxNights: property.maxNights ?? null,
            noticeDays: property.noticeDays ?? 0,
            windowMonths: property.windowMonths ?? 12,
            externalCalendars: property.externalCalendars ?? [],
            exportUrl: `${baseUrl}/properties/${propertyId}/calendar.ics`,
        };
    }
    async updateCalendarSettings(propertyId, dto, user) {
        if (!mongoose_2.Types.ObjectId.isValid(propertyId))
            throw new common_1.BadRequestException('Invalid property ID');
        const property = await this.propertyModel.findById(propertyId).exec();
        if (!property)
            throw new common_1.NotFoundException('Property not found');
        this.assertCanManage(property, user);
        const update = {};
        if (dto.basePrice !== undefined)
            update.price = dto.basePrice;
        if (dto.weekendPrice !== undefined)
            update.weekendPrice = dto.weekendPrice;
        if (dto.minNights !== undefined)
            update.minNights = dto.minNights;
        if (dto.maxNights !== undefined)
            update.maxNights = dto.maxNights;
        if (dto.noticeDays !== undefined)
            update.noticeDays = dto.noticeDays;
        if (dto.windowMonths !== undefined)
            update.windowMonths = dto.windowMonths;
        await this.propertyModel.findByIdAndUpdate(propertyId, { $set: update }, { new: true }).exec();
        this.cacheInvalidate(`property_${propertyId}`);
        this.cacheInvalidate(`similar_${propertyId}`);
        this.cacheInvalidate('featured_');
        this.cacheInvalidate('recent_');
        return this.getCalendarSettings(propertyId, user);
    }
    async setCalendarPrices(propertyId, dto, user) {
        if (!mongoose_2.Types.ObjectId.isValid(propertyId))
            throw new common_1.BadRequestException('Invalid property ID');
        const property = await this.propertyModel.findById(propertyId).exec();
        if (!property)
            throw new common_1.NotFoundException('Property not found');
        this.assertCanManage(property, user);
        const start = new Date(dto.from);
        const end = new Date(dto.to);
        if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) {
            throw new common_1.BadRequestException('Invalid date range');
        }
        const priceOverrides = { ...(property.priceOverrides || {}) };
        const cur = new Date(start);
        while (cur <= end) {
            const key = cur.toISOString().split('T')[0];
            if (dto.price === null || dto.price === undefined) {
                delete priceOverrides[key];
            }
            else {
                priceOverrides[key] = dto.price;
            }
            cur.setDate(cur.getDate() + 1);
        }
        await this.propertyModel.findByIdAndUpdate(propertyId, { $set: { priceOverrides } }, { new: true }).exec();
        return { priceOverrides };
    }
    async addExternalCalendar(propertyId, dto, user) {
        if (!mongoose_2.Types.ObjectId.isValid(propertyId))
            throw new common_1.BadRequestException('Invalid property ID');
        const property = await this.propertyModel.findById(propertyId).exec();
        if (!property)
            throw new common_1.NotFoundException('Property not found');
        this.assertCanManage(property, user);
        const newCalendar = {
            id: new mongoose_2.Types.ObjectId().toString(),
            name: dto.name,
            url: dto.url,
            lastSyncedAt: new Date(),
        };
        await this.propertyModel.findByIdAndUpdate(propertyId, { $push: { externalCalendars: newCalendar } }, { new: true }).exec();
        return newCalendar;
    }
    async removeExternalCalendar(propertyId, calendarId, user) {
        if (!mongoose_2.Types.ObjectId.isValid(propertyId))
            throw new common_1.BadRequestException('Invalid property ID');
        const property = await this.propertyModel.findById(propertyId).exec();
        if (!property)
            throw new common_1.NotFoundException('Property not found');
        this.assertCanManage(property, user);
        await this.propertyModel.findByIdAndUpdate(propertyId, { $pull: { externalCalendars: { id: calendarId } } }, { new: true }).exec();
        return { success: true };
    }
    async getShortTermById(propertyId) {
        if (!mongoose_2.Types.ObjectId.isValid(propertyId))
            throw new common_1.BadRequestException('Invalid property ID');
        const property = await this.propertyModel
            .findOne({
            _id: new mongoose_2.Types.ObjectId(propertyId),
            listingType: property_schema_1.ListingType.SHORT_TERM,
            isActive: true,
            approvalStatus: property_schema_1.ApprovalStatus.APPROVED,
        })
            .populate('ownerId', 'name email phoneNumber profilePicture')
            .populate('agentId', 'name email phoneNumber profilePicture agency')
            .lean()
            .exec();
        if (!property)
            throw new common_1.NotFoundException('Short-term property not found');
        return {
            ...property,
            shortTermSummary: {
                pricePerNight: property.pricingUnit === 'nightly' ? property.price : null,
                pricingUnit: property.pricingUnit,
                minNights: property.minNights,
                maxNights: property.maxNights,
                cleaningFee: property.cleaningFee,
                isInstantBookable: property.isInstantBookable,
                cancellationPolicy: property.cancellationPolicy,
                checkInTime: property.shortTermAmenities?.checkInTime,
                checkOutTime: property.shortTermAmenities?.checkOutTime,
                maxGuests: property.shortTermAmenities?.maxGuests,
                advanceNoticeDays: property.advanceNoticeDays,
                bookingWindowDays: property.bookingWindowDays,
            },
        };
    }
    async trackTourView(propertyId) {
        if (!mongoose_2.Types.ObjectId.isValid(propertyId))
            return;
        await this.propertyModel.findByIdAndUpdate(propertyId, { $inc: { tourViews: 1 } }).exec();
    }
    listingProjection() {
        return {
            title: 1,
            slug: 1,
            description: 1,
            price: 1,
            originalPrice: 1,
            pricingUnit: 1,
            type: 1,
            listingType: 1,
            weeklyDiscountPercent: 1,
            monthlyDiscountPercent: 1,
            customDiscountNights: 1,
            customDiscountPercent: 1,
            city: 1,
            address: 1,
            neighborhood: 1,
            country: 1,
            images: 1,
            amenities: 1,
            shortTermAmenities: 1,
            isInstantBookable: 1,
            cancellationPolicy: 1,
            isFeatured: 1,
            viewsCount: 1,
            location: 1,
            latitude: 1,
            longitude: 1,
            approvalStatus: 1,
            isActive: 1,
            availability: 1,
            averageRating: 1,
            reviewCount: 1,
            starRating: 1,
            ownerId: 1,
            agentId: 1,
            createdAt: 1,
            area: 1,
            floorNumber: 1,
            totalFloors: 1,
            depositAmount: 1,
            maintenanceFee: 1,
            contactPhone: 1,
            contactWhatsApp: 1,
            contactEmail: 1,
            yearBuilt: 1,
            pricePerSqm: 1,
        };
    }
    buildBaseListQuery(filters, includeInactive) {
        const query = {};
        if (!includeInactive) {
            query.isActive = true;
            query.approvalStatus = property_schema_1.ApprovalStatus.APPROVED;
            query.availability = property_schema_1.PropertyStatus.ACTIVE;
        }
        if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
            query.price = {};
            if (filters.minPrice !== undefined)
                query.price.$gte = filters.minPrice;
            if (filters.maxPrice !== undefined)
                query.price.$lte = filters.maxPrice;
        }
        if (filters.propertyType)
            query.type = filters.propertyType;
        if (filters.listingType)
            query.listingType = filters.listingType;
        if (filters.city)
            query.city = filters.city.trim().toLowerCase();
        if (filters.neighborhood)
            query.neighborhood = new RegExp(filters.neighborhood.trim(), 'i');
        if (filters.bedrooms)
            query['amenities.bedrooms'] = { $gte: filters.bedrooms };
        if (filters.bathrooms)
            query['amenities.bathrooms'] = { $gte: filters.bathrooms };
        if (filters.furnished !== undefined)
            query['amenities.furnished'] = filters.furnished;
        if (filters.amenities?.length) {
            query.$and = filters.amenities.map((a) => ({ [`amenities.${a}`]: true }));
        }
        if (filters.isInstantBookable !== undefined)
            query.isInstantBookable = filters.isInstantBookable;
        if (filters.pricingUnit)
            query.pricingUnit = filters.pricingUnit;
        if (filters.cancellationPolicy)
            query.cancellationPolicy = filters.cancellationPolicy;
        if (filters.minGuests)
            query['shortTermAmenities.maxGuests'] = { $gte: filters.minGuests };
        if (filters.minArea !== undefined || filters.maxArea !== undefined) {
            query.area = {};
            if (filters.minArea !== undefined)
                query.area.$gte = filters.minArea;
            if (filters.maxArea !== undefined)
                query.area.$lte = filters.maxArea;
        }
        if (filters.latitude && filters.longitude) {
            if (filters.radius) {
                query.location = {
                    $near: {
                        $geometry: { type: 'Point', coordinates: [filters.longitude, filters.latitude] },
                        $maxDistance: filters.radius * 1000,
                    },
                };
            }
        }
        if (filters.bounds) {
            const { northeast, southwest } = filters.bounds;
            query.location = {
                $geoWithin: {
                    $box: [
                        [southwest.lng, southwest.lat],
                        [northeast.lng, northeast.lat],
                    ],
                },
            };
        }
        return query;
    }
    buildFilterQuery(filters) {
        const query = {};
        if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
            query.price = {};
            if (filters.minPrice !== undefined)
                query.price.$gte = filters.minPrice;
            if (filters.maxPrice !== undefined)
                query.price.$lte = filters.maxPrice;
        }
        if (filters.propertyType)
            query.type = filters.propertyType;
        if (filters.listingType)
            query.listingType = filters.listingType;
        if (filters.city)
            query.city = filters.city.trim().toLowerCase();
        if (filters.bedrooms)
            query['amenities.bedrooms'] = { $gte: filters.bedrooms };
        if (filters.bathrooms)
            query['amenities.bathrooms'] = { $gte: filters.bathrooms };
        return query;
    }
    fireAnalytics(user, filters, total) {
        this.historyService
            .logActivity({
            userId: user._id,
            activityType: history_schema_1.ActivityType.SEARCH,
            searchQuery: JSON.stringify(filters),
            searchFilters: filters,
            resultsCount: total,
            userLocation: filters.latitude && filters.longitude
                ? { type: 'Point', coordinates: [filters.longitude, filters.latitude] }
                : undefined,
            city: filters.city,
        })
            .catch((e) => this.logger.error('History log failed', e));
        this.userInteractionsService
            .trackInteraction({
            userId: user._id,
            interactionType: user_interaction_schema_1.InteractionType.SEARCH,
            source: user_interaction_schema_1.InteractionSource.SEARCH_RESULTS,
            city: filters.city,
            metadata: { searchFilters: filters, resultsCount: total },
            location: filters.latitude && filters.longitude
                ? { type: 'Point', coordinates: [filters.longitude, filters.latitude] }
                : undefined,
        })
            .catch((e) => this.logger.error('Interaction track failed', e));
    }
    async updateRecentlyViewed(userId, propertyId) {
        try {
            await this.userModel.updateOne({ _id: userId }, { $pull: { recentlyViewed: { propertyId } } });
            await this.userModel.updateOne({ _id: userId }, {
                $push: {
                    recentlyViewed: {
                        $each: [{ propertyId, viewedAt: new Date() }],
                        $position: 0,
                        $slice: 50
                    }
                }
            });
        }
        catch (error) {
            this.logger.error('Failed to update recently viewed:', error);
        }
    }
    async getBookedPropertyIds(checkIn, checkOut) {
        try {
            const bookingModel = this.propertyModel.db.model('Booking');
            if (!bookingModel)
                return [];
            const bookings = await bookingModel
                .find({
                status: { $in: ['confirmed', 'pending'] },
                checkIn: { $lt: checkOut },
                checkOut: { $gt: checkIn },
            })
                .select('propertyId')
                .lean()
                .exec();
            return bookings.map((b) => b.propertyId);
        }
        catch {
            this.logger.warn('Booking model not available — skipping availability filter');
            return [];
        }
    }
    isValidCoordinate(lat, lng) {
        return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
    }
    generateSlug(title) {
        const base = title
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .trim();
        const suffix = Math.random().toString(36).slice(2, 7);
        return `${base}-${suffix}`;
    }
    generateKeywords(property) {
        const raw = [];
        if (property.title)
            raw.push(...property.title.toLowerCase().split(' '));
        if (property.description)
            raw.push(...property.description.toLowerCase().split(' '));
        if (property.city)
            raw.push(property.city.toLowerCase());
        if (property.neighborhood)
            raw.push(...property.neighborhood.toLowerCase().split(' '));
        if (property.type)
            raw.push(property.type.toString().toLowerCase());
        if (property.listingType) {
            raw.push(property.listingType.toString().toLowerCase());
            if (property.listingType === 'rent')
                raw.push('location', 'louer', 'rental');
            if (property.listingType === 'sale')
                raw.push('vente', 'vendre', 'acheter', 'sale');
            if (property.listingType === 'short_term')
                raw.push('sejour', 'nuit', 'hotel', 'airbnb');
        }
        if (property.amenities?.furnished)
            raw.push('meuble', 'furnished');
        return [...new Set(raw)].filter((k) => k.length > 2);
    }
    validateShortTermFields(dto) {
        if (!dto.pricingUnit) {
            throw new common_1.BadRequestException('pricingUnit is required for short-term listings');
        }
        if (dto.minNights && dto.maxNights && dto.minNights > dto.maxNights) {
            throw new common_1.BadRequestException('minNights cannot be greater than maxNights');
        }
        if (dto.shortTermAmenities?.checkInTime && !/^\d{2}:\d{2}$/.test(dto.shortTermAmenities.checkInTime)) {
            throw new common_1.BadRequestException('checkInTime must be in HH:mm format');
        }
        if (dto.shortTermAmenities?.checkOutTime && !/^\d{2}:\d{2}$/.test(dto.shortTermAmenities.checkOutTime)) {
            throw new common_1.BadRequestException('checkOutTime must be in HH:mm format');
        }
    }
    assertCanManage(property, user) {
        const isOwner = property.ownerId.toString() === user._id.toString();
        const isAgent = property.agentId?.toString() === user._id.toString();
        const isAdmin = user.role === user_schema_1.UserRole.ADMIN;
        if (!isOwner && !isAgent && !isAdmin) {
            throw new common_1.ForbiddenException('You can only manage your own properties');
        }
    }
};
exports.PropertiesService = PropertiesService;
exports.PropertiesService = PropertiesService = PropertiesService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(property_schema_1.Property.name)),
    __param(1, (0, mongoose_1.InjectModel)(user_schema_1.User.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Model,
        history_service_1.HistoryService,
        user_interactions_service_1.UserInteractionsService,
        watermark_service_1.WatermarkService])
], PropertiesService);
//# sourceMappingURL=properties.service.js.map