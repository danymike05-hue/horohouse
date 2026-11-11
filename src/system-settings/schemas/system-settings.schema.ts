import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type SystemSettingsDocument = SystemSettings & Document;

@Schema({ _id: false })
class SocialLinks {
    @Prop({ default: '' })
    facebook: string;

    @Prop({ default: '' })
    instagram: string;

    @Prop({ default: '' })
    twitter: string;

    @Prop({ default: '' })
    linkedin: string;
}

@Schema({ _id: false })
class FeatureFlags {
    @Prop({ default: true })
    enableAiChat: boolean;

    @Prop({ default: true })
    enableRecommendations: boolean;

    @Prop({ default: true })
    enableWhatsAppBot: boolean;

    @Prop({ default: false })
    enableBooking: boolean;
}

@Schema({ timestamps: true })
export class SystemSettings {
    @Prop({ default: 'HoroHouse' })
    siteName: string;

    @Prop({ default: 'Real Estate Platform for Cameroon' })
    siteDescription: string;

    @Prop({ default: 'support@horohouse.com' })
    supportEmail: string;

    @Prop({ default: '+237 000 000 000' })
    supportPhone: string;

    @Prop({ type: SocialLinks, default: () => ({}) })
    socialLinks: SocialLinks;

    @Prop({ default: false })
    maintenanceMode: boolean;

    @Prop({ default: 'We are currently performing maintenance. Please check back later.' })
    maintenanceMessage: string;

    @Prop({ default: true })
    allowRegistration: boolean;

    @Prop({ type: FeatureFlags, default: () => ({}) })
    featureFlags: FeatureFlags;

    @Prop({ default: 'v1.0.0' })
    version: string;
}

export const SystemSettingsSchema = SchemaFactory.createForClass(SystemSettings);
