"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var AiChatService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiChatService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const axios_1 = require("axios");
const config_1 = require("@nestjs/config");
const property_schema_1 = require("../properties/schemas/property.schema");
const user_schema_1 = require("../users/schemas/user.schema");
const properties_service_1 = require("../properties/properties.service");
const user_interactions_service_1 = require("../user-interactions/user-interactions.service");
const user_interaction_schema_1 = require("../user-interactions/schemas/user-interaction.schema");
let AiChatService = AiChatService_1 = class AiChatService {
    propertyModel;
    userModel;
    propertiesService;
    userInteractionsService;
    configService;
    logger = new common_1.Logger(AiChatService_1.name);
    flaskClient;
    sessions = new Map();
    flaskHealthy = false;
    constructor(propertyModel, userModel, propertiesService, userInteractionsService, configService) {
        this.propertyModel = propertyModel;
        this.userModel = userModel;
        this.propertiesService = propertiesService;
        this.userInteractionsService = userInteractionsService;
        this.configService = configService;
        const flaskUrl = this.configService.get('FLASK_ML_SERVICE_URL')
            || this.configService.get('FLASK_ML_URL')
            || 'http://localhost:5000';
        this.flaskClient = axios_1.default.create({
            baseURL: flaskUrl,
            timeout: 30000,
            headers: {
                'Content-Type': 'application/json',
            },
        });
        this.logger.log(`AI Chat Service initialized with Flask URL: ${flaskUrl}`);
        this.checkFlaskHealth();
    }
    async checkFlaskHealth() {
        try {
            const response = await this.flaskClient.get('/api/health');
            this.flaskHealthy = response.status === 200;
            const features = response.data.features || [];
            this.logger.log(`Flask NLP service health: ${this.flaskHealthy ? 'HEALTHY' : 'UNHEALTHY'}`);
            this.logger.log(`Features enabled: ${features.join(', ')}`);
        }
        catch (error) {
            this.flaskHealthy = false;
            this.logger.warn(`Flask NLP service is not reachable: ${error.message}`);
            this.logger.warn('Chat will work with basic fallback until Flask service is available');
        }
    }
    async processChat(chatRequest, user) {
        try {
            const { message, userId, sessionId, conversationHistory, currentFilters } = chatRequest;
            this.logger.log(`Processing chat for user ${userId || 'guest'}: ${message.substring(0, 50)}...`);
            let nlpResponse;
            try {
                nlpResponse = await this.callFlaskNLP(message, userId, conversationHistory);
            }
            catch (flaskError) {
                this.logger.warn('Flask service unavailable, using basic fallback');
                nlpResponse = this.createFallbackResponse(message);
            }
            const filters = nlpResponse.filters || {};
            const hasFilters = nlpResponse.hasFilters || false;
            let properties = [];
            let totalResults = 0;
            if (hasFilters && Object.keys(filters).length > 0) {
                try {
                    const searchResults = await this.propertiesService.findAll(filters, {
                        page: 1,
                        limit: 6,
                        sortBy: 'createdAt',
                        sortOrder: 'desc',
                    }, user);
                    properties = searchResults.properties;
                    totalResults = searchResults.total;
                    if (nlpResponse.method === 'custom_nlp_enhanced' && properties.length > 0) {
                        properties = await this.enrichPropertiesWithMatchScores(properties, filters, userId);
                    }
                    this.logger.log(`Found ${totalResults} properties matching filters`);
                }
                catch (searchError) {
                    this.logger.error('Error searching properties:', searchError);
                }
            }
            if (user && hasFilters) {
                await this.trackChatInteraction(user._id, message, filters);
            }
            let enhancedMessage = nlpResponse.message;
            if (totalResults > 0) {
                const language = nlpResponse.language || 'fr';
                if (language === 'fr') {
                    enhancedMessage += ` J'ai trouvé ${totalResults} propriété${totalResults > 1 ? 's' : ''} qui correspondent à vos critères.`;
                }
                else {
                    enhancedMessage += ` I found ${totalResults} propert${totalResults > 1 ? 'ies' : 'y'} matching your criteria.`;
                }
            }
            else if (hasFilters) {
                const language = nlpResponse.language || 'fr';
                if (language === 'fr') {
                    enhancedMessage += ` Je n'ai pas trouvé de propriétés correspondant exactement à ces critères. Essayez d'élargir votre recherche.`;
                }
                else {
                    enhancedMessage += ` I didn't find properties matching these exact criteria. Try broadening your search.`;
                }
            }
            const response = {
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
            if (sessionId && userId) {
                await this.updateSession(sessionId, userId, message, response);
            }
            if (nlpResponse.leadScore?.classification === 'hot') {
                this.logger.warn(`🔥 HOT LEAD DETECTED: User ${userId} - Score: ${nlpResponse.leadScore.score} - Action: ${nlpResponse.leadScore.nextAction}`);
            }
            return response;
        }
        catch (error) {
            this.logger.error('Error processing chat:', error);
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
    async callFlaskNLP(message, userId, conversationHistory) {
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
        }
        catch (error) {
            const axiosError = error;
            if (axiosError.code === 'ECONNREFUSED') {
                this.logger.error('Flask NLP service is not running or not reachable');
                this.logger.error(`Please start the Flask service at: ${this.flaskClient.defaults.baseURL}`);
            }
            else if (axiosError.response) {
                this.logger.error(`Flask NLP API error [${axiosError.response.status}]:`, axiosError.response.data);
            }
            else {
                this.logger.error('Flask NLP API error:', axiosError.message);
            }
            throw error;
        }
    }
    async enrichPropertiesWithMatchScores(properties, filters, userId) {
        try {
            const enrichedProperties = await Promise.all(properties.map(async (property) => {
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
                }
                catch (error) {
                    this.logger.warn(`Failed to calculate match score for property ${property._id}`);
                    return property;
                }
            }));
            return enrichedProperties.sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0));
        }
        catch (error) {
            this.logger.error('Error enriching properties with match scores:', error);
            return properties;
        }
    }
    createFallbackResponse(message) {
        const lowerMessage = message.toLowerCase();
        const filters = {};
        let hasFilters = false;
        if (lowerMessage.includes('maison') || lowerMessage.includes('house')) {
            filters.propertyType = 'house';
            hasFilters = true;
        }
        else if (lowerMessage.includes('appartement') || lowerMessage.includes('apartment')) {
            filters.propertyType = 'apartment';
            hasFilters = true;
        }
        else if (lowerMessage.includes('villa')) {
            filters.propertyType = 'villa';
            hasFilters = true;
        }
        else if (lowerMessage.includes('terrain') || lowerMessage.includes('land')) {
            filters.propertyType = 'land';
            hasFilters = true;
        }
        else if (lowerMessage.includes('studio')) {
            filters.propertyType = 'studio';
            hasFilters = true;
        }
        if (lowerMessage.includes('louer') || lowerMessage.includes('rent') || lowerMessage.includes('location')) {
            filters.listingType = 'rent';
            hasFilters = true;
        }
        else if (lowerMessage.includes('acheter') || lowerMessage.includes('buy') || lowerMessage.includes('vente')) {
            filters.listingType = 'sale';
            hasFilters = true;
        }
        const cities = ['yaoundé', 'douala', 'bafoussam', 'garoua', 'maroua', 'ngaoundéré', 'bamenda'];
        for (const city of cities) {
            if (lowerMessage.includes(city.toLowerCase())) {
                filters.city = city.charAt(0).toUpperCase() + city.slice(1);
                hasFilters = true;
                break;
            }
        }
        const bedroomMatch = lowerMessage.match(/(\d+)\s*(chambre|bedroom|bed|ch\b)/);
        if (bedroomMatch) {
            filters.bedrooms = parseInt(bedroomMatch[1]);
            hasFilters = true;
        }
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
    async refineSearch(message, currentFilters, userId, conversationHistory, user) {
        try {
            this.logger.log(`Refining search with message: ${message.substring(0, 50)}...`);
            const response = await this.flaskClient.post('/api/refine-search', {
                message,
                currentFilters,
                userId: userId || 'anonymous',
            });
            const refinedFilters = response.data.filters;
            const searchResults = await this.propertiesService.findAll(refinedFilters, {
                page: 1,
                limit: 6,
                sortBy: 'createdAt',
                sortOrder: 'desc',
            }, user);
            return {
                message: response.data.message,
                properties: searchResults.properties,
                filters: refinedFilters,
                hasFilters: true,
                language: response.data.language || 'fr',
                timestamp: new Date(),
            };
        }
        catch (error) {
            this.logger.error('Error refining search:', error);
            throw new common_1.BadRequestException('Failed to refine search');
        }
    }
    async getLeadScore(userId) {
        try {
            const response = await this.flaskClient.get(`/api/lead-score/${userId}`);
            return response.data.leadScore;
        }
        catch (error) {
            this.logger.error('Error getting lead score:', error);
            return null;
        }
    }
    async getHotLeads(limit = 20) {
        try {
            const hotLeads = [];
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
            hotLeads.sort((a, b) => b.leadScore.score - a.leadScore.score);
            return hotLeads.slice(0, limit);
        }
        catch (error) {
            this.logger.error('Error getting hot leads:', error);
            return [];
        }
    }
    async getPersonalizedRecommendations(userId, limit = 6) {
        try {
            const recommendations = await this.userInteractionsService.getRecommendedProperties(userId, limit);
            if (recommendations.length === 0) {
                return this.propertiesService.getRecent(limit);
            }
            const properties = await this.propertyModel
                .find({ _id: { $in: recommendations } })
                .populate('ownerId', 'name email phoneNumber profilePicture')
                .populate('agentId', 'name email phoneNumber profilePicture agency')
                .limit(limit)
                .exec();
            return properties;
        }
        catch (error) {
            this.logger.error('Error getting personalized recommendations:', error);
            return [];
        }
    }
    async trackChatInteraction(userId, message, filters) {
        try {
            const interactionDto = {
                userId,
                interactionType: user_interaction_schema_1.InteractionType.SEARCH,
                source: user_interaction_schema_1.InteractionSource.SEARCH_RESULTS,
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
        }
        catch (error) {
            this.logger.error('Error tracking chat interaction:', error);
        }
    }
    async updateSession(sessionId, userId, userMessage, response) {
        try {
            let session = this.sessions.get(sessionId);
            if (!session) {
                session = {
                    sessionId,
                    userId: new mongoose_2.Types.ObjectId(userId),
                    messages: [],
                    createdAt: new Date(),
                    updatedAt: new Date(),
                };
            }
            session.messages.push({
                role: 'user',
                content: userMessage,
                timestamp: new Date(),
            });
            session.messages.push({
                role: 'assistant',
                content: response.message,
                timestamp: response.timestamp,
                properties: response.properties,
                filters: response.filters,
            });
            if (response.hasFilters) {
                session.currentFilters = response.filters;
            }
            if (response.leadScore) {
                session.leadScore = response.leadScore;
            }
            session.updatedAt = new Date();
            if (session.messages.length > 20) {
                session.messages = session.messages.slice(-20);
            }
            this.sessions.set(sessionId, session);
        }
        catch (error) {
            this.logger.error('Error updating session:', error);
        }
    }
    async getSession(sessionId) {
        return this.sessions.get(sessionId) || null;
    }
    async cleanupOldSessions() {
        const now = new Date();
        const maxAge = 24 * 60 * 60 * 1000;
        for (const [sessionId, session] of this.sessions.entries()) {
            if (now.getTime() - session.updatedAt.getTime() > maxAge) {
                this.sessions.delete(sessionId);
            }
        }
        this.logger.log(`Cleaned up old chat sessions. Active sessions: ${this.sessions.size}`);
    }
    async getChatStats() {
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
            totalMessages: sessions.reduce((sum, session) => sum + session.messages.length, 0),
            flaskServiceHealthy: this.flaskHealthy,
            leadDistribution: leadStats,
            hotLeads: leadStats.hot,
            warmLeads: leadStats.warm,
            coldLeads: leadStats.cold,
        };
    }
};
exports.AiChatService = AiChatService;
exports.AiChatService = AiChatService = AiChatService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(property_schema_1.Property.name)),
    __param(1, (0, mongoose_1.InjectModel)(user_schema_1.User.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Model,
        properties_service_1.PropertiesService,
        user_interactions_service_1.UserInteractionsService,
        config_1.ConfigService])
], AiChatService);
//# sourceMappingURL=ai-chat.service.js.map