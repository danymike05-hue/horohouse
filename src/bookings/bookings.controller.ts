import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  Req,
  UseGuards,
  BadRequestException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { FastifyRequest } from 'fastify';

import { BookingsService } from './bookings.service';
import {
  CreateBookingDto,
  CancelBookingDto,
  RespondToBookingDto,
  UpdatePaymentDto,
  BookingQueryDto,
  AvailabilityQueryDto,
} from './dto/booking.dto';
import { JwtAuthGuard } from '../auth/guards/jwt.auth.guard';
import { RolesGuard, Roles, Public } from '../auth/guards/roles.guard';
import { User, UserRole } from '../users/schemas/user.schema';

@ApiTags('Bookings')
@Controller('bookings')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) { }

  // ════════════════════════════════════════════════════════════════════════════
  // GUEST — CREATE & VIEW OWN BOOKINGS
  // ════════════════════════════════════════════════════════════════════════════

  @Post()
  @Roles(UserRole.REGISTERED_USER, UserRole.GUEST, UserRole.HOST, UserRole.AGENT, UserRole.LANDLORD, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Request a booking for a short-term property' })
  @ApiResponse({ status: 201, description: 'Booking created (pending or instantly confirmed)' })
  @ApiResponse({ status: 400, description: 'Validation error or property not available for short-term' })
  @ApiResponse({ status: 409, description: 'Dates already booked or blocked' })
  async createBooking(
    @Body() dto: CreateBookingDto,
    @Req() req: FastifyRequest & { user: User },
  ) {
    return this.bookingsService.createBooking(dto, req.user);
  }

  @Get('my')
  @Roles(UserRole.REGISTERED_USER, UserRole.GUEST, UserRole.HOST, UserRole.AGENT, UserRole.LANDLORD, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get the current user's bookings (as guest)" })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiQuery({ name: 'fromDate', required: false, type: String })
  @ApiQuery({ name: 'toDate', required: false, type: String })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['asc', 'desc'] })
  @ApiResponse({ status: 200, description: 'Paginated list of guest bookings' })
  async getMyBookings(
    @Req() req: FastifyRequest & { user: User },
    @Query() query: BookingQueryDto,
  ) {
    return this.bookingsService.getGuestBookings(req.user._id.toString(), query);
  }

  @Patch(':id/cancel')
  @Roles(UserRole.REGISTERED_USER, UserRole.GUEST, UserRole.HOST, UserRole.AGENT, UserRole.LANDLORD, UserRole.ADMIN)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel a booking (guest, host, or admin)' })
  @ApiParam({ name: 'id', description: 'Booking ID' })
  @ApiResponse({ status: 200, description: 'Booking cancelled' })
  @ApiResponse({ status: 400, description: 'Booking cannot be cancelled at this stage' })
  @ApiResponse({ status: 403, description: 'Not authorized to cancel this booking' })
  async cancelBooking(
    @Param('id') id: string,
    @Body() dto: CancelBookingDto,
    @Req() req: FastifyRequest & { user: User },
  ) {
    return this.bookingsService.cancelBooking(id, dto, req.user);
  }

  // ════════════════════════════════════════════════════════════════════════════
  // HOST — MANAGE INCOMING RESERVATIONS
  // ════════════════════════════════════════════════════════════════════════════

  @Get('hosting')
  @Roles(UserRole.HOST, UserRole.AGENT, UserRole.LANDLORD, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all bookings for properties you host' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiQuery({ name: 'fromDate', required: false, type: String })
  @ApiQuery({ name: 'toDate', required: false, type: String })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['asc', 'desc'] })
  @ApiResponse({ status: 200, description: 'Paginated list of host bookings' })
  async getHostBookings(
    @Req() req: FastifyRequest & { user: User },
    @Query() query: BookingQueryDto,
  ) {
    return this.bookingsService.getHostBookings(req.user._id.toString(), query);
  }

  @Patch(':id/confirm')
  @Roles(UserRole.HOST, UserRole.AGENT, UserRole.LANDLORD, UserRole.ADMIN)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Host confirms a pending booking' })
  @ApiParam({ name: 'id', description: 'Booking ID' })
  @ApiResponse({ status: 200, description: 'Booking confirmed' })
  @ApiResponse({ status: 400, description: 'Booking is not in PENDING status' })
  @ApiResponse({ status: 409, description: 'Dates are no longer available (race condition)' })
  async confirmBooking(
    @Param('id') id: string,
    @Body() dto: RespondToBookingDto,
    @Req() req: FastifyRequest & { user: User },
  ) {
    return this.bookingsService.confirmBooking(id, dto, req.user);
  }

  @Patch(':id/reject')
  @Roles(UserRole.HOST, UserRole.AGENT, UserRole.LANDLORD, UserRole.ADMIN)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Host rejects a pending booking' })
  @ApiParam({ name: 'id', description: 'Booking ID' })
  @ApiResponse({ status: 200, description: 'Booking rejected' })
  async rejectBooking(
    @Param('id') id: string,
    @Body() dto: RespondToBookingDto,
    @Req() req: FastifyRequest & { user: User },
  ) {
    return this.bookingsService.rejectBooking(id, dto, req.user);
  }

  @Patch(':id/complete')
  @Roles(UserRole.HOST, UserRole.AGENT, UserRole.LANDLORD, UserRole.ADMIN)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Host marks a stay as completed after checkout' })
  @ApiParam({ name: 'id', description: 'Booking ID' })
  @ApiResponse({ status: 200, description: 'Booking completed' })
  async completeBooking(
    @Param('id') id: string,
    @Req() req: FastifyRequest & { user: User },
  ) {
    return this.bookingsService.completeBooking(id, req.user);
  }

  // ════════════════════════════════════════════════════════════════════════════
  // PROPERTY — AVAILABILITY (PUBLIC)
  // ════════════════════════════════════════════════════════════════════════════

  @Get('availability/:propertyId')
  @Public()
  @ApiOperation({ summary: 'Get blocked/booked date ranges for a property (calendar widget)' })
  @ApiParam({ name: 'propertyId', description: 'Property ID' })
  @ApiQuery({ name: 'from', required: true, type: String, description: 'Range start (ISO date)' })
  @ApiQuery({ name: 'to', required: true, type: String, description: 'Range end (ISO date)' })
  @ApiResponse({ status: 200, description: 'Availability result with booked and blocked ranges' })
  async getAvailability(
    @Param('propertyId') propertyId: string,
    @Query() query: AvailabilityQueryDto,
  ) {
    if (!query.from || !query.to) {
      throw new BadRequestException('Both "from" and "to" query params are required');
    }
    return this.bookingsService.getAvailability(
      propertyId,
      new Date(query.from),
      new Date(query.to),
      query.roomId,
    );
  }

  @Get('property/:propertyId')
  @Roles(UserRole.HOST, UserRole.AGENT, UserRole.LANDLORD, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all bookings for a specific property (host / admin only)' })
  @ApiParam({ name: 'propertyId', description: 'Property ID' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Paginated bookings for the property' })
  async getPropertyBookings(
    @Param('propertyId') propertyId: string,
    @Query() query: BookingQueryDto,
  ) {
    return this.bookingsService.getPropertyBookings(propertyId, query);
  }

  // ════════════════════════════════════════════════════════════════════════════
  // ADMIN ONLY
  // ════════════════════════════════════════════════════════════════════════════

  @Get('admin/all')
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: Get all bookings across the platform' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiQuery({ name: 'fromDate', required: false, type: String })
  @ApiQuery({ name: 'toDate', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Paginated list of all bookings' })
  async getAllBookings(@Query() query: BookingQueryDto) {
    return this.bookingsService.getAllBookings(query);
  }

  @Get('admin/stats')
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: Get booking statistics and revenue' })
  @ApiResponse({ status: 200, description: 'Booking statistics' })
  async getBookingStats() {
    return this.bookingsService.getBookingStats();
  }

  @Patch(':id/payment')
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Admin / webhook: Update payment status of a booking' })
  @ApiParam({ name: 'id', description: 'Booking ID' })
  @ApiResponse({ status: 200, description: 'Payment status updated' })
  async updatePayment(
    @Param('id') id: string,
    @Body() dto: UpdatePaymentDto,
  ) {
    return this.bookingsService.updatePayment(id, dto);
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SINGLE BOOKING DETAIL (authenticated users — access checked in service)
  // ════════════════════════════════════════════════════════════════════════════

  @Get(':id')
  @Roles(UserRole.REGISTERED_USER, UserRole.GUEST, UserRole.HOST, UserRole.AGENT, UserRole.LANDLORD, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get booking details (guest, host, or admin)' })
  @ApiParam({ name: 'id', description: 'Booking ID' })
  @ApiResponse({ status: 200, description: 'Booking details' })
  @ApiResponse({ status: 403, description: 'Not authorized to view this booking' })
  @ApiResponse({ status: 404, description: 'Booking not found' })
  async getBookingById(
    @Param('id') id: string,
    @Req() req: FastifyRequest & { user: User },
  ) {
    return this.bookingsService.getBookingById(id, req.user);
  }

  @Get('host-stats')
  @Roles(UserRole.HOST, UserRole.AGENT, UserRole.LANDLORD, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get aggregated dashboard stats for the authenticated host' })
  @ApiResponse({ status: 200, description: 'Host dashboard stats' })
  async getHostStats(@Req() req: FastifyRequest & { user: User }) {
    return this.bookingsService.getHostStats(req.user._id.toString());
  }
}
