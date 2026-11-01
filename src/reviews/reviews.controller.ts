import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';

import { ReviewsService } from './reviews.service';
import { CreateReviewDto, UpdateReviewDto, RespondReviewDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt.auth.guard';
import { RolesGuard, Roles, Public } from '../auth/guards/roles.guard';
import { User, UserRole } from '../users/schemas/user.schema';
import { ReviewType } from './schemas/review.schema';

@ApiTags('Reviews')
@Controller('reviews')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) { }

  // ════════════════════════════════════════════════════════════════════════════
  // CREATE
  // ════════════════════════════════════════════════════════════════════════════

  @Post()
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Create a review',
    description:
      'reviewType = property | agent — standard reviews (unchanged).\n' +
      'reviewType = stay — guest reviews the property after a completed booking.\n' +
      'reviewType = guest — host reviews the guest after a completed booking.\n' +
      'Stay and guest reviews require bookingId and are gated behind a completed booking check.',
  })
  @ApiResponse({ status: 201, description: 'Review created' })
  @ApiResponse({ status: 400, description: 'Validation error or review window closed' })
  @ApiResponse({ status: 403, description: 'Not the guest or host of this booking' })
  @ApiResponse({ status: 404, description: 'Booking / property / agent not found' })
  async create(@Body() dto: CreateReviewDto, @Req() req: any) {
    return this.reviewsService.create(dto, req.user);
  }

  // ════════════════════════════════════════════════════════════════════════════
  // READ — existing endpoints (unchanged)
  // ════════════════════════════════════════════════════════════════════════════

  @Get()
  @Public()
  @ApiOperation({ summary: 'Get all reviews with filters' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'reviewType', required: false, enum: ReviewType })
  @ApiQuery({ name: 'propertyId', required: false, type: String })
  @ApiQuery({ name: 'agentId', required: false, type: String })
  @ApiQuery({ name: 'bookingId', required: false, type: String })
  @ApiQuery({ name: 'reviewedUserId', required: false, type: String })
  @ApiQuery({ name: 'minRating', required: false, type: Number })
  @ApiQuery({ name: 'maxRating', required: false, type: Number })
  @ApiQuery({ name: 'verified', required: false, type: Boolean })
  @ApiQuery({ name: 'sortBy', required: false, type: String })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['asc', 'desc'] })
  @ApiResponse({ status: 200, description: 'Reviews retrieved' })
  async findAll(@Query() query: any) {
    const filters = {
      reviewType: query.reviewType,
      propertyId: query.propertyId,
      agentId: query.agentId,
      bookingId: query.bookingId,
      reviewedUserId: query.reviewedUserId,
      minRating: query.minRating ? parseFloat(query.minRating) : undefined,
      maxRating: query.maxRating ? parseFloat(query.maxRating) : undefined,
      verified: query.verified === 'true' ? true : query.verified === 'false' ? false : undefined,
    };
    const options = {
      page: query.page ? parseInt(query.page) : 1,
      limit: query.limit ? parseInt(query.limit) : 20,
      sortBy: query.sortBy || 'createdAt',
      sortOrder: query.sortOrder || 'desc',
    };
    return this.reviewsService.findAll(filters, options);
  }

  @Get('property/:propertyId')
  @Public()
  @ApiOperation({ summary: 'Get reviews for a property (includes stay reviews)' })
  @ApiParam({ name: 'propertyId' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'sortBy', required: false, type: String })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['asc', 'desc'] })
  async getPropertyReviews(@Param('propertyId') propertyId: string, @Query() query: any) {
    return this.reviewsService.getPropertyReviews(propertyId, {
      page: query.page ? parseInt(query.page) : 1,
      limit: query.limit ? parseInt(query.limit) : 20,
      sortBy: query.sortBy || 'createdAt',
      sortOrder: query.sortOrder || 'desc',
    });
  }

  @Get('property/:propertyId/stats')
  @Public()
  @ApiOperation({ summary: 'Get review stats for a property (includes sub-rating averages)' })
  @ApiParam({ name: 'propertyId' })
  async getPropertyReviewStats(@Param('propertyId') propertyId: string) {
    return this.reviewsService.getPropertyReviewStats(propertyId);
  }

  @Get('insight/:insightId')
  @Public()
  @ApiOperation({ summary: 'Get comments/reviews for an insight (article)' })
  @ApiParam({ name: 'insightId' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'sortBy', required: false, type: String })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['asc', 'desc'] })
  async getInsightReviews(@Param('insightId') insightId: string, @Query() query: any) {
    return this.reviewsService.getInsightReviews(insightId, {
      page: query.page ? parseInt(query.page) : 1,
      limit: query.limit ? parseInt(query.limit) : 20,
      sortBy: query.sortBy || 'createdAt',
      sortOrder: query.sortOrder || 'desc',
    });
  }

  @Get('agent/:agentId')
  @Public()
  @ApiOperation({ summary: 'Get reviews for an agent' })
  @ApiParam({ name: 'agentId' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'sortBy', required: false, type: String })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['asc', 'desc'] })
  async getAgentReviews(@Param('agentId') agentId: string, @Query() query: any) {
    return this.reviewsService.getAgentReviews(agentId, {
      page: query.page ? parseInt(query.page) : 1,
      limit: query.limit ? parseInt(query.limit) : 20,
      sortBy: query.sortBy || 'createdAt',
      sortOrder: query.sortOrder || 'desc',
    });
  }

  @Get('agent/:agentId/stats')
  @Public()
  @ApiOperation({ summary: 'Get review stats for an agent' })
  @ApiParam({ name: 'agentId' })
  async getAgentReviewStats(@Param('agentId') agentId: string) {
    return this.reviewsService.getAgentReviewStats(agentId);
  }

  // ════════════════════════════════════════════════════════════════════════════
  // READ — NEW booking review endpoints
  // ════════════════════════════════════════════════════════════════════════════

  /**
   * Returns both sides of a booking review (stay + guest) in one call.
   * Used by the booking detail page to show "What both parties said".
   */
  @Get('booking/:bookingId')
  @Public()
  @ApiOperation({
    summary: 'Get both sides of a booking review (stay review + guest review)',
  })
  @ApiParam({ name: 'bookingId', description: 'Booking ID' })
  @ApiResponse({
    status: 200,
    description: 'Returns { stayReview, guestReview } — either can be null if not yet submitted',
  })
  async getBookingReviews(@Param('bookingId') bookingId: string) {
    return this.reviewsService.getBookingReviews(bookingId);
  }

  /**
   * Returns reviews a user received as a guest (host → guest reviews).
   * Useful for a "guest reputation" profile section.
   */
  @Get('user/:userId/as-guest')
  @Public()
  @ApiOperation({ summary: 'Get reviews received by a user as a guest' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['asc', 'desc'] })
  @ApiResponse({ status: 200, description: 'Guest reputation reviews' })
  async getGuestReviews(@Param('userId') userId: string, @Query() query: any) {
    return this.reviewsService.getGuestReviews(userId, {
      page: query.page ? parseInt(query.page) : 1,
      limit: query.limit ? parseInt(query.limit) : 20,
      sortOrder: query.sortOrder || 'desc',
    });
  }

  // ════════════════════════════════════════════════════════════════════════════
  // USER — own reviews
  // ════════════════════════════════════════════════════════════════════════════

  @Get('my-reviews')
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get current user's reviews" })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getMyReviews(@Req() req: any, @Query() query: any) {
    return this.reviewsService.getUserReviews(req.user.id, {
      page: query.page ? parseInt(query.page) : 1,
      limit: query.limit ? parseInt(query.limit) : 20,
      sortBy: query.sortBy || 'createdAt',
      sortOrder: query.sortOrder || 'desc',
    });
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SINGLE REVIEW
  // ════════════════════════════════════════════════════════════════════════════

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Get review by ID' })
  @ApiParam({ name: 'id' })
  @ApiResponse({ status: 404, description: 'Review not found' })
  async findOne(@Param('id') id: string) {
    return this.reviewsService.findOne(id);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update review (own reviews only)' })
  @ApiParam({ name: 'id' })
  async update(@Param('id') id: string, @Body() dto: UpdateReviewDto, @Req() req: any) {
    return this.reviewsService.update(id, dto, req.user);
  }

  @Post(':id/respond')
  @Roles(UserRole.HOST, UserRole.AGENT, UserRole.LANDLORD, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Respond to a review (host, agent, or admin)' })
  @ApiParam({ name: 'id' })
  @ApiResponse({ status: 403, description: 'Can only respond to reviews about yourself / your property' })
  async respondToReview(
    @Param('id') id: string,
    @Body() dto: RespondReviewDto,
    @Req() req: any,
  ) {
    return this.reviewsService.respondToReview(id, dto, req.user);
  }

  @Post(':id/helpful')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Toggle helpful flag on a review' })
  @ApiParam({ name: 'id' })
  async markAsHelpful(@Param('id') id: string, @Req() req: any) {
    return this.reviewsService.markAsHelpful(id, req.user);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete review (own or admin)' })
  @ApiParam({ name: 'id' })
  async remove(@Param('id') id: string, @Req() req: any) {
    await this.reviewsService.remove(id, req.user);
    return { message: 'Review deleted successfully' };
  }
}