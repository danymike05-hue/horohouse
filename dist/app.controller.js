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
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const app_service_1 = require("./app.service");
const roles_guard_1 = require("./auth/guards/roles.guard");
let AppController = class AppController {
    appService;
    constructor(appService) {
        this.appService = appService;
    }
    getHealth() {
        return this.appService.getHealthStatus();
    }
    getHello() {
        return this.appService.getHello();
    }
    async testEmail() {
        const nodemailer = require('nodemailer');
        const config = {
            host: process.env.SMTP_HOST,
            port: parseInt(process.env.SMTP_PORT || '465'),
            secure: parseInt(process.env.SMTP_PORT || '465') === 465,
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
            },
        };
        console.log('SMTP config:', {
            host: config.host,
            port: config.port,
            secure: config.secure,
            user: config.auth.user,
            passLength: config.auth.pass?.length ?? 0,
        });
        try {
            const transporter = nodemailer.createTransport(config);
            await transporter.verify();
            console.log('✅ SMTP connection verified');
            const info = await transporter.sendMail({
                from: process.env.SMTP_USER,
                to: process.env.SMTP_USER,
                subject: 'HoroHouse SMTP Test',
                text: 'If you see this, SMTP is working on Railway.',
            });
            return { success: true, messageId: info.messageId };
        }
        catch (err) {
            console.error('❌ SMTP error:', err.message);
            return { success: false, error: err.message };
        }
    }
};
exports.AppController = AppController;
__decorate([
    (0, roles_guard_1.Public)(),
    (0, common_1.Get)('health'),
    (0, swagger_1.ApiOperation)({ summary: 'Health check endpoint' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Service is healthy' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AppController.prototype, "getHealth", null);
__decorate([
    (0, roles_guard_1.Public)(),
    (0, common_1.Get)('hello'),
    (0, swagger_1.ApiOperation)({ summary: 'Simple hello endpoint' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Returns hello message' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", String)
], AppController.prototype, "getHello", null);
__decorate([
    (0, common_1.Get)('test-email'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AppController.prototype, "testEmail", null);
exports.AppController = AppController = __decorate([
    (0, swagger_1.ApiTags)('Health'),
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [app_service_1.AppService])
], AppController);
//# sourceMappingURL=app.controller.js.map