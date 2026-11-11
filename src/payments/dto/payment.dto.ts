import { IsString, IsNumber, IsEnum, IsOptional, IsEmail, ValidateNested, IsObject, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TransactionType, PaymentMethod, Currency } from '../schemas/transaction.schema';
import { BillingCycle } from '../schemas/transaction.schema';
import { BoostType } from '../schemas/listing-boost.schema';

// Initialize Payment DTO
export class InitializePaymentDto {
  @ApiProperty({ enum: TransactionType })
  @IsEnum(TransactionType)
  type: TransactionType;

  @ApiProperty()
  @IsNumber()
  amount: number;

  @ApiProperty({ enum: Currency, default: Currency.XAF })
  @IsEnum(Currency)
  @IsOptional()
  currency?: Currency;

  @ApiProperty({ enum: PaymentMethod })
  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  propertyId?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  subscriptionPlan?: string;

  @ApiPropertyOptional({ enum: BillingCycle })
  @IsEnum(BillingCycle)
  @IsOptional()
  billingCycle?: BillingCycle;

  @ApiPropertyOptional({ enum: BoostType })
  @IsEnum(BoostType)
  @IsOptional()
  boostType?: BoostType;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  boostDuration?: number; // in hours

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional()
  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  redirectUrl?: string;

  @ApiPropertyOptional()
  @IsEmail()
  @IsOptional()
  customerEmail?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  customerPhone?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  customerName?: string;
}

// Verify Payment DTO
export class VerifyPaymentDto {
  @ApiProperty()
  @IsString()
  transactionId: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  flutterwaveReference?: string;
}

// Create Subscription DTO
// Create Subscription DTO
export class CreateSubscriptionDto {
  @ApiProperty()
  @IsString()
  planName: string;

  @ApiProperty({ enum: BillingCycle })
  @IsEnum(BillingCycle)
  billingCycle: BillingCycle;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  discountCode?: string;

  // ✅ FIX: Change from @IsString() to @IsEnum()
  @ApiPropertyOptional({ 
    enum: PaymentMethod,
    description: 'Payment method: mtn_momo, orange_money, card, bank_transfer, or wallet'
  })
  @IsEnum(PaymentMethod, {
    message: 'paymentMethod must be one of: mtn_momo, orange_money, card, bank_transfer, wallet'
  })
  @IsOptional()
  paymentMethod?: PaymentMethod;
}

// Create Listing Boost DTO
export class CreateListingBoostDto {
  @ApiProperty()
  @IsString()
  propertyId: string;

  @ApiProperty({ enum: BoostType })
  @IsEnum(BoostType)
  boostType: BoostType;

  @ApiProperty()
  @IsNumber()
  duration: number; // in hours

  @ApiPropertyOptional()
  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}

// Cancel Subscription DTO
// Cancel Subscription DTO
export class CancelSubscriptionDto {
  @ApiProperty()
  @IsString()
  reason: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  feedback?: string;  // ✅ ADD THIS LINE

  @ApiPropertyOptional()
  @IsBoolean()  // ✅ ADD THIS DECORATOR
  @IsOptional()
  cancelImmediately?: boolean;
}

// Withdraw Wallet Funds DTO
export class WithdrawFundsDto {
  @ApiProperty()
  @IsNumber()
  amount: number;

  @ApiProperty({ enum: PaymentMethod })
  @IsEnum(PaymentMethod)
  withdrawalMethod: PaymentMethod;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  accountNumber?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  accountName?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  bankCode?: string;
}

export class InitiateBookingPaymentDto {
  @ApiPropertyOptional({ enum: PaymentMethod, description: 'User-selected operator: mtn_momo or orange_money' })
  @IsEnum(PaymentMethod)
  @IsOptional()
  paymentMethod?: PaymentMethod;

  @ApiPropertyOptional({ description: 'Mobile money number to charge, if different from profile phone' })
  @IsString()
  @IsOptional()
  phone?: string;
}


// Flutterwave Webhook DTO
export class FlutterwaveWebhookDto {
  @ApiProperty()
  event: string;

  @ApiProperty()
  data: {
    id: number;
    tx_ref: string;
    flw_ref: string;
    device_fingerprint: string;
    amount: number;
    currency: string;
    charged_amount: number;
    app_fee: number;
    merchant_fee: number;
    processor_response: string;
    auth_model: string;
    ip: string;
    narration: string;
    status: string;
    payment_type: string;
    created_at: string;
    account_id: number;
    customer: {
      id: number;
      name: string;
      phone_number: string;
      email: string;
      created_at: string;
    };
    [key: string]: any;
  };
}

// Query DTOs
export class TransactionQueryDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  status?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  type?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  paymentMethod?: string;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  page?: number;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  limit?: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  startDate?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  endDate?: string;
}

export class AdminRefundBookingDto {
  @ApiPropertyOptional({ description: 'Amount to refund in XAF. Defaults to full refundable or cancellation amount.' })
  @IsNumber()
  @IsOptional()
  amount?: number;

  @ApiPropertyOptional({ description: 'Reason for the refund' })
  @IsString()
  @IsOptional()
  reason?: string;
}