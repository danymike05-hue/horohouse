import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsMongoId,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { ESS_CATEGORIES } from '../schemas/essentials.schema';

// ── Student ─────────────────────────────────────────────────────────────────

export class CityQueryDto {
  @IsOptional() @IsString() @MaxLength(60) city?: string;
}

export class ItemsQueryDto extends CityQueryDto {
  @IsOptional() @IsString() @MaxLength(60) q?: string;
  @IsOptional() @IsIn([...ESS_CATEGORIES]) category?: string;
  @IsOptional() @IsIn(['price', 'rating', 'fast']) sort?: 'price' | 'rating' | 'fast';
  /** Only items up to this price (FCFA) */
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) maxPrice?: number;
}

export class CartLineDto {
  @IsIn(['kit', 'item']) kind!: 'kit' | 'item';
  @IsMongoId() offerId!: string;
  @IsInt() @Min(1) @Max(20) qty!: number;
  @IsOptional() @IsObject() options?: Record<string, string>;
  @IsOptional() @IsArray() @ArrayMaxSize(40) @IsString({ each: true }) removed?: string[];
}

export class PutCartDto {
  @IsString() @MaxLength(60) city!: string;
  @IsArray() @ArrayMaxSize(40) @ValidateNested({ each: true }) @Type(() => CartLineDto) lines!: CartLineDto[];
}

export class CreateOrderDto {
  @IsString() @MaxLength(200) address!: string;
  @IsOptional() @IsString() @MaxLength(80) district?: string;
  /** YYYY-MM-DD */
  @Matches(/^\d{4}-\d{2}-\d{2}$/) date!: string;
  @IsIn(['morning', 'afternoon', 'evening']) slot!: 'morning' | 'afternoon' | 'evening';
  @IsOptional() @IsString() @MaxLength(300) note?: string;
  @IsOptional() @IsMongoId() leaseId?: string;
  /** Someone else receives it (a parent ordering for a child) */
  @IsOptional() @IsString() @MaxLength(80) recipientName?: string;
  @IsOptional() @Matches(/^[+\d\s]{9,16}$/) recipientPhone?: string;
}

export class DisputeDto {
  @IsIn(['missing', 'damaged', 'wrong', 'not_delivered', 'faulty', 'other'])
  reason!: 'missing' | 'damaged' | 'wrong' | 'not_delivered' | 'faulty' | 'other';
  @IsOptional() @IsString() @MaxLength(800) text?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(6) @IsString({ each: true }) photos?: string[];
}

export class RateDto {
  @IsInt() @Min(1) @Max(5) rating!: number;
  @IsOptional() @IsString() @MaxLength(500) review?: string;
}

export class InterestDto {
  @IsString() @MaxLength(60) city!: string;
}

// ── Shops ───────────────────────────────────────────────────────────────────

export class ZoneDto {
  @IsString() @MaxLength(60) city!: string;
  @IsOptional() @IsString() @MaxLength(60) district?: string;
  @IsInt() @Min(0) @Max(100_000) fee!: number;
  @IsInt() @Min(15) @Max(60 * 24 * 7) minutes!: number;
}

export class PayoutMethodDto {
  @IsIn(['mtn_momo', 'orange_money']) provider!: 'mtn_momo' | 'orange_money';
  @Matches(/^[+\d\s]{9,16}$/) number!: string;
  @IsString() @MaxLength(80) name!: string;
}

export class DocumentDto {
  @IsIn(['registration', 'id', 'other']) kind!: 'registration' | 'id' | 'other';
  @IsString() @MaxLength(400) url!: string;
}

export class ShopFieldsDto {
  @IsOptional() @IsString() @MaxLength(80) name?: string;
  @IsOptional() @IsString() @MaxLength(60) city?: string;
  @IsOptional() @IsString() @MaxLength(200) address?: string;
  @IsOptional() @IsObject() location?: { lat: number; lng: number };
  @IsOptional() @Matches(/^[+\d\s]{9,16}$/) phone?: string;
  @IsOptional() @Matches(/^[+\d\s]{0,16}$/) whatsapp?: string;
  @IsOptional() @IsString() @MaxLength(600) about?: string;
  @IsOptional() @IsString() @MaxLength(400) logo?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(8) @IsString({ each: true }) photos?: string[];
  @IsOptional() @IsArray() @ArrayMaxSize(6) @ValidateNested({ each: true }) @Type(() => DocumentDto) documents?: DocumentDto[];
  @IsOptional() @ValidateNested() @Type(() => PayoutMethodDto) payoutMethod?: PayoutMethodDto;
  @IsOptional() @IsArray() @ArrayMaxSize(30) @ValidateNested({ each: true }) @Type(() => ZoneDto) zones?: ZoneDto[];
  @IsOptional() @IsInt() @Min(0) @Max(1_000_000) minOrder?: number;
  @IsOptional() @IsString() @MaxLength(120) openingHours?: string;
}

export class ApplyShopDto extends ShopFieldsDto {
  /** Code from an admin invite: claims that shop */
  @IsOptional() @IsString() @MaxLength(12) inviteCode?: string;
  /** true = send for review; false = save the draft */
  @IsOptional() @IsBoolean() submit?: boolean;
}

export class UpdateShopDto extends ShopFieldsDto {
  @IsOptional() @IsBoolean() paused?: boolean;
}

