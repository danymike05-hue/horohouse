import { AppService } from './app.service';
export declare class AppController {
    private readonly appService;
    constructor(appService: AppService);
    getHealth(): Promise<{
        status: string;
        timestamp: string;
        service: string;
        version: string;
        database: {
            status: string;
            details: {
                name: string;
                host: string;
            };
        };
        system: {
            uptime: number;
            platform: NodeJS.Platform;
            cpus: number;
            loadAvg: number[];
            memory: {
                total: string;
                used: string;
                usagePercent: string;
            };
        };
    }>;
    getHello(): string;
    testEmail(): Promise<{
        success: boolean;
        messageId: any;
        error?: undefined;
    } | {
        success: boolean;
        error: any;
        messageId?: undefined;
    }>;
}
