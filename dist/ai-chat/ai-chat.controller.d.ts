import { AiChatService, ChatRequest, ChatResponse } from './ai-chat.service';
export declare class AiChatController {
    private readonly aiChatService;
    private readonly logger;
    constructor(aiChatService: AiChatService);
    chat(chatRequest: ChatRequest, req: any): Promise<ChatResponse>;
    chatGuest(chatRequest: ChatRequest): Promise<ChatResponse>;
    refineSearch(body: {
        message: string;
        currentFilters: any;
        conversationHistory?: any[];
    }, req: any): Promise<ChatResponse>;
    getRecommendations(req: any, limit?: number): Promise<{
        success: boolean;
        properties: any[];
        count: number;
    }>;
    getSession(sessionId: string): Promise<{
        success: boolean;
        message: string;
        session?: undefined;
    } | {
        success: boolean;
        session: import("./ai-chat.service").ChatSession;
        message?: undefined;
    }>;
    getLeadScore(userId: string): Promise<{
        success: boolean;
        leadScore: import("./ai-chat.service").LeadScore | null;
    }>;
    getHotLeads(limit?: number): Promise<{
        success: boolean;
        hotLeads: any[];
        count: number;
    }>;
    getStats(): Promise<{
        success: boolean;
        stats: any;
    }>;
    cleanupSessions(): Promise<{
        success: boolean;
        message: string;
    }>;
}
