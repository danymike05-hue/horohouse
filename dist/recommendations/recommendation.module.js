"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RecommendationModule = void 0;
const common_1 = require("@nestjs/common");
const axios_1 = require("@nestjs/axios");
const mongoose_1 = require("@nestjs/mongoose");
const config_1 = require("@nestjs/config");
const recommendation_controller_1 = require("./recommendation.controller");
const recommendation_service_1 = require("./recommendation.service");
const content_based_service_1 = require("./content-based.service");
const hybrid_service_1 = require("./hybrid.service");
const flask_ml_service_1 = require("./flask-ml.service");
const ml_sync_service_1 = require("./ml-sync.service");
const property_schema_1 = require("../properties/schemas/property.schema");
const user_schema_1 = require("../users/schemas/user.schema");
const user_interaction_schema_1 = require("../user-interactions/schemas/user-interaction.schema");
const user_interactions_module_1 = require("../user-interactions/user-interactions.module");
let RecommendationModule = class RecommendationModule {
};
exports.RecommendationModule = RecommendationModule;
exports.RecommendationModule = RecommendationModule = __decorate([
    (0, common_1.Module)({
        imports: [
            axios_1.HttpModule.registerAsync({
                imports: [config_1.ConfigModule],
                useFactory: async (configService) => ({
                    timeout: configService.get('FLASK_TIMEOUT', 10000),
                    maxRedirects: 5,
                    baseURL: configService.get('FLASK_ML_URL', 'http://localhost:5001'),
                }),
                inject: [config_1.ConfigService],
            }),
            mongoose_1.MongooseModule.forFeature([
                { name: property_schema_1.Property.name, schema: property_schema_1.PropertySchema },
                { name: user_schema_1.User.name, schema: user_schema_1.UserSchema },
                { name: user_interaction_schema_1.UserInteraction.name, schema: user_interaction_schema_1.UserInteractionSchema },
            ]),
            user_interactions_module_1.UserInteractionsModule,
        ],
        controllers: [recommendation_controller_1.RecommendationController],
        providers: [
            recommendation_service_1.RecommendationService,
            content_based_service_1.ContentBasedRecommendationService,
            hybrid_service_1.HybridRecommendationService,
            flask_ml_service_1.FlaskMLService,
            ml_sync_service_1.MLSyncService,
        ],
        exports: [
            recommendation_service_1.RecommendationService,
            content_based_service_1.ContentBasedRecommendationService,
            hybrid_service_1.HybridRecommendationService,
            flask_ml_service_1.FlaskMLService,
            ml_sync_service_1.MLSyncService,
        ],
    })
], RecommendationModule);
//# sourceMappingURL=recommendation.module.js.map