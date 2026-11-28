import { IsIn, IsInt, IsMongoId, IsOptional, IsString, Matches, MaxLength, ValidateIf } from 'class-validator';
import type { CheckoutMethod, CheckoutPurpose, MomoOperator } from '../schemas/checkout-payment.schema';

export class CreateCheckoutPaymentDto {
  /** What is being paid. Omitted = booking (older app versions). */
  @IsOptional()
  @IsIn(['booking', 'subscription', 'boost', 'date_change', 'essentials', 'rent'])
  purpose?: CheckoutPurpose;

  // ── Shared rent: the tenant's share of a cycle ─────────────────────────
  @ValidateIf((o: CreateCheckoutPaymentDto) => o.purpose === 'rent')
  @IsMongoId()
  cycleId?: string;

  // ── Essential kits: the order ───────────────────────────────────────────
  @ValidateIf((o: CreateCheckoutPaymentDto) => o.purpose === 'essentials')
  @IsMongoId()
  orderId?: string;

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
  @IsIn(['subscription', 'boost', 'date_change', 'essentials', 'rent'])
  purpose!: 'subscription' | 'boost' | 'date_change' | 'essentials' | 'rent';

  @ValidateIf((o: CheckoutQuoteQueryDto) => o.purpose === 'rent')
  @IsMongoId()
  cycleId?: string;

  @ValidateIf((o: CheckoutQuoteQueryDto) => o.purpose === 'essentials')
  @IsMongoId()
  orderId?: string;

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

/** POST /checkout/store-purchase — a plan or boost bought in the app with Apple / Google billing */
export class StorePurchaseDto {
  @IsIn(['ios', 'android'])
  platform!: 'ios' | 'android';

  /** e.g. com.horohouse.app.plan.host_growth.monthly — see checkout/store-products.ts */
  @IsString()
  @MaxLength(120)
  productId!: string;

  /** iPhone: the StoreKit transaction id */
  @ValidateIf((o: StorePurchaseDto) => o.platform === 'ios')
  @IsString()
  @MaxLength(40)
  transactionId?: string;

  /** Android: the Play Billing purchase token */
  @ValidateIf((o: StorePurchaseDto) => o.platform === 'android')
  @IsString()
  @MaxLength(4096)
  purchaseToken?: string;

  /** Boosts: the listing */
  @IsOptional()
  @IsMongoId()
  propertyId?: string;
}
