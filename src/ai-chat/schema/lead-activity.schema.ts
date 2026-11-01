import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type LeadActivityDocument = LeadActivity & Document;

/**
 * Schema for tracking detailed lead activities and engagement
 */
@Schema({ 
  timestamps: true,
  collection: 'lead_activities',
})
export class LeadActivity {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ type: String, ref: 'ChatSession', required: true, index: true })
  sessionId: string;

  @Prop({ 
    required: true, 
    enum: [
      'message_sent',
      'property_viewed',
      'property_saved',
      'filter_applied',
      'viewing_requested',
      'agent_contacted',
      'budget_mentioned',
      'timeframe_mentioned',
      'refinement_made',
      'search_performed',
      'session_started',
      'session_ended',
      'conversion',
    ],
    index: true 
  })
  activityType: string;

  @Prop({ type: String })
  description?: string;

  @Prop({ type: Object })
  metadata?: {
    propertyId?: string;
    propertyType?: string;
    city?: string;
    price?: number;
    filters?: Record<string, any>;
    message?: string;
    duration?: number;
    confidence?: number;
    [key: string]: any;
  };

  @Prop({ type: Number, min: 0, max: 100 })
  impactScore?: number; // How much this activity impacts lead score

  @Prop({ type: Date, default: Date.now, index: true })
  timestamp: Date;

  @Prop({ type: String })
  source?: string; // 'chat', 'search', 'browse', 'email', etc.
}

export const LeadActivitySchema = SchemaFactory.createForClass(LeadActivity);

// Compound indexes
LeadActivitySchema.index({ userId: 1, timestamp: -1 });
LeadActivitySchema.index({ sessionId: 1, timestamp: -1 });
LeadActivitySchema.index({ activityType: 1, timestamp: -1 });

// chat-analytics.schema.ts
export type ChatAnalyticsDocument = ChatAnalytics & Document;

/**
 * Schema for aggregated chat analytics and insights
 */
@Schema({ 
  timestamps: true,
  collection: 'chat_analytics',
})
export class ChatAnalytics {
  @Prop({ required: true, type: Date, index: true })
  date: Date;

  @Prop({ type: String, enum: ['hourly', 'daily', 'weekly', 'monthly'], default: 'daily' })
  period: string;

  @Prop({ type: Number, default: 0 })
  totalSessions: number;

  @Prop({ type: Number, default: 0 })
  totalMessages: number;

  @Prop({ type: Number, default: 0 })
  uniqueUsers: number;

  @Prop({ type: Number, default: 0 })
  guestSessions: number;

  @Prop({ type: Number, default: 0 })
  authenticatedSessions: number;

  @Prop({ type: Object, default: {} })
  leadDistribution: {
    hot?: number;
    warm?: number;
    cold?: number;
  };

  @Prop({ type: Number, default: 0 })
  conversions: number;

  @Prop({ type: Object })
  conversionTypes?: Record<string, number>;

  @Prop({ type: Number })
  avgMessagesPerSession?: number;

  @Prop({ type: Number })
  avgSessionDuration?: number; // in seconds

  @Prop({ type: Number })
  avgResponseTime?: number; // in milliseconds

  @Prop({ type: Object })
  topCities?: Record<string, number>;

  @Prop({ type: Object })
  topPropertyTypes?: Record<string, number>;

  @Prop({ type: Object })
  priceRanges?: Record<string, number>;

  @Prop({ type: [String], default: [] })
  topKeywords: string[];

  @Prop({ type: Number, default: 0 })
  propertiesShown: number;

  @Prop({ type: Number, default: 0 })
  propertiesViewed: number;

  @Prop({ type: Number, default: 0 })
  propertiesSaved: number;

  @Prop({ type: Number })
  engagementRate?: number; // percentage

  @Prop({ type: Number })
  bounceRate?: number; // percentage

  @Prop({ type: Object })
  languageDistribution?: Record<string, number>;

  @Prop({ type: Object })
  deviceDistribution?: Record<string, number>;

  @Prop({ type: Object })
  customMetrics?: Record<string, any>;
}

export const ChatAnalyticsSchema = SchemaFactory.createForClass(ChatAnalytics);

