import { HistoryService, LogActivityDto } from './history.service';
export declare class HistoryController {
    private readonly historyService;
    constructor(historyService: HistoryService);
    logActivity(activityData: LogActivityDto, req: any): Promise<import("./schemas/history.schema").History | null>;
    getPopularCities(limit?: number, timeframe?: number): Promise<any[]>;
    getMostViewedProperties(limit?: number, timeframe?: number): Promise<any[]>;
    getSearchTrends(timeframe?: number, limit?: number): Promise<any[]>;
    getUserActivity(userId: string, timeframe?: number): Promise<any>;
    getMyActivity(req: any, timeframe?: number): Promise<any>;
    getPropertyAnalytics(propertyId: string, timeframe?: number): Promise<any>;
    getAgentAnalytics(agentId: string, timeframe?: number): Promise<any>;
    getDashboardStats(timeframe?: number): Promise<any>;
    getAllHistory(query: any): Promise<{
        data: import("./schemas/history.schema").History[];
        total: number;
        page: number;
        limit: number;
    }>;
}
