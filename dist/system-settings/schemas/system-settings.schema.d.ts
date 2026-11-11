import { Document } from 'mongoose';
export type SystemSettingsDocument = SystemSettings & Document;
declare class SocialLinks {
    facebook: string;
    instagram: string;
    twitter: string;
    linkedin: string;
}
declare class FeatureFlags {
    enableAiChat: boolean;
    enableRecommendations: boolean;
    enableWhatsAppBot: boolean;
    enableBooking: boolean;
}
export declare class SystemSettings {
    siteName: string;
    siteDescription: string;
    supportEmail: string;
    supportPhone: string;
    socialLinks: SocialLinks;
    maintenanceMode: boolean;
    maintenanceMessage: string;
    allowRegistration: boolean;
    featureFlags: FeatureFlags;
    version: string;
}
export declare const SystemSettingsSchema: import("mongoose").Schema<SystemSettings, import("mongoose").Model<SystemSettings, any, any, any, Document<unknown, any, SystemSettings, any, {}> & SystemSettings & {
    _id: import("mongoose").Types.ObjectId;
} & {
    __v: number;
}, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, SystemSettings, Document<unknown, {}, import("mongoose").FlatRecord<SystemSettings>, {}, import("mongoose").DefaultSchemaOptions> & import("mongoose").FlatRecord<SystemSettings> & {
    _id: import("mongoose").Types.ObjectId;
} & {
    __v: number;
}>;
export {};
