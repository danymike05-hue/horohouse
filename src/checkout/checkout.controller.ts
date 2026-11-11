import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  Post,
  Query,
  RawBodyRequest,
  Redirect,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SkipThrottle } from '@nestjs/throttler';
import type { FastifyRequest } from 'fastify';
// ⚠ Adjust to your existing guard path.
import { JwtAuthGuard } from 'src/auth/guards/jwt.auth.guard';
import { CheckoutService } from './checkout.service';
import { CheckoutQuoteQueryDto, CreateCheckoutPaymentDto } from './dto/create-checkout-payment.dto';

const userIdOf = (req: any): string => String(req.user?.id ?? req.user?._id ?? req.user?.sub ?? req.user?.userId);

@Controller('checkout')
export class CheckoutController {
  private readonly signatureHeader: string;

  constructor(private readonly checkout: CheckoutService, config: ConfigService) {
    this.signatureHeader = (config.get<string>('CAMERPAY_SIGNATURE_HEADER') ?? 'x-camerpay-signature').toLowerCase();
  }

  /** Price + payment options for a subscription or a boost (amount always computed here). */
  @UseGuards(JwtAuthGuard)
  @Post('quote')
  @HttpCode(200)
  quote(@Req() req: any, @Body() dto: CheckoutQuoteQueryDto) {
    return this.checkout.quote(userIdOf(req), dto);
  }

  /**
   * Start (or resume) a payment: a booking (amount from the booking), a subscription
   * (amount from the plan) or a boost (amount from the boost pricing). Wallet and
   * included-boost payments are settled immediately.
   */
  @UseGuards(JwtAuthGuard)
  @Post('payments')
  create(@Req() req: any, @Body() dto: CreateCheckoutPaymentDto) {
    return this.checkout.createPayment(userIdOf(req), dto);
  }

  /** Polled by the waiting screen. Reads our DB only. */
  @UseGuards(JwtAuthGuard)
  @Get('payments/:id')
  get(@Req() req: any, @Param('id') id: string) {
    return this.checkout.getPayment(userIdOf(req), id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('payments/:id/cancel')
  @HttpCode(200)
  cancel(@Req() req: any, @Param('id') id: string) {
    return this.checkout.cancelPayment(userIdOf(req), id);
  }

  /** CamerPay → us. Public, signed, needs the raw body (main.ts: rawBody: true). */
  @SkipThrottle()
  @Post('webhooks/camerpay')
  @HttpCode(200)
  webhook(@Req() req: RawBodyRequest<FastifyRequest>, @Headers() headers: Record<string, string | string[] | undefined>) {
    return this.checkout.handleWebhook(req.rawBody, headers[this.signatureHeader]);
  }

  /** CamerPay hosted page → here → app deep link (closes the in-app browser). */
  @SkipThrottle()
  @Get('return')
  @Redirect()
  async returnFromProvider(@Query('paymentId') paymentId?: string) {
    return { url: await this.checkout.buildReturnRedirect(paymentId), statusCode: 302 };
  }
}
