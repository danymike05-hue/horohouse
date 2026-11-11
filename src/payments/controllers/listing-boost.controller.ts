import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { ListingBoostService } from '../services/listing-boost.service';
import { JwtAuthGuard } from '../../auth/guards/jwt.auth.guard';
import { Roles } from '../../auth/guards/roles.guard';
import { UserRole } from '../../users/schemas/user.schema';
import { CreateListingBoostDto } from '../dto/payment.dto';
import { BoostType, BoostStatus } from '../schemas/listing-boost.schema';

class PricingQuery {
  boostType?: BoostType;
  duration?: number;
}

class CancelDto {
  reason: string;
}

@ApiTags('Listing Boosts')
@Controller('boosts')
export class ListingBoostController {
  constructor(private readonly listingBoostService: ListingBoostService) {}

  @Get('options')
  @ApiOperation({ summary: 'Get available boost options and pricing' })
  @ApiResponse({ status: 200, description: 'Boost options returned' })
  getOptions() {
    return this.listingBoostService.getBoostOptions();
  }

  @Get('pricing')
  @ApiOperation({ summary: 'Get price for a boost type and duration' })
  @ApiQuery({ name: 'boostType', required: true })
  @ApiQuery({ name: 'duration', required: true, type: Number })
  @ApiResponse({ status: 200, description: 'Price calculated' })
  getPricing(@Query() q: PricingQuery) {
    if (!q.boostType || !q.duration) {
      throw new BadRequestException('boostType and duration are required');
    }
    return { price: this.listingBoostService.getBoostPricing(q.boostType, q.duration) };
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Create a boost request for a property' })
  @ApiResponse({ status: 201, description: 'Boost request created' })
  async createBoost(@Body() dto: CreateListingBoostDto, @Req() req: any) {
    return this.listingBoostService.createBoostRequest(req.user.id, dto);
  }

  @Post('activate/:transactionId')
  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Activate boost after payment (admin)' })
  @ApiResponse({ status: 200, description: 'Boost activated' })
  async activateBoost(@Param('transactionId') transactionId: string) {
    return this.listingBoostService.activateBoost(transactionId);
  }

  @Get('user')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Get current user's boosts" })
  @ApiQuery({ name: 'status', required: false })
  @ApiResponse({ status: 200, description: 'User boosts returned' })
  async getUserBoosts(@Req() req: any, @Query('status') status?: BoostStatus) {
    return this.listingBoostService.getUserBoosts(req.user.id, status);
  }

  @Get('property/:propertyId')
  @ApiOperation({ summary: 'Get boost history for a property' })
  @ApiResponse({ status: 200, description: 'Property boosts returned' })
  async getPropertyBoosts(@Param('propertyId') propertyId: string) {
    return this.listingBoostService.getPropertyBoosts(propertyId);
  }

  @Get('active')
  @ApiOperation({ summary: 'Get active boosted properties' })
  @ApiQuery({ name: 'boostType', required: false })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Active boosted properties returned' })
  async getActiveBoostedProperties(@Query('boostType') boostType?: BoostType, @Query('limit') limit?: string) {
    const l = limit ? parseInt(limit, 10) : 10;
    return this.listingBoostService.getActiveBoostedProperties(boostType as any, l);
  }

  // Public tracking endpoints
  @Post('track/:boostId/impression')
  @ApiOperation({ summary: 'Track a boost impression' })
  @ApiResponse({ status: 200, description: 'Tracked' })
  async trackImpression(@Param('boostId') boostId: string) {
    await this.listingBoostService.trackImpression(boostId);
    return { status: 'ok' };
  }

  @Post('track/:boostId/click')
  @ApiOperation({ summary: 'Track a boost click' })
  @ApiResponse({ status: 200, description: 'Tracked' })
  async trackClick(@Param('boostId') boostId: string) {
    await this.listingBoostService.trackClick(boostId);
    return { status: 'ok' };
  }

  @Post('track/:boostId/inquiry')
  @ApiOperation({ summary: 'Track a boost inquiry' })
  @ApiResponse({ status: 200, description: 'Tracked' })
  async trackInquiry(@Param('boostId') boostId: string) {
    await this.listingBoostService.trackInquiry(boostId);
    return { status: 'ok' };
  }

  @Post(':boostId/cancel')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Cancel a boost' })
  @ApiResponse({ status: 200, description: 'Boost cancelled' })
  async cancelBoost(@Param('boostId') boostId: string, @Req() req: any, @Body() dto: CancelDto) {
    if (!dto || !dto.reason) {
      throw new BadRequestException('reason is required');
    }
    return this.listingBoostService.cancelBoost(boostId, req.user.id, dto.reason);
  }
}
