import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import axios, { AxiosInstance, AxiosError } from 'axios';
import { ConfigService } from '@nestjs/config';

import { Property, PropertyDocument } from '../properties/schemas/property.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { PropertiesService, PropertySearchFilters } from '../properties/properties.service';
import { UserInteractionsService, CreateInteractionDto } from '../user-interactions/user-interactions.service';
import { InteractionType, InteractionSource } from '../user-interactions/schemas/user-interaction.schema';

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

@Injectable()
export class AiChatService {
  private readonly logger = new Logger(AiChatService.name);
  private flaskClient: AxiosInstance;
  private sessions: Map<string, ChatSession> = new Map();
  private flaskHealthy: boolean = false;

  constructor(
    @InjectModel(Property.name) private propertyModel: Model<PropertyDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private propertiesService: PropertiesService,
    private userInteractionsService: UserInteractionsService,
    private configService: ConfigService,
  ) {
    // Initialize Flask ML service client
    const flaskUrl = this.configService.get<string>('FLASK_ML_SERVICE_URL') 
      || this.configService.get<string>('FLASK_ML_URL') 
      || 'http://localhost:5000';
    
    this.flaskClient = axios.create({
      baseURL: flaskUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.logger.log(`AI Chat Service initialized with Flask URL: ${flaskUrl}`);
    
    // Check Flask health on startup
    this.checkFlaskHealth();
  }

  /**
   * Check if Flask service is healthy
   */
  private async checkFlaskHealth(): Promise<void> {
    try {
      const response = await this.flaskClient.get('/api/health');
      this.flaskHealthy = response.status === 200;
      const features = response.data.features || [];
      this.logger.log(`Flask NLP service health: ${this.flaskHealthy ? 'HEALTHY' : 'UNHEALTHY'}`);
      this.logger.log(`Features enabled: ${features.join(', ')}`);
    } catch (error) {
      this.flaskHealthy = false;
      this.logger.warn(`Flask NLP service is not reachable: ${error.message}`);
      this.logger.warn('Chat will work with basic fallback until Flask service is available');
    }
  }

  /**
   * Process user chat message and return response with properties
   */
  async processChat(chatRequest: ChatRequest, user?: User): Promise<ChatResponse> {
    try {
      const { message, userId, sessionId, conversationHistory, currentFilters } = chatRequest;

      this.logger.log(`Processing chat for user ${userId || 'guest'}: ${message.substring(0, 50)}...`);

      // Try to call Flask Enhanced NLP service
      let nlpResponse;
      try {
        nlpResponse = await this.callFlaskNLP(message, userId, conversationHistory);
      } catch (flaskError) {
        this.logger.warn('Flask service unavailable, using basic fallback');
        nlpResponse = this.createFallbackResponse(message);
      }

      const filters = nlpResponse.filters || {};
      const hasFilters = nlpResponse.hasFilters || false;

      let properties: any[] = [];
      let totalResults = 0;

      // If we have filters, search for properties
      if (hasFilters && Object.keys(filters).length > 0) {
        try {
          const searchResults = await this.propertiesService.findAll(
            filters,
            {
              page: 1,
              limit: 6,
              sortBy: 'createdAt',
              sortOrder: 'desc',
            },
            user,
          );

          properties = searchResults.properties;
          totalResults = searchResults.total;

          // Calculate match scores if we have enhanced NLP
          if (nlpResponse.method === 'custom_nlp_enhanced' && properties.length > 0) {
            properties = await this.enrichPropertiesWithMatchScores(
              properties,
              filters,
              userId,
            );
          }

          this.logger.log(`Found ${totalResults} properties matching filters`);
        } catch (searchError) {
          this.logger.error('Error searching properties:', searchError);
        }
      }

      // Track chat interaction for recommendations
      if (user && hasFilters) {
        await this.trackChatInteraction(user._id, message, filters);
      }

      // Enhance response message with results count
      let enhancedMessage = nlpResponse.message;
      if (totalResults > 0) {
        const language = nlpResponse.language || 'fr';
        if (language === 'fr') {
          enhancedMessage += ` J'ai trouvé ${totalResults} propriété${totalResults > 1 ? 's' : ''} qui correspondent à vos critères.`;
        } else {
          enhancedMessage += ` I found ${totalResults} propert${totalResults > 1 ? 'ies' : 'y'} matching your criteria.`;
        }
      } else if (hasFilters) {
        const language = nlpResponse.language || 'fr';
        if (language === 'fr') {
          enhancedMessage += ` Je n'ai pas trouvé de propriétés correspondant exactement à ces critères. Essayez d'élargir votre recherche.`;
        } else {
          enhancedMessage += ` I didn't find properties matching these exact criteria. Try broadening your search.`;
        }
      }

      const response: ChatResponse = {
        message: enhancedMessage,
        properties,
        filters,
        hasFilters,
        language: nlpResponse.language || 'fr',
        timestamp: new Date(),
        method: nlpResponse.method,
        leadScore: nlpResponse.leadScore,
        contextSummary: nlpResponse.contextSummary,
        conversationType: nlpResponse.conversationType,
        confidence: nlpResponse.confidence,
        suggestions: nlpResponse.suggestedQuestions,
      };

      // Save to session if sessionId provided
      if (sessionId && userId) {
        await this.updateSession(sessionId, userId, message, response);
      }

      // Alert if hot lead detected
      if (nlpResponse.leadScore?.classification === 'hot') {
        this.logger.warn(`🔥 HOT LEAD DETECTED: User ${userId} - Score: ${nlpResponse.leadScore.score} - Action: ${nlpResponse.leadScore.nextAction}`);
        // TODO: Send notification to sales team
      }

      return response;
    } catch (error) {
      this.logger.error('Error processing chat:', error);
      
      // Fallback response
      return {
        message: "Désolé, j'ai rencontré une erreur. Pouvez-vous reformuler votre demande ?",
        properties: [],
        filters: {},
        hasFilters: false,
        language: 'fr',
        timestamp: new Date(),
        method: 'fallback',
      };
    }
  }

  /**
   * Call Flask Enhanced NLP API service
   */
  private async callFlaskNLP(
    message: string,
    userId?: string,
    conversationHistory?: ChatMessage[],
  ): Promise<any> {
    try {
      this.logger.debug('Calling Flask Enhanced NLP API...');
      this.logger.debug(`URL: ${this.flaskClient.defaults.baseURL}/api/chat`);
      this.logger.debug(`Message: ${message}`);

      const response = await this.flaskClient.post('/api/chat', {
        message,
        userId: userId || 'anonymous',
        conversationHistory: conversationHistory?.slice(-10).map(msg => ({
          role: msg.role,
          content: msg.content,
        })),
      });

      this.logger.debug('Flask NLP API response received');
      this.logger.debug(`Lead Score: ${response.data.leadScore?.classification} (${response.data.leadScore?.score})`);
      
      return response.data;
    } catch (error) {
      const axiosError = error as AxiosError;
      
      if (axiosError.code === 'ECONNREFUSED') {
        this.logger.error('Flask NLP service is not running or not reachable');
        this.logger.error(`Please start the Flask service at: ${this.flaskClient.defaults.baseURL}`);
      } else if (axiosError.response) {
        this.logger.error(`Flask NLP API error [${axiosError.response.status}]:`, axiosError.response.data);
      } else {
        this.logger.error('Flask NLP API error:', axiosError.message);
      }
      
      throw error;
    }
  }

  /**
   * Enrich properties with match scores
   */
  private async enrichPropertiesWithMatchScores(
    properties: any[],
    filters: PropertySearchFilters,
    userId?: string,
  ): Promise<any[]> {
    try {
      const enrichedProperties = await Promise.all(
        properties.map(async (property) => {
          try {
            const matchResponse = await this.flaskClient.post('/api/property-match', {
              property: {
                id: property._id,
                propertyType: property.propertyType,
                city: property.city,
                bedrooms: property.bedrooms,
                bathrooms: property.bathrooms,
                price: property.price,
                amenities: property.amenities,
                furnished: property.furnished,
                year_built: property.yearBuilt,
              },
              filters,
              userId: userId || 'anonymous',
            });

            return {
              ...property.toObject(),
              matchScore: matchResponse.data.matchScore,
              matchClassification: matchResponse.data.classification,
            };
          } catch (error) {
            this.logger.warn(`Failed to calculate match score for property ${property._id}`);
            return property;
          }
        }),
      );

      // Sort by match score (highest first)
      return enrichedProperties.sort((a, b) => 
        (b.matchScore || 0) - (a.matchScore || 0)
      );
    } catch (error) {
      this.logger.error('Error enriching properties with match scores:', error);
      return properties;
    }
  }

  /**
   * Create a simple fallback response using pattern matching
   */
  private createFallbackResponse(message: string): any {
    const lowerMessage = message.toLowerCase();
    
    // Simple pattern matching for common queries
    const filters: any = {};
    let hasFilters = false;

    // Check for property type
    if (lowerMessage.includes('maison') || lowerMessage.includes('house')) {
      filters.propertyType = 'house';
      hasFilters = true;
    } else if (lowerMessage.includes('appartement') || lowerMessage.includes('apartment')) {
      filters.propertyType = 'apartment';
      hasFilters = true;
    } else if (lowerMessage.includes('villa')) {
      filters.propertyType = 'villa';
      hasFilters = true;
    } else if (lowerMessage.includes('terrain') || lowerMessage.includes('land')) {
      filters.propertyType = 'land';
      hasFilters = true;
    } else if (lowerMessage.includes('studio')) {
      filters.propertyType = 'studio';
      hasFilters = true;
    }

    // Check for listing type
    if (lowerMessage.includes('louer') || lowerMessage.includes('rent') || lowerMessage.includes('location')) {
      filters.listingType = 'rent';
      hasFilters = true;
    } else if (lowerMessage.includes('acheter') || lowerMessage.includes('buy') || lowerMessage.includes('vente')) {
      filters.listingType = 'sale';
      hasFilters = true;
    }

    // Check for cities
    const cities = ['yaoundé', 'douala', 'bafoussam', 'garoua', 'maroua', 'ngaoundéré', 'bamenda'];
    for (const city of cities) {
      if (lowerMessage.includes(city.toLowerCase())) {
        filters.city = city.charAt(0).toUpperCase() + city.slice(1);
        hasFilters = true;
        break;
      }
    }

    // Extract numbers for bedrooms
    const bedroomMatch = lowerMessage.match(/(\d+)\s*(chambre|bedroom|bed|ch\b)/);
    if (bedroomMatch) {
      filters.bedrooms = parseInt(bedroomMatch[1]);
      hasFilters = true;
    }

    // Check for greetings
    const isGreeting = /\b(bonjour|salut|hello|hi|hey)\b/i.test(lowerMessage);

    return {
      message: isGreeting
        ? "Bonjour! Je suis HoroHouse AI, votre assistant immobilier. Comment puis-je vous aider aujourd'hui?"
        : hasFilters 
          ? "Je recherche des propriétés selon vos critères."
          : "Je peux vous aider à trouver une propriété. Pouvez-vous me donner plus de détails? (type, ville, budget, etc.)",
      filters,
      hasFilters,
      language: 'fr',
      method: 'fallback',
      conversationType: isGreeting ? 'greeting' : hasFilters ? 'search' : 'clarification',
      confidence: 0.5,
      suggestedQuestions: [
        "Appartement à Douala",
        "Maison à Yaoundé",
        "Villa à Bafoussam"
      ],
    };
  }

  /**
   * Refine existing search based on user feedback
   */
  async refineSearch(
    message: string,
    currentFilters: PropertySearchFilters,
    userId?: string,
    conversationHistory?: ChatMessage[],
    user?: User,
  ): Promise<ChatResponse> {
    try {
      this.logger.log(`Refining search with message: ${message.substring(0, 50)}...`);

      const response = await this.flaskClient.post('/api/refine-search', {
        message,
        currentFilters,
        userId: userId || 'anonymous',
      });

      const refinedFilters = response.data.filters;

      // Search with refined filters
      const searchResults = await this.propertiesService.findAll(
        refinedFilters,
        {
          page: 1,
          limit: 6,
          sortBy: 'createdAt',
          sortOrder: 'desc',
        },
        user,
      );

      return {
        message: response.data.message,
        properties: searchResults.properties,
        filters: refinedFilters,
        hasFilters: true,
        language: response.data.language || 'fr',
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error('Error refining search:', error);
      throw new BadRequestException('Failed to refine search');
    }
  }

  /**
   * Get lead score for a user
   */
  async getLeadScore(userId: string): Promise<LeadScore | null> {
    try {
      const response = await this.flaskClient.get(`/api/lead-score/${userId}`);
      return response.data.leadScore;
    } catch (error) {
      this.logger.error('Error getting lead score:', error);
      return null;
    }
  }

  /**
   * Get hot leads for sales team dashboard
   */
  async getHotLeads(limit: number = 20): Promise<any[]> {
    try {
      const hotLeads: any[] = [];

      for (const [sessionId, session] of this.sessions.entries()) {
        if (session.leadScore?.classification === 'hot') {
          const user = await this.userModel.findById(session.userId).exec();
          
          hotLeads.push({
            userId: session.userId,
            user: user ? {
              name: user.name,
              email: user.email,
              phoneNumber: user.phoneNumber,
            } : null,
            leadScore: session.leadScore,
            currentFilters: session.currentFilters,
            lastMessage: session.messages[session.messages.length - 1],
            lastActive: session.updatedAt,
            sessionId,
          });
        }
      }

      // Sort by score (highest first)
      hotLeads.sort((a, b) => b.leadScore.score - a.leadScore.score);

      return hotLeads.slice(0, limit);
    } catch (error) {
      this.logger.error('Error getting hot leads:', error);
      return [];
    }
  }

  /**
   * Get personalized property recommendations based on chat history
   */
  async getPersonalizedRecommendations(
    userId: string,
    limit: number = 6,
  ): Promise<any[]> {
    try {
      // Get user's recommendation profile from interactions
      const recommendations = await this.userInteractionsService.getRecommendedProperties(
        userId,
        limit,
      );

      if (recommendations.length === 0) {
        // Fallback to recent properties
        return this.propertiesService.getRecent(limit);
      }

      // Fetch full property details
      const properties = await this.propertyModel
        .find({ _id: { $in: recommendations } })
        .populate('ownerId', 'name email phoneNumber profilePicture')
        .populate('agentId', 'name email phoneNumber profilePicture agency')
        .limit(limit)
        .exec();

      return properties;
    } catch (error) {
      this.logger.error('Error getting personalized recommendations:', error);
      return [];
    }
  }

  /**
   * Track chat interaction for ML recommendations
   */
  private async trackChatInteraction(
    userId: Types.ObjectId,
    message: string,
    filters: PropertySearchFilters,
  ): Promise<void> {
    try {
      const interactionDto: CreateInteractionDto = {
        userId,
        interactionType: InteractionType.SEARCH,
        source: InteractionSource.SEARCH_RESULTS,
        metadata: {
          searchQuery: message,
          searchFilters: filters,
        },
        city: filters.city,
        propertyType: filters.propertyType,
        price: filters.maxPrice,
        listingType: filters.listingType,
        bedrooms: filters.bedrooms,
        bathrooms: filters.bathrooms,
      };

      await this.userInteractionsService.trackInteraction(interactionDto);
    } catch (error) {
      this.logger.error('Error tracking chat interaction:', error);
    }
  }

  /**
   * Update chat session with lead scoring
   */
  private async updateSession(
    sessionId: string,
    userId: string,
    userMessage: string,
    response: ChatResponse,
  ): Promise<void> {
    try {
      let session = this.sessions.get(sessionId);

      if (!session) {
        session = {
          sessionId,
          userId: new Types.ObjectId(userId),
          messages: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      }

      // Add user message
      session.messages.push({
        role: 'user',
        content: userMessage,
        timestamp: new Date(),
      });

      // Add assistant response
      session.messages.push({
        role: 'assistant',
        content: response.message,
        timestamp: response.timestamp,
        properties: response.properties,
        filters: response.filters,
      });

      // Update current filters
      if (response.hasFilters) {
        session.currentFilters = response.filters;
      }

      // Update lead score
      if (response.leadScore) {
        session.leadScore = response.leadScore;
      }

      session.updatedAt = new Date();

      // Keep only last 20 messages
      if (session.messages.length > 20) {
        session.messages = session.messages.slice(-20);
      }

      this.sessions.set(sessionId, session);
    } catch (error) {
      this.logger.error('Error updating session:', error);
    }
  }

  /**
   * Get chat session
   */
  async getSession(sessionId: string): Promise<ChatSession | null> {
    return this.sessions.get(sessionId) || null;
  }

  /**
   * Clear old sessions (cleanup job)
   */
  async cleanupOldSessions(): Promise<void> {
    const now = new Date();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

    for (const [sessionId, session] of this.sessions.entries()) {
      if (now.getTime() - session.updatedAt.getTime() > maxAge) {
        this.sessions.delete(sessionId);
      }
    }

    this.logger.log(`Cleaned up old chat sessions. Active sessions: ${this.sessions.size}`);
  }

  /**
   * Get chat statistics with lead analytics
   */
  async getChatStats(): Promise<any> {
    const sessions = Array.from(this.sessions.values());
    
    const leadStats = {
      hot: 0,
      warm: 0,
      cold: 0,
    };

    sessions.forEach(session => {
      if (session.leadScore) {
        leadStats[session.leadScore.classification]++;
      }
    });

    return {
      activeSessions: this.sessions.size,
      totalMessages: sessions.reduce(
        (sum, session) => sum + session.messages.length,
        0,
      ),
      flaskServiceHealthy: this.flaskHealthy,
      leadDistribution: leadStats,
      hotLeads: leadStats.hot,
      warmLeads: leadStats.warm,
      coldLeads: leadStats.cold,
    };
  }
}