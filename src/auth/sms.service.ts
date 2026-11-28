import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

/**
 * Text messages (phone verification codes).
 *
 * No SMS provider is connected yet. Before, the code was written to the server logs instead
 * of being sent ("SMS to +2376…: your code is 123456"): anyone who could read the logs could
 * ask for a code and sign in with someone's number, and real users never got theirs.
 * Now nothing is sent or logged, and everything that needs a code says it isn't available
 * (isAvailable) until a provider is connected here.
 */
@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);

  constructor(private configService: ConfigService) {}

  /** True once a real SMS provider sends the codes (none is connected yet) */
  isAvailable(): boolean {
    return false;
  }

  /** A 6-digit code, from a cryptographic random source */
  generateVerificationCode(): string {
    return String(crypto.randomInt(100000, 1000000));
  }

  /**
   * Sends the code by text message. Returns false while no provider is connected.
   * Never log the code itself.
   */
  async sendVerificationCode(phoneNumber: string, _code: string): Promise<boolean> {
    if (!this.isAvailable()) {
      this.logger.warn(`No SMS provider connected: code for ${String(phoneNumber).slice(0, 5)}… not sent`);
      return false;
    }
    // Connect the provider here (Twilio, Africa's Talking, MTN/Orange SMS API…), then make
    // isAvailable() return true.
    return false;
  }

  /**
   * Validate phone number format
   */
  isValidPhoneNumber(phoneNumber: string): boolean {
    // Basic international phone number validation
    const phoneRegex = /^\+[1-9]\d{1,14}$/;
    return phoneRegex.test(phoneNumber);
  }

  /**
   * Format phone number for consistency
   */
  formatPhoneNumber(phoneNumber: string): string {
    // Remove all non-digit characters except +
    return phoneNumber.replace(/[^\d+]/g, '');
  }
}
