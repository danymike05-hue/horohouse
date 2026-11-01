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
var WalletService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.WalletService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const wallet_schema_1 = require("../schemas/wallet.schema");
const camerpay_service_1 = require("../services/camerpay.service");
const transaction_schema_1 = require("../schemas/transaction.schema");
let WalletService = WalletService_1 = class WalletService {
    walletModel;
    transactionModel;
    camerPayService;
    logger = new common_1.Logger(WalletService_1.name);
    MIN_WITHDRAWAL = 5_000;
    COMMISSION_RATES = {
        PROPERTY_SALE: 0.05,
        PROPERTY_RENTAL: 0.10,
        REFERRAL: 0.02,
    };
    constructor(walletModel, transactionModel, camerPayService) {
        this.walletModel = walletModel;
        this.transactionModel = transactionModel;
        this.camerPayService = camerPayService;
    }
    async getOrCreateWallet(userId) {
        let wallet = await this.walletModel.findOne({ userId: new mongoose_2.Types.ObjectId(userId) });
        if (!wallet) {
            wallet = new this.walletModel({
                userId: new mongoose_2.Types.ObjectId(userId),
                balance: 0,
                pendingBalance: 0,
                totalEarned: 0,
                totalWithdrawn: 0,
                transactions: [],
            });
            await wallet.save();
            this.logger.log(`Wallet created for user: ${userId}`);
        }
        return wallet;
    }
    async getWallet(userId) {
        const wallet = await this.walletModel.findOne({ userId: new mongoose_2.Types.ObjectId(userId) });
        if (!wallet)
            throw new common_1.NotFoundException('Wallet not found');
        return wallet;
    }
    async creditWallet(userId, amount, description, reference, transactionId) {
        const wallet = await this.getOrCreateWallet(userId);
        const tx = {
            type: wallet_schema_1.WalletTransactionType.CREDIT,
            amount,
            balance: wallet.balance + amount,
            description,
            reference,
            transactionId,
            createdAt: new Date(),
        };
        wallet.balance += amount;
        wallet.availableBalance = (wallet.availableBalance ?? 0) + amount;
        wallet.totalEarned += amount;
        wallet.transactions.unshift(tx);
        wallet.lastTransactionDate = new Date();
        await wallet.save();
        this.logger.log(`Wallet credited: ${userId} — ${amount} XAF`);
        return wallet;
    }
    async debitWallet(userId, amount, description, reference) {
        const wallet = await this.getWallet(userId);
        if (wallet.balance < amount) {
            throw new common_1.BadRequestException('Insufficient balance');
        }
        const tx = {
            type: wallet_schema_1.WalletTransactionType.DEBIT,
            amount,
            balance: wallet.balance - amount,
            description,
            reference,
            createdAt: new Date(),
        };
        wallet.balance -= amount;
        wallet.availableBalance = Math.max(0, (wallet.availableBalance ?? 0) - amount);
        wallet.transactions.unshift(tx);
        wallet.lastTransactionDate = new Date();
        await wallet.save();
        this.logger.log(`Wallet debited: ${userId} — ${amount} XAF`);
        return wallet;
    }
    async addCommission(agentId, amount, propertyId, commissionType) {
        const commissionAmount = this.calculateCommission(amount, commissionType);
        return this.creditWallet(agentId, commissionAmount, `Commission from ${commissionType} — Property ${propertyId}`, `COMM-${Date.now()}`);
    }
    calculateCommission(amount, type) {
        const rates = {
            sale: this.COMMISSION_RATES.PROPERTY_SALE,
            rental: this.COMMISSION_RATES.PROPERTY_RENTAL,
            referral: this.COMMISSION_RATES.REFERRAL,
        };
        return Math.floor(amount * (rates[type] ?? 0));
    }
    async requestWithdrawal(userId, amount, withdrawalMethod, accountDetails) {
        const wallet = await this.getWallet(userId);
        if (amount < this.MIN_WITHDRAWAL) {
            throw new common_1.BadRequestException(`Minimum withdrawal amount is ${this.MIN_WITHDRAWAL} XAF`);
        }
        const available = wallet.availableBalance ?? wallet.balance;
        if (available < amount) {
            throw new common_1.BadRequestException('Insufficient balance');
        }
        const reference = `WD-${Date.now()}`;
        await this.debitWallet(userId, amount, `Withdrawal via ${withdrawalMethod}`, reference);
        const transaction = new this.transactionModel({
            userId: new mongoose_2.Types.ObjectId(userId),
            amount,
            currency: 'XAF',
            type: transaction_schema_1.TransactionType.WALLET_WITHDRAWAL,
            status: 'pending',
            paymentMethod: withdrawalMethod,
            description: `Withdrawal to ${withdrawalMethod}`,
            flutterwaveReference: reference,
        });
        await transaction.save();
        wallet.totalWithdrawn = (wallet.totalWithdrawn ?? 0) + amount;
        await wallet.save();
        this.dispatchCamerPayPayout(amount, withdrawalMethod, accountDetails, reference, transaction._id).catch(err => this.logger.error(`Background CamerPay payout error (tx ${transaction._id}): ${err.message}`));
        this.logger.log(`Withdrawal queued: ${userId} — ${amount} XAF via ${withdrawalMethod}`);
        return {
            message: 'Withdrawal request submitted successfully',
            amount,
            withdrawalMethod,
            estimatedTime: '24–72 hours',
            transaction,
        };
    }
    async dispatchCamerPayPayout(amount, withdrawalMethod, accountDetails, reference, transactionId) {
        try {
            const method = withdrawalMethod;
            const response = await this.camerPayService.initiatePayout({
                amount,
                method,
                phoneNumber: accountDetails.phoneNumber,
                accountNumber: accountDetails.accountNumber,
                accountName: accountDetails.accountName,
                bankCode: accountDetails.bankCode,
                reference,
                narration: 'HoroHouse withdrawal',
            });
            this.logger.log(`CamerPay payout accepted: ${reference}`);
            await this.transactionModel.findByIdAndUpdate(transactionId, {
                status: 'success',
                paymentProviderResponse: response._raw,
                completedAt: new Date(),
            });
        }
        catch (error) {
            this.logger.error(`CamerPay payout failed (tx ${transactionId}): ${error.message}`);
            await this.transactionModel.findByIdAndUpdate(transactionId, {
                paymentProviderResponse: { error: error.message },
            });
            throw error;
        }
    }
    async updateBankAccount(userId, bankDetails) {
        const wallet = await this.getWallet(userId);
        wallet.bankAccountName = bankDetails.accountName;
        wallet.bankAccountNumber = bankDetails.accountNumber;
        wallet.bankName = bankDetails.bankName;
        wallet.bankCode = bankDetails.bankCode;
        await wallet.save();
        this.logger.log(`Bank account updated for user: ${userId}`);
        return wallet;
    }
    async updateMobileMoneyAccount(userId, mobileMoneyDetails) {
        const wallet = await this.getWallet(userId);
        wallet.mobileMoneyNumber = mobileMoneyDetails.phoneNumber;
        wallet.mobileMoneyProvider = mobileMoneyDetails.provider;
        await wallet.save();
        this.logger.log(`Mobile Money account updated for user: ${userId}`);
        return wallet;
    }
    async enableAutoWithdrawal(userId, threshold) {
        const wallet = await this.getWallet(userId);
        if (threshold < this.MIN_WITHDRAWAL) {
            throw new common_1.BadRequestException(`Threshold must be at least ${this.MIN_WITHDRAWAL} XAF`);
        }
        wallet.autoWithdrawal = true;
        wallet.autoWithdrawalThreshold = threshold;
        await wallet.save();
        this.logger.log(`Auto-withdrawal enabled for user: ${userId}`);
        return wallet;
    }
    async getTransactions(userId, limit = 50) {
        const wallet = await this.getWallet(userId);
        return wallet.transactions.slice(0, limit);
    }
    async getWalletStats(userId) {
        const wallet = await this.getWallet(userId);
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const thisMonthEarnings = wallet.transactions
            .filter(t => t.type === wallet_schema_1.WalletTransactionType.CREDIT && t.createdAt >= startOfMonth)
            .reduce((sum, t) => sum + t.amount, 0);
        return {
            balance: wallet.balance,
            availableBalance: wallet.availableBalance ?? wallet.balance,
            pendingBalance: wallet.pendingBalance,
            totalEarned: wallet.totalEarned,
            totalWithdrawn: wallet.totalWithdrawn ?? 0,
            thisMonthEarnings,
            transactionCount: wallet.transactions.length,
            lastTransactionDate: wallet.lastTransactionDate,
            autoWithdrawal: wallet.autoWithdrawal,
            autoWithdrawalThreshold: wallet.autoWithdrawalThreshold,
            bankAccountName: wallet.bankAccountName,
            bankAccountNumber: wallet.bankAccountNumber,
            bankName: wallet.bankName,
            bankCode: wallet.bankCode,
            mobileMoneyNumber: wallet.mobileMoneyNumber,
            mobileMoneyProvider: wallet.mobileMoneyProvider,
            currency: 'XAF',
        };
    }
};
exports.WalletService = WalletService;
exports.WalletService = WalletService = WalletService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(wallet_schema_1.Wallet.name)),
    __param(1, (0, mongoose_1.InjectModel)(transaction_schema_1.Transaction.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Model,
        camerpay_service_1.CamerPayService])
], WalletService);
//# sourceMappingURL=wallet.service.js.map