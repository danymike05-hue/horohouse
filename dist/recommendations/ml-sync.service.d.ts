import { Model } from 'mongoose';
import { PropertyDocument } from '../properties/schemas/property.schema';
import { UserInteractionDocument } from '../user-interactions/schemas/user-interaction.schema';
import { FlaskMLService } from './flask-ml.service';
import { ConfigService } from '@nestjs/config';
export declare class MLSyncService {
    private propertyModel;
    private interactionModel;
    private flaskMLService;
    private configService;
    private readonly logger;
    private isTraining;
    private lastTrainingTime;
    private readonly enableAutoSync;
    constructor(propertyModel: Model<PropertyDocument>, interactionModel: Model<UserInteractionDocument>, flaskMLService: FlaskMLService, configService: ConfigService);
    scheduledSync(): Promise<void>;
    syncAndTrainModel(force?: boolean): Promise<{
        success: boolean;
        message: string;
        stats: any;
    }>;
    getStatus(): {
        isTraining: boolean;
        lastTrainingTime: Date | null;
        autoSyncEnabled: boolean;
    };
    syncProperties(propertyIds: string[]): Promise<void>;
    syncUserInteractions(userId: string): Promise<void>;
    onApplicationBootstrap(): Promise<void>;
}
