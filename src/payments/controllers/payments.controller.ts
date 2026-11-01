import {
  Controller, Post, Get, Body, Param, Query,
  Req, UseGuards, HttpCode, HttpStatus, Headers, BadRequestException,
} from '@nestjs/common';
import {
  ApiTags, ApiOperation, ApiResponse,
  ApiBearerAuth, ApiQuery, ApiParam,
} from '@nestjs/swagger';
import { PaymentsService } from '../services/payments.service';
import { JwtAuthGuard } from '../../auth/guards/jwt.auth.guard';
import { Roles } from '../../auth/guards/roles.guard';
import { UserRole } from '../../users/schemas/user.schema';
import {
  InitializePaymentDto, VerifyPaymentDto,
  TransactionQueryDto,
  InitiateBookingPaymentDto,
  AdminRefundBookingDto,
} from '../dto/payment.dto';

@ApiTags('Payments')
@ApiBearerAuth('JWT-auth')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  // ── Generic payment (subscriptions, boosts, etc.) ─────────────────────────

  @Post('initialize')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Initialize a new payment' })
  @ApiResponse({ status: 201, description: 'Payment initialized successfully' })
  async initializePayment(
    @Body() initializePaymentDto: InitializePaymentDto,
    @Req() req: any,
  ) {
    return this.paymentsService.initializePayment(initializePaymentDto, req.user);
  }

  // ── Booking payment ───────────────────────────────────────────────────────

  @Post('bookings/:bookingId/initiate')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Initiate CamerPay payment for a booking',
    description:
      'Creates a pending transaction and returns a CamerPay checkout URL. ' +
      'Redirect the user (or open a WebView on mobile) to that URL to complete payment. ' +
      'Idempotent — returns the same URL while payment is still pending. ' +
      'Only the booking guest can call this endpoint.',
  })
  @ApiParam({ name: 'bookingId', description: 'ID of the booking to pay for' })
  @ApiResponse({
    status: 201,
    description: 'Returns { transaction, paymentLink, txRef }',
    schema: {
      example: {
        txRef:       'HH-BOO-1714000000000-AB1C2D',
        paymentLink: 'https://camerpay.biz/pay/f3a1b2c4-...',
        transaction: { _id: '...', status: 'pending', amount: 150000, currency: 'XAF' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Already paid, cancelled, or booking is invalid' })
  @ApiResponse({ status: 403, description: 'Caller is not the booking guest' })
  @ApiResponse({ status: 404, description: 'Booking not found' })
  async initiateBookingPayment(
  @Param('bookingId') bookingId: string,
  @Body() dto: InitiateBookingPaymentDto,
  @Req() req: any,
) {
  return this.paymentsService.initiateBookingPayment(bookingId, req.user, dto.paymentMethod, dto.phone);
}

  // ── Verify payment ────────────────────────────────────────────────────────

  @Post('verify')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify payment status via CamerPay' })
  async verifyPayment(@Body() verifyPaymentDto: VerifyPaymentDto, @Req() req: any) {
    return this.paymentsService.verifyPayment(verifyPaymentDto, req.user);
  }

  // ── Transaction queries ───────────────────────────────────────────────────

  @Get('transactions')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get user transactions' })
  @ApiQuery({ name: 'page',          required: false, type: Number })
  @ApiQuery({ name: 'limit',         required: false, type: Number })
  @ApiQuery({ name: 'status',        required: false, type: String })
  @ApiQuery({ name: 'type',          required: false, type: String })
  @ApiQuery({ name: 'paymentMethod', required: false, type: String })
  @ApiQuery({ name: 'startDate',     required: false, type: String })
  @ApiQuery({ name: 'endDate',       required: false, type: String })
  async getUserTransactions(@Req() req: any, @Query() query: TransactionQueryDto) {
    return this.paymentsService.getUserTransactions(req.user.id, query);
  }

  @Get('transactions/reference/:txRef')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get transaction by reference' })
  async getTransactionByReference(@Param('txRef') txRef: string, @Req() req: any) {
    return this.paymentsService.getTransactionByReference(txRef, req.user.id);
  }

  @Get('transactions/:id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get transaction by ID' })
  async getTransactionById(@Param('id') id: string, @Req() req: any) {
    return this.paymentsService.getTransactionById(id, req.user.id);
  }

  // ── CamerPay Webhook (public — CamerPay POSTs here directly) ─────────────
  // Register this URL in your CamerPay dashboard as the callback_url.
  // Also set CAMERPAY_WEBHOOK_URL=https://api.horohouse.com/payments/webhook/camerpay

  @Post('webhook/camerpay')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'CamerPay webhook receiver' })
  async handleCamerPayWebhook(
    @Headers('x-camerpay-signature') signature: string,
    @Req() req: any,
  ) {
    if (!signature) {
      throw new BadRequestException('Missing X-CamerPay-Signature header');
    }

    // rawBody is attached by the Fastify preHandler hook in main.ts.
    // Falls back to re-serialised body — valid as long as CamerPay sends
    // compact JSON (no extra whitespace), which all webhook providers do.
    const rawBody: string = req.rawBody
      ? req.rawBody.toString('utf8')
      : JSON.stringify(req.body);

    await this.paymentsService.handleWebhook(rawBody, signature);
    return { status: 'success', message: 'Webhook processed successfully' };
  }

  // ── Admin ─────────────────────────────────────────────────────────────────

  @Get('admin/transactions')
  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get all transactions (Admin)' })
  async getAllTransactions(@Query() query: TransactionQueryDto) {
    return this.paymentsService.getAllTransactions(query);
  }

  @Get('admin/analytics')
  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get payment analytics (Admin)' })
  async getPaymentAnalytics() {
    return { message: 'Payment analytics endpoint' };
  }

  @Post('admin/bookings/:bookingId/refund')
  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Process or retry refund for a booking (Admin)',
    description:
      'Initiates a refund via CamerPay for a cancelled or disputed booking, records the REFUND transaction, ' +
      'updates booking payment status, and debits host wallet if applicable.',
  })
  @ApiParam({ name: 'bookingId', description: 'ID of the booking to refund' })
  async adminRefundBooking(
    @Param('bookingId') bookingId: string,
    @Body() dto: AdminRefundBookingDto,
  ) {
    return this.paymentsService.adminRefundBooking(bookingId, dto.amount, dto.reason);
  }
}