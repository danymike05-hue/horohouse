import { Body, Controller, Delete, Get, HttpCode, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { IsMongoId, IsString, Length } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt.auth.guard';
import { CoHostsService } from './co-hosts.service';

class InviteCoHostDto {
  @IsMongoId() propertyId: string;
  /** Email or phone number of an existing host account */
  @IsString() @Length(5, 120) contact: string;
}

@ApiTags('Co-hosts')
@ApiBearerAuth('JWT-auth')
@Controller('co-hosts')
@UseGuards(JwtAuthGuard)
export class CoHostsController {
  constructor(private readonly coHosts: CoHostsService) {}

  @Post()
  // Tight: this answers whether an email or phone belongs to a host account.
  @Throttle({ default: { limit: 10, ttl: 3_600_000 } })
  @ApiOperation({ summary: 'Invite someone to help run a listing' })
  invite(@Body() dto: InviteCoHostDto, @Req() req: any) {
    return this.coHosts.invite(req.user, dto.propertyId, dto.contact);
  }

  @Get('mine')
  @ApiOperation({ summary: 'Invitations to me, and the listings I help run' })
  mine(@Req() req: any) {
    return this.coHosts.mine(req.user);
  }

  @Get('property/:propertyId')
  @ApiOperation({ summary: 'Who helps run this listing (its host only)' })
  forProperty(@Param('propertyId') propertyId: string, @Req() req: any) {
    return this.coHosts.forProperty(req.user, propertyId);
  }

  @Post(':id/accept')
  @HttpCode(200)
  accept(@Param('id') id: string, @Req() req: any) {
    return this.coHosts.respond(req.user, id, true);
  }

  @Post(':id/decline')
  @HttpCode(200)
  decline(@Param('id') id: string, @Req() req: any) {
    return this.coHosts.respond(req.user, id, false);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Host removes a co-host, or a co-host leaves' })
  remove(@Param('id') id: string, @Req() req: any) {
    return this.coHosts.remove(req.user, id);
  }
}