export class KitOfferDto {
  @IsInt() @Min(0) @Max(5_000_000) price!: number;
  @IsOptional() @IsObject() optionPrices?: Record<string, number>;
  @IsOptional() @IsObject() removeDiscounts?: Record<string, number>;
  @IsOptional() @IsArray() @ArrayMaxSize(8) @IsString({ each: true }) photos?: string[];
  @IsOptional() @IsBoolean() available?: boolean;
  @IsOptional() @IsInt() @Min(0) @Max(240) prepHours?: number;
}

export class ItemOptionValueDto {
  @IsString() @MaxLength(30) key!: string;
  @IsString() @MaxLength(40) label!: string;
  @IsInt() @Min(0) @Max(1_000_000) extra!: number;
}
export class ItemOptionDto {
  @IsString() @MaxLength(30) key!: string;
  @IsString() @MaxLength(40) label!: string;
  @IsArray() @ArrayMaxSize(12) @ValidateNested({ each: true }) @Type(() => ItemOptionValueDto) values!: ItemOptionValueDto[];
}

export class ItemOfferDto {
  @IsOptional() @IsString() @MaxLength(40) itemTypeKey?: string;
  @IsOptional() @IsString() @MaxLength(100) title?: string;
  @IsOptional() @IsString() @MaxLength(60) brand?: string;
  @IsOptional() @IsString() @MaxLength(800) description?: string;
  @IsOptional() @IsInt() @Min(0) @Max(5_000_000) price?: number;
  @IsOptional() @IsArray() @ArrayMaxSize(4) @ValidateNested({ each: true }) @Type(() => ItemOptionDto) options?: ItemOptionDto[];
  @IsOptional() @IsArray() @ArrayMaxSize(8) @IsString({ each: true }) photos?: string[];
  @IsOptional() @IsInt() @Min(0) @Max(100_000) stock?: number;
  @IsOptional() @IsInt() @Min(0) @Max(3650) warrantyDays?: number;
  @IsOptional() @IsBoolean() assembly?: boolean;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class PartActionDto {
  @IsOptional() @IsString() @MaxLength(300) reason?: string;
  /** Delivered: the student's 4-digit code */
  @IsOptional() @Matches(/^\d{4}$/) code?: string;
}

// ── Admin ───────────────────────────────────────────────────────────────────

export class AdminShopsQueryDto {
  @IsOptional() @IsIn(['invited', 'pending', 'approved', 'rejected', 'suspended']) status?: string;
  @IsOptional() @IsString() @MaxLength(60) q?: string;
}

export class ReasonDto {
  @IsOptional() @IsString() @MaxLength(400) reason?: string;
}

export class InviteShopDto {
  @IsString() @MaxLength(80) name!: string;
  @IsString() @MaxLength(60) city!: string;
  @IsOptional() @Matches(/^[+\d\s]{9,16}$/) phone?: string;
}

export class AdminOrdersQueryDto {
  @IsOptional() @IsIn(['late', 'disputed', 'active', 'done', 'all']) view?: string;
  @IsOptional() @IsString() @MaxLength(60) city?: string;
}

export class ResolveDisputeDto {
  @IsIn(['refund_full', 'refund_partial', 'no_refund']) decision!: 'refund_full' | 'refund_partial' | 'no_refund';
  @IsOptional() @IsInt() @Min(1) amount?: number;
  @IsOptional() @IsString() @MaxLength(400) note?: string;
}

export class SendPayoutDto {
  @IsMongoId() shopId!: string;
  @IsString() @MaxLength(80) reference!: string;
}

export class MarketDto {
  @IsOptional() @IsNumber() @Min(0) @Max(50) commissionPct?: number;
  @IsOptional() @IsInt() @Min(0) @Max(100_000) serviceFee?: number;
  @IsOptional() @IsInt() @Min(1) @Max(48) acceptHours?: number;
  @IsOptional() @IsInt() @Min(0) @Max(336) holdHours?: number;
  @IsOptional() @IsArray() @ArrayMaxSize(80) @IsString({ each: true }) cities?: string[];
}

export class TemplateLineDto {
  @IsString() @MaxLength(40) itemTypeKey!: string;
  @IsInt() @Min(1) @Max(50) qty!: number;
  @IsBoolean() removable!: boolean;
}

export class TemplateDto {
  @IsOptional() @IsString() @MaxLength(30) key?: string;
  @IsOptional() @IsObject() name?: { en: string; fr: string };
  @IsOptional() @IsObject() description?: { en: string; fr: string };
  @IsOptional() @IsString() @MaxLength(8) icon?: string;
  @IsOptional() @IsString() @MaxLength(400) image?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(40) @ValidateNested({ each: true }) @Type(() => TemplateLineDto) lines?: TemplateLineDto[];
  @IsOptional() @IsArray() @ArrayMaxSize(4) options?: any[];
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsInt() order?: number;
}

export class ItemTypeDto {
  @IsOptional() @IsString() @Matches(/^[a-z0-9_]{2,40}$/) key?: string;
  @IsOptional() @IsObject() name?: { en: string; fr: string };
  @IsOptional() @IsIn([...ESS_CATEGORIES]) category?: string;
  @IsOptional() @IsString() @MaxLength(8) icon?: string;
  @IsOptional() @IsIn(['small', 'medium', 'large']) size?: 'small' | 'medium' | 'large';
  @IsOptional() @IsBoolean() electrical?: boolean;
  @IsOptional() @IsObject() keywords?: { en: string[]; fr: string[] };
}
