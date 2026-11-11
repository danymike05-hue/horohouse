import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ChatSessionDocument = ChatSession & Document;

// Embedded schemas for nested structures
@Schema({ _id: false })
export class ChatMessage {
  @Prop({ required: true, enum: ['user', 'assistant', 'system'] })
  role: string;

  @Prop({ required: true })
  content: string;

  @Prop({ required: true, type: Date, default: Date.now })
  timestamp: Date;

  @Prop({ type: Object })
  properties?: any[];

  @Prop({ type: Object })
  filters?: Record<string, any>;

  @Prop({ type: Number })
  confidence?: number;

  @Prop({ type: String })
  method?: string;
}

export const ChatMessageSchema = SchemaFactory.createForClass(ChatMessage);

@Schema({ _id: false })
export class LeadScore {
  @Prop({ required: true, type: Number, min: 0, max: 100 })
  score: number;

  @Prop({ required: true, enum: ['hot', 'warm', 'cold'] })
  classification: string;

  @Prop({ required: true, enum: ['high', 'medium', 'low'] })
  priority: string;

  @Prop({ type: [String], default: [] })
  signals: string[];

  @Prop({ type: String })
  nextAction?: string;

  @Prop({ type: Date, default: Date.now })
  calculatedAt: Date;

  @Prop({ type: Object })
  history?: Array<{
    score: number;
    classification: string;
    timestamp: Date;
  }>;
}

export const LeadScoreSchema = SchemaFactory.createForClass(LeadScore);

@Schema({ _id: false })
export class PropertySearchFilters {
  @Prop({ type: String })
  propertyType?: string;

  @Prop({ type: String })
  listingType?: string;

  @Prop({ type: String })
  city?: string;

  @Prop({ type: String })
  neighborhood?: string;

  @Prop({ type: Number })
  minPrice?: number;

  @Prop({ type: Number })
  maxPrice?: number;

  @Prop({ type: Number })
  bedrooms?: number;

  @Prop({ type: Number })
  bathrooms?: number;

  @Prop({ type: Number })
  minArea?: number;

  @Prop({ type: Number })
  maxArea?: number;

  @Prop({ type: Boolean })
  furnished?: boolean;

  @Prop({ type: [String] })
  amenities?: string[];

  @Prop({ type: String })
  status?: string;

  @Prop({ type: Object })
  additional?: Record<string, any>;
}

export const PropertySearchFiltersSchema = SchemaFactory.createForClass(PropertySearchFilters);

@Schema({ _id: false })
export class SessionMetadata {
  @Prop({ type: String })
  userAgent?: string;

  @Prop({ type: String })
  ipAddress?: string;

  @Prop({ type: String })
  device?: string;

  @Prop({ type: String })
  platform?: string;

  @Prop({ type: String })
  language?: string;

  @Prop({ type: String })
  referrer?: string;

  @Prop({ type: Object })
  location?: {
    country?: string;
    city?: string;
    timezone?: string;
  };
}

export const SessionMetadataSchema = SchemaFactory.createForClass(SessionMetadata);

@Schema({ _id: false })
export class ConversationContext {
  @Prop({ type: String })
  primaryIntent?: string;

  @Prop({ type: [String], default: [] })
  topicsDiscussed: string[];

  @Prop({ type: [String], default: [] })
  propertiesViewed: string[];

  @Prop({ type: [String], default: [] })
  propertiesSaved: string[];

  @Prop({ type: Number, default: 0 })
  questionsAsked: number;

  @Prop({ type: Number, default: 0 })
  refinements: number;

  @Prop({ type: Boolean, default: false })
  mentionedBudget: boolean;

  @Prop({ type: Boolean, default: false })
  mentionedTimeframe: boolean;

  @Prop({ type: Boolean, default: false })
  askedForViewing: boolean;

  @Prop({ type: Boolean, default: false })
  askedForAgent: boolean;

  @Prop({ type: String })
  preferredLanguage?: string;

  @Prop({ type: Object })
  userPreferences?: Record<string, any>;
}

export const ConversationContextSchema = SchemaFactory.createForClass(ConversationContext);

// Main Chat Session Schema
@Schema({ 
  timestamps: true,
  collection: 'chat_sessions',
})
export class ChatSession {
  @Prop({ required: true, unique: true, index: true })
  sessionId: string;

  @Prop({ type: Types.ObjectId, ref: 'User', index: true })
  userId?: Types.ObjectId;

  @Prop({ type: String, default: 'guest' })
  userType: string; // 'guest', 'authenticated', 'agent', 'admin'

  @Prop({ type: [ChatMessageSchema], default: [] })
  messages: ChatMessage[];

