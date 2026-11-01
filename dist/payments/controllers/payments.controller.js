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
exports.PaymentsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const payments_service_1 = require("../services/payments.service");
const jwt_auth_guard_1 = require("../../auth/guards/jwt.auth.guard");
const roles_guard_1 = require("../../auth/guards/roles.guard");
const user_schema_1 = require("../../users/schemas/user.schema");
const payment_dto_1 = require("../dto/payment.dto");
let PaymentsController = class PaymentsController {
    paymentsService;
    constructor(paymentsService) {
        this.paymentsService = paymentsService;
    }
    async initializePayment(initializePaymentDto, req) {
        return this.paymentsService.initializePayment(initializePaymentDto, req.user);
    }
    async initiateBookingPayment(bookingId, dto, req) {
        return this.paymentsService.initiateBookingPayment(bookingId, req.user, dto.paymentMethod, dto.phone);
    }
    async verifyPayment(verifyPaymentDto, req) {
        return this.paymentsService.verifyPayment(verifyPaymentDto, req.user);
    }
    async getUserTransactions(req, query) {
        return this.paymentsService.getUserTransactions(req.user.id, query);
    }
    async getTransactionByReference(txRef, req) {
        return this.paymentsService.getTransactionByReference(txRef, req.user.id);
    }
    async getTransactionById(id, req) {
        return this.paymentsService.getTransactionById(id, req.user.id);
    }
    async handleCamerPayWebhook(signature, req) {
        if (!signature) {
            throw new common_1.BadRequestException('Missing X-CamerPay-Signature header');
        }
        const rawBody = req.rawBody
            ? req.rawBody.toString('utf8')
            : JSON.stringify(req.body);
        await this.paymentsService.handleWebhook(rawBody, signature);
        return { status: 'success', message: 'Webhook processed successfully' };
    }
    async getAllTransactions(query) {
        return this.paymentsService.getAllTransactions(query);
    }
    async getPaymentAnalytics() {
        return { message: 'Payment analytics endpoint' };
    }
};
exports.PaymentsController = PaymentsController;
__decorate([
    (0, common_1.Post)('initialize'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, swagger_1.ApiOperation)({ summary: 'Initialize a new payment' }),
    (0, swagger_1.ApiResponse)({ status: 201, description: 'Payment initialized successfully' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [payment_dto_1.InitializePaymentDto, Object]),
    __metadata("design:returntype", Promise)
], PaymentsController.prototype, "initializePayment", null);
__decorate([
    (0, common_1.Post)('bookings/:bookingId/initiate'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, swagger_1.ApiOperation)({
        summary: 'Initiate CamerPay payment for a booking',
        description: 'Creates a pending transaction and returns a CamerPay checkout URL. ' +
            'Redirect the user (or open a WebView on mobile) to that URL to complete payment. ' +
            'Idempotent — returns the same URL while payment is still pending. ' +
            'Only the booking guest can call this endpoint.',
    }),
    (0, swagger_1.ApiParam)({ name: 'bookingId', description: 'ID of the booking to pay for' }),
    (0, swagger_1.ApiResponse)({
        status: 201,
        description: 'Returns { transaction, paymentLink, txRef }',
        schema: {
            example: {
                txRef: 'HH-BOO-1714000000000-AB1C2D',
                paymentLink: 'https://camerpay.biz/pay/f3a1b2c4-...',
                transaction: { _id: '...', status: 'pending', amount: 150000, currency: 'XAF' },
            },
        },
    }),
    (0, swagger_1.ApiResponse)({ status: 400, description: 'Already paid, cancelled, or booking is invalid' }),
    (0, swagger_1.ApiResponse)({ status: 403, description: 'Caller is not the booking guest' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Booking not found' }),
    __param(0, (0, common_1.Param)('bookingId')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, payment_dto_1.InitiateBookingPaymentDto, Object]),
    __metadata("design:returntype", Promise)
], PaymentsController.prototype, "initiateBookingPayment", null);
__decorate([
    (0, common_1.Post)('verify'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Verify payment status via CamerPay' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [payment_dto_1.VerifyPaymentDto, Object]),
    __metadata("design:returntype", Promise)
], PaymentsController.prototype, "verifyPayment", null);
__decorate([
    (0, common_1.Get)('transactions'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, swagger_1.ApiOperation)({ summary: 'Get user transactions' }),
    (0, swagger_1.ApiQuery)({ name: 'page', required: false, type: Number }),
    (0, swagger_1.ApiQuery)({ name: 'limit', required: false, type: Number }),
    (0, swagger_1.ApiQuery)({ name: 'status', required: false, type: String }),
    (0, swagger_1.ApiQuery)({ name: 'type', required: false, type: String }),
    (0, swagger_1.ApiQuery)({ name: 'paymentMethod', required: false, type: String }),
    (0, swagger_1.ApiQuery)({ name: 'startDate', required: false, type: String }),
    (0, swagger_1.ApiQuery)({ name: 'endDate', required: false, type: String }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, payment_dto_1.TransactionQueryDto]),
    __metadata("design:returntype", Promise)
], PaymentsController.prototype, "getUserTransactions", null);
__decorate([
    (0, common_1.Get)('transactions/reference/:txRef'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, swagger_1.ApiOperation)({ summary: 'Get transaction by reference' }),
    __param(0, (0, common_1.Param)('txRef')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], PaymentsController.prototype, "getTransactionByReference", null);
__decorate([
    (0, common_1.Get)('transactions/:id'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, swagger_1.ApiOperation)({ summary: 'Get transaction by ID' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], PaymentsController.prototype, "getTransactionById", null);
__decorate([
    (0, common_1.Post)('webhook/camerpay'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'CamerPay webhook receiver' }),
    __param(0, (0, common_1.Headers)('x-camerpay-signature')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], PaymentsController.prototype, "handleCamerPayWebhook", null);
__decorate([
    (0, common_1.Get)('admin/transactions'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, roles_guard_1.Roles)(user_schema_1.UserRole.ADMIN),
    (0, swagger_1.ApiOperation)({ summary: 'Get all transactions (Admin)' }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [payment_dto_1.TransactionQueryDto]),
    __metadata("design:returntype", Promise)
], PaymentsController.prototype, "getAllTransactions", null);
__decorate([
    (0, common_1.Get)('admin/analytics'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, roles_guard_1.Roles)(user_schema_1.UserRole.ADMIN),
    (0, swagger_1.ApiOperation)({ summary: 'Get payment analytics (Admin)' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], PaymentsController.prototype, "getPaymentAnalytics", null);
exports.PaymentsController = PaymentsController = __decorate([
    (0, swagger_1.ApiTags)('Payments'),
    (0, swagger_1.ApiBearerAuth)('JWT-auth'),
    (0, common_1.Controller)('payments'),
    __metadata("design:paramtypes", [payments_service_1.PaymentsService])
], PaymentsController);
//# sourceMappingURL=payments.controller.js.map