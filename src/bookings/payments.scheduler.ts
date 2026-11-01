import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Model } from 'mongoose';

import { Transaction, TransactionDocument, TransactionStatus } from 'src/payments/schemas/transaction.schema';
import { PaymentsService } from 'src/payments/services/payments.service';

/**
 * How far back to keep chasing a stuck PENDING transaction.
 * Beyond this, it's almost certainly abandoned — leave it PENDING
 * (don't auto-fail it; a human/support flow should review it).
 */
const RECONCILE_WINDOW_HOURS = 24;

/** Cap on how many transactions we check per run, to avoid hammering CamerPay */
const BATCH_SIZE = 50;

@Injectable()
export class PaymentsScheduler {
  private readonly logger = new Logger(PaymentsScheduler.name);

  constructor(
    @InjectModel(Transaction.name) private transactionModel: Model<TransactionDocument>,
    private readonly paymentsService: PaymentsService,
  ) {}

  // ════════════════════════════════════════════════════════════════════════════
  // RECONCILE STUCK PENDING TRANSACTIONS
  // ════════════════════════════════════════════════════════════════════════════

  /**
   * Every 5 minutes: re-check any PENDING transaction directly against CamerPay.
   * Safety net for webhook delivery failures and users who close the app
   * before client-side polling confirms the payment.
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async reconcilePendingTransactions(): Promise<void> {
    const cutoff = new Date(Date.now() - RECONCILE_WINDOW_HOURS * 3_600_000);

    try {
      const stale = await this.transactionModel
        .find({
          status: TransactionStatus.PENDING,
          flutterwaveTransactionId: { $exists: true, $ne: null },
          createdAt: { $gt: cutoff },
        })
        .limit(BATCH_SIZE)
        .exec();

      if (stale.length === 0) return;

      let recovered = 0;
      let failed = 0;

      for (const tx of stale) {
        try {
          const outcome = await this.paymentsService.reconcileTransaction(tx);
          if (outcome === 'success') recovered++;
          if (outcome === 'failed') failed++;
        } catch (err: any) {
          this.logger.warn(`Reconciliation check failed for tx ${tx._id}: ${err.message}`);
        }
      }

      if (recovered > 0 || failed > 0) {
        this.logger.log(
          `Reconciliation job: checked ${stale.length} pending tx(s) — ` +
          `recovered ${recovered}, marked failed ${failed}`,
        );
      }
    } catch (err: any) {
      this.logger.error(`Reconciliation job failed: ${err.message}`, err.stack);
    }
  }
}