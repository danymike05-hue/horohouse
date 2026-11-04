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
Object.defineProperty(exports, "__esModule", { value: true });
exports.CheckoutController = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const throttler_1 = require("@nestjs/throttler");
const jwt_auth_guard_1 = require("../auth/guards/jwt.auth.guard");
const checkout_service_1 = require("./checkout.service");
const create_checkout_payment_dto_1 = require("./dto/create-checkout-payment.dto");
const userIdOf = (req) => String(req.user?.id ?? req.user?._id ?? req.user?.sub ?? req.user?.userId);
let CheckoutController = class CheckoutController {
    checkout;
    signatureHeader;
    constructor(checkout, config) {
        this.checkout = checkout;
        this.signatureHeader = (config.get('CAMERPAY_SIGNATURE_HEADER') ?? 'x-camerpay-signature').toLowerCase();
    }
    create(req, dto) {
        return this.checkout.createPayment(userIdOf(req), dto);
    }
    get(req, id) {
        return this.checkout.getPayment(userIdOf(req), id);
    }
    cancel(req, id) {
        return this.checkout.cancelPayment(userIdOf(req), id);
    }
    webhook(req, headers) {
        return this.checkout.handleWebhook(req.rawBody, headers[this.signatureHeader]);
    }
    async returnFromProvider(paymentId) {
        return { url: await this.checkout.buildReturnRedirect(paymentId), statusCode: 302 };
    }
};
exports.CheckoutController = CheckoutController;
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Post)('payments'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_checkout_payment_dto_1.CreateCheckoutPaymentDto]),
    __metadata("design:returntype", void 0)
], CheckoutController.prototype, "create", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Get)('payments/:id'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], CheckoutController.prototype, "get", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Post)('payments/:id/cancel'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], CheckoutController.prototype, "cancel", null);
__decorate([
    (0, throttler_1.SkipThrottle)(),
    (0, common_1.Post)('webhooks/camerpay'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Headers)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], CheckoutController.prototype, "webhook", null);
__decorate([
    (0, throttler_1.SkipThrottle)(),
    (0, common_1.Get)('return'),
    (0, common_1.Redirect)(),
    __param(0, (0, common_1.Query)('paymentId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], CheckoutController.prototype, "returnFromProvider", null);
exports.CheckoutController = CheckoutController = __decorate([
    (0, common_1.Controller)('checkout'),
    __metadata("design:paramtypes", [checkout_service_1.CheckoutService, config_1.ConfigService])
], CheckoutController);
//# sourceMappingURL=checkout.controller.js.map