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

  // Runs on every authenticated request: no logging of emails or ids here
  // (it used to log three lines with personal data per request).
  async validate(payload: JwtPayload): Promise<any> {
    try {
      // Also checks the session is still active, so signing out a device or
      // resetting the password takes effect immediately
      const user: UserDocument = await this.authService.validateUser(payload);

      // Return a normalized user object with consistent ID fields
      // This ensures req.user.userId is always available in controllers
      return {
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
        hasPassword: !!(user as any).password, // password is select:false; validateUser asks for it
      };
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
  }
}
