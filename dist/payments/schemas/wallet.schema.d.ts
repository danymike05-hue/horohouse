import { Document, Types } from 'mongoose';
export type WalletDocument = Wallet & Document;
export declare enum WalletTransactionType {
    CREDIT = "credit",
    DEBIT = "debit"
}
export interface WalletTransaction {
    type: WalletTransactionType;
    amount: number;
    balance: number;
    description: string;
    reference?: string;
    transactionId?: Types.ObjectId;
    createdAt: Date;
}
export declare class Wallet {
    userId: Types.ObjectId;
    balance: number;
    availableBalance: number;
    pendingBalance: number;
    totalEarned: number;
    totalDeposited?: number;
    totalWithdrawn?: number;
    transactions: WalletTransaction[];
    lastTransactionDate?: Date;
    bankAccountName?: string;
    bankAccountNumber?: string;
    bankName?: string;
    bankCode?: string;
    mobileMoneyNumber?: string;
    mobileMoneyProvider?: string;
    autoWithdrawal?: boolean;
    autoWithdrawalThreshold?: number;
    withdrawalDetails?: {
        method?: string;
        accountNumber?: string;
        accountName?: string;
        bankCode?: string;
        [key: string]: any;
    };
    metadata?: Record<string, any>;
    createdAt: Date;
    updatedAt: Date;
}
export declare const WalletSchema: import("mongoose").Schema<Wallet, import("mongoose").Model<Wallet, any, any, any, Document<unknown, any, Wallet, any, {}> & Wallet & {
    _id: Types.ObjectId;
} & {
    __v: number;
}, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, Wallet, Document<unknown, {}, import("mongoose").FlatRecord<Wallet>, {}, import("mongoose").DefaultSchemaOptions> & import("mongoose").FlatRecord<Wallet> & {
    _id: Types.ObjectId;
} & {
    __v: number;
}>;