  @Prop({ type: PropertySearchFiltersSchema })
  currentFilters?: PropertySearchFilters;

  @Prop({ type: LeadScoreSchema })
  leadScore?: LeadScore;

  @Prop({ type: ConversationContextSchema, default: {} })
  context: ConversationContext;

  @Prop({ type: SessionMetadataSchema })
  metadata?: SessionMetadata;

  @Prop({ type: String, enum: ['active', 'idle', 'closed', 'converted'], default: 'active', index: true })
  status: string;

  @Prop({ type: Date, index: true })
  lastActiveAt: Date;

  @Prop({ type: Date })
  convertedAt?: Date;

  @Prop({ type: String })
  conversionType?: string; // 'viewing_scheduled', 'property_saved', 'contact_made'

  @Prop({ type: Number, default: 1 })
  messageCount: number;

  @Prop({ type: Number, default: 0 })
  propertiesShown: number;

  @Prop({ type: Boolean, default: false })
  isTestSession: boolean;

  @Prop({ type: Object })
  analytics?: {
    avgResponseTime?: number;
    totalDuration?: number;
    bounceRate?: number;
    engagementScore?: number;
  };

  @Prop({ type: [String], default: [] })
  tags: string[];

  @Prop({ type: String })
  notes?: string;

  @Prop({ type: Date, index: { expires: '30d' } }) // Auto-delete after 30 days
  expiresAt?: Date;
}

export const ChatSessionSchema = SchemaFactory.createForClass(ChatSession);

// Indexes for better performance
ChatSessionSchema.index({ userId: 1, createdAt: -1 });
ChatSessionSchema.index({ 'leadScore.classification': 1, status: 1 });
ChatSessionSchema.index({ status: 1, lastActiveAt: -1 });
ChatSessionSchema.index({ sessionId: 1, userId: 1 });
ChatSessionSchema.index({ createdAt: -1 });

// Virtual for session duration
ChatSessionSchema.virtual('duration').get(function() {
  if (this.messages.length < 2) return 0;
  const first = this.messages[0].timestamp;
  const last = this.messages[this.messages.length - 1].timestamp;
  return last.getTime() - first.getTime();
});

// Method to add message
ChatSessionSchema.methods.addMessage = function(message: ChatMessage) {
  this.messages.push(message);
  this.messageCount = this.messages.length;
  this.lastActiveAt = new Date();
  
  // Keep only last 50 messages to prevent document from growing too large
  if (this.messages.length > 50) {
    this.messages = this.messages.slice(-50);
  }
};

// Method to update lead score
ChatSessionSchema.methods.updateLeadScore = function(leadScore: LeadScore) {
  // Save history
  if (!this.leadScore) {
    this.leadScore = leadScore;
    this.leadScore.history = [];
  } else {
    if (!this.leadScore.history) {
      this.leadScore.history = [];
    }
    this.leadScore.history.push({
      score: this.leadScore.score,
      classification: this.leadScore.classification,
      timestamp: this.leadScore.calculatedAt,
    });
  }
  
  // Update current score
  Object.assign(this.leadScore, leadScore);
  this.leadScore.calculatedAt = new Date();
};

// Method to mark as converted
ChatSessionSchema.methods.markAsConverted = function(conversionType: string) {
  this.status = 'converted';
  this.convertedAt = new Date();
  this.conversionType = conversionType;
};

// Static method to find hot leads
ChatSessionSchema.statics.findHotLeads = function(limit = 20) {
  return this.find({
    'leadScore.classification': 'hot',
    status: { $in: ['active', 'idle'] },
  })
    .sort({ 'leadScore.score': -1, lastActiveAt: -1 })
    .limit(limit)
    .populate('userId', 'name email phoneNumber profilePicture')
    .exec();
};

// Static method to find active sessions
ChatSessionSchema.statics.findActiveSessions = function(hours = 24) {
  const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);
  return this.find({
    status: 'active',
    lastActiveAt: { $gte: cutoffTime },
  })
    .sort({ lastActiveAt: -1 })
    .exec();
};

// Static method to get session stats
ChatSessionSchema.statics.getStats = async function() {
  const stats = await this.aggregate([
    {
      $facet: {
        total: [{ $count: 'count' }],
        byStatus: [
          { $group: { _id: '$status', count: { $sum: 1 } } }
        ],
        byLeadClass: [
          { $group: { _id: '$leadScore.classification', count: { $sum: 1 } } }
        ],
        avgMessages: [
          { $group: { _id: null, avg: { $avg: '$messageCount' } } }
        ],
        recentActivity: [
          { $match: { lastActiveAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } } },
          { $count: 'count' }
        ]
      }
    }
  ]);
  
  return stats[0];
};