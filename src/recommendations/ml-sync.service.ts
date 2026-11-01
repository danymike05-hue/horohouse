import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Property, PropertyDocument } from '../properties/schemas/property.schema';
import { UserInteraction, UserInteractionDocument } from '../user-interactions/schemas/user-interaction.schema';
import { FlaskMLService } from './flask-ml.service';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class MLSyncService {
  private readonly logger = new Logger(MLSyncService.name);
  private isTraining = false;
  private lastTrainingTime: Date | null = null;
  private readonly enableAutoSync: boolean;

  constructor(
    @InjectModel(Property.name) private propertyModel: Model<PropertyDocument>,
    @InjectModel(UserInteraction.name) private interactionModel: Model<UserInteractionDocument>,
    private flaskMLService: FlaskMLService,
    private configService: ConfigService,
  ) {
    this.enableAutoSync = this.configService.get<boolean>('ML_AUTO_SYNC_ENABLED', true);
    this.logger.log(`ML Auto-sync: ${this.enableAutoSync ? 'ENABLED' : 'DISABLED'}`);
  }

  /**
   * Sync data with Flask ML service and train model
   * Runs daily at 2 AM
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async scheduledSync() {
    if (!this.enableAutoSync) {
      this.logger.debug('ML auto-sync is disabled, skipping scheduled sync');
      return;
    }

    this.logger.log('Starting scheduled ML model sync and training');
    await this.syncAndTrainModel();
  }

  /**
   * Manually trigger sync and training
   */
  async syncAndTrainModel(force: boolean = false): Promise<{
    success: boolean;
    message: string;
    stats: any;
  }> {
    if (this.isTraining && !force) {
      return {
        success: false,
        message: 'Training already in progress',
        stats: null,
      };
    }

    this.isTraining = true;
    const startTime = Date.now();

    try {
      // Check if Flask service is available
      const isHealthy = await this.flaskMLService.healthCheck();
      if (!isHealthy) {
        throw new Error('Flask ML service is not available');
      }

      // Fetch active properties from database
      this.logger.log('Fetching properties from database...');
      const properties = await this.propertyModel
        .find({
          isActive: true,
          availability: 'active',
        } as any)
        .select('_id type description amenities price city area averageRating reviewCount keywords')
        .lean()
        .exec();

      this.logger.log(`Found ${properties.length} active properties`);

      // Fetch recent user interactions (last 90 days)
      this.logger.log('Fetching user interactions from database...');
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

      const interactions = await this.interactionModel
        .find({
          createdAt: { $gte: ninetyDaysAgo },
          propertyId: { $ne: null },
        })
        .select('userId propertyId interactionType createdAt metadata')
        .lean()
        .exec();

      this.logger.log(`Found ${interactions.length} recent interactions`);

      // Train the Flask model
      this.logger.log('Training Flask ML model...');
      const result = await this.flaskMLService.trainModel(properties, interactions);

      const processingTime = Date.now() - startTime;
      this.lastTrainingTime = new Date();

      const stats = {
        propertiesProcessed: properties.length,
        interactionsProcessed: interactions.length,
        processingTime: `${processingTime}ms`,
        lastTrainingTime: this.lastTrainingTime,
      };

      this.logger.log(
        `ML model training completed successfully in ${processingTime}ms`,
        stats,
      );

      return {
        success: true,
        message: 'ML model trained successfully',
        stats,
      };
    } catch (error) {
      this.logger.error('Error during ML sync and training:', error);
      return {
        success: false,
        message: error.message || 'Failed to sync and train ML model',
        stats: null,
      };
    } finally {
      this.isTraining = false;
    }
  }

  /**
   * Get sync status
   */
  getStatus(): {
    isTraining: boolean;
    lastTrainingTime: Date | null;
    autoSyncEnabled: boolean;
  } {
    return {
      isTraining: this.isTraining,
      lastTrainingTime: this.lastTrainingTime,
      autoSyncEnabled: this.enableAutoSync,
    };
  }

  /**
   * Sync specific properties (incremental update)
   */
  async syncProperties(propertyIds: string[]): Promise<void> {
    try {
      this.logger.log(`Syncing ${propertyIds.length} specific properties`);

      const properties = await this.propertyModel
        .find({
          _id: { $in: propertyIds },
          isActive: true,
        })
        .lean()
        .exec();

      if (properties.length === 0) {
        this.logger.warn('No active properties found to sync');
        return;
      }

      // For incremental updates, we might want to retrain with all data
      // or implement a partial update mechanism in Flask
      await this.flaskMLService.trainModel(properties, []);

      this.logger.log(`Successfully synced ${properties.length} properties`);
    } catch (error) {
      this.logger.error('Error syncing specific properties:', error);
      throw error;
    }
  }

  /**
   * Sync user interactions for a specific user
   */
  async syncUserInteractions(userId: string): Promise<void> {
  try {
    this.logger.log(`Syncing interactions for user ${userId}`);

    const interactions = await this.interactionModel
      .find({
        userId,
        propertyId: { $ne: null },
      })
      .lean()
      .exec();

    if (interactions.length === 0) {
      this.logger.warn(`No interactions found for user ${userId}`);
      return;
    }

    await this.flaskMLService.trainModel([], interactions);

    this.logger.log(`Successfully synced ${interactions.length} interactions for user ${userId}`);
  } catch (error) {
    this.logger.error('Error syncing user interactions:', error);
    throw error;
  }
}

  /**
   * Trigger training on application startup
   */
  async onApplicationBootstrap() {
    if (!this.enableAutoSync) {
      this.logger.log('ML auto-sync disabled, skipping initial training');
      return;
    }

    // Wait 10 seconds after startup before training
    setTimeout(async () => {
      this.logger.log('Performing initial ML model training on startup...');
      try {
        await this.syncAndTrainModel();
      } catch (error) {
        this.logger.error('Failed to train model on startup:', error);
        // Don't throw error to prevent app from failing to start
      }
    }, 10000);
  }
}