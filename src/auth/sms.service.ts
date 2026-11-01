import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);

  constructor(private configService: ConfigService) {}

  /**
   * Generate a 6-digit verification code
   */
  generateVerificationCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Send SMS verification code
   * For now, we'll use a mock implementation
   * In production, integrate with Twilio, AWS SNS, or similar service
   */
  async sendVerificationCode(phoneNumber: string, code: string): Promise<boolean> {
    try {
      this.logger.log(`Sending SMS to ${phoneNumber}: Your verification code is ${code}`);
      
      // TODO: Integrate with actual SMS service
      // Example with Twilio:
      // const client = twilio(accountSid, authToken);
      // await client.messages.create({
      //   body: `Your HoroHouse verification code is: ${code}`,
      //   from: '+1234567890',
      //   to: phoneNumber
      // });

      // For development, we'll just log the code
      console.log(`📱 SMS to ${phoneNumber}: Your HoroHouse verification code is: ${code}`);
      
      return true;
    } catch (error) {
      this.logger.error(`Failed to send SMS to ${phoneNumber}:`, error);
      return false;
    }
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