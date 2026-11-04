import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt.auth.guard';
import { Roles, RolesGuard } from '../auth/guards/roles.guard';
import { UserRole } from '../users/schemas/user.schema';
import { TrustService, ID_DOCUMENT_TYPES, ID_MAX_BYTES, ID_MIME_TYPES, IdDocumentType } from './trust.service';

class ReviewIdentityDto {
  @IsBoolean() approve: boolean;
  @IsOptional() @IsString() @MaxLength(300) reason?: string;
}

@ApiTags('Trust')
@ApiBearerAuth('JWT-auth')
@Controller('trust')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TrustController {
  constructor(private readonly trust: TrustService) {}

  @Get('me/identity')
  @ApiOperation({ summary: 'My identity verification status' })
  myIdentity(@Req() req: any) {
    return this.trust.getMyIdentity(String(req.user._id ?? req.user.id));
  }

  @Post('me/identity')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload an ID photo (?documentType=national_id|passport|residence_permit|driving_licence)' })
  async submitIdentity(@Req() req: any, @Query('documentType') documentType?: string) {
    const type = (ID_DOCUMENT_TYPES as readonly string[]).includes(String(documentType)) ? (documentType as IdDocumentType) : 'national_id';
    const data = await req.file();
    if (!data) throw new BadRequestException('No file uploaded');
    if (!ID_MIME_TYPES.includes(String(data.mimetype).toLowerCase())) {
      throw new BadRequestException('Upload a photo of your ID (JPG, PNG, WEBP or HEIC)');
    }
    const buffer: Buffer = await data.toBuffer();
    if (buffer.length > ID_MAX_BYTES) throw new BadRequestException('The photo is too large (10 MB maximum)');
    return this.trust.submitIdentity(String(req.user._id ?? req.user.id), buffer, type);
  }

  @Get('identity/pending')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'IDs waiting for review, oldest first (Admin)' })
  pending(@Query('page') page?: string, @Query('limit') limit?: string) {
    return this.trust.listPending(Number(page) || 1, Number(limit) || 20);
  }

  @Get('identity/:userId/document')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Signed 10-minute link to a user ID photo (Admin)' })
  document(@Param('userId') userId: string) {
    return this.trust.documentUrl(userId);
  }

  @Patch('identity/:userId')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Approve or reject an ID (Admin)' })
  review(@Param('userId') userId: string, @Body() body: ReviewIdentityDto, @Req() req: any) {
    return this.trust.review(userId, body.approve, body.reason, req.user);
  }

  @Get('guests/:guestId')
  @Roles(UserRole.HOST, UserRole.AGENT, UserRole.LANDLORD, UserRole.ADMIN)
  @ApiOperation({ summary: 'Guest profile for a host: verifications, stays, reviews from hosts' })
  guest(@Param('guestId') guestId: string, @Req() req: any) {
    return this.trust.guestProfile(guestId, req.user);
  }
}
