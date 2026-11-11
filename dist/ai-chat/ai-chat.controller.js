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
var AiChatController_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiChatController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const jwt_auth_guard_1 = require("../auth/guards/jwt.auth.guard");
const ai_chat_service_1 = require("./ai-chat.service");
let AiChatController = AiChatController_1 = class AiChatController {
    aiChatService;
    logger = new common_1.Logger(AiChatController_1.name);
    constructor(aiChatService) {
        this.aiChatService = aiChatService;
    }
    async chat(chatRequest, req) {
        try {
            const user = req.user;
            if (user && !chatRequest.userId) {
                chatRequest.userId = user.userId;
            }
            this.logger.log(`Chat request from user: ${chatRequest.userId || 'guest'}`);
            const response = await this.aiChatService.processChat(chatRequest, user);
            return response;
        }
        catch (error) {
            this.logger.error('Error in chat endpoint:', error);
            throw error;
        }
    }
    async chatGuest(chatRequest) {
        try {
            this.logger.log(`Guest chat request from session: ${chatRequest.sessionId || 'new'}`);
            const response = await this.aiChatService.processChat(chatRequest, undefined);
            return response;
        }
        catch (error) {
            this.logger.error('Error in guest chat endpoint:', error);
            throw error;
        }
    }
    async refineSearch(body, req) {
        try {
            const user = req.user;
            const userId = user?.userId;
            return await this.aiChatService.refineSearch(body.message, body.currentFilters, userId, body.conversationHistory, user);
        }
        catch (error) {
            this.logger.error('Error refining search:', error);
            throw error;
        }
    }
    async getRecommendations(req, limit) {
        try {
            const userId = req.user.userId;
            const propertyLimit = limit ? parseInt(limit) : 6;
            const recommendations = await this.aiChatService.getPersonalizedRecommendations(userId, propertyLimit);
            return {
                success: true,
                properties: recommendations,
                count: recommendations.length,
            };
        }
        catch (error) {
            this.logger.error('Error getting recommendations:', error);
            throw error;
        }
    }
    async getSession(sessionId) {
        try {
            const session = await this.aiChatService.getSession(sessionId);
            if (!session) {
                return {
                    success: false,
                    message: 'Session not found',
                };
            }
            return {
                success: true,
                session,
            };
        }
        catch (error) {
            this.logger.error('Error getting session:', error);
            throw error;
        }
    }
    async getLeadScore(userId) {
        try {
            const leadScore = await this.aiChatService.getLeadScore(userId);
            return {
                success: true,
                leadScore,
            };
        }
        catch (error) {
            this.logger.error('Error getting lead score:', error);
            throw error;
        }
    }
    async getHotLeads(limit) {
        try {
            const leadLimit = limit ? parseInt(limit) : 20;
            const hotLeads = await this.aiChatService.getHotLeads(leadLimit);
            return {
                success: true,
                hotLeads,
                count: hotLeads.length,
            };
        }
        catch (error) {
            this.logger.error('Error getting hot leads:', error);
            throw error;
        }
    }
    async getStats() {
        try {
            const stats = await this.aiChatService.getChatStats();
            return {
                success: true,
                stats,
            };
        }
        catch (error) {
            this.logger.error('Error getting stats:', error);
            throw error;
        }
    }
    async cleanupSessions() {
        try {
            await this.aiChatService.cleanupOldSessions();
            return {
                success: true,
                message: 'Old sessions cleaned up successfully',
            };
        }
        catch (error) {
            this.logger.error('Error cleaning up sessions:', error);
            throw error;
        }
    }
};
exports.AiChatController = AiChatController;
__decorate([
    (0, common_1.Post)('chat'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({
        summary: 'Send chat message and get AI response with property recommendations',
        description: 'Enhanced NLP with context memory, lead scoring, and spell correction'
    }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'Chat response with properties and filters',
        schema: {
            example: {
                message: 'Parfait! Je recherche des appartements avec 3 chambres à Douala...',
                properties: [],
                filters: {
                    propertyType: 'apartment',
                    bedrooms: 3,
                    city: 'Douala',
                },
                hasFilters: true,
                language: 'fr',
                suggestions: ['Avec piscine', 'Immeuble sécurisé', 'Proche des écoles'],
                leadScore: {
                    score: 65,
                    classification: 'warm',
                    priority: 'medium',
                    signals: ['has_budget', 'specific_location'],
                    nextAction: 'Send curated property list',
                },
                contextSummary: 'Based on our conversation, you are focused on Douala and interested in apartments.',
                conversationType: 'search',
                confidence: 0.95,
                method: 'custom_nlp_enhanced',
                timestamp: '2024-01-15T10:30:00Z',
            },
        },
    }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AiChatController.prototype, "chat", null);
__decorate([
    (0, common_1.Post)('chat/guest'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({
        summary: 'Send chat message as guest (no authentication required)',
        description: 'Process chat without requiring user authentication'
    }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'Chat response with properties and filters',
    }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AiChatController.prototype, "chatGuest", null);
__decorate([
    (0, common_1.Post)('refine'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({
        summary: 'Refine existing search based on feedback',
        description: 'Update search filters based on natural language feedback'
    }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'Refined search results',
    }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AiChatController.prototype, "refineSearch", null);
__decorate([
    (0, common_1.Get)('recommendations'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({
        summary: 'Get personalized property recommendations',
        description: 'Based on chat history and user interactions'
    }),
    (0, swagger_1.ApiQuery)({ name: 'limit', required: false, type: Number }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'Personalized property recommendations',
    }),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number]),
    __metadata("design:returntype", Promise)
], AiChatController.prototype, "getRecommendations", null);
__decorate([
    (0, common_1.Get)('session/:sessionId'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({
        summary: 'Get chat session',
        description: 'Retrieve chat history and session data including lead score'
    }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'Chat session data',
    }),
    __param(0, (0, common_1.Param)('sessionId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AiChatController.prototype, "getSession", null);
__decorate([
    (0, common_1.Get)('lead-score/:userId'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({
        summary: 'Get lead score for user',
        description: 'Retrieve current lead qualification score and signals'
    }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'Lead score data',
        schema: {
            example: {
                success: true,
                leadScore: {
                    score: 85,
                    classification: 'hot',
                    priority: 'high',
                    signals: ['has_budget', 'specific_location', 'asked_viewing'],
                    nextAction: 'Schedule viewing ASAP',
                },
            },
        },
    }),
    __param(0, (0, common_1.Param)('userId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AiChatController.prototype, "getLeadScore", null);
__decorate([
    (0, common_1.Get)('hot-leads'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({
        summary: 'Get hot leads for sales team',
        description: 'Retrieve list of high-priority leads (score >= 70)'
    }),
    (0, swagger_1.ApiQuery)({ name: 'limit', required: false, type: Number }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'List of hot leads',
        schema: {
            example: {
                success: true,
                hotLeads: [
                    {
                        userId: '507f1f77bcf86cd799439011',
                        user: {
                            name: 'John Doe',
                            email: 'john@example.com',
                            phoneNumber: '+237670000000',
                        },
                        leadScore: {
                            score: 85,
                            classification: 'hot',
                            priority: 'high',
                            signals: ['has_budget', 'asked_viewing'],
                            nextAction: 'Schedule viewing ASAP',
                        },
                        currentFilters: {
                            propertyType: 'apartment',
                            city: 'Douala',
                            bedrooms: 3,
                        },
                        lastActive: '2024-01-15T10:30:00Z',
                    },
                ],
                count: 1,
            },
        },
    }),
    __param(0, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], AiChatController.prototype, "getHotLeads", null);
__decorate([
    (0, common_1.Get)('stats'),
    (0, swagger_1.ApiOperation)({
        summary: 'Get chat statistics',
        description: 'Analytics including active sessions, messages, and lead distribution'
    }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'Chat statistics and analytics',
        schema: {
            example: {
                success: true,
                stats: {
                    activeSessions: 45,
                    totalMessages: 1234,
                    flaskServiceHealthy: true,
                    leadDistribution: {
                        hot: 5,
                        warm: 15,
                        cold: 25,
                    },
                    hotLeads: 5,
                    warmLeads: 15,
                    coldLeads: 25,
                },
            },
        },
    }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AiChatController.prototype, "getStats", null);
__decorate([
    (0, common_1.Post)('cleanup'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({
        summary: 'Cleanup old sessions (admin only)',
        description: 'Remove sessions older than 24 hours'
    }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'Cleanup completed',
    }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AiChatController.prototype, "cleanupSessions", null);
exports.AiChatController = AiChatController = AiChatController_1 = __decorate([
    (0, swagger_1.ApiTags)('AI Chat'),
    (0, common_1.Controller)('ai-chat'),
    __metadata("design:paramtypes", [ai_chat_service_1.AiChatService])
], AiChatController);
//# sourceMappingURL=ai-chat.controller.js.map