import { IsIn, IsMongoId, IsOptional, IsString, Matches, MaxLength, ValidateIf } from 'class-validator';
import type { CheckoutMethod, MomoOperator } from '../schemas/checkout-payment.schema';

export class CreateCheckoutPaymentDto {
  @IsMongoId()
  bookingId!: string;

  @IsIn(['mobile_money', 'card'])
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
