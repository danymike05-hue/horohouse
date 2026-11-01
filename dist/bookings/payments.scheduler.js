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
var PaymentsScheduler_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentsScheduler = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const schedule_1 = require("@nestjs/schedule");
const mongoose_2 = require("mongoose");
const transaction_schema_1 = require("../payments/schemas/transaction.schema");
const payments_service_1 = require("../payments/services/payments.service");
const RECONCILE_WINDOW_HOURS = 24;
const BATCH_SIZE = 50;
let PaymentsScheduler = PaymentsScheduler_1 = class PaymentsScheduler {
    transactionModel;
    paymentsService;
    logger = new common_1.Logger(PaymentsScheduler_1.name);
    constructor(transactionModel, paymentsService) {
        this.transactionModel = transactionModel;
        this.paymentsService = paymentsService;
    }
    async reconcilePendingTransactions() {
        const cutoff = new Date(Date.now() - RECONCILE_WINDOW_HOURS * 3_600_000);
        try {
            const stale = await this.transactionModel
                .find({
                status: transaction_schema_1.TransactionStatus.PENDING,
                flutterwaveTransactionId: { $exists: true, $ne: null },
                createdAt: { $gt: cutoff },
            })
                .limit(BATCH_SIZE)
                .exec();
            if (stale.length === 0)
                return;
            let recovered = 0;
            let failed = 0;
            for (const tx of stale) {
                try {
                    const outcome = await this.paymentsService.reconcileTransaction(tx);
                    if (outcome === 'success')
                        recovered++;
                    if (outcome === 'failed')
                        failed++;
                }
                catch (err) {
                    this.logger.warn(`Reconciliation check failed for tx ${tx._id}: ${err.message}`);
                }
            }
            if (recovered > 0 || failed > 0) {
                this.logger.log(`Reconciliation job: checked ${stale.length} pending tx(s) — ` +
                    `recovered ${recovered}, marked failed ${failed}`);
            }
        }
        catch (err) {
            this.logger.error(`Reconciliation job failed: ${err.message}`, err.stack);
        }
    }
};
exports.PaymentsScheduler = PaymentsScheduler;
__decorate([
    (0, schedule_1.Cron)(schedule_1.CronExpression.EVERY_5_MINUTES),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], PaymentsScheduler.prototype, "reconcilePendingTransactions", null);
exports.PaymentsScheduler = PaymentsScheduler = PaymentsScheduler_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(transaction_schema_1.Transaction.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        payments_service_1.PaymentsService])
], PaymentsScheduler);
//# sourceMappingURL=payments.scheduler.js.map