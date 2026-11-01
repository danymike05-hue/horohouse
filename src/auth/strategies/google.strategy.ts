import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';

import { AuthService } from '../auth.service';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(
    private authService: AuthService,
    private configService: ConfigService,
  ) {
    // Read values from ConfigService; if missing, use safe placeholders to avoid
    // OAuth2Strategy constructor throwing at startup. We'll gate usage below.
    const clientID = configService.get<string>('GOOGLE_CLIENT_ID') || 'DISABLED_GOOGLE_OAUTH';
    const clientSecret = configService.get<string>('GOOGLE_CLIENT_SECRET') || 'DISABLED_GOOGLE_OAUTH';
    const callbackURL = configService.get<string>('GOOGLE_CALLBACK_URL') || 'http://localhost/disabled-google-callback';

    super({
      clientID,
      clientSecret,
      callbackURL,
      scope: ['email', 'profile'],
    });

    if (
      clientID === 'DISABLED_GOOGLE_OAUTH' ||
      clientSecret === 'DISABLED_GOOGLE_OAUTH' ||
      callbackURL === 'http://localhost/disabled-google-callback'
    ) {
      Logger.warn(
        'Google OAuth is not configured. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_CALLBACK_URL to enable it.',
        GoogleStrategy.name,
      );
    }
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: VerifyCallback,
  ): Promise<any> {
    try {
      // If OAuth is not configured, prevent usage and return a clear error
      const isDisabled =
        !this.configService.get<string>('GOOGLE_CLIENT_ID') ||
        !this.configService.get<string>('GOOGLE_CLIENT_SECRET') ||
        !this.configService.get<string>('GOOGLE_CALLBACK_URL');
      if (isDisabled) {
        return done(
          new ServiceUnavailableException(
            'Google OAuth is not configured on this server.',
          ),
        );
      }

      const googleUser = {
        id: profile.id,
        email: profile.emails[0].value,
        displayName: profile.displayName,
        firstName: profile.name.givenName,
        lastName: profile.name.familyName,
        picture: profile.photos[0].value,
        accessToken,
        refreshToken,
      };

      // Just pass the Google user data to the controller
      // The controller will handle the authentication
      done(null, googleUser);
    } catch (error) {
      done(error, false);
    }
  }
}