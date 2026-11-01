import { Model } from 'mongoose';
import { UserDocument } from '../users/schemas/user.schema';
export declare class DevicesService {
    private userModel;
    private readonly logger;
    constructor(userModel: Model<UserDocument>);
    registerToken(userId: string, token: string, platform: 'ios' | 'android', deviceId?: string): Promise<{
        success: boolean;
    }>;
    removeInvalidTokens(tokens: string[]): Promise<void>;
}
