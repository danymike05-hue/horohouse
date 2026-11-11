import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type SavedSearchDocument = SavedSearch & Document & {
  createdAt: Date;
  updatedAt: Date;
};

export enum SearchFrequency {
  INSTANT = 'instant',
  DAILY = 'daily',
  WEEKLY = 'weekly',
  NEVER = 'never',
}

@Schema({ timestamps: true })
export class SavedSearch {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  name: string;

  // Search criteria
  @Prop({ type: Object, required: true })
  searchCriteria: {
    minPrice?: number;
    maxPrice?: number;
    propertyType?: string;
    listingType?: string;
    city?: string;
    state?: string;
    bedrooms?: number;
    bathrooms?: number;
    amenities?: string[];
    latitude?: number;
    longitude?: number;
    radius?: number;
  };

  // Email notification settings
  @Prop({ 
    type: String, 
    enum: Object.values(SearchFrequency), 
    default: SearchFrequency.DAILY 
  })
  notificationFrequency: SearchFrequency;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ default: 0 })
  resultsCount: number;

  @Prop({ type: Date })
  lastNotificationSent?: Date;

  @Prop({ type: Date })
  lastChecked?: Date;

  @Prop({ type: [Types.ObjectId], ref: 'Property', default: [] })
  newMatchingProperties: Types.ObjectId[];
}

export const SavedSearchSchema = SchemaFactory.createForClass(SavedSearch);

// Indexes for efficient queries
SavedSearchSchema.index({ userId: 1, createdAt: -1 });
SavedSearchSchema.index({ userId: 1, isActive: 1 });
SavedSearchSchema.index({ notificationFrequency: 1, isActive: 1, lastNotificationSent: 1 });