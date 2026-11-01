import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { Strategy, ExtractJwt } from 'passport-jwt';

import { AuthService, JwtPayload } from '../auth.service';
import { UserDocument } from '../../users/schemas/user.schema';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private authService: AuthService,
    private configService: ConfigService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: any) => {
          if (req && req.cookies && req.cookies.access_token) {
            return req.cookies.access_token;
          }
          return null;
        },
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload): Promise<any> {
    try {
      console.log('[JwtStrategy] Validating JWT payload:', {
        sub: payload.sub,
        sessionId: payload.sessionId,
        role: payload.role,
      });

      const user: UserDocument = await this.authService.validateUser(payload);

      console.log('[JwtStrategy] User validated:', {
        userId: user._id.toString(),
        role: user.role,
        email: user.email,
      });

      // Return a normalized user object with consistent ID fields
      // This ensures req.user.userId is always available in controllers
      const normalizedUser = {
        userId: user._id.toString(),        // Primary ID field for controllers
        _id: user._id,                      // Keep original MongoDB ObjectId
        id: user._id.toString(),            // Alternative ID field
        sub: payload.sub,                   // JWT subject
        sessionId: payload.sessionId,       // Session ID from JWT
        email: user.email,
        phoneNumber: user.phoneNumber,
        name: user.name,
        role: user.role,
        emailVerified: user.emailVerified,
        phoneVerified: user.phoneVerified,
        profilePicture: user.profilePicture,
        isActive: user.isActive,
        preferences: user.preferences,
        agentPreferences: user.agentPreferences,
        onboardingCompleted: user.onboardingCompleted,
        onboardingStatus: user.onboardingStatus,
        licenseNumber: user.licenseNumber,
        agency: user.agency,
        googleId: user.googleId,            // Social connection status
        hasPassword: !!(user as any).password, // Indicates whether a password is set (password is select:false)
      };

      console.log('[JwtStrategy] Returning normalized user with userId:', normalizedUser.userId);

      return normalizedUser;
    } catch (error) {
      console.error('[JwtStrategy] Validation error:', error);
      throw new UnauthorizedException('Invalid token');
    }
  }
}