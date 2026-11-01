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
Object.defineProperty(exports, "__esModule", { value: true });
exports.BookingsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const bookings_service_1 = require("./bookings.service");
const booking_dto_1 = require("./dto/booking.dto");
const jwt_auth_guard_1 = require("../auth/guards/jwt.auth.guard");
const roles_guard_1 = require("../auth/guards/roles.guard");
const user_schema_1 = require("../users/schemas/user.schema");
let BookingsController = class BookingsController {
    bookingsService;
    constructor(bookingsService) {
        this.bookingsService = bookingsService;
    }
    async createBooking(dto, req) {
        return this.bookingsService.createBooking(dto, req.user);
    }
    async getMyBookings(req, query) {
        return this.bookingsService.getGuestBookings(req.user._id.toString(), query);
    }
    async cancelBooking(id, dto, req) {
        return this.bookingsService.cancelBooking(id, dto, req.user);
    }
    async getHostBookings(req, query) {
        return this.bookingsService.getHostBookings(req.user._id.toString(), query);
    }
    async confirmBooking(id, dto, req) {
        return this.bookingsService.confirmBooking(id, dto, req.user);
    }
    async rejectBooking(id, dto, req) {
        return this.bookingsService.rejectBooking(id, dto, req.user);
    }
    async completeBooking(id, req) {
        return this.bookingsService.completeBooking(id, req.user);
    }
    async getAvailability(propertyId, query) {
        if (!query.from || !query.to) {
            throw new common_1.BadRequestException('Both "from" and "to" query params are required');
        }
        return this.bookingsService.getAvailability(propertyId, new Date(query.from), new Date(query.to), query.roomId);
    }
    async getPropertyBookings(propertyId, query) {
        return this.bookingsService.getPropertyBookings(propertyId, query);
    }
    async getAllBookings(query) {
        return this.bookingsService.getAllBookings(query);
    }
    async getBookingStats() {
        return this.bookingsService.getBookingStats();
    }
    async updatePayment(id, dto) {
        return this.bookingsService.updatePayment(id, dto);
    }
    async getBookingById(id, req) {
        return this.bookingsService.getBookingById(id, req.user);
    }
    async getHostStats(req) {
        return this.bookingsService.getHostStats(req.user._id.toString());
    }
};
exports.BookingsController = BookingsController;
__decorate([
    (0, common_1.Post)(),
    (0, roles_guard_1.Roles)(user_schema_1.UserRole.REGISTERED_USER, user_schema_1.UserRole.GUEST, user_schema_1.UserRole.HOST, user_schema_1.UserRole.AGENT, user_schema_1.UserRole.LANDLORD, user_schema_1.UserRole.ADMIN),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({ summary: 'Request a booking for a short-term property' }),
    (0, swagger_1.ApiResponse)({ status: 201, description: 'Booking created (pending or instantly confirmed)' }),
    (0, swagger_1.ApiResponse)({ status: 400, description: 'Validation error or property not available for short-term' }),
    (0, swagger_1.ApiResponse)({ status: 409, description: 'Dates already booked or blocked' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [booking_dto_1.CreateBookingDto, Object]),
    __metadata("design:returntype", Promise)
], BookingsController.prototype, "createBooking", null);
__decorate([
    (0, common_1.Get)('my'),
    (0, roles_guard_1.Roles)(user_schema_1.UserRole.REGISTERED_USER, user_schema_1.UserRole.GUEST, user_schema_1.UserRole.HOST, user_schema_1.UserRole.AGENT, user_schema_1.UserRole.LANDLORD, user_schema_1.UserRole.ADMIN),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({ summary: "Get the current user's bookings (as guest)" }),
    (0, swagger_1.ApiQuery)({ name: 'page', required: false, type: Number }),
    (0, swagger_1.ApiQuery)({ name: 'limit', required: false, type: Number }),
    (0, swagger_1.ApiQuery)({ name: 'status', required: false, type: String }),
    (0, swagger_1.ApiQuery)({ name: 'fromDate', required: false, type: String }),
    (0, swagger_1.ApiQuery)({ name: 'toDate', required: false, type: String }),
    (0, swagger_1.ApiQuery)({ name: 'sortOrder', required: false, enum: ['asc', 'desc'] }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Paginated list of guest bookings' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, booking_dto_1.BookingQueryDto]),
    __metadata("design:returntype", Promise)
], BookingsController.prototype, "getMyBookings", null);
__decorate([
    (0, common_1.Patch)(':id/cancel'),
    (0, roles_guard_1.Roles)(user_schema_1.UserRole.REGISTERED_USER, user_schema_1.UserRole.GUEST, user_schema_1.UserRole.HOST, user_schema_1.UserRole.AGENT, user_schema_1.UserRole.LANDLORD, user_schema_1.UserRole.ADMIN),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Cancel a booking (guest, host, or admin)' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'Booking ID' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Booking cancelled' }),
    (0, swagger_1.ApiResponse)({ status: 400, description: 'Booking cannot be cancelled at this stage' }),
    (0, swagger_1.ApiResponse)({ status: 403, description: 'Not authorized to cancel this booking' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, booking_dto_1.CancelBookingDto, Object]),
    __metadata("design:returntype", Promise)
], BookingsController.prototype, "cancelBooking", null);
__decorate([
    (0, common_1.Get)('hosting'),
    (0, roles_guard_1.Roles)(user_schema_1.UserRole.HOST, user_schema_1.UserRole.AGENT, user_schema_1.UserRole.LANDLORD, user_schema_1.UserRole.ADMIN),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({ summary: 'Get all bookings for properties you host' }),
    (0, swagger_1.ApiQuery)({ name: 'page', required: false, type: Number }),
    (0, swagger_1.ApiQuery)({ name: 'limit', required: false, type: Number }),
    (0, swagger_1.ApiQuery)({ name: 'status', required: false, type: String }),
    (0, swagger_1.ApiQuery)({ name: 'fromDate', required: false, type: String }),
    (0, swagger_1.ApiQuery)({ name: 'toDate', required: false, type: String }),
    (0, swagger_1.ApiQuery)({ name: 'sortOrder', required: false, enum: ['asc', 'desc'] }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Paginated list of host bookings' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, booking_dto_1.BookingQueryDto]),
    __metadata("design:returntype", Promise)
], BookingsController.prototype, "getHostBookings", null);
__decorate([
    (0, common_1.Patch)(':id/confirm'),
    (0, roles_guard_1.Roles)(user_schema_1.UserRole.HOST, user_schema_1.UserRole.AGENT, user_schema_1.UserRole.LANDLORD, user_schema_1.UserRole.ADMIN),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Host confirms a pending booking' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'Booking ID' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Booking confirmed' }),
    (0, swagger_1.ApiResponse)({ status: 400, description: 'Booking is not in PENDING status' }),
    (0, swagger_1.ApiResponse)({ status: 409, description: 'Dates are no longer available (race condition)' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, booking_dto_1.RespondToBookingDto, Object]),
    __metadata("design:returntype", Promise)
], BookingsController.prototype, "confirmBooking", null);
__decorate([
    (0, common_1.Patch)(':id/reject'),
    (0, roles_guard_1.Roles)(user_schema_1.UserRole.HOST, user_schema_1.UserRole.AGENT, user_schema_1.UserRole.LANDLORD, user_schema_1.UserRole.ADMIN),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Host rejects a pending booking' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'Booking ID' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Booking rejected' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, booking_dto_1.RespondToBookingDto, Object]),
    __metadata("design:returntype", Promise)
], BookingsController.prototype, "rejectBooking", null);
__decorate([
    (0, common_1.Patch)(':id/complete'),
    (0, roles_guard_1.Roles)(user_schema_1.UserRole.HOST, user_schema_1.UserRole.AGENT, user_schema_1.UserRole.LANDLORD, user_schema_1.UserRole.ADMIN),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Host marks a stay as completed after checkout' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'Booking ID' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Booking completed' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], BookingsController.prototype, "completeBooking", null);
