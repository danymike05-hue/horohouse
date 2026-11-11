"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiChatModule = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const config_1 = require("@nestjs/config");
const ai_chat_controller_1 = require("./ai-chat.controller");
const ai_chat_service_1 = require("./ai-chat.service");
const property_schema_1 = require("../properties/schemas/property.schema");
const user_schema_1 = require("../users/schemas/user.schema");
const properties_module_1 = require("../properties/properties.module");
const user_interactions_module_1 = require("../user-interactions/user-interactions.module");
let AiChatModule = class AiChatModule {
};
exports.AiChatModule = AiChatModule;
exports.AiChatModule = AiChatModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule,
            mongoose_1.MongooseModule.forFeature([
                { name: property_schema_1.Property.name, schema: property_schema_1.PropertySchema },
                { name: user_schema_1.User.name, schema: user_schema_1.UserSchema },
            ]),
            properties_module_1.PropertiesModule,
            user_interactions_module_1.UserInteractionsModule,
        ],
        controllers: [ai_chat_controller_1.AiChatController],
        providers: [ai_chat_service_1.AiChatService],
        exports: [ai_chat_service_1.AiChatService],
    })
], AiChatModule);
//# sourceMappingURL=ai-chat.module.js.map