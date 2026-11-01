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
exports.WalletController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const wallet_service_1 = require("../services/wallet.service");
const jwt_auth_guard_1 = require("../../auth/guards/jwt.auth.guard");
const roles_guard_1 = require("../../auth/guards/roles.guard");
const user_schema_1 = require("../../users/schemas/user.schema");
const payment_dto_1 = require("../dto/payment.dto");
class CreditDebitDto {
    amount;
    description;
    reference;
}
class BankDetailsDto {
    accountName;
    accountNumber;
    bankName;
    bankCode;
}
class MobileMoneyDto {
    phoneNumber;
    provider;
}
class AutoWithdrawDto {
    threshold;
}
let WalletController = class WalletController {
    walletService;
    constructor(walletService) {
        this.walletService = walletService;
    }
    async getWallet(req) {
        return this.walletService.getOrCreateWallet(req.user.id);
    }
    async creditWallet(dto, req) {
        if (!dto || !dto.amount || !dto.description) {
            throw new common_1.BadRequestException('amount and description are required');
        }
        const targetUserId = dto.userId || req.user.id;
        return this.walletService.creditWallet(targetUserId, dto.amount, dto.description, dto.reference);
    }
    async debitWallet(dto, req) {
        if (!dto || !dto.amount || !dto.description) {
            throw new common_1.BadRequestException('amount and description are required');
        }
        const targetUserId = dto.userId || req.user.id;
        return this.walletService.debitWallet(targetUserId, dto.amount, dto.description, dto.reference);
    }
    async requestWithdrawal(dto, req) {
        const accountDetails = {};
        if (dto.withdrawalMethod === 'bank_transfer') {
            accountDetails.accountNumber = dto.accountNumber;
            accountDetails.accountName = dto.accountName;
            accountDetails.bankCode = dto.bankCode;
        }
        else {
            accountDetails.phoneNumber = dto.accountNumber;
        }
        return this.walletService.requestWithdrawal(req.user.id, dto.amount, dto.withdrawalMethod, accountDetails);
    }
    async updateBankAccount(dto, req) {
        return this.walletService.updateBankAccount(req.user.id, dto);
    }
    async updateMobileMoneyAccount(dto, req) {
        return this.walletService.updateMobileMoneyAccount(req.user.id, dto);
    }
    async enableAutoWithdrawal(dto, req) {
        if (!dto || typeof dto.threshold !== 'number') {
            throw new common_1.BadRequestException('threshold is required');
        }
        return this.walletService.enableAutoWithdrawal(req.user.id, dto.threshold);
    }
    async getTransactions(req, limit) {
        const l = limit ? parseInt(limit, 10) : undefined;
        return this.walletService.getTransactions(req.user.id, l);
    }
    async getWalletStats(req) {
        return this.walletService.getWalletStats(req.user.id);
    }
};
exports.WalletController = WalletController;
__decorate([
    (0, common_1.Get)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, swagger_1.ApiOperation)({ summary: 'Get or create wallet for current user' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Wallet returned' }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], WalletController.prototype, "getWallet", null);
__decorate([
    (0, common_1.Post)('credit'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, roles_guard_1.Roles)(user_schema_1.UserRole.ADMIN),
    (0, swagger_1.ApiOperation)({ summary: 'Credit a user wallet (admin)' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Wallet credited' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [CreditDebitDto, Object]),
    __metadata("design:returntype", Promise)
], WalletController.prototype, "creditWallet", null);
__decorate([
    (0, common_1.Post)('debit'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, roles_guard_1.Roles)(user_schema_1.UserRole.ADMIN),
    (0, swagger_1.ApiOperation)({ summary: 'Debit a user wallet (admin)' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Wallet debited' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [CreditDebitDto, Object]),
    __metadata("design:returntype", Promise)
], WalletController.prototype, "debitWallet", null);
__decorate([
    (0, common_1.Post)('withdraw'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, swagger_1.ApiOperation)({ summary: 'Request a wallet withdrawal' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Withdrawal requested' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [payment_dto_1.WithdrawFundsDto, Object]),
    __metadata("design:returntype", Promise)
], WalletController.prototype, "requestWithdrawal", null);
__decorate([
    (0, common_1.Post)('bank'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, swagger_1.ApiOperation)({ summary: "Update user's bank account details" }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Bank account updated' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [BankDetailsDto, Object]),
    __metadata("design:returntype", Promise)
], WalletController.prototype, "updateBankAccount", null);
__decorate([
    (0, common_1.Post)('mobile'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, swagger_1.ApiOperation)({ summary: "Update user's mobile money details" }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Mobile money account updated' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [MobileMoneyDto, Object]),
    __metadata("design:returntype", Promise)
], WalletController.prototype, "updateMobileMoneyAccount", null);
__decorate([
    (0, common_1.Post)('auto-withdraw'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, swagger_1.ApiOperation)({ summary: 'Enable auto-withdrawal with threshold' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Auto-withdrawal enabled' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [AutoWithdrawDto, Object]),
    __metadata("design:returntype", Promise)
], WalletController.prototype, "enableAutoWithdrawal", null);
__decorate([
    (0, common_1.Get)('transactions'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, swagger_1.ApiOperation)({ summary: 'Get wallet transactions' }),
    (0, swagger_1.ApiQuery)({ name: 'limit', required: false, type: Number }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Transactions retrieved' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], WalletController.prototype, "getTransactions", null);
__decorate([
    (0, common_1.Get)('stats'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, swagger_1.ApiOperation)({ summary: 'Get wallet statistics' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Wallet stats' }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], WalletController.prototype, "getWalletStats", null);
exports.WalletController = WalletController = __decorate([
    (0, swagger_1.ApiTags)('Wallet'),
    (0, swagger_1.ApiBearerAuth)('JWT-auth'),
    (0, common_1.Controller)('wallet'),
    __metadata("design:paramtypes", [wallet_service_1.WalletService])
], WalletController);
//# sourceMappingURL=wallet.controller.js.map