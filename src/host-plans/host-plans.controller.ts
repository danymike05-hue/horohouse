import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize, IsArray, IsBoolean, IsIn, IsInt, IsMongoId, IsNumber, IsOptional, IsString, Length, Max, MaxLength, Min,
} from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt.auth.guard';
import { HostPlansService } from './host-plans.service';
import { HostInsightsService } from './host-insights.service';
import { ListingWriterService } from './listing-writer.service';
import { PromoCodesService } from './promo-codes.service';

const uid = (req: any) => String(req.user?._id ?? req.user?.id ?? req.user?.userId);

class TrialDto {
  @IsIn(['host_starter', 'host_growth']) planName: string;
}
class ReferralDto {
  @IsString() @Length(4, 20) code: string;
}
class WriterDto {
  @IsOptional() @IsIn(['en', 'fr']) lang?: 'en' | 'fr';
  @IsOptional() @IsString() @MaxLength(60) type?: string;
  @IsOptional() @IsString() @MaxLength(40) listingType?: string;
  @IsOptional() @IsString() @MaxLength(80) city?: string;
  @IsOptional() @IsString() @MaxLength(80) neighborhood?: string;
  @IsOptional() @Type(() => Number) @IsNumber() bedrooms?: number;
  @IsOptional() @Type(() => Number) @IsNumber() bathrooms?: number;
  @IsOptional() @Type(() => Number) @IsNumber() maxGuests?: number;
  @IsOptional() @Type(() => Number) @IsNumber() area?: number;
  @IsOptional() @IsArray() @ArrayMaxSize(60) @IsString({ each: true }) amenities?: string[];
  @IsOptional() @IsString() @MaxLength(600) notes?: string;
  @IsOptional() @IsString() @MaxLength(120) currentTitle?: string;
  @IsOptional() @IsString() @MaxLength(3000) currentDescription?: string;
}
class PromoDto {
  @IsOptional() @IsString() @Length(4, 16) code?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(5) @Max(50) percentOff?: number;
  @IsOptional() @IsArray() @ArrayMaxSize(200) @IsMongoId({ each: true }) propertyIds?: string[];
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(90) minNights?: number;
  @IsOptional() @IsString() startsAt?: string | null;
  @IsOptional() @IsString() endsAt?: string | null;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) maxUses?: number | null;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
class PromoCheckDto {
  @IsString() @Length(2, 20) code: string;
  @IsMongoId() propertyId: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) nights?: number;
}

@ApiTags('Hosting plans')
@ApiBearerAuth('JWT-auth')
@Controller('host-plans')
@UseGuards(JwtAuthGuard)
export class HostPlansController {
  constructor(
    private readonly plans: HostPlansService,
    private readonly insights: HostInsightsService,
    private readonly writer: ListingWriterService,
  ) {}

  @Get('me')
  @ApiOperation({ summary: 'My plan, what I use of it, the exact price of each plan, and the offers' })
  me(@Req() req: any) {
    return this.plans.overview(uid(req)).then((o) => ({ ...o, aiWriterAvailable: this.writer.enabled }));
  }

  @Post('trial')
  @HttpCode(200)
  @ApiOperation({ summary: 'Start the free month of Starter or Growth (once, for hosts who never had a plan)' })
  trial(@Req() req: any, @Body() dto: TrialDto) {
    return this.plans.startTrial(uid(req), dto.planName);
  }

  @Post('founding')
  @HttpCode(200)
  @ApiOperation({ summary: 'Claim a founding host place: Growth free for 6 months' })
  founding(@Req() req: any) {
    return this.plans.claimFounding(uid(req));
  }

  @Post('referral')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 3_600_000 } })
  @ApiOperation({ summary: 'Enter the code of the host who invited me' })
  async referral(@Req() req: any, @Body() dto: ReferralDto) {
    await this.plans.applyReferral(uid(req), dto.code);
    return { ok: true };
  }

  @Get('insights')
  @ApiOperation({ summary: 'My hosting numbers (30 days; 12 months and per listing from Growth)' })
  hostInsights(@Req() req: any) {
    return this.insights.forHost(uid(req));
  }

  @Post('ai-writer')
  @HttpCode(200)
  @Throttle({ default: { limit: 20, ttl: 3_600_000 } })
  @ApiOperation({ summary: 'Write a listing title and description from its details' })
  write(@Req() req: any, @Body() dto: WriterDto) {
    return this.writer.write(uid(req), dto);
  }
}

@ApiTags('Promo codes')
@ApiBearerAuth('JWT-auth')
@Controller('promo-codes')
@UseGuards(JwtAuthGuard)
export class PromoCodesController {
  constructor(private readonly codes: PromoCodesService) {}

  @Get()
  @ApiOperation({ summary: 'My promo codes' })
  mine(@Req() req: any) {
    return this.codes.mine(uid(req));
  }

  @Post()
  @ApiOperation({ summary: 'Make a promo code for my guests' })
  create(@Req() req: any, @Body() dto: PromoDto) {
    return this.codes.create(uid(req), dto);
  }

  @Post('check')
  @HttpCode(200)
  @Throttle({ default: { limit: 30, ttl: 3_600_000 } })
  @ApiOperation({ summary: 'Does this code work for this stay? (guests, before booking)' })
  async check(@Body() dto: PromoCheckDto) {
    const ok = await this.codes.check(dto.code, dto.propertyId, dto.nights ?? 0);
    return { code: ok.code, percentOff: ok.percentOff, minNights: ok.minNights };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Change or switch off a promo code' })
  update(@Req() req: any, @Param('id') id: string, @Body() dto: PromoDto) {
    return this.codes.update(uid(req), id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete a promo code' })
  async remove(@Req() req: any, @Param('id') id: string) {
    await this.codes.remove(uid(req), id);
  }
}
