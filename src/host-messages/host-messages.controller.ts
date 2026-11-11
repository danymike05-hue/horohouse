import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt.auth.guard';
import { Roles, RolesGuard } from '../auth/guards/roles.guard';
import { UserRole } from '../users/schemas/user.schema';
import { HostMessagesService } from './host-messages.service';
import { CheckInGuideDto, CreateTemplateDto, UpdateTemplateDto } from './dto/host-messages.dto';
import { TemplateKind } from './schemas/host-message.schema';

const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
const HOSTS = [UserRole.HOST, UserRole.AGENT, UserRole.LANDLORD, UserRole.ADMIN];

@ApiTags('Host messages')
@ApiBearerAuth('JWT-auth')
@Controller('host-messages')
@UseGuards(JwtAuthGuard, RolesGuard)
export class HostMessagesController {
  constructor(private readonly service: HostMessagesService) {}

  // ── Templates ───────────────────────────────────────────────────────────
  @Get('templates')
  @Roles(...HOSTS)
  @ApiOperation({ summary: 'My quick replies and scheduled messages (?kind=quick_reply|scheduled)' })
  list(@Req() req: any, @Query('kind') kind?: TemplateKind) {
    return this.service.listTemplates(req.user, kind);
  }

  @Post('templates')
  @Roles(...HOSTS)
  create(@Req() req: any, @Body() dto: CreateTemplateDto) {
    return this.service.createTemplate(req.user, dto);
  }

  @Patch('templates/:id')
  @Roles(...HOSTS)
  update(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateTemplateDto) {
    return this.service.updateTemplate(req.user, id, dto);
  }

  @Delete('templates/:id')
  @Roles(...HOSTS)
  remove(@Req() req: any, @Param('id') id: string) {
    return this.service.deleteTemplate(req.user, id);
  }

  @Get('quick-replies')
  @Roles(...HOSTS)
  @ApiOperation({ summary: 'Quick replies filled in for a guest (?guestId=&propertyId=)' })
  quickReplies(@Req() req: any, @Query('guestId') guestId?: string, @Query('propertyId') propertyId?: string) {
    return this.service.quickReplies(req.user, guestId, propertyId);
  }

  // ── Check-in guide (host) ───────────────────────────────────────────────
  @Get('check-in-guide/:propertyId')
  @Roles(...HOSTS)
  getGuide(@Req() req: any, @Param('propertyId') propertyId: string) {
    return this.service.getGuideForHost(propertyId, req.user);
  }

  @Put('check-in-guide/:propertyId')
  @Roles(...HOSTS)
  putGuide(@Req() req: any, @Param('propertyId') propertyId: string, @Body() dto: CheckInGuideDto) {
    return this.service.updateGuide(propertyId, dto, req.user);
  }

  @Post('check-in-guide/:propertyId/photos')
  @Roles(...HOSTS)
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Add a photo to the check-in guide (?caption=)' })
  async addPhoto(@Req() req: any, @Param('propertyId') propertyId: string, @Query('caption') caption?: string) {
    const data = await req.file();
    if (!data) throw new BadRequestException('No file uploaded');
    if (!PHOTO_TYPES.includes(String(data.mimetype).toLowerCase())) throw new BadRequestException('Upload a JPG, PNG, WEBP or HEIC photo');
    const buffer: Buffer = await data.toBuffer();
    if (buffer.length > 10 * 1024 * 1024) throw new BadRequestException('The photo is too large (10 MB maximum)');
    return this.service.addGuidePhoto(propertyId, buffer, caption, req.user);
  }

  @Delete('check-in-guide/:propertyId/photos/:publicId')
  @Roles(...HOSTS)
  removePhoto(@Req() req: any, @Param('propertyId') propertyId: string, @Param('publicId') publicId: string) {
    return this.service.removeGuidePhoto(propertyId, publicId, req.user);
  }

  // ── Guest side (host can open it too) ───────────────────────────────────
  @Get('booking/:bookingId/check-in-guide')
  guideForBooking(@Req() req: any, @Param('bookingId') bookingId: string) {
    return this.service.getGuideForBooking(bookingId, req.user);
  }

  @Get('booking/:bookingId/messages')
  messages(@Req() req: any, @Param('bookingId') bookingId: string) {
    return this.service.messagesForBooking(bookingId, req.user);
  }
}
