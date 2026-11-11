import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';

import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { SmsService } from './sms.service';

// Strategies
import { JwtStrategy } from './strategies/jwt.strategy';
import { GoogleStrategy } from './strategies/google.strategy';

// Guards
import { RolesGuard } from './guards/roles.guard';
import { JwtAuthGuard } from './guards/jwt.auth.guard';
import { OnboardingGuard } from './guards/onboarding.guard';

// Schemas
import { User, UserSchema } from '../users/schemas/user.schema';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        // Convert string time (e.g., '15m') to seconds
        const expiresIn = configService.get<string>('JWT_EXPIRATION', '15m');
        let expiresInSeconds: number;
        
        if (expiresIn.endsWith('d')) {
          expiresInSeconds = parseInt(expiresIn) * 24 * 60 * 60; // days to seconds
        } else if (expiresIn.endsWith('h')) {
          expiresInSeconds = parseInt(expiresIn) * 60 * 60; // hours to seconds
        } else if (expiresIn.endsWith('m')) {
          expiresInSeconds = parseInt(expiresIn) * 60; // minutes to seconds
        } else if (expiresIn.endsWith('s')) {
          expiresInSeconds = parseInt(expiresIn); // already in seconds
        } else {
          // If no unit is specified, assume seconds
          expiresInSeconds = parseInt(expiresIn) || 900; // default to 15 minutes (900 seconds)
        }
        
        return {
          secret: configService.get<string>('JWT_SECRET'),
          signOptions: {
            expiresIn: expiresInSeconds,
          },
        };
      },
      inject: [ConfigService],
    }),
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
    EmailModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    SmsService,
    JwtStrategy,
    GoogleStrategy,
    RolesGuard,
    JwtAuthGuard,
    OnboardingGuard,
  ],
  exports: [AuthService, SmsService, JwtAuthGuard, RolesGuard, OnboardingGuard],
})
export class AuthModule {}