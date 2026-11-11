import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SystemSettings, SystemSettingsDocument } from './schemas/system-settings.schema';

@Injectable()
export class SystemSettingsService implements OnModuleInit {
    private readonly logger = new Logger(SystemSettingsService.name);

    constructor(
        @InjectModel(SystemSettings.name) private settingsModel: Model<SystemSettingsDocument>,
    ) { }

    async onModuleInit() {
        // Ensure settings exist on startup
        const count = await this.settingsModel.countDocuments();
        if (count === 0) {
            this.logger.log('🌱 Initializing default system settings...');
            const defaultSettings = new this.settingsModel({});
            await defaultSettings.save();
        }
    }

    async getSettings(): Promise<SystemSettings> {
        const settings = await this.settingsModel.findOne().exec();
        return settings || new this.settingsModel({});
    }

    async updateSettings(updateDto: Partial<SystemSettings>): Promise<SystemSettings> {
        const settings = await this.settingsModel.findOneAndUpdate(
            {},
            { $set: updateDto },
            { new: true, upsert: true }
        ).exec();

        this.logger.log('⚙️ System settings updated');
        return settings;
    }
}
