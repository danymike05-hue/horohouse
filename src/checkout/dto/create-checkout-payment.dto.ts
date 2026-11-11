import { IsIn, IsInt, IsMongoId, IsOptional, IsString, Matches, MaxLength, ValidateIf } from 'class-validator';
import type { CheckoutMethod, CheckoutPurpose, MomoOperator } from '../schemas/checkout-payment.schema';

export class CreateCheckoutPaymentDto {
  /** What is being paid. Omitted = booking (older app versions). */
  @IsOptional()
  @IsIn(['booking', 'subscription', 'boost', 'date_change'])
  purpose?: CheckoutPurpose;

  // ── Date change: the price difference ───────────────────────────────────
  @ValidateIf((o: CreateCheckoutPaymentDto) => o.purpose === 'date_change')
  @IsMongoId()
  changeId?: string;

  @ValidateIf((o: CreateCheckoutPaymentDto) => !o.purpose || o.purpose === 'booking')
  @IsMongoId()
  bookingId?: string;

  // ── Subscription ─────────────────────────────────────────────────────────
  @ValidateIf((o: CreateCheckoutPaymentDto) => o.purpose === 'subscription')
  @IsString()
  @MaxLength(40)
  planName?: string;

  @ValidateIf((o: CreateCheckoutPaymentDto) => o.purpose === 'subscription')
  @IsIn(['monthly', 'quarterly', 'yearly'])
  billingCycle?: 'monthly' | 'quarterly' | 'yearly';

  // ── Boost ────────────────────────────────────────────────────────────────
  @ValidateIf((o: CreateCheckoutPaymentDto) => o.purpose === 'boost')
  @IsMongoId()
  propertyId?: string;

  @ValidateIf((o: CreateCheckoutPaymentDto) => o.purpose === 'boost')
  @IsString()
  @MaxLength(30)
  boostType?: string;

  @ValidateIf((o: CreateCheckoutPaymentDto) => o.purpose === 'boost')
  @IsInt()
  @IsIn([24, 168, 720])
  duration?: number;

  // ── How ──────────────────────────────────────────────────────────────────
  @IsIn(['mobile_money', 'card', 'wallet', 'plan_credit'])
  method!: CheckoutMethod;

  @ValidateIf((o: CreateCheckoutPaymentDto) => o.method === 'mobile_money')
  @IsIn(['orange_money', 'mtn_momo'])
  operator?: MomoOperator;

  @ValidateIf((o: CreateCheckoutPaymentDto) => o.method === 'mobile_money')
  @IsString()
  @Matches(/^[+\d\s]{9,16}$/)
  phone?: string;

  /** Deep link / URL to land on after the hosted page. Checked against an allowlist. */
  @IsOptional()
  @IsString()
  @MaxLength(300)
  returnUrl?: string;
}

/** POST /checkout/quote — what a subscription / boost costs and which ways to pay apply */
export class CheckoutQuoteQueryDto {
  @IsIn(['subscription', 'boost', 'date_change'])
  purpose!: 'subscription' | 'boost' | 'date_change';

  @ValidateIf((o: CheckoutQuoteQueryDto) => o.purpose === 'date_change')
  @IsMongoId()
  changeId?: string;

  @ValidateIf((o: CheckoutQuoteQueryDto) => o.purpose === 'subscription')
  @IsString()
  @MaxLength(40)
  planName?: string;

  @ValidateIf((o: CheckoutQuoteQueryDto) => o.purpose === 'subscription')
  @IsIn(['monthly', 'quarterly', 'yearly'])
  billingCycle?: 'monthly' | 'quarterly' | 'yearly';

  @ValidateIf((o: CheckoutQuoteQueryDto) => o.purpose === 'boost')
  @IsMongoId()
  propertyId?: string;

  @ValidateIf((o: CheckoutQuoteQueryDto) => o.purpose === 'boost')
  @IsString()
  @MaxLength(30)
  boostType?: string;

  @ValidateIf((o: CheckoutQuoteQueryDto) => o.purpose === 'boost')
  @IsInt()
  @IsIn([24, 168, 720])
  duration?: number;
}
