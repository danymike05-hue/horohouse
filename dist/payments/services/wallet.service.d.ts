import { Model, Types } from 'mongoose';
import { WalletDocument, WalletTransaction } from '../schemas/wallet.schema';
import { CamerPayService } from '../services/camerpay.service';
import { TransactionDocument } from '../schemas/transaction.schema';
export declare class WalletService {
    private walletModel;
    private transactionModel;
    private camerPayService;
    private readonly logger;
    private readonly MIN_WITHDRAWAL;
    private readonly COMMISSION_RATES;
    constructor(walletModel: Model<WalletDocument>, transactionModel: Model<TransactionDocument>, camerPayService: CamerPayService);
    getOrCreateWallet(userId: string): Promise<WalletDocument>;
    getWallet(userId: string): Promise<WalletDocument>;
    creditWallet(userId: string, amount: number, description: string, reference?: string, transactionId?: Types.ObjectId): Promise<WalletDocument>;
    debitWallet(userId: string, amount: number, description: string, reference?: string): Promise<WalletDocument>;
    addCommission(agentId: string, amount: number, propertyId: string, commissionType: 'sale' | 'rental' | 'referral'): Promise<WalletDocument>;
    private calculateCommission;
    requestWithdrawal(userId: string, amount: number, withdrawalMethod: 'mtn_momo' | 'orange_money' | 'bank_transfer', accountDetails: {
        phoneNumber?: string;
        accountNumber?: string;
        accountName?: string;
        bankCode?: string;
    }): Promise<any>;
    private dispatchCamerPayPayout;
    updateBankAccount(userId: string, bankDetails: {
        accountName: string;
        accountNumber: string;
        bankName: string;
        bankCode: string;
    }): Promise<WalletDocument>;
    updateMobileMoneyAccount(userId: string, mobileMoneyDetails: {
        phoneNumber: string;
        provider: 'MTN' | 'ORANGE';
    }): Promise<WalletDocument>;
    enableAutoWithdrawal(userId: string, threshold: number): Promise<WalletDocument>;
    getTransactions(userId: string, limit?: number): Promise<WalletTransaction[]>;
    getWalletStats(userId: string): Promise<any>;
}
