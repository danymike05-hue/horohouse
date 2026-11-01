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
var PropertiesController_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PropertiesController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const properties_service_1 = require("./properties.service");
const property_dto_1 = require("./dto/property.dto");
const jwt_auth_guard_1 = require("../auth/guards/jwt.auth.guard");
const roles_guard_1 = require("../auth/guards/roles.guard");
const user_schema_1 = require("../users/schemas/user.schema");
const property_schema_1 = require("./schemas/property.schema");
class CreatePropertyRequestDto {
    title;
    price;
    type;
    listingType;
    description;
    city;
    address;
    neighborhood;
    country;
    latitude;
    longitude;
    amenities;
    images;
    contactPhone;
    contactEmail;
    area;
    yearBuilt;
    keywords;
    nearbyAmenities;
    transportAccess;
}
class UpdatePropertyRequestDto extends CreatePropertyRequestDto {
    availability;
    isVerified;
    isFeatured;
    isActive;
}
let PropertiesController = PropertiesController_1 = class PropertiesController {
    propertiesService;
    logger = new common_1.Logger(PropertiesController_1.name);
    constructor(propertiesService) {
        this.propertiesService = propertiesService;
    }
    async create(createPropertyDto, req) {
        return this.propertiesService.create(createPropertyDto, req.user);
    }
    async findAll(query, req) {
        const filters = {
            minPrice: query.minPrice ? parseFloat(query.minPrice) : undefined,
            maxPrice: query.maxPrice ? parseFloat(query.maxPrice) : undefined,
            propertyType: query.propertyType,
            listingType: query.listingType,
            city: query.city,
            bedrooms: query.bedrooms ? parseInt(query.bedrooms) : undefined,
            bathrooms: query.bathrooms ? parseInt(query.bathrooms) : undefined,
            latitude: query.latitude ? parseFloat(query.latitude) : undefined,
            longitude: query.longitude ? parseFloat(query.longitude) : undefined,
            radius: query.radius ? parseFloat(query.radius) : undefined,
            amenities: query.amenities ? query.amenities.split(',') : undefined,
            isInstantBookable: query.isInstantBookable !== undefined
                ? query.isInstantBookable === 'true'
                : undefined,
            minGuests: query.minGuests ? parseInt(query.minGuests) : undefined,
            cancellationPolicy: query.cancellationPolicy,
            pricingUnit: query.pricingUnit,
            checkIn: query.checkIn ? new Date(query.checkIn) : undefined,
            checkOut: query.checkOut ? new Date(query.checkOut) : undefined,
            minArea: query.minArea ? parseFloat(query.minArea) : undefined,
            maxArea: query.maxArea ? parseFloat(query.maxArea) : undefined,
            furnished: query.furnished !== undefined ? query.furnished === 'true' : undefined,
            neighborhood: query.neighborhood,
        };
        if (query.bounds) {
            try {
                filters.bounds = JSON.parse(query.bounds);
            }
            catch (error) {
                throw new common_1.BadRequestException('Invalid bounds format');
            }
        }
        const options = {
            page: query.page ? parseInt(query.page) : 1,
            limit: query.limit ? parseInt(query.limit) : 20,
            sortBy: query.sortBy || 'createdAt',
            sortOrder: query.sortOrder || 'desc',
        };
        return this.propertiesService.findAll(filters, options, req.user);
    }
    async findNearby(latitude, longitude, req, radius, limit) {
        const lat = parseFloat(latitude);
        const lng = parseFloat(longitude);
        const radiusKm = radius ? parseFloat(radius) : 5;
        const maxResults = limit ? parseInt(limit) : 10;
        if (isNaN(lat) || isNaN(lng)) {
            throw new common_1.BadRequestException('Valid latitude and longitude are required');
        }
        return this.propertiesService.findNearby(lat, lng, radiusKm, maxResults, req?.user);
    }
    async searchByText(query, req) {
        if (!query.q) {
            throw new common_1.BadRequestException('Search query (q) is required');
        }
        const filters = {
            city: query.city,
            propertyType: query.propertyType,
            minPrice: query.minPrice ? parseFloat(query.minPrice) : undefined,
            maxPrice: query.maxPrice ? parseFloat(query.maxPrice) : undefined,
        };
        const options = {
            page: query.page ? parseInt(query.page) : 1,
            limit: query.limit ? parseInt(query.limit) : 20,
        };
        return this.propertiesService.searchByText(query.q, filters, options, req.user);
    }
    async getMostViewed(limit) {
        const maxResults = limit ? parseInt(limit) : 10;
        return this.propertiesService.getMostViewed(maxResults);
    }
    async getRecent(limit) {
        const maxResults = limit ? parseInt(limit) : 10;
        return this.propertiesService.getRecent(maxResults);
    }
    async getFeatured(limit) {
        const maxResults = limit ? parseInt(limit) : 10;
        return this.propertiesService.getFeatured(maxResults);
    }
    async getPopularCities(limit) {
        const maxResults = limit ? parseInt(limit) : 10;
        return this.propertiesService.getPopularCities(maxResults);
    }
    async adminGetAllProperties(query, req) {
        const filters = {
            approvalStatus: query.approvalStatus,
            propertyType: query.propertyType,
            listingType: query.listingType,
            city: query.city,
            search: query.search,
            ownerId: query.ownerId,
        };
        const options = {
            page: query.page ? parseInt(query.page) : 1,
            limit: query.limit ? parseInt(query.limit) : 20,
            sortBy: query.sortBy || 'createdAt',
            sortOrder: (query.sortOrder || 'desc'),
        };
        return this.propertiesService.getAllPropertiesAdmin(filters, options);
    }
    async approveProperty(id, req) {
        return this.propertiesService.approveProperty(id, req.user);
    }
    async rejectProperty(id, body, req) {
        return this.propertiesService.rejectProperty(id, body.reason, req.user);
    }
    async getShortTermListings(query) {
        const filters = {
            city: query.city,
            minPrice: query.minPrice ? parseFloat(query.minPrice) : undefined,
            maxPrice: query.maxPrice ? parseFloat(query.maxPrice) : undefined,
            propertyType: query.propertyType,
            pricingUnit: query.pricingUnit,
            cancellationPolicy: query.cancellationPolicy,
            isInstantBookable: query.isInstantBookable !== undefined
                ? query.isInstantBookable === 'true'
                : undefined,
            minGuests: query.minGuests ? parseInt(query.minGuests) : undefined,
            latitude: query.latitude ? parseFloat(query.latitude) : undefined,
            longitude: query.longitude ? parseFloat(query.longitude) : undefined,
            radius: query.radius ? parseFloat(query.radius) : undefined,
            checkIn: query.checkIn ? new Date(query.checkIn) : undefined,
            checkOut: query.checkOut ? new Date(query.checkOut) : undefined,
        };
        const options = {
            page: query.page ? parseInt(query.page) : 1,
            limit: query.limit ? parseInt(query.limit) : 20,
            sortBy: query.sortBy || 'createdAt',
            sortOrder: query.sortOrder || 'desc',
        };
        return this.propertiesService.getShortTermListings(filters, options);
    }
    async getShortTermById(id) {
        return this.propertiesService.getShortTermById(id);
    }
    async getBlockedDates(id) {
        return this.propertiesService.getBlockedDates(id);
    }
    async blockDates(id, dto, req) {
        return this.propertiesService.blockDates(id, dto, req.user);
    }
    async unblockDates(id, dto, req) {
        return this.propertiesService.unblockDates(id, dto, req.user);
    }
    async getCalendarSettings(id, req) {
        return this.propertiesService.getCalendarSettings(id, req.user);
    }
    async updateCalendarSettings(id, dto, req) {
        return this.propertiesService.updateCalendarSettings(id, dto, req.user);
    }
    async setCalendarPrices(id, dto, req) {
        return this.propertiesService.setCalendarPrices(id, dto, req.user);
    }
    async addExternalCalendar(id, dto, req) {
        return this.propertiesService.addExternalCalendar(id, dto, req.user);
    }
    async removeExternalCalendar(id, calendarId, req) {
        return this.propertiesService.removeExternalCalendar(id, calendarId, req.user);
    }
    async trackTourView(body) {
        if (body?.propertyId) {
            this.propertiesService.trackTourView(body.propertyId).catch(() => { });
        }
    }
    async findOne(id, req) {
        return this.propertiesService.findOne(id, req.user);
    }
    async update(id, updatePropertyDto, req) {
        return this.propertiesService.update(id, updatePropertyDto, req.user);
    }
    async remove(id, req) {
        await this.propertiesService.remove(id, req.user);
        return { message: 'Property deleted successfully' };
    }
    async getMyProperties(query, req) {
        const filters = {
            propertyType: query.propertyType,
            listingType: query.listingType,
            city: query.city,
            minPrice: query.minPrice ? parseFloat(query.minPrice) : undefined,
            maxPrice: query.maxPrice ? parseFloat(query.maxPrice) : undefined,
        };
        const options = {
            page: query.page ? parseInt(query.page) : 1,
            limit: query.limit ? parseInt(query.limit) : 20,
            sortBy: query.sortBy || 'createdAt',
            sortOrder: query.sortOrder || 'desc',
            includeInactive: query.includeInactive !== 'false',
        };
        const userId = req.user._id?.toString();
        if (!userId) {
            throw new common_1.BadRequestException('User ID not found in request');
        }
        this.logger.debug(`Fetching properties for user ${userId}`);
        return this.propertiesService.getMyProperties(filters, options, userId);
    }
    async toggleFeatured(id, body, req) {
        return this.propertiesService.update(id, { isFeatured: body.isFeatured }, req.user);
    }
    async toggleVerified(id, body, req) {
        return this.propertiesService.update(id, { isVerified: body.isVerified }, req.user);
    }
    async toggleActive(id, body, req) {
        return this.propertiesService.update(id, { isActive: body.isActive }, req.user);
    }
    async addToFavorites(id, req) {
        return { message: 'Property added to favorites', propertyId: id };
    }
    async removeFromFavorites(id, req) {
        return { message: 'Property removed from favorites', propertyId: id };
    }
    async getMyFavorites(query, req) {
        const options = {
            page: query.page ? parseInt(query.page) : 1,
            limit: query.limit ? parseInt(query.limit) : 20,
            sortBy: query.sortBy || 'createdAt',
            sortOrder: query.sortOrder || 'desc',
        };
        const userId = req.user._id?.toString();
        if (!userId) {
            throw new common_1.BadRequestException('User ID not found in request');
        }
        return this.propertiesService.getUserFavorites(userId, options);
    }
    async getSimilarProperties(id, limit) {
        const maxResults = limit ? parseInt(limit) : 6;
        return this.propertiesService.getSimilarProperties(id, maxResults);
    }
    async uploadImages(id, req) {
        const files = [];
        const parts = req.parts();
        for await (const part of parts) {
            if (part.type === 'file') {
                const chunks = [];
                for await (const chunk of part.file) {
                    chunks.push(Buffer.from(chunk));
                }
                files.push({ buffer: Buffer.concat(chunks) });
            }
        }
        const property = await this.propertiesService.uploadImages(id, files, req.user);
        return { message: 'Images uploaded successfully', property };
    }
    async deleteImage(id, imageId, req) {
        const property = await this.propertiesService.deleteImage(id, imageId, req.user);
        return { message: 'Image deleted successfully', property };
    }
    async uploadVideos(id, req) {
        const files = [];
        const parts = req.parts();
        for await (const part of parts) {
            if (part.type === 'file') {
                const chunks = [];
                for await (const chunk of part.file) {
                    chunks.push(Buffer.from(chunk));
                }
                files.push({ buffer: Buffer.concat(chunks) });
            }
        }
        const property = await this.propertiesService.uploadVideos(id, files, req.user);
        return { message: 'Videos uploaded successfully', property };
    }
    async deleteVideo(id, videoId, req) {
        const property = await this.propertiesService.deleteVideo(id, videoId, req.user);
        return { message: 'Video deleted successfully', property };
    }
};
exports.PropertiesController = PropertiesController;
__decorate([
    (0, common_1.Post)(),
    (0, roles_guard_1.Roles)(user_schema_1.UserRole.HOST, user_schema_1.UserRole.AGENT, user_schema_1.UserRole.LANDLORD, user_schema_1.UserRole.ADMIN),
    (0, swagger_1.ApiOperation)({ summary: 'Create a new property' }),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiResponse)({ status: 201, description: 'Property created successfully' }),
    (0, swagger_1.ApiResponse)({ status: 400, description: 'Bad request' }),
    (0, swagger_1.ApiResponse)({ status: 403, description: 'Forbidden - Only agents and admins can create properties' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [property_dto_1.CreatePropertyDto, Object]),
    __metadata("design:returntype", Promise)
], PropertiesController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(),
    (0, roles_guard_1.Public)(),
    (0, swagger_1.ApiOperation)({ summary: 'Get all properties with filtering and search' }),
    (0, swagger_1.ApiQuery)({ name: 'page', required: false, type: Number, description: 'Page number' }),
    (0, swagger_1.ApiQuery)({ name: 'limit', required: false, type: Number, description: 'Items per page' }),
    (0, swagger_1.ApiQuery)({ name: 'minPrice', required: false, type: Number, description: 'Minimum price' }),
    (0, swagger_1.ApiQuery)({ name: 'maxPrice', required: false, type: Number, description: 'Maximum price' }),
    (0, swagger_1.ApiQuery)({ name: 'propertyType', required: false, enum: property_schema_1.PropertyType, description: 'Property type' }),
    (0, swagger_1.ApiQuery)({ name: 'listingType', required: false, enum: property_schema_1.ListingType, description: 'Listing type (sale/rent)' }),
    (0, swagger_1.ApiQuery)({ name: 'city', required: false, type: String, description: 'City name' }),
    (0, swagger_1.ApiQuery)({ name: 'bedrooms', required: false, type: Number, description: 'Minimum bedrooms' }),
    (0, swagger_1.ApiQuery)({ name: 'bathrooms', required: false, type: Number, description: 'Minimum bathrooms' }),
    (0, swagger_1.ApiQuery)({ name: 'latitude', required: false, type: Number, description: 'Latitude for location search' }),
    (0, swagger_1.ApiQuery)({ name: 'longitude', required: false, type: Number, description: 'Longitude for location search' }),
    (0, swagger_1.ApiQuery)({ name: 'radius', required: false, type: Number, description: 'Search radius in kilometers' }),
    (0, swagger_1.ApiQuery)({ name: 'sortBy', required: false, type: String, description: 'Sort by field' }),
    (0, swagger_1.ApiQuery)({ name: 'sortOrder', required: false, enum: ['asc', 'desc'], description: 'Sort order' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Properties retrieved successfully' }),
    (0, swagger_1.ApiQuery)({ name: 'isInstantBookable', required: false, type: Boolean }),
    (0, swagger_1.ApiQuery)({ name: 'minGuests', required: false, type: Number }),
    (0, swagger_1.ApiQuery)({ name: 'cancellationPolicy', required: false, enum: property_schema_1.CancellationPolicy }),
    (0, swagger_1.ApiQuery)({ name: 'pricingUnit', required: false, enum: property_schema_1.PricingUnit }),
    (0, swagger_1.ApiQuery)({ name: 'checkIn', required: false, type: String, description: 'ISO date — filters available properties' }),
    (0, swagger_1.ApiQuery)({ name: 'checkOut', required: false, type: String, description: 'ISO date — filters available properties' }),
    (0, swagger_1.ApiQuery)({ name: 'minArea', required: false, type: Number, description: 'Minimum area in m² (rent/sale)' }),
    (0, swagger_1.ApiQuery)({ name: 'maxArea', required: false, type: Number, description: 'Maximum area in m² (rent/sale)' }),
    (0, swagger_1.ApiQuery)({ name: 'furnished', required: false, type: Boolean, description: 'Filter furnished properties' }),
    (0, swagger_1.ApiQuery)({ name: 'neighborhood', required: false, type: String, description: 'Neighborhood / quarter' }),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], PropertiesController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)('nearby'),
    (0, roles_guard_1.Public)(),
    (0, swagger_1.ApiOperation)({ summary: 'Find properties near a location' }),
    (0, swagger_1.ApiQuery)({ name: 'latitude', required: true, type: Number }),
    (0, swagger_1.ApiQuery)({ name: 'longitude', required: true, type: Number }),
    (0, swagger_1.ApiQuery)({ name: 'radius', required: false, type: Number, description: 'Radius in kilometers (default: 5)' }),
    (0, swagger_1.ApiQuery)({ name: 'limit', required: false, type: Number, description: 'Maximum results (default: 10)' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Nearby properties found' }),
    (0, swagger_1.ApiResponse)({ status: 400, description: 'Invalid coordinates' }),
    __param(0, (0, common_1.Query)('latitude')),
    __param(1, (0, common_1.Query)('longitude')),
    __param(2, (0, common_1.Req)()),
    __param(3, (0, common_1.Query)('radius')),
    __param(4, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object, String, String]),
    __metadata("design:returntype", Promise)
], PropertiesController.prototype, "findNearby", null);
__decorate([
    (0, common_1.Get)('search'),
    (0, roles_guard_1.Public)(),
    (0, swagger_1.ApiOperation)({ summary: 'Text search properties' }),
    (0, swagger_1.ApiQuery)({ name: 'q', required: true, type: String, description: 'Search query' }),
    (0, swagger_1.ApiQuery)({ name: 'page', required: false, type: Number }),
    (0, swagger_1.ApiQuery)({ name: 'limit', required: false, type: Number }),
    (0, swagger_1.ApiQuery)({ name: 'city', required: false, type: String }),
    (0, swagger_1.ApiQuery)({ name: 'propertyType', required: false, enum: property_schema_1.PropertyType }),
    (0, swagger_1.ApiQuery)({ name: 'minPrice', required: false, type: Number }),
    (0, swagger_1.ApiQuery)({ name: 'maxPrice', required: false, type: Number }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Search results' }),
    (0, swagger_1.ApiResponse)({ status: 400, description: 'Search query is required' }),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], PropertiesController.prototype, "searchByText", null);
__decorate([
    (0, common_1.Get)('most-viewed'),
    (0, roles_guard_1.Public)(),
    (0, swagger_1.ApiOperation)({ summary: 'Get most viewed properties' }),
    (0, swagger_1.ApiQuery)({ name: 'limit', required: false, type: Number, description: 'Maximum results (default: 10)' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Most viewed properties' }),
    __param(0, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], PropertiesController.prototype, "getMostViewed", null);
__decorate([
    (0, common_1.Get)('recent'),
    (0, roles_guard_1.Public)(),
    (0, swagger_1.ApiOperation)({ summary: 'Get recently added properties' }),
    (0, swagger_1.ApiQuery)({ name: 'limit', required: false, type: Number, description: 'Maximum results (default: 10)' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Recent properties' }),
    __param(0, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], PropertiesController.prototype, "getRecent", null);
__decorate([
    (0, common_1.Get)('featured'),
    (0, roles_guard_1.Public)(),
    (0, swagger_1.ApiOperation)({ summary: 'Get featured properties' }),
    (0, swagger_1.ApiQuery)({ name: 'limit', required: false, type: Number, description: 'Maximum results (default: 10)' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Featured properties' }),
    __param(0, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], PropertiesController.prototype, "getFeatured", null);
__decorate([
    (0, common_1.Get)('popular-cities'),
    (0, roles_guard_1.Public)(),
    (0, swagger_1.ApiOperation)({ summary: 'Get popular cities with property counts' }),
    (0, swagger_1.ApiQuery)({ name: 'limit', required: false, type: Number, description: 'Maximum results (default: 10)' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Popular cities' }),
    __param(0, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], PropertiesController.prototype, "getPopularCities", null);
__decorate([
    (0, common_1.Get)('admin/all'),
    (0, roles_guard_1.Roles)(user_schema_1.UserRole.ADMIN),
    (0, swagger_1.ApiOperation)({ summary: 'Admin: Get all properties with any approval status' }),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiQuery)({ name: 'approvalStatus', required: false, enum: property_schema_1.ApprovalStatus }),
    (0, swagger_1.ApiQuery)({ name: 'propertyType', required: false, enum: property_schema_1.PropertyType }),
    (0, swagger_1.ApiQuery)({ name: 'listingType', required: false, enum: property_schema_1.ListingType }),
    (0, swagger_1.ApiQuery)({ name: 'city', required: false, type: String }),
    (0, swagger_1.ApiQuery)({ name: 'search', required: false, type: String }),
    (0, swagger_1.ApiQuery)({ name: 'page', required: false, type: Number }),
    (0, swagger_1.ApiQuery)({ name: 'limit', required: false, type: Number }),
    (0, swagger_1.ApiQuery)({ name: 'sortBy', required: false, type: String }),
    (0, swagger_1.ApiQuery)({ name: 'sortOrder', required: false, enum: ['asc', 'desc'] }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'All properties retrieved' }),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], PropertiesController.prototype, "adminGetAllProperties", null);
__decorate([
    (0, common_1.Patch)(':id/approve'),
    (0, roles_guard_1.Roles)(user_schema_1.UserRole.ADMIN),
    (0, swagger_1.ApiOperation)({ summary: 'Admin: Approve a property listing' }),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'Property ID' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Property approved' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], PropertiesController.prototype, "approveProperty", null);
__decorate([
    (0, common_1.Patch)(':id/reject'),
    (0, roles_guard_1.Roles)(user_schema_1.UserRole.ADMIN),
    (0, swagger_1.ApiOperation)({ summary: 'Admin: Reject a property listing' }),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'Property ID' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Property rejected' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], PropertiesController.prototype, "rejectProperty", null);
__decorate([
    (0, common_1.Get)('short-term'),
    (0, roles_guard_1.Public)(),
    (0, swagger_1.ApiOperation)({ summary: 'Browse short-term / hospitality listings (hotels, vacation rentals, etc.)' }),
    (0, swagger_1.ApiQuery)({ name: 'page', required: false, type: Number }),
    (0, swagger_1.ApiQuery)({ name: 'limit', required: false, type: Number }),
    (0, swagger_1.ApiQuery)({ name: 'city', required: false, type: String }),
    (0, swagger_1.ApiQuery)({ name: 'minPrice', required: false, type: Number }),
    (0, swagger_1.ApiQuery)({ name: 'maxPrice', required: false, type: Number }),
    (0, swagger_1.ApiQuery)({ name: 'propertyType', required: false, enum: property_schema_1.PropertyType }),
    (0, swagger_1.ApiQuery)({ name: 'isInstantBookable', required: false, type: Boolean }),
    (0, swagger_1.ApiQuery)({ name: 'minGuests', required: false, type: Number }),
    (0, swagger_1.ApiQuery)({ name: 'cancellationPolicy', required: false, enum: property_schema_1.CancellationPolicy }),
    (0, swagger_1.ApiQuery)({ name: 'pricingUnit', required: false, enum: property_schema_1.PricingUnit }),
    (0, swagger_1.ApiQuery)({ name: 'checkIn', required: false, type: String, description: 'ISO date' }),
    (0, swagger_1.ApiQuery)({ name: 'checkOut', required: false, type: String, description: 'ISO date' }),
    (0, swagger_1.ApiQuery)({ name: 'latitude', required: false, type: Number }),
    (0, swagger_1.ApiQuery)({ name: 'longitude', required: false, type: Number }),
    (0, swagger_1.ApiQuery)({ name: 'radius', required: false, type: Number, description: 'km' }),
    (0, swagger_1.ApiQuery)({ name: 'sortBy', required: false, type: String }),
    (0, swagger_1.ApiQuery)({ name: 'sortOrder', required: false, enum: ['asc', 'desc'] }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Paginated short-term listings' }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], PropertiesController.prototype, "getShortTermListings", null);
__decorate([
    (0, common_1.Get)(':id/short-term-details'),
    (0, roles_guard_1.Public)(),
    (0, swagger_1.ApiOperation)({ summary: 'Get short-term property with booking widget data (check-in time, maxGuests, etc.)' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'Property ID' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Short-term property detail' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Not found or not a short-term listing' }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], PropertiesController.prototype, "getShortTermById", null);
__decorate([
    (0, common_1.Get)(':id/blocked-dates'),
    (0, roles_guard_1.Public)(),
    (0, swagger_1.ApiOperation)({ summary: 'Get host-blocked date ranges for a property (calendar widget)' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'Property ID' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Array of blocked date ranges' }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], PropertiesController.prototype, "getBlockedDates", null);
__decorate([
    (0, common_1.Post)(':id/block-dates'),
    (0, roles_guard_1.Roles)(user_schema_1.UserRole.HOST, user_schema_1.UserRole.AGENT, user_schema_1.UserRole.LANDLORD, user_schema_1.UserRole.ADMIN),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({ summary: 'Host blocks date ranges on a short-term property' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'Property ID' }),
    (0, swagger_1.ApiResponse)({ status: 201, description: 'Dates blocked successfully' }),
    (0, swagger_1.ApiResponse)({ status: 400, description: 'Invalid dates or not a short-term listing' }),
    (0, swagger_1.ApiResponse)({ status: 403, description: 'Not your property' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, property_dto_1.BlockDatesDto, Object]),
    __metadata("design:returntype", Promise)
], PropertiesController.prototype, "blockDates", null);
__decorate([
    (0, common_1.Delete)(':id/block-dates'),
    (0, roles_guard_1.Roles)(user_schema_1.UserRole.HOST, user_schema_1.UserRole.AGENT, user_schema_1.UserRole.LANDLORD, user_schema_1.UserRole.ADMIN),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Host removes previously blocked date ranges' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'Property ID' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Dates unblocked successfully' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, property_dto_1.UnblockDatesDto, Object]),
    __metadata("design:returntype", Promise)
], PropertiesController.prototype, "unblockDates", null);
__decorate([
    (0, common_1.Get)(':id/calendar/settings'),
    (0, roles_guard_1.Roles)(user_schema_1.UserRole.HOST, user_schema_1.UserRole.AGENT, user_schema_1.UserRole.LANDLORD, user_schema_1.UserRole.ADMIN),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({ summary: 'Get host calendar pricing, rules, and external sync settings' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'Property ID' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Host calendar settings' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], PropertiesController.prototype, "getCalendarSettings", null);
__decorate([
    (0, common_1.Put)(':id/calendar/settings'),
    (0, roles_guard_1.Roles)(user_schema_1.UserRole.HOST, user_schema_1.UserRole.AGENT, user_schema_1.UserRole.LANDLORD, user_schema_1.UserRole.ADMIN),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({ summary: 'Update host calendar pricing rules and booking window' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'Property ID' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Updated host calendar settings' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, property_dto_1.UpdateCalendarSettingsDto, Object]),
    __metadata("design:returntype", Promise)
], PropertiesController.prototype, "updateCalendarSettings", null);
__decorate([
    (0, common_1.Put)(':id/calendar/prices'),
    (0, roles_guard_1.Roles)(user_schema_1.UserRole.HOST, user_schema_1.UserRole.AGENT, user_schema_1.UserRole.LANDLORD, user_schema_1.UserRole.ADMIN),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({ summary: 'Set or clear per-night custom price overrides for a date range' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'Property ID' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Updated price overrides' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, property_dto_1.SetCalendarPricesDto, Object]),
    __metadata("design:returntype", Promise)
], PropertiesController.prototype, "setCalendarPrices", null);
__decorate([
    (0, common_1.Post)(':id/calendar/external'),
    (0, roles_guard_1.Roles)(user_schema_1.UserRole.HOST, user_schema_1.UserRole.AGENT, user_schema_1.UserRole.LANDLORD, user_schema_1.UserRole.ADMIN),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({ summary: 'Add external iCal calendar feed' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'Property ID' }),
    (0, swagger_1.ApiResponse)({ status: 201, description: 'External calendar added' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, property_dto_1.AddExternalCalendarDto, Object]),
    __metadata("design:returntype", Promise)
], PropertiesController.prototype, "addExternalCalendar", null);
__decorate([
    (0, common_1.Delete)(':id/calendar/external/:calendarId'),
    (0, roles_guard_1.Roles)(user_schema_1.UserRole.HOST, user_schema_1.UserRole.AGENT, user_schema_1.UserRole.LANDLORD, user_schema_1.UserRole.ADMIN),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({ summary: 'Remove an external iCal calendar feed' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'Property ID' }),
    (0, swagger_1.ApiParam)({ name: 'calendarId', description: 'Calendar Feed ID' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'External calendar removed' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Param)('calendarId')),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", Promise)
], PropertiesController.prototype, "removeExternalCalendar", null);
__decorate([
    (0, common_1.Post)('tour/track'),
    (0, roles_guard_1.Public)(),
    (0, common_1.HttpCode)(common_1.HttpStatus.NO_CONTENT),
    (0, swagger_1.ApiOperation)({ summary: 'Track a virtual tour view (fire-and-forget)' }),
    (0, swagger_1.ApiResponse)({ status: 204, description: 'Tracked' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], PropertiesController.prototype, "trackTourView", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, roles_guard_1.Public)(),
    (0, swagger_1.ApiOperation)({ summary: 'Get property by ID' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'Property ID' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Property found' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Property not found' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], PropertiesController.prototype, "findOne", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, roles_guard_1.Roles)(user_schema_1.UserRole.HOST, user_schema_1.UserRole.AGENT, user_schema_1.UserRole.LANDLORD, user_schema_1.UserRole.ADMIN),
    (0, swagger_1.ApiOperation)({ summary: 'Update property' }),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'Property ID' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Property updated successfully' }),
    (0, swagger_1.ApiResponse)({ status: 403, description: 'Forbidden - Can only update own properties' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Property not found' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, property_dto_1.UpdatePropertyDto, Object]),
    __metadata("design:returntype", Promise)
], PropertiesController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, roles_guard_1.Roles)(user_schema_1.UserRole.HOST, user_schema_1.UserRole.AGENT, user_schema_1.UserRole.LANDLORD, user_schema_1.UserRole.ADMIN),
    (0, swagger_1.ApiOperation)({ summary: 'Delete property' }),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'Property ID' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Property deleted successfully' }),
    (0, swagger_1.ApiResponse)({ status: 403, description: 'Forbidden - Can only delete own properties' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Property not found' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], PropertiesController.prototype, "remove", null);
__decorate([
    (0, common_1.Get)('my/properties'),
    (0, roles_guard_1.Roles)(user_schema_1.UserRole.HOST, user_schema_1.UserRole.AGENT, user_schema_1.UserRole.LANDLORD, user_schema_1.UserRole.ADMIN),
    (0, swagger_1.ApiOperation)({ summary: 'Get current user\'s properties' }),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiQuery)({ name: 'page', required: false, type: Number }),
    (0, swagger_1.ApiQuery)({ name: 'limit', required: false, type: Number }),
    (0, swagger_1.ApiQuery)({ name: 'propertyType', required: false, enum: property_schema_1.PropertyType }),
    (0, swagger_1.ApiQuery)({ name: 'listingType', required: false, enum: property_schema_1.ListingType }),
    (0, swagger_1.ApiQuery)({ name: 'city', required: false, type: String }),
    (0, swagger_1.ApiQuery)({ name: 'minPrice', required: false, type: Number }),
    (0, swagger_1.ApiQuery)({ name: 'maxPrice', required: false, type: Number }),
    (0, swagger_1.ApiQuery)({ name: 'includeInactive', required: false, type: Boolean, description: 'Include inactive properties' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'User properties retrieved' }),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], PropertiesController.prototype, "getMyProperties", null);
__decorate([
    (0, common_1.Patch)(':id/feature'),
    (0, roles_guard_1.Roles)(user_schema_1.UserRole.ADMIN),
    (0, swagger_1.ApiOperation)({ summary: 'Toggle property featured status (Admin only)' }),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'Property ID' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Property featured status updated' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], PropertiesController.prototype, "toggleFeatured", null);
__decorate([
    (0, common_1.Patch)(':id/verify'),
    (0, roles_guard_1.Roles)(user_schema_1.UserRole.ADMIN),
    (0, swagger_1.ApiOperation)({ summary: 'Toggle property verification status (Admin only)' }),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'Property ID' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Property verification status updated' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], PropertiesController.prototype, "toggleVerified", null);
__decorate([
    (0, common_1.Patch)(':id/activate'),
    (0, roles_guard_1.Roles)(user_schema_1.UserRole.HOST, user_schema_1.UserRole.AGENT, user_schema_1.UserRole.LANDLORD, user_schema_1.UserRole.ADMIN),
    (0, swagger_1.ApiOperation)({ summary: 'Toggle property active status' }),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'Property ID' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Property active status updated' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], PropertiesController.prototype, "toggleActive", null);
__decorate([
    (0, common_1.Post)(':id/favorite'),
    (0, roles_guard_1.Roles)(user_schema_1.UserRole.REGISTERED_USER, user_schema_1.UserRole.HOST, user_schema_1.UserRole.AGENT, user_schema_1.UserRole.LANDLORD, user_schema_1.UserRole.ADMIN),
    (0, swagger_1.ApiOperation)({ summary: 'Add property to favorites' }),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'Property ID' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Property added to favorites' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Property not found' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], PropertiesController.prototype, "addToFavorites", null);
__decorate([
    (0, common_1.Delete)(':id/favorite'),
    (0, roles_guard_1.Roles)(user_schema_1.UserRole.REGISTERED_USER, user_schema_1.UserRole.HOST, user_schema_1.UserRole.AGENT, user_schema_1.UserRole.LANDLORD, user_schema_1.UserRole.ADMIN),
    (0, swagger_1.ApiOperation)({ summary: 'Remove property from favorites' }),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'Property ID' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Property removed from favorites' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Property not found' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], PropertiesController.prototype, "removeFromFavorites", null);
__decorate([
    (0, common_1.Get)('my/favorites'),
    (0, roles_guard_1.Roles)(user_schema_1.UserRole.REGISTERED_USER, user_schema_1.UserRole.HOST, user_schema_1.UserRole.AGENT, user_schema_1.UserRole.LANDLORD, user_schema_1.UserRole.ADMIN),
    (0, swagger_1.ApiOperation)({ summary: 'Get current user\'s favorite properties' }),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiQuery)({ name: 'page', required: false, type: Number }),
    (0, swagger_1.ApiQuery)({ name: 'limit', required: false, type: Number }),
    (0, swagger_1.ApiQuery)({ name: 'sortBy', required: false, type: String }),
    (0, swagger_1.ApiQuery)({ name: 'sortOrder', required: false, enum: ['asc', 'desc'] }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'User favorite properties retrieved' }),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], PropertiesController.prototype, "getMyFavorites", null);
__decorate([
    (0, common_1.Get)(':id/similar'),
    (0, roles_guard_1.Public)(),
    (0, swagger_1.ApiOperation)({ summary: 'Get similar properties' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'Property ID' }),
    (0, swagger_1.ApiQuery)({ name: 'limit', required: false, type: Number, description: 'Maximum results (default: 6)' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Similar properties found' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Property not found' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], PropertiesController.prototype, "getSimilarProperties", null);
__decorate([
    (0, common_1.Post)(':id/images'),
    (0, roles_guard_1.Roles)(user_schema_1.UserRole.HOST, user_schema_1.UserRole.AGENT, user_schema_1.UserRole.LANDLORD, user_schema_1.UserRole.ADMIN),
    (0, swagger_1.ApiOperation)({ summary: 'Upload property images' }),
    (0, swagger_1.ApiBearerAuth)(),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], PropertiesController.prototype, "uploadImages", null);
__decorate([
    (0, common_1.Delete)(':id/images/:imageId'),
    (0, roles_guard_1.Roles)(user_schema_1.UserRole.HOST, user_schema_1.UserRole.AGENT, user_schema_1.UserRole.LANDLORD, user_schema_1.UserRole.ADMIN),
    (0, swagger_1.ApiOperation)({ summary: 'Delete property image' }),
    (0, swagger_1.ApiBearerAuth)(),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Param)('imageId')),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", Promise)
], PropertiesController.prototype, "deleteImage", null);
__decorate([
    (0, common_1.Post)(':id/videos'),
    (0, roles_guard_1.Roles)(user_schema_1.UserRole.HOST, user_schema_1.UserRole.AGENT, user_schema_1.UserRole.LANDLORD, user_schema_1.UserRole.ADMIN),
    (0, swagger_1.ApiOperation)({ summary: 'Upload property videos' }),
    (0, swagger_1.ApiBearerAuth)(),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], PropertiesController.prototype, "uploadVideos", null);
__decorate([
    (0, common_1.Delete)(':id/videos/:videoId'),
    (0, roles_guard_1.Roles)(user_schema_1.UserRole.HOST, user_schema_1.UserRole.AGENT, user_schema_1.UserRole.LANDLORD, user_schema_1.UserRole.ADMIN),
    (0, swagger_1.ApiOperation)({ summary: 'Delete property video' }),
    (0, swagger_1.ApiBearerAuth)(),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Param)('videoId')),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", Promise)
], PropertiesController.prototype, "deleteVideo", null);
exports.PropertiesController = PropertiesController = PropertiesController_1 = __decorate([
    (0, swagger_1.ApiTags)('Properties'),
    (0, common_1.Controller)('properties'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    __metadata("design:paramtypes", [properties_service_1.PropertiesService])
], PropertiesController);
//# sourceMappingURL=properties.controller.js.map