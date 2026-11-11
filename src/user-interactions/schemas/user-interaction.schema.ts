import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type UserInteractionDocument = UserInteraction & Document;

export enum InteractionType {
  PROPERTY_VIEW = 'property_view',
  PROPERTY_FAVORITE = 'property_favorite',
  PROPERTY_UNFAVORITE = 'property_unfavorite',
  PROPERTY_SHARE = 'property_share',
  PROPERTY_INQUIRY = 'property_inquiry',
  SEARCH = 'search',
  FILTER_APPLY = 'filter_apply',
  PROPERTY_COMPARE = 'property_compare',
  MAP_VIEW = 'map_view',
  LIST_VIEW = 'list_view',
  SIMILAR_PROPERTIES_CLICK = 'similar_properties_click',
  RECOMMENDATION_CLICK = 'recommendation_click',
  RECOMMENDATION_DISMISS = 'recommendation_dismiss',
  CONTACT_AGENT = 'contact_agent',
  SCHEDULE_VIEWING = 'schedule_viewing',
}

export enum InteractionSource {
  SEARCH_RESULTS = 'search_results',
  RECOMMENDATIONS = 'recommendations',
  SIMILAR_PROPERTIES = 'similar_properties',
  FAVORITES = 'favorites',
  DIRECT_LINK = 'direct_link',
  MAP = 'map',
  DASHBOARD = 'dashboard',
  NOTIFICATION = 'notification',
}

export interface InteractionMetadata {
  sessionId?: string;
  userAgent?: string;
  ipAddress?: string;
  referrer?: string;
  deviceType?: string;
  browser?: string;
  os?: string;
  screenResolution?: string;
  timeOnPage?: number; // in seconds
  scrollDepth?: number; // percentage
  searchFilters?: Record<string, any>;
  searchQuery?: string;
  resultsCount?: number;
  propertyPosition?: number; // position in search results
  recommendationScore?: number;
  recommendationReason?: string;
  context?: Record<string, any>;
  radius?: number; // for nearby searches
  rating?: number; // for user feedback on recommendations
}

@Schema({ timestamps: true })
export class UserInteraction {
  @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
  userId: Types.ObjectId;

  @Prop({ required: true, type: String, enum: InteractionType })
  interactionType: InteractionType;

  @Prop({ type: Types.ObjectId, ref: 'Property' })
  propertyId?: Types.ObjectId;

  @Prop({ type: String, enum: InteractionSource })
  source?: InteractionSource;

  @Prop({ type: Object, default: {} })
  metadata: InteractionMetadata;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  agentId?: Types.ObjectId; // If interaction involves an agent

  @Prop({ type: Object })
  location?: {
    type: 'Point';
    coordinates: [number, number]; // [longitude, latitude]
  };

  @Prop({ type: String })
  city?: string;

  @Prop({ type: String })
  neighborhood?: string;

  @Prop({ type: String })
  propertyType?: string;

  @Prop({ type: Number })
  price?: number;

  @Prop({ type: String })
  listingType?: string;

  @Prop({ type: Number })
  bedrooms?: number;

  @Prop({ type: Number })
  bathrooms?: number;

  // Analytics fields
  @Prop({ type: Number, default: 1 })
  weight: number; // Weight for recommendation algorithm

  @Prop({ type: Date })
  expiresAt?: Date; // For TTL if needed

  @Prop({ type: Boolean, default: false })
  isProcessed: boolean; // Mark if processed by recommendation engine

  @Prop({ type: Date })
  processedAt?: Date;

  @Prop({ type: String })
  batchId?: string; // For batch processing

  // Timestamps are automatically added
  createdAt!: Date;
  updatedAt!: Date;
}

export const UserInteractionSchema = SchemaFactory.createForClass(UserInteraction);

// Indexes for efficient querying
UserInteractionSchema.index({ userId: 1, createdAt: -1 });
UserInteractionSchema.index({ userId: 1, interactionType: 1, createdAt: -1 });
UserInteractionSchema.index({ propertyId: 1, interactionType: 1, createdAt: -1 });
UserInteractionSchema.index({ interactionType: 1, createdAt: -1 });
UserInteractionSchema.index({ source: 1, createdAt: -1 });
UserInteractionSchema.index({ city: 1, interactionType: 1, createdAt: -1 });
UserInteractionSchema.index({ propertyType: 1, interactionType: 1, createdAt: -1 });
UserInteractionSchema.index({ price: 1, interactionType: 1, createdAt: -1 });
UserInteractionSchema.index({ isProcessed: 1, createdAt: -1 });
UserInteractionSchema.index({ batchId: 1 });

// TTL index - automatically delete interactions older than 2 years
UserInteractionSchema.index({ createdAt: 1 }, { expireAfterSeconds: 2 * 365 * 24 * 60 * 60 });

// Compound indexes for recommendation queries
UserInteractionSchema.index({ 
  userId: 1, 
  propertyType: 1, 
  interactionType: 1, 
  createdAt: -1 
});

UserInteractionSchema.index({ 
  userId: 1, 
  city: 1, 
  price: 1, 
  interactionType: 1, 
  createdAt: -1 
});

// Geospatial index for location-based recommendations
UserInteractionSchema.index({ location: '2dsphere' });
