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

  async debitWallet(
    userId: string,
    amount: number,
    description: string,
    reference?: string,
  ): Promise<WalletDocument> {
    const wallet = await this.getWallet(userId);

    if (wallet.balance < amount) {
      throw new BadRequestException('Insufficient balance');
    }

    const tx: WalletTransaction = {
      type: WalletTransactionType.DEBIT,
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
    const wallet = await this.getWallet(userId);

    if (amount < this.MIN_WITHDRAWAL) {
      throw new BadRequestException(`Minimum withdrawal amount is ${this.MIN_WITHDRAWAL} XAF`);
    }

    const available = wallet.availableBalance ?? wallet.balance;
    if (available < amount) {
      throw new BadRequestException('Insufficient balance');
    }

    const reference = `WD-${Date.now()}`;

    // Reserve funds immediately
    await this.debitWallet(userId, amount, `Withdrawal via ${withdrawalMethod}`, reference);

    const transaction = new this.transactionModel({
      userId: new Types.ObjectId(userId),
      amount,
      currency: 'XAF',
      type: TransactionType.WALLET_WITHDRAWAL,
      status: 'pending',
      paymentMethod: withdrawalMethod,
      description: `Withdrawal to ${withdrawalMethod}`,
      flutterwaveReference: reference,
    });
    await transaction.save();

    wallet.totalWithdrawn = (wallet.totalWithdrawn ?? 0) + amount;
    await wallet.save();

    // ✅ Fire-and-forget CamerPay payout
    this.dispatchCamerPayPayout(
      amount,
      withdrawalMethod,
      accountDetails,
      reference,
      transaction._id as Types.ObjectId,
    ).catch(err =>
      this.logger.error(
        `Background CamerPay payout error (tx ${transaction._id}): ${err.message}`,
      ),
    );

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
        paymentProviderResponse: { error: error.message },
      });
      throw error;
    }
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
    const wallet = await this.getWallet(userId);
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
    const wallet = await this.getWallet(userId);
    wallet.mobileMoneyNumber = mobileMoneyDetails.phoneNumber;
    wallet.mobileMoneyProvider = mobileMoneyDetails.provider;
    await wallet.save();
    this.logger.log(`Mobile Money account updated for user: ${userId}`);
    return wallet;
  }

  async enableAutoWithdrawal(userId: string, threshold: number): Promise<WalletDocument> {
    const wallet = await this.getWallet(userId);
    if (threshold < this.MIN_WITHDRAWAL) {
      throw new BadRequestException(`Threshold must be at least ${this.MIN_WITHDRAWAL} XAF`);
    }
    wallet.autoWithdrawal = true;
    wallet.autoWithdrawalThreshold = threshold;
    await wallet.save();
    this.logger.log(`Auto-withdrawal enabled for user: ${userId}`);
    return wallet;
  }

  // ─── Queries / stats ────────────────────────────────────────────────────────

  async getTransactions(userId: string, limit = 50): Promise<WalletTransaction[]> {
    const wallet = await this.getWallet(userId);
    return wallet.transactions.slice(0, limit);
  }

  async getWalletStats(userId: string): Promise<any> {
    const wallet = await this.getWallet(userId);
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const thisMonthEarnings = wallet.transactions
      .filter(
        t => t.type === WalletTransactionType.CREDIT && t.createdAt >= startOfMonth,
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