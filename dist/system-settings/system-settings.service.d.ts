import { OnModuleInit } from '@nestjs/common';
import { Model } from 'mongoose';
import { SystemSettings, SystemSettingsDocument } from './schemas/system-settings.schema';
export declare class SystemSettingsService implements OnModuleInit {
    private settingsModel;
    private readonly logger;
    constructor(settingsModel: Model<SystemSettingsDocument>);
    onModuleInit(): Promise<void>;
    getSettings(): Promise<SystemSettings>;
    updateSettings(updateDto: Partial<SystemSettings>): Promise<SystemSettings>;
}
