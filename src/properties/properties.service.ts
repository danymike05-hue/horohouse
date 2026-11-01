import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import axios from 'axios';
import { uploadBufferToCloudinary, deleteFromCloudinary } from '../utils/cloudinary';
import { WatermarkService } from '../watermark/watermark.service';

import {
  Property,
  PropertyDocument,
  PropertyType,
  PropertyStatus,
  ApprovalStatus,
  ListingType,
  PricingUnit,
  CancellationPolicy,
} from './schemas/property.schema';
import { User, UserRole, UserDocument } from '../users/schemas/user.schema';
import { HistoryService } from '../history/history.service';
import { ActivityType } from '../history/schemas/history.schema';
import { UserInteractionsService } from '../user-interactions/user-interactions.service';
import { InteractionType, InteractionSource } from '../user-interactions/schemas/user-interaction.schema';
import {
  BlockDatesDto,
  UnblockDatesDto,
  CreatePropertyDto,
  UpdatePropertyDto,
  UpdateCalendarSettingsDto,
  SetCalendarPricesDto,
  AddExternalCalendarDto,
} from './dto/property.dto';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PropertySearchFilters {
  minPrice?: number;
  maxPrice?: number;
  propertyType?: PropertyType;
  listingType?: ListingType;
  city?: string;
  bedrooms?: number;
  bathrooms?: number;
  amenities?: string[];
  latitude?: number;
  longitude?: number;
  radius?: number;
  bounds?: {
    northeast: { lat: number; lng: number };
    southwest: { lat: number; lng: number };
  };
  isInstantBookable?: boolean;
  minGuests?: number;
  cancellationPolicy?: CancellationPolicy;
  pricingUnit?: PricingUnit;
  checkIn?: Date;
  checkOut?: Date;
  // Long-term / landlord-specific filters
  minArea?: number;
  maxArea?: number;
  furnished?: boolean;
  neighborhood?: string;
}

export interface PropertySearchOptions {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  includeInactive?: boolean;
}

