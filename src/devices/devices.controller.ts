import { Body, Controller, Post, Req, UseGuards, UnauthorizedException } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt.auth.guard';
import { DevicesService } from './devices.service';
import { RegisterDeviceDto } from './dto/register-device.dto';

function extractUserId(req: any): string {
  const userId = req.user?.userId ?? req.user?._id?.toString() ?? req.user?.id;
  if (!userId) throw new UnauthorizedException('User ID not found in token');
  return userId;
}

@Controller('devices')
@UseGuards(JwtAuthGuard)
export class DevicesController {
  constructor(private readonly devicesService: DevicesService) {}

  @Post('register')
  async register(@Req() req: any, @Body() dto: RegisterDeviceDto) {
    const userId = extractUserId(req);
    return this.devicesService.registerToken(userId, dto.token, dto.platform, dto.deviceId);
  }
}