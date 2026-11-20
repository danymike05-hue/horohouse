import { Body, Controller, Get, HttpCode, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, Length } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt.auth.guard';
import { RolesGuard, Roles } from '../auth/guards/roles.guard';
import { UserRole } from '../users/schemas/user.schema';
import { HostOnboardingService } from './host-onboarding.service';

class FindOrCreateHostDto {
  @IsString()
  @Length(6, 25)
  phoneNumber: string;

  @IsOptional()
  @IsString()
  @Length(2, 80)
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;
}

/**
 * Admins publishing a home for a host: find or create the host's account, create the listing
 * with POST /properties { onBehalfOf }, then send it to the host, who checks it and publishes it.
 */
@ApiTags('Admin · Listings for hosts')
@ApiBearerAuth()
@Controller('admin/hosts')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class HostOnboardingController {
  constructor(private readonly hostOnboarding: HostOnboardingService) {}

  @Post('find-or-create')
  @HttpCode(200)
  @ApiOperation({ summary: 'Find the host by phone or email, or create their account (becomes a host account)' })
  findOrCreate(@Body() dto: FindOrCreateHostDto) {
    return this.hostOnboarding.findOrCreateHost(dto);
  }

  @Post('listings/:propertyId/send')
  @HttpCode(200)
  @ApiOperation({ summary: 'Tell the host their listing is ready to check and publish (notification + email)' })
  send(@Param('propertyId') propertyId: string, @Req() req: any) {
    return this.hostOnboarding.sendToHost(propertyId, req.user);
  }

  @Get('listings/awaiting')
  @ApiOperation({ summary: 'Listings the team set up that their hosts haven’t published yet' })
  awaiting() {
    return this.hostOnboarding.awaitingConfirmation();
  }
}
