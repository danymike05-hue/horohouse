import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Wallet,
  WalletDocument,
  WalletTransaction,
  WalletTransactionType,
} from '../schemas/wallet.schema';
// ✅ CamerPayService replaces FlutterwaveService
import { CamerPayService } from '../services/camerpay.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { NotificationType } from '../../notifications/schemas/notification.schema';
import { Transaction, TransactionDocument, TransactionType } from '../schemas/transaction.schema';

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);

  private readonly MIN_WITHDRAWAL = 5_000; // XAF

  private readonly COMMISSION_RATES = {
    PROPERTY_SALE: 0.05,
    PROPERTY_RENTAL: 0.10,
    REFERRAL: 0.02,
  };

  constructor(
    @InjectModel(Wallet.name) private walletModel: Model<WalletDocument>,
    @InjectModel(Transaction.name) private transactionModel: Model<TransactionDocument>,
    // ✅ Injected CamerPayService
    private camerPayService: CamerPayService,
    private notificationsService: NotificationsService,
  ) {}

  // ─── Wallet CRUD ────────────────────────────────────────────────────────────

  async getOrCreateWallet(userId: string): Promise<WalletDocument> {
    let wallet = await this.walletModel.findOne({ userId: new Types.ObjectId(userId) });
    if (!wallet) {
      wallet = new this.walletModel({
        userId: new Types.ObjectId(userId),
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

  async getWallet(userId: string): Promise<WalletDocument> {
    const wallet = await this.walletModel.findOne({ userId: new Types.ObjectId(userId) });
    if (!wallet) throw new NotFoundException('Wallet not found');
    return wallet;
  }

  async creditWallet(
    userId: string,
    amount: number,
    description: string,
    reference?: string,
    transactionId?: Types.ObjectId,
  ): Promise<WalletDocument> {
    const wallet = await this.getOrCreateWallet(userId);

    const tx: WalletTransaction = {
      type: WalletTransactionType.CREDIT,
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

  /**
   * One atomic update that only succeeds while the balance covers the amount. The old
   * read-check-save let two withdrawals sent at the same moment both pass the check.
   */
  async debitWallet(
    userId: string,
    amount: number,
    description: string,
    reference?: string,
    opts: { availableOnly?: boolean } = {},
  ): Promise<WalletDocument> {
    if (!(amount > 0)) throw new BadRequestException('Invalid amount');
    const current = await this.getWallet(userId);
    const now = new Date();
    const filter: any = { _id: current._id, balance: { $gte: amount } };
    // Withdrawals: held earnings stay put. Checked in the write itself, so two requests
    // sent at once can't both pass a check made beforehand.
    if (opts.availableOnly) {
      filter.$expr = { $gte: [{ $ifNull: ['$availableBalance', '$balance'] }, amount] };
    }
    const updated = await this.walletModel.findOneAndUpdate(
      filter,
      [
        {
          $set: {
            balance: { $subtract: ['$balance', amount] },
            availableBalance: { $max: [0, { $subtract: [{ $ifNull: ['$availableBalance', '$balance'] }, amount] }] },
            lastTransactionDate: now,
            transactions: {
              $concatArrays: [
                [{
                  type: WalletTransactionType.DEBIT,
                  amount,
                  balance: { $subtract: ['$balance', amount] },
                  // $literal: text starting with "$" must not be read as a field path
                  description: { $literal: description },
                  reference: { $literal: reference ?? null },
                  createdAt: now,
                }],
                { $ifNull: ['$transactions', []] },
              ],
            },
          },
        },
      ] as any,
      { new: true },
    );
    if (!updated) throw new BadRequestException('Insufficient balance');
    this.logger.log(`Wallet debited: ${userId} — ${amount} XAF`);
    return updated;
  }

  // ─── Held booking income ────────────────────────────────────────────────────
  // pendingBalance is kept apart from balance, so held money can't be withdrawn or
  // spent at checkout: every debit checks balance.

  /** Booking paid: the host's share waits here until it's released. */
  async holdFunds(userId: string, amount: number): Promise<void> {
    const wallet = await this.getOrCreateWallet(userId);
    await this.walletModel.updateOne({ _id: wallet._id }, { $inc: { pendingBalance: amount } });
    this.logger.log(`Wallet hold: ${userId} + ${amount} XAF`);
  }

  /** The guest was refunded: the held money never reaches the host. */
  async dropHeldFunds(userId: string, amount: number): Promise<void> {
    if (!(amount > 0)) return;
    const wallet = await this.getOrCreateWallet(userId);
    await this.walletModel.updateOne({ _id: wallet._id }, [
      { $set: { pendingBalance: { $max: [0, { $subtract: [{ $ifNull: ['$pendingBalance', 0] }, amount] }] } } },
    ] as any);
    this.logger.log(`Wallet hold dropped: ${userId} - ${amount} XAF`);
  }

  /** One atomic update: held money becomes withdrawable and counts as earned. */
  async releaseHeldFunds(userId: string, amount: number, description: string, reference?: string): Promise<void> {
    if (!(amount > 0)) throw new BadRequestException('Invalid amount');
    const wallet = await this.getOrCreateWallet(userId);
    const now = new Date();
    await this.walletModel.updateOne({ _id: wallet._id }, [
      {
        $set: {
          pendingBalance: { $max: [0, { $subtract: [{ $ifNull: ['$pendingBalance', 0] }, amount] }] },
          balance: { $add: ['$balance', amount] },
          availableBalance: { $add: [{ $ifNull: ['$availableBalance', '$balance'] }, amount] },
          totalEarned: { $add: [{ $ifNull: ['$totalEarned', 0] }, amount] },
          lastTransactionDate: now,
          transactions: {
            $concatArrays: [
              [{
                type: WalletTransactionType.CREDIT,
                amount,
                balance: { $add: ['$balance', amount] },
                description: { $literal: description },
                reference: { $literal: reference ?? null },
                createdAt: now,
              }],
              { $ifNull: ['$transactions', []] },
            ],
          },
        },
      },
    ] as any);
    this.logger.log(`Wallet hold released: ${userId} — ${amount} XAF`);
  }

  async addCommission(
    agentId: string,
    amount: number,
    propertyId: string,
    commissionType: 'sale' | 'rental' | 'referral',
  ): Promise<WalletDocument> {
    const commissionAmount = this.calculateCommission(amount, commissionType);
    return this.creditWallet(
      agentId,
      commissionAmount,
      `Commission from ${commissionType} — Property ${propertyId}`,
      `COMM-${Date.now()}`,
    );
  }

  private calculateCommission(amount: number, type: 'sale' | 'rental' | 'referral'): number {
    const rates = {
      sale: this.COMMISSION_RATES.PROPERTY_SALE,
      rental: this.COMMISSION_RATES.PROPERTY_RENTAL,
      referral: this.COMMISSION_RATES.REFERRAL,
    };
    return Math.floor(amount * (rates[type] ?? 0));
  }

  // ─── Withdrawal ─────────────────────────────────────────────────────────────

  async requestWithdrawal(
    userId: string,
    amount: number,
    withdrawalMethod: 'mtn_momo' | 'orange_money' | 'bank_transfer',
    accountDetails: {
      phoneNumber?: string;
      accountNumber?: string;
      accountName?: string;
      bankCode?: string;
    },
  ): Promise<any> {
    const wallet = await this.getOrCreateWallet(userId);

    if (!(amount > 0) || amount < this.MIN_WITHDRAWAL) {
      throw new BadRequestException(`Minimum withdrawal amount is ${this.MIN_WITHDRAWAL} XAF`);
    }

    const available = wallet.availableBalance ?? wallet.balance;
    if (available < amount) {
      throw new BadRequestException('Insufficient balance');
    }

    const reference = `WD-${new Types.ObjectId().toHexString()}`;

    // Reserve funds immediately (only from what's available, never from held earnings)
    await this.debitWallet(userId, amount, `Withdrawal via ${withdrawalMethod}`, reference, { availableOnly: true });

    // Sent somewhere other than the saved payout method: tell the owner, in case it isn't them
    const digits = (v?: string) => String(v ?? '').replace(/\D/g, '').replace(/^237/, '');
    const savedTo = withdrawalMethod === 'bank_transfer' ? wallet.bankAccountNumber : wallet.mobileMoneyNumber;
    const sentTo = withdrawalMethod === 'bank_transfer' ? accountDetails.accountNumber : accountDetails.phoneNumber;
    if (digits(sentTo) && digits(sentTo) !== digits(savedTo)) {
      const masked = `•••• ${digits(sentTo).slice(-4)}`;
      this.notificationsService.create(
        {
          userId,
          type: NotificationType.SYSTEM,
          title: 'Withdrawal to a new account',
          message: `${amount.toLocaleString('fr-FR')} XAF is being sent to ${masked}, which isn't your saved payout method. If this wasn't you, change your password and contact support now.`,
          link: '/settings/payments',
        } as any,
        {
          title: 'Retrait vers un nouveau compte',
          message: `${amount.toLocaleString('fr-FR')} XAF est envoyé vers ${masked}, qui n'est pas votre moyen de versement enregistré. Si ce n'est pas vous, changez votre mot de passe et contactez le support immédiatement.`,
        },
      ).catch((e: any) => this.logger.warn(`Withdrawal alert not sent for ${userId}: ${e?.message}`));
    }

    const transaction = new this.transactionModel({
      userId: new Types.ObjectId(userId),
      amount,
      currency: 'XAF',
      type: TransactionType.WALLET_WITHDRAWAL,
      status: 'pending',
      paymentMethod: withdrawalMethod,
      description: `Withdrawal to ${withdrawalMethod}`,
      flutterwaveReference: reference,
      // Where the money goes: the team needs it to send a payout by hand
      metadata: {
        destination: {
          method: withdrawalMethod,
          phoneNumber: accountDetails.phoneNumber,
          accountNumber: accountDetails.accountNumber,
          accountName: accountDetails.accountName,
          bankCode: accountDetails.bankCode,
        },
      },
    });
    await transaction.save();

    await this.walletModel.updateOne({ _id: wallet._id }, { $inc: { totalWithdrawn: amount } });

    // ✅ Fire-and-forget CamerPay payout
    this.dispatchCamerPayPayout(
      amount,
      withdrawalMethod,
      accountDetails,
      reference,
      transaction._id as Types.ObjectId,
    ).catch(async (err) => {
      this.logger.error(
        `Background CamerPay payout error (tx ${transaction._id}): ${err.message}`,
      );
      // The money was already taken from the wallet: give it back, or the host loses it.
      try {
        await this.creditWallet(userId, amount, `Withdrawal failed — refunded (${reference})`, `${reference}-REFUND`);
        await this.walletModel.updateOne({ _id: wallet._id }, { $inc: { totalWithdrawn: -amount, totalEarned: -amount } });
      } catch (refundErr: any) {
        this.logger.error(`URGENT: could not refund failed withdrawal ${reference} for ${userId}: ${refundErr?.message}`);
      }
    });

    this.logger.log(`Withdrawal queued: ${userId} — ${amount} XAF via ${withdrawalMethod}`);

    return {
      message: 'Withdrawal request submitted successfully',
      amount,
      withdrawalMethod,
      estimatedTime: '24–72 hours',
      transaction,
    };
  }

  /**
   * ✅ Replaces dispatchFlutterwavePayout() — uses CamerPayService.initiatePayout()
   */
  private async dispatchCamerPayPayout(
    amount: number,
    withdrawalMethod: string,
    accountDetails: {
      phoneNumber?: string;
      accountNumber?: string;
      accountName?: string;
      bankCode?: string;
    },
    reference: string,
    transactionId: Types.ObjectId,
  ): Promise<void> {
    try {
      const method = withdrawalMethod as 'mtn_momo' | 'orange_money' | 'bank_transfer';

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

      // CamerPay payouts aren't wired up yet (initiatePayout answers success: false).
      // Before, the withdrawal was marked successful anyway: the host's balance went down
      // and no money left. Now it stays pending and the team sends it by hand.
      if (!response?.success) {
        await this.transactionModel.findByIdAndUpdate(transactionId, {
          $set: {
            paymentProviderResponse: response?._raw ?? response ?? null,
            'metadata.manualPayoutNeeded': true,
          },
        });
        const to =
          withdrawalMethod === 'bank_transfer'
            ? `bank account ${accountDetails.accountNumber ?? '?'} (${accountDetails.accountName ?? ''})`
            : `${withdrawalMethod} ${accountDetails.phoneNumber ?? '?'}`;
        await this.notificationsService
          .notifyAdmins({
            title: 'Withdrawal to send by hand',
            message: `${amount.toLocaleString('fr-FR')} XAF to ${to}, reference ${reference}. Automatic payouts aren't connected yet: send it, then mark transaction ${String(transactionId)} as paid.`,
            metadata: { transactionId: String(transactionId), reference, amount, withdrawalMethod },
          })
          .catch((e: any) => this.logger.error(`Could not alert admins about withdrawal ${reference}: ${e?.message}`));
        this.logger.warn(`Withdrawal ${reference} waits for a manual payout`);
        return;
      }

      this.logger.log(`CamerPay payout accepted: ${reference}`);

      await this.transactionModel.findByIdAndUpdate(transactionId, {
        status: 'success',
        paymentProviderResponse: response._raw,
        completedAt: new Date(),
      });
    } catch (error: any) {
      this.logger.error(
        `CamerPay payout failed (tx ${transactionId}): ${error.message}`,
      );
      await this.transactionModel.findByIdAndUpdate(transactionId, {
        status: 'failed',
        paymentProviderResponse: { error: error.message },
      });
      throw error;
    }
  }

  // ─── Withdrawals sent by hand (admin) ───────────────────────────────────────
  // CamerPay payouts aren't connected yet: a withdrawal waits as "pending" until the team
  // sends the money and marks it here, or gives it back to the host's balance.

  /** Withdrawals; `pending` = still to send (oldest first), the others newest first */
  async adminListWithdrawals(status: 'pending' | 'success' | 'failed' = 'pending', limit = 100) {
    const rows: any[] = await this.transactionModel
      .find({ type: TransactionType.WALLET_WITHDRAWAL, status })
      .sort({ createdAt: status === 'pending' ? 1 : -1 })
      .limit(Math.min(Math.max(limit, 1), 200))
      .populate('userId', 'name email phoneNumber profilePicture')
      .lean();
    // Older withdrawals didn't save where they go: the host's saved payout method instead
    const wallets: any[] = await this.walletModel
      .find({ userId: { $in: rows.map((r) => r.userId?._id ?? r.userId) } })
      .select('userId mobileMoneyNumber mobileMoneyProvider bankAccountNumber bankAccountName bankName')
      .lean();
    const walletOf = new Map(wallets.map((w) => [String(w.userId), w]));
    return rows.map((r) => {
      const w: any = walletOf.get(String(r.userId?._id ?? r.userId)) ?? {};
      const d = r.metadata?.destination;
      const method: string = d?.method ?? r.paymentMethod;
      const bank = method === 'bank_transfer';
      return {
        id: String(r._id),
        reference: r.flutterwaveReference,
        amount: r.amount,
        currency: r.currency ?? 'XAF',
        status: r.status,
        createdAt: r.createdAt,
        completedAt: r.completedAt,
        host:
          r.userId && typeof r.userId === 'object'
            ? { id: String(r.userId._id), name: r.userId.name, email: r.userId.email, phoneNumber: r.userId.phoneNumber, photo: r.userId.profilePicture }
            : { id: String(r.userId) },
        destination: {
          method,
          phoneNumber: d?.phoneNumber ?? (bank ? undefined : w.mobileMoneyNumber),
          accountNumber: d?.accountNumber ?? (bank ? w.bankAccountNumber : undefined),
          accountName: d?.accountName ?? (bank ? w.bankAccountName : undefined),
          bankName: bank ? w.bankName : undefined,
          /** True when it comes from the saved payout method, not the withdrawal itself */
          saved: !d,
        },
        manual: r.metadata?.manual,
      };
    });
  }

  /** The team sent the money: the withdrawal is done */
  async adminMarkWithdrawalSent(transactionId: string, adminId: string, providerReference?: string, note?: string) {
    if (!Types.ObjectId.isValid(transactionId)) throw new NotFoundException('Withdrawal not found');
    const now = new Date();
    const tx = await this.transactionModel.findOneAndUpdate(
      { _id: transactionId, type: TransactionType.WALLET_WITHDRAWAL, status: 'pending' },
      {
        $set: {
          status: 'success',
          completedAt: now,
          'metadata.manualPayoutNeeded': false,
          'metadata.manual': {
            action: 'sent',
            by: adminId,
            at: now,
            providerReference: providerReference?.trim() || undefined,
            note: note?.trim() || undefined,
          },
        },
      },
      { new: true },
    );
    if (!tx) throw new BadRequestException('This withdrawal is not waiting any more (already sent or given back).');
    const amount = Math.round(tx.amount).toLocaleString('fr-FR');
    await this.notificationsService
      .create(
        {
          userId: String(tx.userId),
          type: NotificationType.SYSTEM,
          title: 'Your withdrawal was sent',
          message: `${amount} XAF is on its way to your account.`,
          link: '/host/withdraw',
          metadata: { transactionId: String(tx._id), amount: tx.amount },
        } as any,
        { title: 'Votre retrait a été envoyé', message: `${amount} XAF est en route vers votre compte.` },
      )
      .catch((e: any) => this.logger.warn(`Withdrawal sent notice failed for ${String(tx._id)}: ${e?.message}`));
    this.logger.log(`Withdrawal ${tx.flutterwaveReference} marked sent by ${adminId}`);
    return { id: String(tx._id), status: tx.status };
  }

  /** The money couldn't be sent: it goes back to the host's balance */
  async adminRefundWithdrawal(transactionId: string, adminId: string, reason?: string) {
    if (!Types.ObjectId.isValid(transactionId)) throw new NotFoundException('Withdrawal not found');
    const now = new Date();
    // Claimed first, so two clicks can't give the money back twice
    const tx = await this.transactionModel.findOneAndUpdate(
      { _id: transactionId, type: TransactionType.WALLET_WITHDRAWAL, status: 'pending' },
      {
        $set: {
          status: 'failed',
          'metadata.manualPayoutNeeded': false,
          'metadata.manual': { action: 'given_back', by: adminId, at: now, note: reason?.trim() || undefined },
        },
      },
      { new: true },
    );
    if (!tx) throw new BadRequestException('This withdrawal is not waiting any more (already sent or given back).');
    const userId = String(tx.userId);
    try {
      await this.creditWallet(userId, tx.amount, `Withdrawal not sent — back in your balance (${tx.flutterwaveReference})`, `${tx.flutterwaveReference}-REFUND`);
      // Not new earnings, and not withdrawn after all
      await this.walletModel.updateOne(
        { userId: new Types.ObjectId(userId) },
        { $inc: { totalWithdrawn: -tx.amount, totalEarned: -tx.amount } },
      );
    } catch (err) {
      await this.transactionModel.updateOne(
        { _id: tx._id, status: 'failed' },
        { $set: { status: 'pending', 'metadata.manualPayoutNeeded': true }, $unset: { 'metadata.manual': 1 } },
      );
      throw err;
    }
    const amount = Math.round(tx.amount).toLocaleString('fr-FR');
    const why = reason?.trim() ? ` ${reason.trim()}` : '';
    await this.notificationsService
      .create(
        {
          userId,
          type: NotificationType.SYSTEM,
          title: 'Your withdrawal could not be sent',
          message: `${amount} XAF is back in your balance.${why} Check your payout details and try again.`,
          link: '/settings/payments',
          metadata: { transactionId: String(tx._id), amount: tx.amount },
        } as any,
        {
          title: 'Votre retrait n’a pas pu être envoyé',
          message: `${amount} XAF est de nouveau dans votre solde.${why} Vérifiez vos informations de versement et réessayez.`,
        },
      )
      .catch((e: any) => this.logger.warn(`Withdrawal give-back notice failed for ${String(tx._id)}: ${e?.message}`));
    this.logger.log(`Withdrawal ${tx.flutterwaveReference} given back to the host by ${adminId}`);
    return { id: String(tx._id), status: tx.status };
  }

  // ─── Account details ────────────────────────────────────────────────────────

  async updateBankAccount(
    userId: string,
    bankDetails: {
      accountName: string;
      accountNumber: string;
      bankName: string;
      bankCode: string;
    },
  ): Promise<WalletDocument> {
    const wallet = await this.getOrCreateWallet(userId);
    wallet.bankAccountName = bankDetails.accountName;
    wallet.bankAccountNumber = bankDetails.accountNumber;
    wallet.bankName = bankDetails.bankName;
    wallet.bankCode = bankDetails.bankCode;
    await wallet.save();
    this.logger.log(`Bank account updated for user: ${userId}`);
    return wallet;
  }

  async updateMobileMoneyAccount(
    userId: string,
    mobileMoneyDetails: { phoneNumber: string; provider: 'MTN' | 'ORANGE' },
  ): Promise<WalletDocument> {
    const wallet = await this.getOrCreateWallet(userId);
    wallet.mobileMoneyNumber = mobileMoneyDetails.phoneNumber;
    wallet.mobileMoneyProvider = mobileMoneyDetails.provider;
    await wallet.save();
    this.logger.log(`Mobile Money account updated for user: ${userId}`);
    return wallet;
  }

  async enableAutoWithdrawal(userId: string, threshold: number): Promise<WalletDocument> {
    const wallet = await this.getOrCreateWallet(userId);
    if (threshold < this.MIN_WITHDRAWAL) {
      throw new BadRequestException(`Threshold must be at least ${this.MIN_WITHDRAWAL} XAF`);
    }
    wallet.autoWithdrawal = true;
    wallet.autoWithdrawalThreshold = threshold;
    await wallet.save();
    this.logger.log(`Auto-withdrawal enabled for user: ${userId}`);
    return wallet;
  }

  async disableAutoWithdrawal(userId: string): Promise<WalletDocument> {
    const wallet = await this.getOrCreateWallet(userId);
    wallet.autoWithdrawal = false;
    await wallet.save();
    this.logger.log(`Auto-withdrawal disabled for user: ${userId}`);
    return wallet;
  }

  // ─── Queries / stats ────────────────────────────────────────────────────────

  // A host with no earnings yet has no wallet: these used to answer 404 "Wallet not found",
  // which showed "Some data couldn't be loaded" on every new host's dashboard.
  /** Newest first. from/to (to exclusive) narrow it to a period, e.g. one week or month. */
  async getTransactions(userId: string, limit = 50, from?: Date, to?: Date): Promise<WalletTransaction[]> {
    const wallet = await this.getOrCreateWallet(userId);
    if (!from && !to) return wallet.transactions.slice(0, limit);
    const fromMs = from ? from.getTime() : -Infinity;
    const toMs = to ? to.getTime() : Infinity;
    return wallet.transactions
      .filter((t) => {
        const at = new Date(t.createdAt).getTime();
        return at >= fromMs && at < toMs;
      })
      .slice(0, limit);
  }

  async getWalletStats(userId: string): Promise<any> {
    const wallet = await this.getOrCreateWallet(userId);
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const thisMonthEarnings = wallet.transactions
      .filter(
        t => t.type === WalletTransactionType.CREDIT && new Date(t.createdAt) >= startOfMonth,
      )
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
}