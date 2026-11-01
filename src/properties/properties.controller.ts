import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  Req,
  BadRequestException,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery, ApiParam } from '@nestjs/swagger';
import { FastifyRequest } from 'fastify';
import { MultipartFile } from '@fastify/multipart';
// Fastify multipart provides files on request via parts()

import { PropertiesService, PropertySearchFilters, PropertySearchOptions } from './properties.service';
import {
  CreatePropertyDto,
  UpdatePropertyDto,
  BlockDatesDto,
  UnblockDatesDto,
  UpdateCalendarSettingsDto,
  SetCalendarPricesDto,
  AddExternalCalendarDto,
} from './dto/property.dto';
import { JwtAuthGuard } from '../auth/guards/jwt.auth.guard';
import { RolesGuard, Roles, Public } from '../auth/guards/roles.guard';
import { User, UserRole } from '../users/schemas/user.schema';
import { PropertyType, ListingType, ApprovalStatus, PricingUnit, CancellationPolicy } from './schemas/property.schema';

// DTOs for API documentation
class CreatePropertyRequestDto {
  title: string;
  price: number;
  type: PropertyType;
  listingType: ListingType;
  description: string;
  city: string;
  address: string;
  neighborhood?: string;
  country: string;
  latitude: number;
  longitude: number;
  amenities?: any;
  images?: any[];
  contactPhone?: string;
  contactEmail?: string;
  area?: number;
  yearBuilt?: number;
  keywords?: string[];
  nearbyAmenities?: string[];
  transportAccess?: string[];
}

class UpdatePropertyRequestDto extends CreatePropertyRequestDto {
  availability?: string;
  isVerified?: boolean;
  isFeatured?: boolean;
  isActive?: boolean;
}

