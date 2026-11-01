import { SystemSettingsService } from './system-settings.service';
import { SystemSettings } from './schemas/system-settings.schema';
export declare class SystemSettingsController {
    private readonly settingsService;
    constructor(settingsService: SystemSettingsService);
    getSettings(): Promise<SystemSettings>;
    updateSettings(updateDto: Partial<SystemSettings>): Promise<SystemSettings>;
}