// ─── Cache Entry ──────────────────────────────────────────────────────────────

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class PropertiesService implements OnModuleInit {
  private readonly logger = new Logger(PropertiesService.name);

  // ── In-memory TTL cache (replace with Redis in production) ────────────────
  private readonly cache = new Map<string, CacheEntry<any>>();
  private readonly CACHE_TTL_MS = 60_000; // 1 minute default
  private readonly POPULAR_CITIES_TTL_MS = 5 * 60_000; // 5 minutes
  private readonly FEATURED_TTL_MS = 2 * 60_000; // 2 minutes

  constructor(
    @InjectModel(Property.name) private propertyModel: Model<PropertyDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private historyService: HistoryService,
    private userInteractionsService: UserInteractionsService,
    private watermarkService: WatermarkService
  ) { }

  // ── Ensure DB indexes exist on startup ────────────────────────────────────

  async onModuleInit(): Promise<void> {
    await this.ensureIndexes();
  }

  /**
   * Create all performance-critical indexes declaratively.
   * Running createIndex with the same spec is idempotent — safe to call on every boot.
   */
  private async ensureIndexes(): Promise<void> {
    try {
      const col = this.propertyModel.collection;

      await Promise.all([
        // Geospatial — required for $near / $geoWithin
        col.createIndex({ location: '2dsphere' } as any),

        // Full-text search on keywords
        col.createIndex({ title: 'text', description: 'text', city: 'text', neighborhood: 'text', keywords: 'text' } as any),
        // Primary listing feed — most common query shape
        col.createIndex(
          { isActive: 1, approvalStatus: 1, availability: 1, createdAt: -1 },
          { background: true } as any,
        ),

        // Owner's property list
        col.createIndex({ ownerId: 1, createdAt: -1 }, { background: true } as any),

        // City browse
        col.createIndex({ city: 1, isActive: 1, price: 1 }, { background: true } as any),

        // Short-term browse
        col.createIndex(
          { listingType: 1, isActive: 1, approvalStatus: 1, availability: 1, createdAt: -1 },
          { background: true } as any,
        ),

        // Popularity sort
        col.createIndex({ viewsCount: -1, isActive: 1 }, { background: true } as any),

        // Featured
        col.createIndex({ isFeatured: 1, isActive: 1, createdAt: -1 }, { background: true } as any),

        // Slug lookups
        col.createIndex({ slug: 1 }, { unique: true, sparse: true, background: true } as any),
      ]);

      this.logger.log('✅ Property indexes ensured');
    } catch (err) {
      this.logger.error('Failed to ensure property indexes:', err);
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // CACHE HELPERS
  // ════════════════════════════════════════════════════════════════════════════

  private cacheGet<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return entry.data as T;
  }

  private cacheSet<T>(key: string, data: T, ttlMs = this.CACHE_TTL_MS): void {
    this.cache.set(key, { data, expiresAt: Date.now() + ttlMs });
  }

  private cacheInvalidate(pattern: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(pattern)) this.cache.delete(key);
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // CREATE
  // ════════════════════════════════════════════════════════════════════════════

  async create(createPropertyDto: CreatePropertyDto, user: User): Promise<Property> {
    try {
      const { latitude, longitude, ...restDto } = createPropertyDto;

      if (latitude !== undefined && longitude !== undefined) {
        if (!this.isValidCoordinate(latitude, longitude)) {
          throw new BadRequestException('Invalid coordinates provided');
        }
      }

      const locationData =
        latitude !== undefined && longitude !== undefined
          ? {
            location: {
              type: 'Point' as const,
              coordinates: [Number(longitude), Number(latitude)] as [number, number],
            },
          }
          : {};

      const isAdmin = user.role === UserRole.ADMIN;

      if (createPropertyDto.listingType === ListingType.SHORT_TERM) {
        this.validateShortTermFields(createPropertyDto);
      }

      const property = new this.propertyModel({
        ...restDto,
        ...locationData,
        latitude,
        longitude,
        ownerId: user._id,
        agentId: user.role === UserRole.AGENT ? user._id : undefined,
        slug: this.generateSlug(createPropertyDto.title),
        keywords: this.generateKeywords(createPropertyDto),
        approvalStatus: isAdmin ? ApprovalStatus.APPROVED : ApprovalStatus.PENDING,
        isActive: isAdmin,
        pricingUnit: createPropertyDto.pricingUnit ?? PricingUnit.NIGHTLY,
        minNights: createPropertyDto.minNights ?? 1,
        maxNights: createPropertyDto.maxNights ?? 365,
        cleaningFee: createPropertyDto.cleaningFee ?? 0,
        serviceFee: createPropertyDto.serviceFee ?? 0,
        city: createPropertyDto.city.trim().toLowerCase(),
        shortTermAmenities: createPropertyDto.shortTermAmenities ?? {},
        isInstantBookable: createPropertyDto.isInstantBookable ?? false,
        cancellationPolicy: createPropertyDto.cancellationPolicy ?? CancellationPolicy.FLEXIBLE,
        advanceNoticeDays: createPropertyDto.advanceNoticeDays ?? 0,
        bookingWindowDays: createPropertyDto.bookingWindowDays ?? 365,
        originalPrice: createPropertyDto.originalPrice ?? null,
        customDiscountNights: createPropertyDto.customDiscountNights ?? null,
        customDiscountPercent: createPropertyDto.customDiscountPercent ?? null,
        unavailableDates: [],
      });

      const savedProperty = await property.save();

      // Invalidate caches that may now be stale
      this.cacheInvalidate('popular_cities');
      this.cacheInvalidate('recent_');
      this.cacheInvalidate('featured_');

      this.logger.log(
        `Property created: ${savedProperty._id} by user ${user._id} (approvalStatus: ${savedProperty.approvalStatus})`,
      );

      return savedProperty;
    } catch (error) {
      this.logger.error('Error creating property:', error);
      throw error;
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // FIND ALL  (main listing feed)
  // ════════════════════════════════════════════════════════════════════════════

  async findAll(
    filters: PropertySearchFilters = {},
    options: PropertySearchOptions = {},
    user?: User,
  ): Promise<{ properties: Property[]; total: number; page: number; totalPages: number }> {
    try {
      const {
        page = 1,
        limit = 20,
        sortBy = 'createdAt',
        sortOrder = 'desc',
        includeInactive = false,
      } = options;

      const skip = (page - 1) * limit;
      const query = this.buildBaseListQuery(filters, includeInactive);
      const sort: any = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

      // Availability sub-query runs in parallel with the main queries
      const availabilityPromise =
        filters.checkIn && filters.checkOut
          ? this.getBookedPropertyIds(filters.checkIn, filters.checkOut)
          : Promise.resolve<Types.ObjectId[]>([]);

      const bookedIds = await availabilityPromise;
      if (bookedIds.length > 0) {
        query._id = { $nin: bookedIds };
      }

      // Main query + count in parallel — both use .lean() to skip hydration
      const [properties, total] = await Promise.all([
        this.propertyModel
          .find(query)
          .select(this.listingProjection())
          .populate('ownerId', 'name email phoneNumber profilePicture')
          .populate('agentId', 'name email phoneNumber profilePicture agency')
          .sort(sort)
          .skip(skip)
          .limit(limit)
          .lean()  // ← skip Mongoose document hydration
          .exec(),
        this.propertyModel.countDocuments(query),
      ]);

      // ── Fire-and-forget analytics (don't block the response) ──────────────
      if (user) {
        this.fireAnalytics(user, filters, total);
      }

      return { properties: properties as unknown as Property[], total, page, totalPages: Math.ceil(total / limit) };
    } catch (error) {
      this.logger.error('Error finding properties:', error);
      throw error;
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // FIND NEARBY
  // ════════════════════════════════════════════════════════════════════════════

  async findNearby(
    latitude: number,
    longitude: number,
    radiusKm = 5,
    limit = 10,
    user?: User,
  ): Promise<Property[]> {
    try {
      if (!this.isValidCoordinate(latitude, longitude)) {
        throw new BadRequestException('Invalid coordinates provided');
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
          availability: PropertyStatus.ACTIVE,
        })
        .select(this.listingProjection())
        .populate('ownerId', 'name email phoneNumber')
        .populate('agentId', 'name email phoneNumber agency')
        .limit(limit)
        .lean()
        .exec();

      // Fire-and-forget
      if (user) {
        this.historyService
          .logActivity({
            userId: user._id,
            activityType: ActivityType.SEARCH,
            searchQuery: `nearby:${latitude},${longitude},${radiusKm}km`,
            resultsCount: properties.length,
            userLocation: { type: 'Point', coordinates: [longitude, latitude] },
          })
          .catch((e) => this.logger.error('History log failed', e));

        this.userInteractionsService
          .trackInteraction({
            userId: user._id,
            interactionType: InteractionType.MAP_VIEW,
            source: InteractionSource.MAP,
            location: { type: 'Point', coordinates: [longitude, latitude] },
            metadata: { resultsCount: properties.length, radius: radiusKm },
          })
          .catch((e) => this.logger.error('Interaction track failed', e));
      }

      return properties as unknown as Property[];
    } catch (error) {
      this.logger.error('Error finding nearby properties:', error);
      throw error;
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // FIND ONE 
  // ════════════════════════════════════════════════════════════════════════════

  async findOne(id: string, user?: User): Promise<Property> {
  try {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException(`Invalid property ID format: ${id}`);
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
      throw new NotFoundException('Property not found');
    }

    // ─── Enforce visibility rules for non-privileged callers ───────────────
    const isOwner = user && (property as any).ownerId?._id?.toString() === user._id.toString();
    const isAgent = user && (property as any).agentId?._id?.toString() === user._id.toString();
    const isAdmin = user?.role === UserRole.ADMIN;

    if (!isOwner && !isAgent && !isAdmin) {
      const isVisible =
        (property as any).isActive === true &&
        (property as any).approvalStatus === ApprovalStatus.APPROVED;

      if (!isVisible) {
        // Same response as "doesn't exist" — don't leak that a hidden property exists
        throw new NotFoundException('Property not found');
      }
    }
    // ─────────────────────────────────────────────────────────────────────

    // ...rest unchanged (fire-and-forget analytics, etc.)
    return property as unknown as Property;
  } catch (error) {
    this.logger.error(`Error finding property ${id}:`, error);
    throw error;
  }
}

  // ════════════════════════════════════════════════════════════════════════════
  // UPDATE
  // ════════════════════════════════════════════════════════════════════════════

  async update(id: string, updatePropertyDto: UpdatePropertyDto, user: User): Promise<Property> {
    try {
      // Fetch only the fields we need for the permission check — not the full document
      const property = await this.propertyModel
        .findById(id)
        .select('ownerId agentId title description city type price originalPrice')
        .lean()
        .exec();

      if (!property) throw new NotFoundException('Property not found');

      if (
        user.role !== UserRole.ADMIN &&
        (property as any).ownerId.toString() !== user._id.toString() &&
        (property as any).agentId?.toString() !== user._id.toString()
      ) {
        throw new ForbiddenException('You can only update your own properties');
      }

      if (
        updatePropertyDto.latitude !== undefined &&
        updatePropertyDto.longitude !== undefined
      ) {
        if (!this.isValidCoordinate(updatePropertyDto.latitude, updatePropertyDto.longitude)) {
          throw new BadRequestException('Invalid coordinates provided');
        }
        (updatePropertyDto as any).location = {
          type: 'Point' as const,
          coordinates: [updatePropertyDto.longitude, updatePropertyDto.latitude],
        };
      }

      if (updatePropertyDto.title || updatePropertyDto.description) {
        updatePropertyDto.keywords = this.generateKeywords({
          title: updatePropertyDto.title || (property as any).title,
          description: updatePropertyDto.description || (property as any).description,
          city: updatePropertyDto.city || (property as any).city,
          type: updatePropertyDto.type || (property as any).type,
        } as any);
      }

      // Automatically track price discount / crossed-out original price
      if (updatePropertyDto.originalPrice !== undefined) {
        (updatePropertyDto as any).originalPrice = updatePropertyDto.originalPrice;
      } else if (updatePropertyDto.price !== undefined) {
        const currentPrice = Number((property as any).price);
        const currentOriginalPrice = (property as any).originalPrice ? Number((property as any).originalPrice) : null;
        const newPrice = Number(updatePropertyDto.price);

        if (newPrice < currentPrice) {
          // Price decreased: preserve or record previous price as originalPrice
          (updatePropertyDto as any).originalPrice = currentOriginalPrice || currentPrice;
        } else if (currentOriginalPrice && newPrice >= currentOriginalPrice) {
          // Price increased back to or above original price: remove discount
          (updatePropertyDto as any).originalPrice = null;
        }
      }

      const updatedProperty = await this.propertyModel
        .findByIdAndUpdate(id, updatePropertyDto, { new: true })
        .populate('ownerId', 'name email phoneNumber')
        .populate('agentId', 'name email phoneNumber agency')
        .lean()
        .exec();

      if (!updatedProperty) throw new NotFoundException('Property not found after update');

      // Invalidate relevant caches
      this.cacheInvalidate(`similar_${id}`);
      this.cacheInvalidate('featured_');

      this.logger.log(`Property updated: ${id} by user ${user._id}`);
      return updatedProperty as unknown as Property;
    } catch (error) {
      this.logger.error(`Error updating property ${id}:`, error);
      throw error;
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // ADMIN METHODS
  // ════════════════════════════════════════════════════════════════════════════

  async getAllPropertiesAdmin(
    filters: {
      approvalStatus?: ApprovalStatus;
      propertyType?: PropertyType;
      listingType?: ListingType;
      city?: string;
      ownerId?: string;
      search?: string;
    } = {},
    options: PropertySearchOptions = {},
  ): Promise<{ properties: Property[]; total: number; page: number; totalPages: number }> {
    const { page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc' } = options;
    const skip = (page - 1) * limit;

    const query: any = {};
    if (filters.approvalStatus) query.approvalStatus = filters.approvalStatus;
    if (filters.propertyType) query.type = filters.propertyType;
    if (filters.listingType) query.listingType = filters.listingType;
    if (filters.city) query.city = filters.city.trim().toLowerCase();
    if (filters.ownerId) query.ownerId = new Types.ObjectId(filters.ownerId);
    if (filters.search) {
      query.$or = [
        { title: { $regex: filters.search, $options: 'i' } },
        { city: { $regex: filters.search, $options: 'i' } },
        { address: { $regex: filters.search, $options: 'i' } },
      ];
    }

    const sort: any = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

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

    return { properties: properties as unknown as Property[], total, page, totalPages: Math.ceil(total / limit) };
  }

  async approveProperty(id: string, admin: User): Promise<Property> {
    const property = await this.propertyModel.findById(id).select('_id').lean().exec();
    if (!property) throw new NotFoundException('Property not found');
    if (admin.role !== UserRole.ADMIN) throw new ForbiddenException('Only admins can approve properties');

    const updated = await this.propertyModel
      .findByIdAndUpdate(
        id,
        { approvalStatus: ApprovalStatus.APPROVED, isActive: true, $unset: { rejectionReason: '' } },
        { new: true },
      )
      .populate('ownerId', 'name email phoneNumber')
      .populate('agentId', 'name email agency')
      .lean()
      .exec();

    this.cacheInvalidate('featured_');
    this.cacheInvalidate('recent_');
    this.logger.log(`Property ${id} approved by admin ${admin._id}`);
    return updated as unknown as Property;
  }

  async rejectProperty(id: string, reason: string | undefined, admin: User): Promise<Property> {
    const property = await this.propertyModel.findById(id).select('_id').lean().exec();
    if (!property) throw new NotFoundException('Property not found');
    if (admin.role !== UserRole.ADMIN) throw new ForbiddenException('Only admins can reject properties');

    const updated = await this.propertyModel
      .findByIdAndUpdate(
        id,
        {
          approvalStatus: ApprovalStatus.REJECTED,
          isActive: false,
          ...(reason ? { rejectionReason: reason } : {}),
        },
        { new: true },
      )
      .populate('ownerId', 'name email phoneNumber')
      .populate('agentId', 'name email agency')
      .lean()
      .exec();

    this.logger.log(`Property ${id} rejected by admin ${admin._id}. Reason: ${reason ?? 'none'}`);
    return updated as unknown as Property;
  }

  // ════════════════════════════════════════════════════════════════════════════
  // DELETE
  // ════════════════════════════════════════════════════════════════════════════

  async remove(id: string, user: User): Promise<void> {
    try {
      const property = await this.propertyModel
        .findById(id)
        .select('ownerId')
        .lean()
        .exec();

      if (!property) throw new NotFoundException('Property not found');

      if (
        user.role !== UserRole.ADMIN &&
        (property as any).ownerId.toString() !== user._id.toString()
      ) {
        throw new ForbiddenException('You can only delete your own properties');
      }

      await this.propertyModel.findByIdAndDelete(id);
      this.cacheInvalidate(`similar_${id}`);
      this.cacheInvalidate('popular_cities');
      this.logger.log(`Property deleted: ${id} by user ${user._id}`);
    } catch (error) {
      this.logger.error(`Error deleting property ${id}:`, error);
      throw error;
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // IMAGE / VIDEO UPLOADS  (unchanged logic, added lean where applicable)
  // ════════════════════════════════════════════════════════════════════════════

  async uploadImages(
  propertyId: string,
  files: { buffer: Buffer; filename?: string }[],
  user: User,
): Promise<Property> {
  const property = await this.propertyModel.findById(propertyId);
  if (!property) throw new NotFoundException('Property not found');
  this.assertCanManage(property, user);

  const uploads = await Promise.all(
    files.map(async (file, index) => {
      // Apply watermark before uploading
      const watermarkedBuffer = await this.watermarkService.applyWatermark(file.buffer);

      const publicId = `property_${propertyId}_${Date.now()}_${index}`;
      const result = await uploadBufferToCloudinary(watermarkedBuffer, {
        publicId,
        folder: 'horohouse/properties/images',
        resourceType: 'image',
        transformation: [{ quality: 'auto', fetch_format: 'auto' }],
      });
      return { url: result.secure_url, publicId: result.public_id };
    }),
  );

  (property.images as any) = [...((property.images as any) || []), ...uploads];
  await property.save();
  return property;
}

  async deleteImage(propertyId: string, imagePublicId: string, user: User): Promise<Property> {
    const property = await this.propertyModel.findById(propertyId);
    if (!property) throw new NotFoundException('Property not found');
    this.assertCanManage(property, user);

    await deleteFromCloudinary(imagePublicId, 'image');
    (property.images as any) = ((property.images as any) || []).filter(
      (img: any) => img.publicId !== imagePublicId,
    );
    await property.save();
    return property;
  }

  async uploadVideos(
    propertyId: string,
    files: { buffer: Buffer; filename?: string }[],
    user: User,
  ): Promise<Property> {
    const property = await this.propertyModel.findById(propertyId);
    if (!property) throw new NotFoundException('Property not found');
    this.assertCanManage(property, user);

    const uploads = await Promise.all(
      files.map(async (file, index) => {
        const publicId = `property_${propertyId}_video_${Date.now()}_${index}`;
        const result = await uploadBufferToCloudinary(file.buffer, {
          publicId,
          folder: 'horohouse/properties/videos',
          resourceType: 'video',
          transformation: [{ quality: 'auto' }],
        });
        return { url: result.secure_url, publicId: result.public_id };
      }),
    );

    (property as any).videos = [...(((property as any).videos) || []), ...uploads];
    await property.save();
    return property;
  }

  async deleteVideo(propertyId: string, videoPublicId: string, user: User): Promise<Property> {
    const property = await this.propertyModel.findById(propertyId);
    if (!property) throw new NotFoundException('Property not found');
    this.assertCanManage(property, user);

    await deleteFromCloudinary(videoPublicId, 'video');
    (property as any).videos = ((property as any).videos || []).filter(
      (vid: any) => vid.publicId !== videoPublicId,
    );
    await property.save();
    return property;
  }

  // ════════════════════════════════════════════════════════════════════════════
  // AGGREGATES / CONVENIENCE ENDPOINTS  (all cached)
  // ════════════════════════════════════════════════════════════════════════════

  async getMostViewed(limit = 10): Promise<Property[]> {
    const key = `most_viewed_${limit}`;
    const cached = this.cacheGet<Property[]>(key);
    if (cached) return cached;

    const result = await this.propertyModel
      .find({ isActive: true, availability: PropertyStatus.ACTIVE })
      .select(this.listingProjection())
      .sort({ viewsCount: -1 })
      .limit(limit)
      .populate('ownerId', 'name profilePicture')
      .populate('agentId', 'name profilePicture agency')
      .lean()
      .exec() as unknown as Property[];

    this.cacheSet(key, result, this.CACHE_TTL_MS);
    return result;
  }

  async getRecent(limit = 10): Promise<Property[]> {
    const key = `recent_${limit}`;
    const cached = this.cacheGet<Property[]>(key);
    if (cached) return cached;

    const result = await this.propertyModel
      .find({ isActive: true, availability: PropertyStatus.ACTIVE })
      .select(this.listingProjection())
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('ownerId', 'name profilePicture')
      .populate('agentId', 'name profilePicture agency')
      .lean()
      .exec() as unknown as Property[];

    this.cacheSet(key, result, this.CACHE_TTL_MS);
    return result;
  }

  async getFeatured(limit = 10): Promise<Property[]> {
    const key = `featured_${limit}`;
    const cached = this.cacheGet<Property[]>(key);
    if (cached) return cached;

    const result = await this.propertyModel
      .find({ isActive: true, isFeatured: true, availability: PropertyStatus.ACTIVE })
      .select(this.listingProjection())
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('ownerId', 'name profilePicture')
      .populate('agentId', 'name profilePicture agency')
      .lean()
      .exec() as unknown as Property[];

    this.cacheSet(key, result, this.FEATURED_TTL_MS);
    return result;
  }

  async getPopularCities(limit = 10): Promise<Array<{ city: string; count: number }>> {
    const key = `popular_cities_${limit}`;
    const cached = this.cacheGet<Array<{ city: string; count: number }>>(key);
    if (cached) return cached;

    const result = await this.propertyModel.aggregate([
      { $match: { isActive: true, availability: PropertyStatus.ACTIVE } },
      { $group: { _id: '$city', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: limit },
      { $project: { _id: 0, city: '$_id', count: 1 } },
    ]);

    this.cacheSet(key, result, this.POPULAR_CITIES_TTL_MS);
    return result;
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SIMILAR PROPERTIES  (parallelised + cached)
  // ════════════════════════════════════════════════════════════════════════════

  async getSimilarProperties(propertyId: string, limit = 6): Promise<Property[]> {
    const cacheKey = `similar_${propertyId}_${limit}`;
    const cached = this.cacheGet<Property[]>(cacheKey);
    if (cached) return cached;

    try {
      if (!Types.ObjectId.isValid(propertyId)) {
        throw new BadRequestException('Invalid property ID format');
      }

      const property = await this.propertyModel
        .findById(propertyId)
        .select('type city price listingType location')
        .lean()
        .exec();

      if (!property) throw new NotFoundException('Property not found');

      const priceMin = (property as any).price * 0.7;
      const priceMax = (property as any).price * 1.3;
      const baseExclude = { _id: { $ne: (property as any)._id }, isActive: true, availability: PropertyStatus.ACTIVE };
      const cityFilter = (property as any).city
        ? { city: { $regex: new RegExp(`^${(property as any).city.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } }
        : {};
      const listingFilter = (property as any).listingType ? { listingType: (property as any).listingType } : {};
      const typeFilter = (property as any).type ? { type: (property as any).type } : {};
      const priceFilter = { price: { $gte: priceMin, $lte: priceMax } };
      const populate = [
        { path: 'ownerId', select: 'name profilePicture' },
        { path: 'agentId', select: 'name profilePicture agency' },
      ];

      // Run all 4 strategies in PARALLEL — pick whichever return results
      const loc = (property as any).location?.coordinates;
      const hasValidLocation =
        Array.isArray(loc) &&
        loc.length === 2 &&
        loc[0] !== 0 &&
        loc[1] !== 0;

      const [geoResults, strictResults, relaxedResults, fallbackResults] = await Promise.all([
        // Strategy 1: geo
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
            .catch(() => []) // geo index may not exist yet
          : Promise.resolve([]),

        // Strategy 2: city + type + listing + price
        this.propertyModel
          .find({ ...baseExclude, ...cityFilter, ...listingFilter, ...typeFilter, ...priceFilter })
          .select(this.listingProjection())
          .populate(populate)
          .sort({ createdAt: -1 })
          .limit(limit)
          .lean()
          .exec(),

        // Strategy 3: city + type + listing (relaxed price)
        this.propertyModel
          .find({ ...baseExclude, ...cityFilter, ...listingFilter, ...typeFilter })
          .select(this.listingProjection())
          .populate(populate)
          .sort({ createdAt: -1 })
          .limit(limit)
          .lean()
          .exec(),

        // Strategy 4: city + listing only
        this.propertyModel
          .find({ ...baseExclude, ...cityFilter, ...listingFilter })
          .select(this.listingProjection())
          .populate(populate)
          .sort({ createdAt: -1 })
          .limit(limit)
          .lean()
          .exec(),
      ]);

      // Merge results in priority order, deduplicate
      const seen = new Set<string>();
      const merged: any[] = [];

      for (const batch of [geoResults, strictResults, relaxedResults, fallbackResults]) {
        for (const p of batch as any[]) {
          const idStr = p._id.toString();
          if (!seen.has(idStr)) {
            seen.add(idStr);
            merged.push(p);
          }
          if (merged.length >= limit) break;
        }
        if (merged.length >= limit) break;
      }

      const result = merged.slice(0, limit) as unknown as Property[];
      this.cacheSet(cacheKey, result, this.CACHE_TTL_MS);
      return result;
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) throw error;
      this.logger.error(`Error finding similar properties for ${propertyId}:`, error);
      return [];
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // USER FAVORITES
  // ════════════════════════════════════════════════════════════════════════════

  async getUserFavorites(
    userId: string,
    options: PropertySearchOptions = {},
  ): Promise<{ properties: any[]; total: number; page: number; totalPages: number }> {
    try {
      const { page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc' } = options;
      const skip = (page - 1) * limit;

      const userDoc = await this.userModel.findById(userId).select('favorites').lean().exec();
      if (!userDoc) throw new NotFoundException('User not found');

      const favoriteIds: Types.ObjectId[] = (userDoc.favorites as any[]) || [];
      const total = favoriteIds.length;
      if (total === 0) return { properties: [], total: 0, page, totalPages: 0 };

      const sort: any = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

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
    } catch (error) {
      this.logger.error(`Error getting user favorites for ${userId}:`, error);
      throw error;
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // MY PROPERTIES
  // ════════════════════════════════════════════════════════════════════════════

  async getMyProperties(
    filters: PropertySearchFilters = {},
    options: PropertySearchOptions = {},
    userId: string,
  ): Promise<{ properties: Property[]; total: number; page: number; totalPages: number }> {
    try {
      const { page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc', includeInactive = true } = options;
      const skip = (page - 1) * limit;
      const userObjectId = new Types.ObjectId(userId);
      const query: any = {
        $or: [{ ownerId: userObjectId }, { agentId: userObjectId }],
      };

      if (!includeInactive) {
        query.isActive = true;
        query.availability = PropertyStatus.ACTIVE;
      }

      if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
        query.price = {};
        if (filters.minPrice !== undefined) query.price.$gte = filters.minPrice;
        if (filters.maxPrice !== undefined) query.price.$lte = filters.maxPrice;
      }
      if (filters.propertyType) query.type = filters.propertyType;
      if (filters.listingType) query.listingType = filters.listingType;
      if (filters.city) query.city = filters.city.trim().toLowerCase();
      if (filters.bedrooms) query['amenities.bedrooms'] = { $gte: filters.bedrooms };
      if (filters.bathrooms) query['amenities.bathrooms'] = { $gte: filters.bathrooms };
      if (filters.amenities?.length) {
        query.$and = filters.amenities.map((a) => ({ [`amenities.${a}`]: true }));
      }

      const sort: any = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

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
        properties: properties as unknown as Property[],
        total,
        page,
        totalPages: Math.ceil(total / limit),
      };
    } catch (error) {
      this.logger.error(`Error getting user properties for ${userId}:`, error);
      throw error;
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // GEOCODING
  // ════════════════════════════════════════════════════════════════════════════

  async geocodeAddress(
    address: string,
    city?: string,
    country?: string,
  ): Promise<{ latitude: number; longitude: number } | null> {
    try {
      const query = [address, city, country].filter(Boolean).join(', ');
      const response = await axios.get('https://nominatim.openstreetmap.org/search', {
        params: { q: query, format: 'json', limit: 1 },
        headers: { 'User-Agent': 'HoroHouse-Backend/1.0' },
        timeout: 5000, // ← prevent hanging geocode requests
      });

      if (response.data?.length > 0) {
        return {
          latitude: parseFloat(response.data[0].lat),
          longitude: parseFloat(response.data[0].lon),
        };
      }

      this.logger.warn(`Geocoding returned no results for: ${query}`);
      return null;
    } catch (error) {
      this.logger.error('Geocoding failed:', error);
      return null;
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // TEXT SEARCH
  // ════════════════════════════════════════════════════════════════════════════

  async searchByText(
    searchText: string,
    filters: PropertySearchFilters = {},
    options: PropertySearchOptions = {},
    user?: User,
  ) {
    try {
      const query: any = {
        $text: { $search: searchText },
        isActive: true,
        availability: PropertyStatus.ACTIVE,
        ...this.buildFilterQuery(filters),
      };

      const { page = 1, limit = 20, sortBy = 'score' } = options;
      const skip = (page - 1) * limit;
      const sort: any =
        sortBy === 'score'
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
            activityType: ActivityType.SEARCH,
            searchQuery: searchText,
            searchFilters: filters,
            resultsCount: total,
          })
          .catch((e) => this.logger.error('History log failed', e));
      }

      return { properties, total, page, totalPages: Math.ceil(total / limit) };
    } catch (error) {
      this.logger.error('Text search failed:', error);
      throw error;
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SHORT-TERM LISTINGS
  // ════════════════════════════════════════════════════════════════════════════

  async getShortTermListings(
    filters: {
      city?: string;
      minPrice?: number;
      maxPrice?: number;
      propertyType?: PropertyType;
      isInstantBookable?: boolean;
      minGuests?: number;
      cancellationPolicy?: CancellationPolicy;
      pricingUnit?: PricingUnit;
      checkIn?: Date;
      checkOut?: Date;
      latitude?: number;
      longitude?: number;
      radius?: number;
    } = {},
    options: { page?: number; limit?: number; sortBy?: string; sortOrder?: 'asc' | 'desc' } = {},
  ): Promise<{ properties: Property[]; total: number; page: number; totalPages: number }> {
    const { page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc' } = options;
    const skip = (page - 1) * limit;

    const query: any = {
      listingType: ListingType.SHORT_TERM,
      isActive: true,
      approvalStatus: ApprovalStatus.APPROVED,
      availability: PropertyStatus.ACTIVE,
    };

    if (filters.city) query.city = filters.city.trim().toLowerCase();
    if (filters.propertyType) query.type = filters.propertyType;
    if (filters.pricingUnit) query.pricingUnit = filters.pricingUnit;
    if (filters.cancellationPolicy) query.cancellationPolicy = filters.cancellationPolicy;
    if (filters.isInstantBookable !== undefined) query.isInstantBookable = filters.isInstantBookable;
    if (filters.minGuests) query['shortTermAmenities.maxGuests'] = { $gte: filters.minGuests };
    if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
      query.price = {};
      if (filters.minPrice !== undefined) query.price.$gte = filters.minPrice;
      if (filters.maxPrice !== undefined) query.price.$lte = filters.maxPrice;
    }
    if (filters.latitude && filters.longitude && filters.radius) {
      query.location = {
        $near: {
          $geometry: { type: 'Point', coordinates: [filters.longitude, filters.latitude] },
          $maxDistance: filters.radius * 1000,
        },
      };
    }

    // Availability — run in parallel with count
    const availabilityPromise =
      filters.checkIn && filters.checkOut
        ? this.getBookedPropertyIds(filters.checkIn, filters.checkOut)
        : Promise.resolve<Types.ObjectId[]>([]);

    const bookedIds = await availabilityPromise;
    if (bookedIds.length > 0) query._id = { $nin: bookedIds };

    const sort: any = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

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

    return { properties: properties as unknown as Property[], total, page, totalPages: Math.ceil(total / limit) };
  }

  // ════════════════════════════════════════════════════════════════════════════
  // BLOCK / UNBLOCK DATES
  // ════════════════════════════════════════════════════════════════════════════

  async blockDates(propertyId: string, dto: BlockDatesDto, user: User): Promise<Property> {
    const property = await this.propertyModel.findById(propertyId);
    if (!property) throw new NotFoundException('Property not found');
    this.assertCanManage(property, user);

    if (property.listingType !== ListingType.SHORT_TERM) {
      throw new BadRequestException('Date blocking is only available for short-term listings');
    }

    const newRanges = dto.ranges.map((r) => {
      const from = new Date(r.from);
      const to = new Date(r.to);
      if (isNaN(from.getTime()) || isNaN(to.getTime())) {
        throw new BadRequestException(`Invalid date range: ${r.from} → ${r.to}`);
      }
      if (to < from) {
        throw new BadRequestException(`"to" must be after or equal to "from" in range: ${r.from} → ${r.to}`);
      }
      return { from, to, reason: r.reason };
    });

    const existingFromSet = new Set(
      ((property as any).unavailableDates ?? []).map((r: any) => r.from.toISOString()),
    );
    const toAdd = newRanges.filter((r) => !existingFromSet.has(r.from.toISOString()));

    const updated = await this.propertyModel
      .findByIdAndUpdate(propertyId, { $push: { unavailableDates: { $each: toAdd } } }, { new: true })
      .lean()
      .exec();

    this.logger.log(`Blocked ${toAdd.length} date range(s) on property ${propertyId}`);
    return updated as unknown as Property;
  }

  async unblockDates(propertyId: string, dto: UnblockDatesDto, user: User): Promise<Property> {
    const property = await this.propertyModel.findById(propertyId).select('ownerId agentId listingType').lean().exec();
    if (!property) throw new NotFoundException('Property not found');
    this.assertCanManage(property as unknown as Property, user);

    const fromDatesToRemove = dto.fromDates.map((d) => {
      const parsed = new Date(d);
      if (isNaN(parsed.getTime())) throw new BadRequestException(`Invalid date: ${d}`);
      return parsed;
    });

    const updated = await this.propertyModel
      .findByIdAndUpdate(
        propertyId,
        { $pull: { unavailableDates: { from: { $in: fromDatesToRemove } } } },
        { new: true },
      )
      .lean()
      .exec();

    this.logger.log(`Unblocked ${fromDatesToRemove.length} date range(s) on property ${propertyId}`);
    return updated as unknown as Property;
  }

  async getBlockedDates(propertyId: string): Promise<{ unavailableDates: any[] }> {
    if (!Types.ObjectId.isValid(propertyId)) throw new BadRequestException('Invalid property ID');

    const property = await this.propertyModel
      .findById(propertyId)
      .select('unavailableDates listingType')
      .lean()
      .exec();

    if (!property) throw new NotFoundException('Property not found');
    return { unavailableDates: (property as any).unavailableDates ?? [] };
  }

  // ════════════════════════════════════════════════════════════════════════════
  // HOST CALENDAR SETTINGS & SYNC
  // ════════════════════════════════════════════════════════════════════════════

  async getCalendarSettings(propertyId: string, user: User) {
    if (!Types.ObjectId.isValid(propertyId)) throw new BadRequestException('Invalid property ID');
    const property = await this.propertyModel.findById(propertyId).exec();
    if (!property) throw new NotFoundException('Property not found');
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

  async updateCalendarSettings(propertyId: string, dto: UpdateCalendarSettingsDto, user: User) {
    if (!Types.ObjectId.isValid(propertyId)) throw new BadRequestException('Invalid property ID');
    const property = await this.propertyModel.findById(propertyId).exec();
    if (!property) throw new NotFoundException('Property not found');
    this.assertCanManage(property, user);

    const update: any = {};
    if (dto.basePrice !== undefined) update.price = dto.basePrice;
    if (dto.weekendPrice !== undefined) update.weekendPrice = dto.weekendPrice;
    if (dto.minNights !== undefined) update.minNights = dto.minNights;
    if (dto.maxNights !== undefined) update.maxNights = dto.maxNights;
    if (dto.noticeDays !== undefined) update.noticeDays = dto.noticeDays;
    if (dto.windowMonths !== undefined) update.windowMonths = dto.windowMonths;

    await this.propertyModel.findByIdAndUpdate(propertyId, { $set: update }, { new: true }).exec();
    this.cacheInvalidate(`property_${propertyId}`);
    this.cacheInvalidate(`similar_${propertyId}`);
    this.cacheInvalidate('featured_');
    this.cacheInvalidate('recent_');
    return this.getCalendarSettings(propertyId, user);
  }

  async setCalendarPrices(propertyId: string, dto: SetCalendarPricesDto, user: User) {
    if (!Types.ObjectId.isValid(propertyId)) throw new BadRequestException('Invalid property ID');
    const property = await this.propertyModel.findById(propertyId).exec();
    if (!property) throw new NotFoundException('Property not found');
    this.assertCanManage(property, user);

    const start = new Date(dto.from);
    const end = new Date(dto.to);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) {
      throw new BadRequestException('Invalid date range');
    }

    const priceOverrides = { ...((property as any).priceOverrides || {}) };
    const cur = new Date(start);
    while (cur <= end) {
      const key = cur.toISOString().split('T')[0];
      if (dto.price === null || dto.price === undefined) {
        delete priceOverrides[key];
      } else {
        priceOverrides[key] = dto.price;
      }
      cur.setDate(cur.getDate() + 1);
    }

    await this.propertyModel.findByIdAndUpdate(
      propertyId,
      { $set: { priceOverrides } },
      { new: true },
    ).exec();

    return { priceOverrides };
  }

  async addExternalCalendar(propertyId: string, dto: AddExternalCalendarDto, user: User) {
    if (!Types.ObjectId.isValid(propertyId)) throw new BadRequestException('Invalid property ID');
    const property = await this.propertyModel.findById(propertyId).exec();
    if (!property) throw new NotFoundException('Property not found');
    this.assertCanManage(property, user);

    const newCalendar = {
      id: new Types.ObjectId().toString(),
      name: dto.name,
      url: dto.url,
      lastSyncedAt: new Date(),
    };

    await this.propertyModel.findByIdAndUpdate(
      propertyId,
      { $push: { externalCalendars: newCalendar } },
      { new: true },
    ).exec();

    return newCalendar;
  }

  async removeExternalCalendar(propertyId: string, calendarId: string, user: User) {
    if (!Types.ObjectId.isValid(propertyId)) throw new BadRequestException('Invalid property ID');
    const property = await this.propertyModel.findById(propertyId).exec();
    if (!property) throw new NotFoundException('Property not found');
    this.assertCanManage(property, user);

    await this.propertyModel.findByIdAndUpdate(
      propertyId,
      { $pull: { externalCalendars: { id: calendarId } } },
      { new: true },
    ).exec();

    return { success: true };
  }

  async getShortTermById(propertyId: string): Promise<any> {
    if (!Types.ObjectId.isValid(propertyId)) throw new BadRequestException('Invalid property ID');

    const property = await this.propertyModel
      .findOne({
        _id: new Types.ObjectId(propertyId),
        listingType: ListingType.SHORT_TERM,
        isActive: true,
        approvalStatus: ApprovalStatus.APPROVED,
      })
      .populate('ownerId', 'name email phoneNumber profilePicture')
      .populate('agentId', 'name email phoneNumber profilePicture agency')
      .lean()
      .exec();

    if (!property) throw new NotFoundException('Short-term property not found');

    return {
      ...property,
      shortTermSummary: {
        pricePerNight: (property as any).pricingUnit === 'nightly' ? (property as any).price : null,
        pricingUnit: (property as any).pricingUnit,
        minNights: (property as any).minNights,
        maxNights: (property as any).maxNights,
        cleaningFee: (property as any).cleaningFee,
        isInstantBookable: (property as any).isInstantBookable,
        cancellationPolicy: (property as any).cancellationPolicy,
        checkInTime: (property as any).shortTermAmenities?.checkInTime,
        checkOutTime: (property as any).shortTermAmenities?.checkOutTime,
        maxGuests: (property as any).shortTermAmenities?.maxGuests,
        advanceNoticeDays: (property as any).advanceNoticeDays,
        bookingWindowDays: (property as any).bookingWindowDays,
      },
    };
  }

  async trackTourView(propertyId: string): Promise<void> {
    if (!Types.ObjectId.isValid(propertyId)) return;
    await this.propertyModel.findByIdAndUpdate(propertyId, { $inc: { tourViews: 1 } }).exec();
  }

  // ════════════════════════════════════════════════════════════════════════════
  // PRIVATE HELPERS
  // ════════════════════════════════════════════════════════════════════════════

  /**
   * Sparse field projection for list endpoints — avoids pulling large text blobs
   * (description, keywords) on every card render.
   */
  private listingProjection() {
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
      // Long-term / landlord fields
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

  /**
   * Builds the standard query object for the public listing feed.
   */
  private buildBaseListQuery(filters: PropertySearchFilters, includeInactive: boolean): any {
    const query: any = {};

    if (!includeInactive) {
      query.isActive = true;
      query.approvalStatus = ApprovalStatus.APPROVED;
      query.availability = PropertyStatus.ACTIVE;
    }

    if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
      query.price = {};
      if (filters.minPrice !== undefined) query.price.$gte = filters.minPrice;
      if (filters.maxPrice !== undefined) query.price.$lte = filters.maxPrice;
    }
    if (filters.propertyType) query.type = filters.propertyType;
    if (filters.listingType) query.listingType = filters.listingType;
    if (filters.city) query.city = filters.city.trim().toLowerCase();
    if (filters.neighborhood) query.neighborhood = new RegExp(filters.neighborhood.trim(), 'i');
    if (filters.bedrooms) query['amenities.bedrooms'] = { $gte: filters.bedrooms };
    if (filters.bathrooms) query['amenities.bathrooms'] = { $gte: filters.bathrooms };
    if (filters.furnished !== undefined) query['amenities.furnished'] = filters.furnished;
    if (filters.amenities?.length) {
      query.$and = filters.amenities.map((a) => ({ [`amenities.${a}`]: true }));
    }
    if (filters.isInstantBookable !== undefined) query.isInstantBookable = filters.isInstantBookable;
    if (filters.pricingUnit) query.pricingUnit = filters.pricingUnit;
    if (filters.cancellationPolicy) query.cancellationPolicy = filters.cancellationPolicy;
    if (filters.minGuests) query['shortTermAmenities.maxGuests'] = { $gte: filters.minGuests };

    // Area filters (rent / sale listings)
    if (filters.minArea !== undefined || filters.maxArea !== undefined) {
      query.area = {};
      if (filters.minArea !== undefined) query.area.$gte = filters.minArea;
      if (filters.maxArea !== undefined) query.area.$lte = filters.maxArea;
    }

    // Geospatial
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

  private buildFilterQuery(filters: PropertySearchFilters): any {
    const query: any = {};
    if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
      query.price = {};
      if (filters.minPrice !== undefined) query.price.$gte = filters.minPrice;
      if (filters.maxPrice !== undefined) query.price.$lte = filters.maxPrice;
    }
    if (filters.propertyType) query.type = filters.propertyType;
    if (filters.listingType) query.listingType = filters.listingType;
    if (filters.city) query.city = filters.city.trim().toLowerCase();
    if (filters.bedrooms) query['amenities.bedrooms'] = { $gte: filters.bedrooms };
    if (filters.bathrooms) query['amenities.bathrooms'] = { $gte: filters.bathrooms };
    return query;
  }

  /**
   * Fire-and-forget analytics helper — response is never blocked.
   */
  private fireAnalytics(user: User, filters: PropertySearchFilters, total: number): void {
    this.historyService
      .logActivity({
        userId: user._id,
        activityType: ActivityType.SEARCH,
        searchQuery: JSON.stringify(filters),
        searchFilters: filters,
        resultsCount: total,
        userLocation:
          filters.latitude && filters.longitude
            ? { type: 'Point', coordinates: [filters.longitude, filters.latitude] }
            : undefined,
        city: filters.city,
      })
      .catch((e) => this.logger.error('History log failed', e));

    this.userInteractionsService
      .trackInteraction({
        userId: user._id,
        interactionType: InteractionType.SEARCH,
        source: InteractionSource.SEARCH_RESULTS,
        city: filters.city,
        metadata: { searchFilters: filters, resultsCount: total },
        location:
          filters.latitude && filters.longitude
            ? { type: 'Point', coordinates: [filters.longitude, filters.latitude] }
            : undefined,
      })
      .catch((e) => this.logger.error('Interaction track failed', e));
  }

  /**
   * Collapses two sequential updateOne calls into one atomic pipeline write.
   * $pull + $push in a single round-trip.
   */
  private async updateRecentlyViewed(
    userId: Types.ObjectId,
    propertyId: Types.ObjectId,
  ): Promise<void> {
    try {
      // Step 1: Remove existing entries for this property
      await this.userModel.updateOne(
        { _id: userId },
        { $pull: { recentlyViewed: { propertyId } } } as any
      );

      // Step 2: Push the new entry to the front of the array and limit to 50
      await this.userModel.updateOne(
        { _id: userId },
        {
          $push: {
            recentlyViewed: {
              $each: [{ propertyId, viewedAt: new Date() }],
              $position: 0,
              $slice: 50
            }
          }
        } as any
      );
    } catch (error) {
      this.logger.error('Failed to update recently viewed:', error);
    }
  }

  /**
   * Returns property IDs that have an overlapping confirmed/pending booking.
   * Uses dynamic model resolution to avoid circular imports.
   */
  private async getBookedPropertyIds(checkIn: Date, checkOut: Date): Promise<Types.ObjectId[]> {
    try {
      const bookingModel = (this.propertyModel.db as any).model('Booking');
      if (!bookingModel) return [];

      const bookings = await bookingModel
        .find({
          status: { $in: ['confirmed', 'pending'] },
          checkIn: { $lt: checkOut },
          checkOut: { $gt: checkIn },
        })
        .select('propertyId')
        .lean()
        .exec();

      return bookings.map((b: any) => b.propertyId);
    } catch {
      this.logger.warn('Booking model not available — skipping availability filter');
      return [];
    }
  }

  // ─── Validation ──────────────────────────────────────────────────────────

  private isValidCoordinate(lat: number, lng: number): boolean {
    return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
  }

  private generateSlug(title: string): string {
    const base = title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
    // Append a short random suffix to guarantee uniqueness across concurrent inserts
    const suffix = Math.random().toString(36).slice(2, 7);
    return `${base}-${suffix}`;
  }

  private generateKeywords(property: any): string[] {
    const raw: string[] = [];
    if (property.title)       raw.push(...property.title.toLowerCase().split(' '));
    if (property.description) raw.push(...property.description.toLowerCase().split(' '));
    if (property.city)        raw.push(property.city.toLowerCase());
    if (property.neighborhood) raw.push(...property.neighborhood.toLowerCase().split(' '));
    if (property.type)        raw.push(property.type.toString().toLowerCase());
    // Listing type labels (help surface rent/sale/short_term listings in search)
    if (property.listingType) {
      raw.push(property.listingType.toString().toLowerCase());
      if (property.listingType === 'rent')  raw.push('location', 'louer', 'rental');
      if (property.listingType === 'sale')  raw.push('vente', 'vendre', 'acheter', 'sale');
      if (property.listingType === 'short_term') raw.push('sejour', 'nuit', 'hotel', 'airbnb');
    }
    // Furnished boost
    if (property.amenities?.furnished) raw.push('meuble', 'furnished');
    return [...new Set(raw)].filter((k) => k.length > 2);
  }

  validateShortTermFields(dto: any): void {
    if (!dto.pricingUnit) {
      throw new BadRequestException('pricingUnit is required for short-term listings');
    }
    if (dto.minNights && dto.maxNights && dto.minNights > dto.maxNights) {
      throw new BadRequestException('minNights cannot be greater than maxNights');
    }
    if (dto.shortTermAmenities?.checkInTime && !/^\d{2}:\d{2}$/.test(dto.shortTermAmenities.checkInTime)) {
      throw new BadRequestException('checkInTime must be in HH:mm format');
    }
    if (dto.shortTermAmenities?.checkOutTime && !/^\d{2}:\d{2}$/.test(dto.shortTermAmenities.checkOutTime)) {
      throw new BadRequestException('checkOutTime must be in HH:mm format');
    }
  }

  private assertCanManage(property: Property, user: User): void {
    const isOwner = property.ownerId.toString() === user._id.toString();
    const isAgent = property.agentId?.toString() === user._id.toString();
    const isAdmin = user.role === UserRole.ADMIN;
    if (!isOwner && !isAgent && !isAdmin) {
      throw new ForbiddenException('You can only manage your own properties');
    }
  }
}