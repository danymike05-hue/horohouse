import { BadRequestException, Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize, IsArray, IsIn, IsInt, IsMongoId, IsOptional, IsString, IsUrl, Length, Min,
} from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt.auth.guard';
import { Roles, RolesGuard } from '../auth/guards/roles.guard';
import { UserRole } from '../users/schemas/user.schema';
import { uploadBufferToCloudinary } from '../utils/cloudinary';
import { BookingIssuesService } from './booking-issues.service';
import { ISSUE_CATEGORIES, IssueCategory, IssueOutcome } from './schemas/booking-issue.schema';

const PHOTO_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
const PHOTO_MAX_BYTES = 10 * 1024 * 1024;

class ReportIssueDto {
  @IsMongoId() bookingId: string;
  @IsIn(ISSUE_CATEGORIES as unknown as string[]) category: IssueCategory;
  @IsString() @Length(20, 2000) description: string;

  @IsOptional() @IsArray() @ArrayMaxSize(6) @IsUrl({ protocols: ['https'], require_protocol: true }, { each: true })
  photos?: string[];
}

class RespondDto {
  @IsString() @Length(3, 2000) message: string;
}

class ResolveIssueDto {
  @IsIn(Object.values(IssueOutcome)) outcome: IssueOutcome;

  /** XAF; leave out for a full refund */
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  amount?: number;

  /** Both the guest and the host see this */
  @IsString() @Length(3, 500) note: string;
}

@ApiTags('Booking issues')
@ApiBearerAuth('JWT-auth')
@Controller('booking-issues')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BookingIssuesController {
  constructor(private readonly issues: BookingIssuesService) {}

  @Post('photos')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload one photo for a problem report' })
  async uploadPhoto(@Req() req: any) {
    const data = await req.file();
    if (!data) throw new BadRequestException('No file uploaded');
    if (!PHOTO_MIME_TYPES.includes(String(data.mimetype).toLowerCase())) {
      throw new BadRequestException('Upload a photo (JPG, PNG, WEBP or HEIC)');
    }
    const buffer: Buffer = await data.toBuffer();
    if (buffer.length > PHOTO_MAX_BYTES) throw new BadRequestException('The photo is too large (10 MB maximum)');
    const result = await uploadBufferToCloudinary(buffer, { folder: 'horohouse/booking-issues', resourceType: 'image' });
    return { url: result.secure_url };
  }

  @Post()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Guest reports a problem with a stay (pauses the host payout if still held)' })
  report(@Body() dto: ReportIssueDto, @Req() req: any) {
    return this.issues.report(req.user, dto);
  }

  @Get('booking/:bookingId')
  @ApiOperation({ summary: 'The problem report on a booking, and whether one can be made' })
  forBooking(@Param('bookingId') bookingId: string, @Req() req: any) {
    return this.issues.forBooking(req.user, bookingId);
  }

  @Post(':id/respond')
  @ApiOperation({ summary: 'Host adds their side' })
  respond(@Param('id') id: string, @Body() dto: RespondDto, @Req() req: any) {
    return this.issues.respond(req.user, id, dto.message);
  }

  @Get('admin/list')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Problem reports to decide (Admin)' })
  adminList(@Query('state') state?: string) {
    return this.issues.adminList(state === 'resolved' ? 'resolved' : 'open');
  }

  @Post('admin/:id/resolve')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Decide a report: refund the guest and/or release the payout (Admin)' })
  resolve(@Param('id') id: string, @Body() dto: ResolveIssueDto, @Req() req: any) {
    return this.issues.resolve(req.user, id, dto);
  }
}
