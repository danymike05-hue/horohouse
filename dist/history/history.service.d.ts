import { Model } from 'mongoose';
import { History, HistoryDocument } from './schemas/history.schema';
import { LogActivityDto } from './dto/log-activity.dto';
export declare class HistoryService {
    private historyModel;
    private readonly logger;
    constructor(historyModel: Model<HistoryDocument>);
    logActivity(activityData: LogActivityDto): Promise<History | null>;
    getPopularCities(limit?: number, timeframe?: number): Promise<any[]>;
    getMostViewedProperties(limit?: number, timeframe?: number): Promise<any[]>;
    getSearchTrends(timeframe?: number, limit?: number): Promise<any[]>;
    getUserActivity(userId: string, timeframe?: number): Promise<any>;
    getPropertyAnalytics(propertyId: string, timeframe?: number): Promise<any>;
    getAgentAnalytics(agentId: string, timeframe?: number): Promise<any>;
    getDashboardStats(timeframe?: number): Promise<any>;
    getAllHistory(query: {
        page?: number;
        limit?: number;
        activityType?: string;
        userId?: string;
        city?: string;
        ipAddress?: string;
        startDate?: string;
        endDate?: string;
        sortBy?: string;
        sortOrder?: 'asc' | 'desc';
    }): Promise<{
        data: History[];
        total: number;
        page: number;
        limit: number;
    }>;
    cleanOldData(daysToKeep?: number): Promise<number>;
}
export { LogActivityDto };
