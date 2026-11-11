"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SavedSearchesModule = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const saved_searches_service_1 = require("./saved-searches.service");
const saved_searches_controller_1 = require("./saved-searches.controller");
const saved_search_schema_1 = require("./schemas/saved-search.schema");
const user_schema_1 = require("../users/schemas/user.schema");
const property_schema_1 = require("../properties/schemas/property.schema");
const email_module_1 = require("../email/email.module");
let SavedSearchesModule = class SavedSearchesModule {
};
exports.SavedSearchesModule = SavedSearchesModule;
exports.SavedSearchesModule = SavedSearchesModule = __decorate([
    (0, common_1.Module)({
        imports: [
            mongoose_1.MongooseModule.forFeature([
                { name: saved_search_schema_1.SavedSearch.name, schema: saved_search_schema_1.SavedSearchSchema },
                { name: user_schema_1.User.name, schema: user_schema_1.UserSchema },
                { name: property_schema_1.Property.name, schema: property_schema_1.PropertySchema },
            ]),
            email_module_1.EmailModule,
        ],
        controllers: [saved_searches_controller_1.SavedSearchesController],
        providers: [saved_searches_service_1.SavedSearchesService],
        exports: [saved_searches_service_1.SavedSearchesService],
    })
], SavedSearchesModule);
//# sourceMappingURL=saved-searches.module.js.map