ChatAnalyticsSchema.index({ date: -1, period: 1 });

// conversation-summary.schema.ts
export type ConversationSummaryDocument = ConversationSummary & Document;

/**
 * Schema for storing AI-generated conversation summaries
 */
@Schema({ 
  timestamps: true,
  collection: 'conversation_summaries',
})
export class ConversationSummary {
  @Prop({ type: String, ref: 'ChatSession', required: true, unique: true, index: true })
  sessionId: string;

  @Prop({ type: Types.ObjectId, ref: 'User', index: true })
  userId?: Types.ObjectId;

  @Prop({ type: String, required: true })
  summary: string;

  @Prop({ type: [String], default: [] })
  keyPoints: string[];

  @Prop({ type: Object })
  userIntent?: {
    primary?: string;
    secondary?: string[];
    confidence?: number;
  };

  @Prop({ type: Object })
  requirements?: {
    propertyType?: string;
    location?: string;
    budget?: { min?: number; max?: number };
    bedrooms?: number;
    bathrooms?: number;
    mustHaves?: string[];
    niceToHaves?: string[];
  };

  @Prop({ type: String, enum: ['buyer', 'renter', 'seller', 'landlord', 'browser', 'unknown'], default: 'unknown' })
  userCategory: string;

  @Prop({ type: Number, min: 0, max: 100 })
  intentClarityScore?: number;

  @Prop({ type: String })
  recommendedAction?: string;

  @Prop({ type: [String], default: [] })
  tags: string[];

  @Prop({ type: String, enum: ['auto', 'manual', 'hybrid'], default: 'auto' })
  generationType: string;

  @Prop({ type: Date })
  lastUpdated: Date;

  @Prop({ type: Object })
  sentiment?: {
    overall?: string; // 'positive', 'neutral', 'negative'
    confidence?: number;
    keywords?: string[];
  };
}

export const ConversationSummarySchema = SchemaFactory.createForClass(ConversationSummary);

ConversationSummarySchema.index({ userId: 1, createdAt: -1 });
ConversationSummarySchema.index({ userCategory: 1 });

// saved-search.schema.ts
export type SavedSearchDocument = SavedSearch & Document;

/**
 * Schema for saving user search preferences from chat
 */
@Schema({ 
  timestamps: true,
  collection: 'saved_searches',
})
export class SavedSearch {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ type: String, ref: 'ChatSession', index: true })
  sessionId?: string;

  @Prop({ required: true })
  name: string;

  @Prop({ type: Object, required: true })
  filters: {
    propertyType?: string;
    listingType?: string;
    city?: string;
    neighborhood?: string;
    minPrice?: number;
    maxPrice?: number;
    bedrooms?: number;
    bathrooms?: number;
    minArea?: number;
    maxArea?: number;
    furnished?: boolean;
    amenities?: string[];
    [key: string]: any;
  };

  @Prop({ type: Boolean, default: true })
  isActive: boolean;

  @Prop({ type: Boolean, default: false })
  notificationsEnabled: boolean;

  @Prop({ type: String, enum: ['instant', 'daily', 'weekly'], default: 'daily' })
  notificationFrequency: string;

  @Prop({ type: Date })
  lastNotifiedAt?: Date;

  @Prop({ type: Number, default: 0 })
  matchCount: number;

  @Prop({ type: Date })
  lastMatchAt?: Date;

  @Prop({ type: String, enum: ['chat', 'manual', 'api'], default: 'chat' })
  source: string;

  @Prop({ type: Object })
  metadata?: {
    originalQuery?: string;
    confidence?: number;
    [key: string]: any;
  };
}

export const SavedSearchSchema = SchemaFactory.createForClass(SavedSearch);

SavedSearchSchema.index({ userId: 1, isActive: 1 });
SavedSearchSchema.index({ userId: 1, createdAt: -1 });

// Export all schemas
export const schemas = [
  { name: LeadActivity.name, schema: LeadActivitySchema },
  { name: ChatAnalytics.name, schema: ChatAnalyticsSchema },
  { name: ConversationSummary.name, schema: ConversationSummarySchema },
  { name: SavedSearch.name, schema: SavedSearchSchema },
];