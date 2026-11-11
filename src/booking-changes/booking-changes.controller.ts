import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { IsDateString, IsMongoId, IsOptional, IsString, Length } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt.auth.guard';
import { BookingChangesService } from './booking-changes.service';

class PreviewChangeDto {
  @IsMongoId() bookingId: string;
  @IsDateString() checkIn: string;
  @IsDateString() checkOut: string;
}

class RequestChangeDto extends PreviewChangeDto {
  @IsOptional() @IsString() @Length(0, 500) note?: string;
}

class DeclineChangeDto {
  @IsOptional() @IsString() @Length(0, 500) reason?: string;
}

@ApiTags('Booking date changes')
@ApiBearerAuth('JWT-auth')
@Controller('booking-changes')
@UseGuards(JwtAuthGuard)
export class BookingChangesController {
  constructor(private readonly changes: BookingChangesService) {}

  @Post('preview')
  @ApiOperation({ summary: 'What new dates would cost (guest). Saves nothing.' })
  preview(@Body() dto: PreviewChangeDto, @Req() req: any) {
    return this.changes.preview(req.user, dto);
  }

  @Post()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Guest asks to move a paid, confirmed stay' })
  request(@Body() dto: RequestChangeDto, @Req() req: any) {
    return this.changes.request(req.user, dto);
  }

  @Get('booking/:bookingId')
  @ApiOperation({ summary: 'The latest date change on a booking, and whether one can be requested' })
  forBooking(@Param('bookingId') bookingId: string, @Req() req: any) {
    return this.changes.forBooking(req.user, bookingId);
  }

  @Post(':id/accept')
  @ApiOperation({ summary: 'Host accepts. Applies now, or waits for the guest to pay the difference.' })
  accept(@Param('id') id: string, @Req() req: any) {
    return this.changes.accept(req.user, id);
  }

  @Post(':id/decline')
  @ApiOperation({ summary: 'Host declines' })
  decline(@Param('id') id: string, @Body() dto: DeclineChangeDto, @Req() req: any) {
    return this.changes.decline(req.user, id, dto.reason);
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Guest withdraws the request' })
  cancel(@Param('id') id: string, @Req() req: any) {
    return this.changes.cancel(req.user, id);
  }
}
