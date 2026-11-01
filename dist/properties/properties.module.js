"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PropertiesModule = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const properties_service_1 = require("./properties.service");
const properties_controller_1 = require("./properties.controller");
const inquiry_service_1 = require("./inquiry.service");
const inquiry_controller_1 = require("./inquiry.controller");
const comparison_service_1 = require("./comparison.service");
const comparison_controller_1 = require("./comparison.controller");
const property_schema_1 = require("./schemas/property.schema");
const inquiry_schema_1 = require("./schemas/inquiry.schema");
const comparison_schema_1 = require("./schemas/comparison.schema");
const user_schema_1 = require("../users/schemas/user.schema");
const history_module_1 = require("../history/history.module");
const notifications_module_1 = require("../notifications/notifications.module");
const user_interactions_module_1 = require("../user-interactions/user-interactions.module");
const watermark_service_1 = require("../watermark/watermark.service");
let PropertiesModule = class PropertiesModule {
};
exports.PropertiesModule = PropertiesModule;
exports.PropertiesModule = PropertiesModule = __decorate([
    (0, common_1.Module)({
        imports: [
            mongoose_1.MongooseModule.forFeature([
                { name: property_schema_1.Property.name, schema: property_schema_1.PropertySchema },
                { name: inquiry_schema_1.Inquiry.name, schema: inquiry_schema_1.InquirySchema },
                { name: comparison_schema_1.Comparison.name, schema: comparison_schema_1.ComparisonSchema },
                { name: user_schema_1.User.name, schema: user_schema_1.UserSchema },
            ]),
            history_module_1.HistoryModule,
            notifications_module_1.NotificationsModule,
            user_interactions_module_1.UserInteractionsModule,
        ],
        controllers: [properties_controller_1.PropertiesController, inquiry_controller_1.InquiryController, comparison_controller_1.ComparisonController],
        providers: [properties_service_1.PropertiesService, inquiry_service_1.InquiryService, comparison_service_1.ComparisonService, watermark_service_1.WatermarkService],
        exports: [properties_service_1.PropertiesService, inquiry_service_1.InquiryService, comparison_service_1.ComparisonService],
    })
], PropertiesModule);
//# sourceMappingURL=properties.module.js.map