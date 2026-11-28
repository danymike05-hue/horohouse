import { Controller, Get, ServiceUnavailableException, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AppService } from './app.service';
import { Public, Roles, RolesGuard } from './auth/guards/roles.guard';
import { JwtAuthGuard } from './auth/guards/jwt.auth.guard';
import { UserRole } from './users/schemas/user.schema';

@ApiTags('Health')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) { }

  @Public()
  @Get('health')
  @ApiOperation({ summary: 'Health check endpoint' })
  @ApiResponse({ status: 200, description: 'Service is healthy' })
  async getHealth() {
    const health = await this.appService.getHealthStatus();
    // 503 when the database is down, so Railway (and any uptime monitor) sees the outage
    if (health.status !== 'ok') throw new ServiceUnavailableException(health);
    return health;
  }

  @Public()
  @Get('hello')
  @ApiOperation({ summary: 'Simple hello endpoint' })
  @ApiResponse({ status: 200, description: 'Returns hello message' })
  getHello(): string {
    return this.appService.getHello();
  }

  // Sends a real email on every call: admins only
  @Get('test-email')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
async testEmail() {
  const nodemailer = require('nodemailer');
  const config = {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '465'),
    secure: parseInt(process.env.SMTP_PORT || '465') === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  };

  console.log('SMTP config:', {
    host: config.host,
    port: config.port,
    secure: config.secure,
    user: config.auth.user,
    passLength: config.auth.pass?.length ?? 0,
  });

  try {
    const transporter = nodemailer.createTransport(config);
    await transporter.verify();
    console.log('✅ SMTP connection verified');

    const info = await transporter.sendMail({
      from: process.env.SMTP_USER,
      to: process.env.SMTP_USER,
      subject: 'HoroHouse SMTP Test',
      text: 'If you see this, SMTP is working on Railway.',
    });

    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error('❌ SMTP error:', err.message);
    return { success: false, error: err.message };
  }
}
}