@ApiTags('Properties')
@Controller('properties')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PropertiesController {
  private readonly logger = new Logger(PropertiesController.name);

  constructor(private readonly propertiesService: PropertiesService) { }

  @Post()
  @Roles(UserRole.HOST, UserRole.AGENT, UserRole.LANDLORD, UserRole.ADMIN)
  @ApiOperation({ summary: 'Create a new property' })
  @ApiBearerAuth()
  @ApiResponse({ status: 201, description: 'Property created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 403, description: 'Forbidden - Only agents and admins can create properties' })
  async create(
    @Body() createPropertyDto: CreatePropertyDto,
    @Req() req: FastifyRequest & { user: User },
  ) {
    return this.propertiesService.create(createPropertyDto, req.user);
  }

  @Get()
  @Public()
  @ApiOperation({ summary: 'Get all properties with filtering and search' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page' })
  @ApiQuery({ name: 'minPrice', required: false, type: Number, description: 'Minimum price' })
  @ApiQuery({ name: 'maxPrice', required: false, type: Number, description: 'Maximum price' })
  @ApiQuery({ name: 'propertyType', required: false, enum: PropertyType, description: 'Property type' })
  @ApiQuery({ name: 'listingType', required: false, enum: ListingType, description: 'Listing type (sale/rent)' })
  @ApiQuery({ name: 'city', required: false, type: String, description: 'City name' })
  @ApiQuery({ name: 'bedrooms', required: false, type: Number, description: 'Minimum bedrooms' })
  @ApiQuery({ name: 'bathrooms', required: false, type: Number, description: 'Minimum bathrooms' })
  @ApiQuery({ name: 'latitude', required: false, type: Number, description: 'Latitude for location search' })
  @ApiQuery({ name: 'longitude', required: false, type: Number, description: 'Longitude for location search' })
  @ApiQuery({ name: 'radius', required: false, type: Number, description: 'Search radius in kilometers' })
  @ApiQuery({ name: 'sortBy', required: false, type: String, description: 'Sort by field' })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['asc', 'desc'], description: 'Sort order' })
  @ApiResponse({ status: 200, description: 'Properties retrieved successfully' })
  @ApiQuery({ name: 'isInstantBookable', required: false, type: Boolean })
  @ApiQuery({ name: 'minGuests', required: false, type: Number })
  @ApiQuery({ name: 'cancellationPolicy', required: false, enum: CancellationPolicy })
  @ApiQuery({ name: 'pricingUnit', required: false, enum: PricingUnit })
  @ApiQuery({ name: 'checkIn', required: false, type: String, description: 'ISO date — filters available properties' })
  @ApiQuery({ name: 'checkOut', required: false, type: String, description: 'ISO date — filters available properties' })
  @ApiQuery({ name: 'minArea', required: false, type: Number, description: 'Minimum area in m² (rent/sale)' })
  @ApiQuery({ name: 'maxArea', required: false, type: Number, description: 'Maximum area in m² (rent/sale)' })
  @ApiQuery({ name: 'furnished', required: false, type: Boolean, description: 'Filter furnished properties' })
  @ApiQuery({ name: 'neighborhood', required: false, type: String, description: 'Neighborhood / quarter' })


  async findAll(
    @Query() query: any,
    @Req() req: FastifyRequest & { user?: User },
  ) {
    const filters: PropertySearchFilters = {
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
      // Long-term / landlord filters
      minArea: query.minArea ? parseFloat(query.minArea) : undefined,
      maxArea: query.maxArea ? parseFloat(query.maxArea) : undefined,
      furnished: query.furnished !== undefined ? query.furnished === 'true' : undefined,
      neighborhood: query.neighborhood,
    };

    // Handle bounding box search
    if (query.bounds) {
      try {
        filters.bounds = JSON.parse(query.bounds);
      } catch (error) {
        throw new BadRequestException('Invalid bounds format');
      }
    }

    const options: PropertySearchOptions = {
      page: query.page ? parseInt(query.page) : 1,
      limit: query.limit ? parseInt(query.limit) : 20,
      sortBy: query.sortBy || 'createdAt',
      sortOrder: query.sortOrder || 'desc',
    };

    return this.propertiesService.findAll(filters, options, req.user);
  }

  @Get('nearby')
  @Public()
  @ApiOperation({ summary: 'Find properties near a location' })
  @ApiQuery({ name: 'latitude', required: true, type: Number })
  @ApiQuery({ name: 'longitude', required: true, type: Number })
  @ApiQuery({ name: 'radius', required: false, type: Number, description: 'Radius in kilometers (default: 5)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Maximum results (default: 10)' })
  @ApiResponse({ status: 200, description: 'Nearby properties found' })
  @ApiResponse({ status: 400, description: 'Invalid coordinates' })
  async findNearby(
    @Query('latitude') latitude: string,
    @Query('longitude') longitude: string,
    @Req() req: FastifyRequest & { user?: User },
    @Query('radius') radius?: string,
    @Query('limit') limit?: string,
  ) {
    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);
    const radiusKm = radius ? parseFloat(radius) : 5;
    const maxResults = limit ? parseInt(limit) : 10;

    if (isNaN(lat) || isNaN(lng)) {
      throw new BadRequestException('Valid latitude and longitude are required');
    }

    return this.propertiesService.findNearby(lat, lng, radiusKm, maxResults, req?.user);
  }

  @Get('search')
  @Public()
  @ApiOperation({ summary: 'Text search properties' })
  @ApiQuery({ name: 'q', required: true, type: String, description: 'Search query' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'city', required: false, type: String })
  @ApiQuery({ name: 'propertyType', required: false, enum: PropertyType })
  @ApiQuery({ name: 'minPrice', required: false, type: Number })
  @ApiQuery({ name: 'maxPrice', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Search results' })
  @ApiResponse({ status: 400, description: 'Search query is required' })
  async searchByText(
    @Query() query: any,
    @Req() req: FastifyRequest & { user?: User },
  ) {
    if (!query.q) {
      throw new BadRequestException('Search query (q) is required');
    }

    const filters: PropertySearchFilters = {
      city: query.city,
      propertyType: query.propertyType,
      minPrice: query.minPrice ? parseFloat(query.minPrice) : undefined,
      maxPrice: query.maxPrice ? parseFloat(query.maxPrice) : undefined,
    };

    const options: PropertySearchOptions = {
      page: query.page ? parseInt(query.page) : 1,
      limit: query.limit ? parseInt(query.limit) : 20,
    };

    return this.propertiesService.searchByText(query.q, filters, options, req.user);
  }

  @Get('most-viewed')
  @Public()
  @ApiOperation({ summary: 'Get most viewed properties' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Maximum results (default: 10)' })
  @ApiResponse({ status: 200, description: 'Most viewed properties' })
  async getMostViewed(@Query('limit') limit?: string) {
    const maxResults = limit ? parseInt(limit) : 10;
    return this.propertiesService.getMostViewed(maxResults);
  }

  @Get('recent')
  @Public()
  @ApiOperation({ summary: 'Get recently added properties' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Maximum results (default: 10)' })
  @ApiResponse({ status: 200, description: 'Recent properties' })
  async getRecent(@Query('limit') limit?: string) {
    const maxResults = limit ? parseInt(limit) : 10;
    return this.propertiesService.getRecent(maxResults);
  }

  @Get('featured')
  @Public()
  @ApiOperation({ summary: 'Get featured properties' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Maximum results (default: 10)' })
  @ApiResponse({ status: 200, description: 'Featured properties' })
  async getFeatured(@Query('limit') limit?: string) {
    const maxResults = limit ? parseInt(limit) : 10;
    return this.propertiesService.getFeatured(maxResults);
  }

  @Get('popular-cities')
  @Public()
  @ApiOperation({ summary: 'Get popular cities with property counts' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Maximum results (default: 10)' })
  @ApiResponse({ status: 200, description: 'Popular cities' })
  async getPopularCities(@Query('limit') limit?: string) {
    const maxResults = limit ? parseInt(limit) : 10;
    return this.propertiesService.getPopularCities(maxResults);
  }

  // ─── Admin approval endpoints ───────────────────────────────────────────────

  @Get('admin/all')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Admin: Get all properties with any approval status' })
  @ApiBearerAuth()
  @ApiQuery({ name: 'approvalStatus', required: false, enum: ApprovalStatus })
  @ApiQuery({ name: 'propertyType', required: false, enum: PropertyType })
  @ApiQuery({ name: 'listingType', required: false, enum: ListingType })
  @ApiQuery({ name: 'city', required: false, type: String })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'sortBy', required: false, type: String })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['asc', 'desc'] })
  @ApiResponse({ status: 200, description: 'All properties retrieved' })
  async adminGetAllProperties(
    @Query() query: any,
    @Req() req: FastifyRequest & { user: User },
  ) {
    const filters = {
      approvalStatus: query.approvalStatus as ApprovalStatus | undefined,
      propertyType: query.propertyType as PropertyType | undefined,
      listingType: query.listingType as ListingType | undefined,
      city: query.city,
      search: query.search,
      ownerId: query.ownerId,
    };
    const options = {
      page: query.page ? parseInt(query.page) : 1,
      limit: query.limit ? parseInt(query.limit) : 20,
      sortBy: query.sortBy || 'createdAt',
      sortOrder: (query.sortOrder || 'desc') as 'asc' | 'desc',
    };
    return this.propertiesService.getAllPropertiesAdmin(filters, options);
  }

  @Patch(':id/approve')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Admin: Approve a property listing' })
  @ApiBearerAuth()
  @ApiParam({ name: 'id', description: 'Property ID' })
  @ApiResponse({ status: 200, description: 'Property approved' })
  async approveProperty(
    @Param('id') id: string,
    @Req() req: FastifyRequest & { user: User },
  ) {
    return this.propertiesService.approveProperty(id, req.user);
  }

  @Patch(':id/reject')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Admin: Reject a property listing' })
  @ApiBearerAuth()
  @ApiParam({ name: 'id', description: 'Property ID' })
  @ApiResponse({ status: 200, description: 'Property rejected' })
  async rejectProperty(
    @Param('id') id: string,
    @Body() body: { reason?: string },
    @Req() req: FastifyRequest & { user: User },
  ) {
    return this.propertiesService.rejectProperty(id, body.reason, req.user);
  }

  @Get('short-term')
  @Public()
  @ApiOperation({ summary: 'Browse short-term / hospitality listings (hotels, vacation rentals, etc.)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'city', required: false, type: String })
  @ApiQuery({ name: 'minPrice', required: false, type: Number })
  @ApiQuery({ name: 'maxPrice', required: false, type: Number })
  @ApiQuery({ name: 'propertyType', required: false, enum: PropertyType })
  @ApiQuery({ name: 'isInstantBookable', required: false, type: Boolean })
  @ApiQuery({ name: 'minGuests', required: false, type: Number })
  @ApiQuery({ name: 'cancellationPolicy', required: false, enum: CancellationPolicy })
  @ApiQuery({ name: 'pricingUnit', required: false, enum: PricingUnit })
  @ApiQuery({ name: 'checkIn', required: false, type: String, description: 'ISO date' })
  @ApiQuery({ name: 'checkOut', required: false, type: String, description: 'ISO date' })
  @ApiQuery({ name: 'latitude', required: false, type: Number })
  @ApiQuery({ name: 'longitude', required: false, type: Number })
  @ApiQuery({ name: 'radius', required: false, type: Number, description: 'km' })
  @ApiQuery({ name: 'sortBy', required: false, type: String })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['asc', 'desc'] })
  @ApiResponse({ status: 200, description: 'Paginated short-term listings' })
  async getShortTermListings(@Query() query: any) {
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

  // ══ 2. Short-term detail — enriched with booking widget data (PUBLIC) ═════════

  @Get(':id/short-term-details')
  @Public()
  @ApiOperation({ summary: 'Get short-term property with booking widget data (check-in time, maxGuests, etc.)' })
  @ApiParam({ name: 'id', description: 'Property ID' })
  @ApiResponse({ status: 200, description: 'Short-term property detail' })
  @ApiResponse({ status: 404, description: 'Not found or not a short-term listing' })
  async getShortTermById(@Param('id') id: string) {
    return this.propertiesService.getShortTermById(id);
  }

  // ══ 3. Get blocked dates for a property (PUBLIC) ══════════════════════════════

  @Get(':id/blocked-dates')
  @Public()
  @ApiOperation({ summary: 'Get host-blocked date ranges for a property (calendar widget)' })
  @ApiParam({ name: 'id', description: 'Property ID' })
  @ApiResponse({ status: 200, description: 'Array of blocked date ranges' })
  async getBlockedDates(@Param('id') id: string) {
    return this.propertiesService.getBlockedDates(id);
  }

  // ══ 4. Block dates — host only ════════════════════════════════════════════════

  @Post(':id/block-dates')
  @Roles(UserRole.HOST, UserRole.AGENT, UserRole.LANDLORD, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Host blocks date ranges on a short-term property' })
  @ApiParam({ name: 'id', description: 'Property ID' })
  @ApiResponse({ status: 201, description: 'Dates blocked successfully' })
  @ApiResponse({ status: 400, description: 'Invalid dates or not a short-term listing' })
  @ApiResponse({ status: 403, description: 'Not your property' })
  async blockDates(
    @Param('id') id: string,
    @Body() dto: BlockDatesDto,
    @Req() req: FastifyRequest & { user: User },
  ) {
    return this.propertiesService.blockDates(id, dto, req.user);
  }

  // ══ 5. Unblock dates — host only ══════════════════════════════════════════════

  @Delete(':id/block-dates')
  @Roles(UserRole.HOST, UserRole.AGENT, UserRole.LANDLORD, UserRole.ADMIN)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Host removes previously blocked date ranges' })
  @ApiParam({ name: 'id', description: 'Property ID' })
  @ApiResponse({ status: 200, description: 'Dates unblocked successfully' })
  async unblockDates(
    @Param('id') id: string,
    @Body() dto: UnblockDatesDto,
    @Req() req: FastifyRequest & { user: User },
  ) {
    return this.propertiesService.unblockDates(id, dto, req.user);
  }

  // ══ 6. Host Calendar Settings ═════════════════════════════════════════════════

  @Get(':id/calendar/settings')
  @Roles(UserRole.HOST, UserRole.AGENT, UserRole.LANDLORD, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get host calendar pricing, rules, and external sync settings' })
  @ApiParam({ name: 'id', description: 'Property ID' })
  @ApiResponse({ status: 200, description: 'Host calendar settings' })
  async getCalendarSettings(
    @Param('id') id: string,
    @Req() req: FastifyRequest & { user: User },
  ) {
    return this.propertiesService.getCalendarSettings(id, req.user);
  }

  @Put(':id/calendar/settings')
  @Roles(UserRole.HOST, UserRole.AGENT, UserRole.LANDLORD, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update host calendar pricing rules and booking window' })
  @ApiParam({ name: 'id', description: 'Property ID' })
  @ApiResponse({ status: 200, description: 'Updated host calendar settings' })
  async updateCalendarSettings(
    @Param('id') id: string,
    @Body() dto: UpdateCalendarSettingsDto,
    @Req() req: FastifyRequest & { user: User },
  ) {
    return this.propertiesService.updateCalendarSettings(id, dto, req.user);
  }

  @Put(':id/calendar/prices')
  @Roles(UserRole.HOST, UserRole.AGENT, UserRole.LANDLORD, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Set or clear per-night custom price overrides for a date range' })
  @ApiParam({ name: 'id', description: 'Property ID' })
  @ApiResponse({ status: 200, description: 'Updated price overrides' })
  async setCalendarPrices(
    @Param('id') id: string,
    @Body() dto: SetCalendarPricesDto,
    @Req() req: FastifyRequest & { user: User },
  ) {
    return this.propertiesService.setCalendarPrices(id, dto, req.user);
  }

  @Post(':id/calendar/external')
  @Roles(UserRole.HOST, UserRole.AGENT, UserRole.LANDLORD, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add external iCal calendar feed' })
  @ApiParam({ name: 'id', description: 'Property ID' })
  @ApiResponse({ status: 201, description: 'External calendar added' })
  async addExternalCalendar(
    @Param('id') id: string,
    @Body() dto: AddExternalCalendarDto,
    @Req() req: FastifyRequest & { user: User },
  ) {
    return this.propertiesService.addExternalCalendar(id, dto, req.user);
  }

  @Delete(':id/calendar/external/:calendarId')
  @Roles(UserRole.HOST, UserRole.AGENT, UserRole.LANDLORD, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Remove an external iCal calendar feed' })
  @ApiParam({ name: 'id', description: 'Property ID' })
  @ApiParam({ name: 'calendarId', description: 'Calendar Feed ID' })
  @ApiResponse({ status: 200, description: 'External calendar removed' })
  async removeExternalCalendar(
    @Param('id') id: string,
    @Param('calendarId') calendarId: string,
    @Req() req: FastifyRequest & { user: User },
  ) {
    return this.propertiesService.removeExternalCalendar(id, calendarId, req.user);
  }

  @Post('tour/track')
  @Public()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Track a virtual tour view (fire-and-forget)' })
  @ApiResponse({ status: 204, description: 'Tracked' })
  async trackTourView(@Body() body: { propertyId: string }): Promise<void> {
    if (body?.propertyId) {
      // Intentionally not awaited — never block the response
      this.propertiesService.trackTourView(body.propertyId).catch(() => { });
    }
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Get property by ID' })
  @ApiParam({ name: 'id', description: 'Property ID' })
  @ApiResponse({ status: 200, description: 'Property found' })
  @ApiResponse({ status: 404, description: 'Property not found' })
  async findOne(
    @Param('id') id: string,
    @Req() req: FastifyRequest & { user?: User },
  ) {
    return this.propertiesService.findOne(id, req.user);
  }

  @Patch(':id')
  @Roles(UserRole.HOST, UserRole.AGENT, UserRole.LANDLORD, UserRole.ADMIN)
  @ApiOperation({ summary: 'Update property' })
  @ApiBearerAuth()
  @ApiParam({ name: 'id', description: 'Property ID' })
  @ApiResponse({ status: 200, description: 'Property updated successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - Can only update own properties' })
  @ApiResponse({ status: 404, description: 'Property not found' })
  async update(
    @Param('id') id: string,
    @Body() updatePropertyDto: UpdatePropertyDto,
    @Req() req: FastifyRequest & { user: User },
  ) {
    return this.propertiesService.update(id, updatePropertyDto, req.user);
  }

  @Delete(':id')
  @Roles(UserRole.HOST, UserRole.AGENT, UserRole.LANDLORD, UserRole.ADMIN)
  @ApiOperation({ summary: 'Delete property' })
  @ApiBearerAuth()
  @ApiParam({ name: 'id', description: 'Property ID' })
  @ApiResponse({ status: 200, description: 'Property deleted successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - Can only delete own properties' })
  @ApiResponse({ status: 404, description: 'Property not found' })
  async remove(
    @Param('id') id: string,
    @Req() req: FastifyRequest & { user: User },
  ) {
    await this.propertiesService.remove(id, req.user);
    return { message: 'Property deleted successfully' };
  }

  // Property management endpoints for agents/admins
  @Get('my/properties')
  @Roles(UserRole.HOST, UserRole.AGENT, UserRole.LANDLORD, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get current user\'s properties' })
  @ApiBearerAuth()
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'propertyType', required: false, enum: PropertyType })
  @ApiQuery({ name: 'listingType', required: false, enum: ListingType })
  @ApiQuery({ name: 'city', required: false, type: String })
  @ApiQuery({ name: 'minPrice', required: false, type: Number })
  @ApiQuery({ name: 'maxPrice', required: false, type: Number })
  @ApiQuery({ name: 'includeInactive', required: false, type: Boolean, description: 'Include inactive properties' })
  @ApiResponse({ status: 200, description: 'User properties retrieved' })
  async getMyProperties(
    @Query() query: any,
    @Req() req: FastifyRequest & { user: User },
  ) {
    const filters: PropertySearchFilters = {
      propertyType: query.propertyType,
      listingType: query.listingType,
      city: query.city,
      minPrice: query.minPrice ? parseFloat(query.minPrice) : undefined,
      maxPrice: query.maxPrice ? parseFloat(query.maxPrice) : undefined,
    };

    const options: PropertySearchOptions = {
      page: query.page ? parseInt(query.page) : 1,
      limit: query.limit ? parseInt(query.limit) : 20,
      sortBy: query.sortBy || 'createdAt',
      sortOrder: query.sortOrder || 'desc',
      includeInactive: query.includeInactive !== 'false', // Default to true for user's properties
    };

    // Get user ID - ensure it exists
    const userId = req.user._id?.toString();

    if (!userId) {
      throw new BadRequestException('User ID not found in request');
    }

    // Log for debugging
    this.logger.debug(`Fetching properties for user ${userId}`);
    return this.propertiesService.getMyProperties(filters, options, userId);
  }

  @Patch(':id/feature')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Toggle property featured status (Admin only)' })
  @ApiBearerAuth()
  @ApiParam({ name: 'id', description: 'Property ID' })
  @ApiResponse({ status: 200, description: 'Property featured status updated' })
  async toggleFeatured(
    @Param('id') id: string,
    @Body() body: { isFeatured: boolean },
    @Req() req: FastifyRequest & { user: User },
  ) {
    return this.propertiesService.update(id, { isFeatured: body.isFeatured }, req.user);
  }

  @Patch(':id/verify')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Toggle property verification status (Admin only)' })
  @ApiBearerAuth()
  @ApiParam({ name: 'id', description: 'Property ID' })
  @ApiResponse({ status: 200, description: 'Property verification status updated' })
  async toggleVerified(
    @Param('id') id: string,
    @Body() body: { isVerified: boolean },
    @Req() req: FastifyRequest & { user: User },
  ) {
    return this.propertiesService.update(id, { isVerified: body.isVerified }, req.user);
  }

  @Patch(':id/activate')
  @Roles(UserRole.HOST, UserRole.AGENT, UserRole.LANDLORD, UserRole.ADMIN)
  @ApiOperation({ summary: 'Toggle property active status' })
  @ApiBearerAuth()
  @ApiParam({ name: 'id', description: 'Property ID' })
  @ApiResponse({ status: 200, description: 'Property active status updated' })
  async toggleActive(
    @Param('id') id: string,
    @Body() body: { isActive: boolean },
    @Req() req: FastifyRequest & { user: User },
  ) {
    return this.propertiesService.update(id, { isActive: body.isActive }, req.user);
  }

  @Post(':id/favorite')
  @Roles(UserRole.REGISTERED_USER, UserRole.HOST, UserRole.AGENT, UserRole.LANDLORD, UserRole.ADMIN)
  @ApiOperation({ summary: 'Add property to favorites' })
  @ApiBearerAuth()
  @ApiParam({ name: 'id', description: 'Property ID' })
  @ApiResponse({ status: 200, description: 'Property added to favorites' })
  @ApiResponse({ status: 404, description: 'Property not found' })
  async addToFavorites(
    @Param('id') id: string,
    @Req() req: FastifyRequest & { user: User },
  ) {
    // This would typically be handled by a user service
    // For now, return a success response
    return { message: 'Property added to favorites', propertyId: id };
  }

  @Delete(':id/favorite')
  @Roles(UserRole.REGISTERED_USER, UserRole.HOST, UserRole.AGENT, UserRole.LANDLORD, UserRole.ADMIN)
  @ApiOperation({ summary: 'Remove property from favorites' })
  @ApiBearerAuth()
  @ApiParam({ name: 'id', description: 'Property ID' })
  @ApiResponse({ status: 200, description: 'Property removed from favorites' })
  @ApiResponse({ status: 404, description: 'Property not found' })
  async removeFromFavorites(
    @Param('id') id: string,
    @Req() req: FastifyRequest & { user: User },
  ) {
    // This would typically be handled by a user service
    // For now, return a success response
    return { message: 'Property removed from favorites', propertyId: id };
  }

  @Get('my/favorites')
  @Roles(UserRole.REGISTERED_USER, UserRole.HOST, UserRole.AGENT, UserRole.LANDLORD, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get current user\'s favorite properties' })
  @ApiBearerAuth()
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'sortBy', required: false, type: String })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['asc', 'desc'] })
  @ApiResponse({ status: 200, description: 'User favorite properties retrieved' })
  async getMyFavorites(
    @Query() query: any,
    @Req() req: FastifyRequest & { user: User },
  ) {
    const options: PropertySearchOptions = {
      page: query.page ? parseInt(query.page) : 1,
      limit: query.limit ? parseInt(query.limit) : 20,
      sortBy: query.sortBy || 'createdAt',
      sortOrder: query.sortOrder || 'desc',
    };

    const userId = req.user._id?.toString();

    if (!userId) {
      throw new BadRequestException('User ID not found in request');
    }

    return this.propertiesService.getUserFavorites(userId, options);
  }

  @Get(':id/similar')
  @Public()
  @ApiOperation({ summary: 'Get similar properties' })
  @ApiParam({ name: 'id', description: 'Property ID' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Maximum results (default: 6)' })
  @ApiResponse({ status: 200, description: 'Similar properties found' })
  @ApiResponse({ status: 404, description: 'Property not found' })
  async getSimilarProperties(
    @Param('id') id: string,
    @Query('limit') limit?: string,
  ) {
    const maxResults = limit ? parseInt(limit) : 6;
    return this.propertiesService.getSimilarProperties(id, maxResults);
  }

  @Post(':id/images')
  @Roles(UserRole.HOST, UserRole.AGENT, UserRole.LANDLORD, UserRole.ADMIN)
  @ApiOperation({ summary: 'Upload property images' })
  @ApiBearerAuth()
  async uploadImages(
    @Param('id') id: string,
    @Req() req: FastifyRequest & { user: User },
  ) {
    const files: { buffer: Buffer }[] = [];
    // @ts-ignore fastify types
    const parts = req.parts();
    for await (const part of parts as AsyncIterable<MultipartFile>) {
      if (part.type === 'file') {
        const chunks: Buffer[] = [];
        for await (const chunk of part.file) {
          chunks.push(Buffer.from(chunk));
        }
        files.push({ buffer: Buffer.concat(chunks) });
      }
    }
    const property = await this.propertiesService.uploadImages(id, files, (req as any).user);
    return { message: 'Images uploaded successfully', property };
  }

  @Delete(':id/images/:imageId')
  @Roles(UserRole.HOST, UserRole.AGENT, UserRole.LANDLORD, UserRole.ADMIN)
  @ApiOperation({ summary: 'Delete property image' })
  @ApiBearerAuth()
  async deleteImage(
    @Param('id') id: string,
    @Param('imageId') imageId: string,
    @Req() req: FastifyRequest & { user: User },
  ) {
    const property = await this.propertiesService.deleteImage(id, imageId, (req as any).user);
    return { message: 'Image deleted successfully', property };
  }

  @Post(':id/videos')
  @Roles(UserRole.HOST, UserRole.AGENT, UserRole.LANDLORD, UserRole.ADMIN)
  @ApiOperation({ summary: 'Upload property videos' })
  @ApiBearerAuth()
  async uploadVideos(
    @Param('id') id: string,
    @Req() req: FastifyRequest & { user: User },
  ) {
    const files: { buffer: Buffer }[] = [];
    // @ts-ignore fastify types
    const parts = req.parts();
    for await (const part of parts as AsyncIterable<MultipartFile>) {
      if (part.type === 'file') {
        const chunks: Buffer[] = [];
        for await (const chunk of part.file) {
          chunks.push(Buffer.from(chunk));
        }
        files.push({ buffer: Buffer.concat(chunks) });
      }
    }
    const property = await this.propertiesService.uploadVideos(id, files, (req as any).user);
    return { message: 'Videos uploaded successfully', property };
  }

  @Delete(':id/videos/:videoId')
  @Roles(UserRole.HOST, UserRole.AGENT, UserRole.LANDLORD, UserRole.ADMIN)
  @ApiOperation({ summary: 'Delete property video' })
  @ApiBearerAuth()
  async deleteVideo(
    @Param('id') id: string,
    @Param('videoId') videoId: string,
    @Req() req: FastifyRequest & { user: User },
  ) {
    const property = await this.propertiesService.deleteVideo(id, videoId, (req as any).user);
    return { message: 'Video deleted successfully', property };
  }
}
