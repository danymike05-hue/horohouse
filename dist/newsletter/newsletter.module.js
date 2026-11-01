"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NewsletterModule = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const newsletter_schema_1 = require("./schemas/newsletter.schema");
const newsletter_controller_1 = require("./newsletter.controller");
const newsletter_service_1 = require("./newsletter.service");
const email_module_1 = require("../email/email.module");
let NewsletterModule = class NewsletterModule {
};
exports.NewsletterModule = NewsletterModule;
exports.NewsletterModule = NewsletterModule = __decorate([
    (0, common_1.Module)({
        imports: [
            mongoose_1.MongooseModule.forFeature([{ name: newsletter_schema_1.Newsletter.name, schema: newsletter_schema_1.NewsletterSchema }]),
            email_module_1.EmailModule,
        ],
        controllers: [newsletter_controller_1.NewsletterController],
        providers: [newsletter_service_1.NewsletterService],
    })
], NewsletterModule);
//# sourceMappingURL=newsletter.module.js.map