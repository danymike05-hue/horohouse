import { ConfigService } from '@nestjs/config';
export declare class SmsService {
    private configService;
    private readonly logger;
    constructor(configService: ConfigService);
    generateVerificationCode(): string;
    sendVerificationCode(phoneNumber: string, code: string): Promise<boolean>;
    isValidPhoneNumber(phoneNumber: string): boolean;
    formatPhoneNumber(phoneNumber: string): string;
}
