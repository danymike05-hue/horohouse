import { Model, Types } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { PropertyDocument } from '../properties/schemas/property.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { PropertiesService, PropertySearchFilters } from '../properties/properties.service';
import { UserInteractionsService } from '../user-interactions/user-interactions.service';
export interface ChatMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: Date;
    properties?: any[];
    filters?: PropertySearchFilters;
}
export interface ChatSession {
    sessionId: string;
    userId: Types.ObjectId;
    messages: ChatMessage[];
    currentFilters?: PropertySearchFilters;
    leadScore?: LeadScore;
    createdAt: Date;
    updatedAt: Date;
}
export interface LeadScore {
    score: number;
    classification: 'hot' | 'warm' | 'cold';
    priority: 'high' | 'medium' | 'low';
    signals: string[];
    nextAction: string;
}
export interface ChatRequest {
    message: string;
    userId?: string;
    sessionId?: string;
    conversationHistory?: ChatMessage[];
    currentFilters?: PropertySearchFilters;
}
export interface ChatResponse {
    message: string;
    properties?: any[];
    filters?: PropertySearchFilters;
    hasFilters: boolean;
    language: 'fr' | 'en';
    suggestions?: string[];
    timestamp: Date;
    method?: 'custom_nlp_enhanced' | 'fallback';
    leadScore?: LeadScore;
    contextSummary?: string;
    conversationType?: string;
    confidence?: number;
}
export declare class AiChatService {
    private propertyModel;
    private userModel;
    private propertiesService;
    private userInteractionsService;
    private configService;
    private readonly logger;
    private flaskClient;
    private sessions;
    private flaskHealthy;
    constructor(propertyModel: Model<PropertyDocument>, userModel: Model<UserDocument>, propertiesService: PropertiesService, userInteractionsService: UserInteractionsService, configService: ConfigService);
    private checkFlaskHealth;
    processChat(chatRequest: ChatRequest, user?: User): Promise<ChatResponse>;
    private callFlaskNLP;
    private enrichPropertiesWithMatchScores;
    private createFallbackResponse;
    refineSearch(message: string, currentFilters: PropertySearchFilters, userId?: string, conversationHistory?: ChatMessage[], user?: User): Promise<ChatResponse>;
    getLeadScore(userId: string): Promise<LeadScore | null>;
    getHotLeads(limit?: number): Promise<any[]>;
    getPersonalizedRecommendations(userId: string, limit?: number): Promise<any[]>;
    private trackChatInteraction;
    private updateSession;
    getSession(sessionId: string): Promise<ChatSession | null>;
    cleanupOldSessions(): Promise<void>;
    getChatStats(): Promise<any>;
}
