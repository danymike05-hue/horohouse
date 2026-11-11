"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.InsightsModule = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const platform_express_1 = require("@nestjs/platform-express");
const post_schema_1 = require("./schemas/post.schema");
const category_schema_1 = require("./schemas/category.schema");
const tag_schema_1 = require("./schemas/tag.schema");
const author_profile_schema_1 = require("./schemas/author-profile.schema");
const insights_controller_1 = require("./insights.controller");
const insights_admin_controller_1 = require("./insights-admin.controller");
const insights_service_1 = require("./(JWT-guarded)/insights.service");
const insights_admin_service_1 = require("./(JWT-guarded)/insights-admin.service");
const insights_seo_service_1 = require("./(JWT-guarded)/insights-seo.service");
const insights_recommendation_service_1 = require("./(JWT-guarded)/insights-recommendation.service");
const cloudinary_module_1 = require("../cloudinary/cloudinary.module");
let InsightsModule = class InsightsModule {
};
exports.InsightsModule = InsightsModule;
exports.InsightsModule = InsightsModule = __decorate([
    (0, common_1.Module)({
        imports: [
            mongoose_1.MongooseModule.forFeature([
                { name: post_schema_1.Post.name, schema: post_schema_1.PostSchema },
                { name: category_schema_1.Category.name, schema: category_schema_1.CategorySchema },
                { name: tag_schema_1.Tag.name, schema: tag_schema_1.TagSchema },
                { name: author_profile_schema_1.AuthorProfile.name, schema: author_profile_schema_1.AuthorProfileSchema },
            ]),
            cloudinary_module_1.CloudinaryModule,
            platform_express_1.MulterModule.register({ limits: { fileSize: 10 * 1024 * 1024 } }),
        ],
        controllers: [insights_controller_1.InsightsController, insights_admin_controller_1.InsightsAdminController],
        providers: [
            insights_service_1.InsightsService,
            insights_admin_service_1.InsightsAdminService,
            insights_seo_service_1.InsightsSeoService,
            insights_recommendation_service_1.InsightsRecommendationService,
        ],
        exports: [insights_service_1.InsightsService],
    })
], InsightsModule);
//# sourceMappingURL=insights.module.js.map