__decorate([
    (0, common_1.Get)('availability/:propertyId'),
    (0, roles_guard_1.Public)(),
    (0, swagger_1.ApiOperation)({ summary: 'Get blocked/booked date ranges for a property (calendar widget)' }),
    (0, swagger_1.ApiParam)({ name: 'propertyId', description: 'Property ID' }),
    (0, swagger_1.ApiQuery)({ name: 'from', required: true, type: String, description: 'Range start (ISO date)' }),
    (0, swagger_1.ApiQuery)({ name: 'to', required: true, type: String, description: 'Range end (ISO date)' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Availability result with booked and blocked ranges' }),
    __param(0, (0, common_1.Param)('propertyId')),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, booking_dto_1.AvailabilityQueryDto]),
    __metadata("design:returntype", Promise)
], BookingsController.prototype, "getAvailability", null);
__decorate([
    (0, common_1.Get)('property/:propertyId'),
    (0, roles_guard_1.Roles)(user_schema_1.UserRole.HOST, user_schema_1.UserRole.AGENT, user_schema_1.UserRole.LANDLORD, user_schema_1.UserRole.ADMIN),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({ summary: 'Get all bookings for a specific property (host / admin only)' }),
    (0, swagger_1.ApiParam)({ name: 'propertyId', description: 'Property ID' }),
    (0, swagger_1.ApiQuery)({ name: 'page', required: false, type: Number }),
    (0, swagger_1.ApiQuery)({ name: 'limit', required: false, type: Number }),
    (0, swagger_1.ApiQuery)({ name: 'status', required: false, type: String }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Paginated bookings for the property' }),
    __param(0, (0, common_1.Param)('propertyId')),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, booking_dto_1.BookingQueryDto]),
    __metadata("design:returntype", Promise)
], BookingsController.prototype, "getPropertyBookings", null);
__decorate([
    (0, common_1.Get)('admin/all'),
    (0, roles_guard_1.Roles)(user_schema_1.UserRole.ADMIN),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({ summary: 'Admin: Get all bookings across the platform' }),
    (0, swagger_1.ApiQuery)({ name: 'page', required: false, type: Number }),
    (0, swagger_1.ApiQuery)({ name: 'limit', required: false, type: Number }),
    (0, swagger_1.ApiQuery)({ name: 'status', required: false, type: String }),
    (0, swagger_1.ApiQuery)({ name: 'fromDate', required: false, type: String }),
    (0, swagger_1.ApiQuery)({ name: 'toDate', required: false, type: String }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Paginated list of all bookings' }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [booking_dto_1.BookingQueryDto]),
    __metadata("design:returntype", Promise)
], BookingsController.prototype, "getAllBookings", null);
__decorate([
    (0, common_1.Get)('admin/stats'),
    (0, roles_guard_1.Roles)(user_schema_1.UserRole.ADMIN),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({ summary: 'Admin: Get booking statistics and revenue' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Booking statistics' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], BookingsController.prototype, "getBookingStats", null);
__decorate([
    (0, common_1.Patch)(':id/payment'),
    (0, roles_guard_1.Roles)(user_schema_1.UserRole.ADMIN),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Admin / webhook: Update payment status of a booking' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'Booking ID' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Payment status updated' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, booking_dto_1.UpdatePaymentDto]),
    __metadata("design:returntype", Promise)
], BookingsController.prototype, "updatePayment", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, roles_guard_1.Roles)(user_schema_1.UserRole.REGISTERED_USER, user_schema_1.UserRole.GUEST, user_schema_1.UserRole.HOST, user_schema_1.UserRole.AGENT, user_schema_1.UserRole.LANDLORD, user_schema_1.UserRole.ADMIN),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({ summary: 'Get booking details (guest, host, or admin)' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'Booking ID' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Booking details' }),
    (0, swagger_1.ApiResponse)({ status: 403, description: 'Not authorized to view this booking' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Booking not found' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], BookingsController.prototype, "getBookingById", null);
__decorate([
    (0, common_1.Get)('host-stats'),
    (0, roles_guard_1.Roles)(user_schema_1.UserRole.HOST, user_schema_1.UserRole.AGENT, user_schema_1.UserRole.LANDLORD, user_schema_1.UserRole.ADMIN),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({ summary: 'Get aggregated dashboard stats for the authenticated host' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Host dashboard stats' }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], BookingsController.prototype, "getHostStats", null);
exports.BookingsController = BookingsController = __decorate([
    (0, swagger_1.ApiTags)('Bookings'),
    (0, common_1.Controller)('bookings'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    __metadata("design:paramtypes", [bookings_service_1.BookingsService])
], BookingsController);
//# sourceMappingURL=bookings.controller.js.map