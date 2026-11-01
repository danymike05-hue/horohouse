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
var MLSyncService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MLSyncService = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const property_schema_1 = require("../properties/schemas/property.schema");
const user_interaction_schema_1 = require("../user-interactions/schemas/user-interaction.schema");
const flask_ml_service_1 = require("./flask-ml.service");
const config_1 = require("@nestjs/config");
let MLSyncService = MLSyncService_1 = class MLSyncService {
    propertyModel;
    interactionModel;
    flaskMLService;
    configService;
    logger = new common_1.Logger(MLSyncService_1.name);
    isTraining = false;
    lastTrainingTime = null;
    enableAutoSync;
    constructor(propertyModel, interactionModel, flaskMLService, configService) {
        this.propertyModel = propertyModel;
        this.interactionModel = interactionModel;
        this.flaskMLService = flaskMLService;
        this.configService = configService;
        this.enableAutoSync = this.configService.get('ML_AUTO_SYNC_ENABLED', true);
        this.logger.log(`ML Auto-sync: ${this.enableAutoSync ? 'ENABLED' : 'DISABLED'}`);
    }
    async scheduledSync() {
        if (!this.enableAutoSync) {
            this.logger.debug('ML auto-sync is disabled, skipping scheduled sync');
            return;
        }
        this.logger.log('Starting scheduled ML model sync and training');
        await this.syncAndTrainModel();
    }
    async syncAndTrainModel(force = false) {
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
            const isHealthy = await this.flaskMLService.healthCheck();
            if (!isHealthy) {
                throw new Error('Flask ML service is not available');
            }
            this.logger.log('Fetching properties from database...');
            const properties = await this.propertyModel
                .find({
                isActive: true,
                availability: 'active',
            })
                .select('_id type description amenities price city area averageRating reviewCount keywords')
                .lean()
                .exec();
            this.logger.log(`Found ${properties.length} active properties`);
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
            this.logger.log(`ML model training completed successfully in ${processingTime}ms`, stats);
            return {
                success: true,
                message: 'ML model trained successfully',
                stats,
            };
        }
        catch (error) {
            this.logger.error('Error during ML sync and training:', error);
            return {
                success: false,
                message: error.message || 'Failed to sync and train ML model',
                stats: null,
            };
        }
        finally {
            this.isTraining = false;
        }
    }
    getStatus() {
        return {
            isTraining: this.isTraining,
            lastTrainingTime: this.lastTrainingTime,
            autoSyncEnabled: this.enableAutoSync,
        };
    }
    async syncProperties(propertyIds) {
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
            await this.flaskMLService.trainModel(properties, []);
            this.logger.log(`Successfully synced ${properties.length} properties`);
        }
        catch (error) {
            this.logger.error('Error syncing specific properties:', error);
            throw error;
        }
    }
    async syncUserInteractions(userId) {
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
        }
        catch (error) {
            this.logger.error('Error syncing user interactions:', error);
            throw error;
        }
    }
    async onApplicationBootstrap() {
        if (!this.enableAutoSync) {
            this.logger.log('ML auto-sync disabled, skipping initial training');
            return;
        }
        setTimeout(async () => {
            this.logger.log('Performing initial ML model training on startup...');
            try {
                await this.syncAndTrainModel();
            }
            catch (error) {
                this.logger.error('Failed to train model on startup:', error);
            }
        }, 10000);
    }
};
exports.MLSyncService = MLSyncService;
__decorate([
    (0, schedule_1.Cron)(schedule_1.CronExpression.EVERY_DAY_AT_2AM),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], MLSyncService.prototype, "scheduledSync", null);
exports.MLSyncService = MLSyncService = MLSyncService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(property_schema_1.Property.name)),
    __param(1, (0, mongoose_1.InjectModel)(user_interaction_schema_1.UserInteraction.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Model,
        flask_ml_service_1.FlaskMLService,
        config_1.ConfigService])
], MLSyncService);
//# sourceMappingURL=ml-sync.service.js.map