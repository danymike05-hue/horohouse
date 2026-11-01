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
var FlaskMLService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.FlaskMLService = void 0;
const common_1 = require("@nestjs/common");
const axios_1 = require("@nestjs/axios");
const config_1 = require("@nestjs/config");
const rxjs_1 = require("rxjs");
let FlaskMLService = FlaskMLService_1 = class FlaskMLService {
    httpService;
    configService;
    logger = new common_1.Logger(FlaskMLService_1.name);
    flaskBaseUrl;
    timeout;
    constructor(httpService, configService) {
        this.httpService = httpService;
        this.configService = configService;
        this.flaskBaseUrl = this.configService.get('FLASK_ML_URL', 'http://localhost:5000');
        this.timeout = this.configService.get('FLASK_TIMEOUT', 10000);
        this.logger.log(`Flask ML Service initialized at: ${this.flaskBaseUrl}`);
    }
    async getSimilarProperties(propertyId, limit = 5, excludeIds = []) {
        try {
            const url = `${this.flaskBaseUrl}/api/recommend/property/${propertyId}`;
            const params = {
                limit: limit.toString(),
                exclude: excludeIds.join(','),
            };
            this.logger.debug(`Calling Flask: GET ${url}`, params);
            const response = await (0, rxjs_1.firstValueFrom)(this.httpService.get(url, {
                params,
                timeout: this.timeout,
            }));
            if (!response.data.success) {
                throw new Error(response.data.error || 'Flask ML service returned error');
            }
            this.logger.log(`Retrieved ${response.data.data.recommendations.length} similar properties from Flask`);
            return response.data.data.recommendations;
        }
        catch (error) {
            return this.handleFlaskError(error, 'getSimilarProperties');
        }
    }
    async getPersonalizedRecommendations(userId, limit = 5, excludeIds = [], propertyType) {
        try {
            const url = `${this.flaskBaseUrl}/api/recommend/user/${userId}`;
            const params = {
                limit: limit.toString(),
                exclude: excludeIds.join(','),
            };
            if (propertyType) {
                params.property_type = propertyType;
            }
            this.logger.debug(`Calling Flask: GET ${url}`, params);
            const response = await (0, rxjs_1.firstValueFrom)(this.httpService.get(url, {
                params,
                timeout: this.timeout,
            }));
            if (!response.data.success) {
                throw new Error(response.data.error || 'Flask ML service returned error');
            }
            this.logger.log(`Retrieved ${response.data.data.recommendations.length} personalized recommendations from Flask`);
            return response.data.data.recommendations;
        }
        catch (error) {
            return this.handleFlaskError(error, 'getPersonalizedRecommendations');
        }
    }
    async trainModel(properties, userInteractions = []) {
        try {
            const url = `${this.flaskBaseUrl}/api/train`;
            const transformedProperties = this.transformPropertiesToFlaskFormat(properties);
            const transformedInteractions = this.transformInteractionsToFlaskFormat(userInteractions);
            this.logger.debug(`Training Flask model with ${transformedProperties.length} properties`);
            const response = await (0, rxjs_1.firstValueFrom)(this.httpService.post(url, {
                properties: transformedProperties,
                user_interactions: transformedInteractions,
            }, {
                timeout: 60000,
            }));
            if (!response.data.success) {
                throw new Error(response.data.error || 'Training failed');
            }
            this.logger.log('Flask model trained successfully');
            return {
                success: true,
                message: 'Model trained successfully',
            };
        }
        catch (error) {
            this.logger.error('Error training Flask model:', error);
            throw new common_1.HttpException('Failed to train ML model', common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async healthCheck() {
        try {
            const response = await (0, rxjs_1.firstValueFrom)(this.httpService.get(`${this.flaskBaseUrl}/health`, {
                timeout: 5000,
            }));
            return response.status === 200;
        }
        catch (error) {
            this.logger.warn('Flask service health check failed:', error.message);
            return false;
        }
    }
    transformPropertiesToFlaskFormat(properties) {
        return properties.map(property => ({
            _id: property._id?.toString() || property.id?.toString(),
            title: property.title,
            type: property.type,
            listingType: property.listingType,
            availability: property.availability,
            description: property.description || '',
            amenities: property.amenities || {},
            price: property.price,
            city: property.city,
            area: property.area,
            isActive: property.isActive,
            averageRating: property.averageRating || 0,
            reviewCount: property.reviewCount || 0,
            viewsCount: property.viewsCount || 0,
        }));
    }
    extractAmenitiesArray(amenities) {
        if (!amenities)
            return [];
        const amenityList = [];
        if (typeof amenities === 'object') {
            Object.entries(amenities).forEach(([key, value]) => {
                if (value === true || (typeof value === 'number' && value > 0)) {
                    amenityList.push(key);
                }
            });
        }
        return amenityList;
    }
    transformInteractionsToFlaskFormat(interactions) {
        return interactions.map(interaction => ({
            user_id: interaction.userId?.toString(),
            property_id: interaction.propertyId?.toString(),
            interaction_type: interaction.interactionType,
            timestamp: interaction.createdAt || new Date(),
            metadata: interaction.metadata || {},
        }));
    }
    handleFlaskError(error, operation) {
        if (error.response) {
            const status = error.response.status;
            const message = error.response.data?.error || error.message;
            this.logger.error(`Flask ML ${operation} failed [${status}]: ${message}`, error.response.data);
            if (status === 503) {
                throw new common_1.HttpException('ML model not initialized. Please train the model first.', common_1.HttpStatus.SERVICE_UNAVAILABLE);
            }
            else if (status === 404) {
                throw new common_1.HttpException('Property or user not found in ML model', common_1.HttpStatus.NOT_FOUND);
            }
            else {
                throw new common_1.HttpException(`ML service error: ${message}`, common_1.HttpStatus.INTERNAL_SERVER_ERROR);
            }
        }
        else if (error.code === 'ECONNREFUSED') {
            this.logger.error(`Flask ML service is not reachable at ${this.flaskBaseUrl}`);
            throw new common_1.HttpException('ML recommendation service is currently unavailable', common_1.HttpStatus.SERVICE_UNAVAILABLE);
        }
        else {
            this.logger.error(`Flask ML ${operation} error:`, error.message);
            throw new common_1.HttpException('Failed to get ML recommendations', common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
};
exports.FlaskMLService = FlaskMLService;
exports.FlaskMLService = FlaskMLService = FlaskMLService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [axios_1.HttpService,
        config_1.ConfigService])
], FlaskMLService);
//# sourceMappingURL=flask-ml.service.js.map