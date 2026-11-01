import { OnModuleInit } from '@nestjs/common';
import { Model } from 'mongoose';
import { UserDocument } from '../users/schemas/user.schema';
import { DevicesService } from '../devices/devices.service';
export declare class PushNotificationsService implements OnModuleInit {
    private userModel;
    private devicesService;
    private readonly logger;
    private expo;
    private ExpoClass;
    constructor(userModel: Model<UserDocument>, devicesService: DevicesService);
    onModuleInit(): Promise<void>;
    sendToUser(userId: string, payload: {
        title: string;
        body: string;
        data?: Record<string, any>;
    }): Promise<void>;
    private checkReceipts;
}
