import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { JwtAuthGuard } from '../auth/guards/jwt.auth.guard';
import { Roles, RolesGuard } from '../auth/guards/roles.guard';
import { UserRole } from '../users/schemas/user.schema';
import { AdminReviewService, ReviewSource } from './admin-review.service';

class RefundDto {
  /** XAF; leave out for a full refund */
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  amount?: number;

  @IsOptional() @IsString() @MaxLength(300)
  note?: string;
}

class ResolveDto {
  @IsIn(['refunded_manually', 'no_refund_needed'])
  resolution: 'refunded_manually' | 'no_refund_needed';

  /** Required for "refunded manually": what was given back (XAF) */
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  amount?: number;

  @IsOptional() @IsString() @MaxLength(300)
  note?: string;
}

@ApiTags('Admin review')
@ApiBearerAuth('JWT-auth')
@Controller('admin/review')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminReviewController {
  constructor(private readonly review: AdminReviewService) {}

  @Get('summary')
  @ApiOperation({ summary: 'Real dashboard figures: commission, refunds, items waiting (Admin)' })
  summary(@Query('days') days?: string) {
    return this.review.summary(Number(days) || 30);
  }

  @Get('payments')
  @ApiOperation({ summary: 'Payments that need a human (state=open|resolved) (Admin)' })
  payments(@Query('state') state?: string, @Query('limit') limit?: string) {
    return this.review.list(state === 'resolved' ? 'resolved' : 'open', Number(limit) || 50);
  }

  @Post('payments/:source/:id/refund')
  @ApiOperation({ summary: 'Refund the guest through CamerPay (once only) (Admin)' })
  refund(@Param('source') source: ReviewSource, @Param('id') id: string, @Body() dto: RefundDto, @Req() req: any) {
    return this.review.refund(source, id, req.user, dto.amount, dto.note);
  }

  @Post('payments/:source/:id/resolve')
  @ApiOperation({ summary: 'Close by hand: refunded outside the app, or no refund needed (Admin)' })
  resolve(@Param('source') source: ReviewSource, @Param('id') id: string, @Body() dto: ResolveDto, @Req() req: any) {
    return this.review.resolve(source, id, req.user, dto.resolution, dto.note, dto.amount);
  }
}
