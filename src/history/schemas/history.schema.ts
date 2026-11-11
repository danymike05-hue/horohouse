import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type HistoryDocument = History & Document;

export enum ActivityType {
  PROPERTY_VIEW = 'property_view',
  SEARCH = 'search',
  FAVORITE_ADD = 'favorite_add',
  FAVORITE_REMOVE = 'favorite_remove',
  PROPERTY_INQUIRY = 'property_inquiry',
  PROFILE_UPDATE = 'profile_update',
  LOGIN = 'login',
  LOGOUT = 'logout',
  PROPERTY_SHARE = 'property_share',
  AGENT_CONTACT = 'agent_contact',
  PROPERTY_FAVORITE = 'property_favorite',
  PROPERTY_SEARCH = 'property_search',
}

export interface SearchFilters {
  minPrice?: number;
  maxPrice?: number;
  propertyType?: string;
  listingType?: string;
  city?: string;
  bedrooms?: number;
  bathrooms?: number;
  amenities?: string[];
  radius?: number;
  latitude?: number;
  longitude?: number;
}

export interface DeviceInfo {
  userAgent?: string;
  platform?: string;
  browser?: string;
  isMobile?: boolean;
  screenResolution?: string;
}

@Schema({ timestamps: true })
export class History {
  @Prop({ type: Types.ObjectId, ref: 'User' })
  userId?: Types.ObjectId;

  @Prop({ type: String, enum: ActivityType, required: true })
  activityType: ActivityType;

  @Prop({ type: Types.ObjectId, ref: 'Property' })
  propertyId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  agentId?: Types.ObjectId;

  // Search-specific fields
  @Prop()
  searchQuery?: string;

  @Prop({ type: Object })
  searchFilters?: SearchFilters;

  @Prop()
  resultsCount?: number;

  @Prop()
  resultsClicked?: number;

  // Location where the activity occurred (user's location, not property location)
  @Prop({
    type: {
      type: String,
      enum: ['Point'],
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
    },
  })
  userLocation?: {
    type: 'Point';
    coordinates: [number, number];
  };

  // Search location (where they searched for properties)
  @Prop({
    type: {
      type: String,
      enum: ['Point'],
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
    },
  })
  searchLocation?: {
    type: 'Point';
    coordinates: [number, number];
  };

  @Prop()
  city?: string;

  @Prop()
  country?: string;

  // Session and device information
  @Prop()
  sessionId?: string;

  @Prop()
  ipAddress?: string;

  @Prop({ type: Object })
  deviceInfo?: DeviceInfo;

  // Referrer information
  @Prop()
  referrer?: string;

  @Prop()
  source?: string;

  @Prop()
  utmSource?: string;

  @Prop()
  utmMedium?: string;

  @Prop()
  utmCampaign?: string;

  // Activity-specific fields
  @Prop()
  viewDuration?: number; // in milliseconds

  @Prop({ type: [String] })
  viewedImages?: string[];

  @Prop()
  scrollDepth?: number; // percentage

  @Prop()
  contactedAgent?: boolean;

  // Additional metadata
  @Prop({ type: Object, default: {} })
  metadata: Record<string, any>;

  @Prop({ type: [String] })
  tags?: string[];

  // For property inquiries
  @Prop()
  inquiryMessage?: string;

  @Prop()
  inquiryPhone?: string;

  @Prop()
  inquiryEmail?: string;

  // For anonymous users (before they register)
  @Prop()
  anonymousId?: string;

  // Timestamp is automatically added by timestamps: true
  createdAt: Date;
  updatedAt: Date;
}

export const HistorySchema = SchemaFactory.createForClass(History);

// Indexes for analytics queries
HistorySchema.index({ userId: 1, activityType: 1, createdAt: -1 });
HistorySchema.index({ propertyId: 1, activityType: 1, createdAt: -1 });
HistorySchema.index({ city: 1, activityType: 1, createdAt: -1 });
HistorySchema.index({ createdAt: -1 }); // For recent activities
HistorySchema.index({ sessionId: 1 });
HistorySchema.index({ anonymousId: 1 });
HistorySchema.index({ agentId: 1, activityType: 1, createdAt: -1 });

// Geospatial index for user location analytics
HistorySchema.index({ userLocation: '2dsphere' });
HistorySchema.index({ searchLocation: '2dsphere' });

// Compound indexes for complex analytics queries
HistorySchema.index({ 
  activityType: 1, 
  createdAt: -1, 
  city: 1 
});