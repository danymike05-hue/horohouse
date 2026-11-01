import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type WalletDocument = Wallet & Document;

// Wallet Transaction Type Enum
export enum WalletTransactionType {
  CREDIT = 'credit',
  DEBIT = 'debit',
}

// Wallet Transaction Interface
export interface WalletTransaction {
  type: WalletTransactionType;
  amount: number;
  balance: number;
  description: string;
  reference?: string;
  transactionId?: Types.ObjectId;
  createdAt: Date;
}

@Schema({ timestamps: true })
export class Wallet {
  @Prop({ required: true, type: Types.ObjectId, ref: 'User', unique: true })
  userId: Types.ObjectId;

  @Prop({ default: 0 })
  balance: number;

  @Prop({ default: 0 })
  availableBalance: number; // balance available for withdrawal (after holds)

  @Prop({ default: 0 })
  pendingBalance: number; // pending transactions not yet cleared

  @Prop({ default: 0 })
  totalEarned: number;

  @Prop({ default: 0 })
  totalDeposited?: number;

  @Prop({ default: 0 })
  totalWithdrawn?: number;

  @Prop({ type: [Object], default: [] })
  transactions: WalletTransaction[];

  @Prop()
  lastTransactionDate?: Date;

  // Bank account details
  @Prop()
  bankAccountName?: string;

  @Prop()
  bankAccountNumber?: string;

  @Prop()
  bankName?: string;

  @Prop()
  bankCode?: string;

  // Mobile Money details
  @Prop()
  mobileMoneyNumber?: string;

  @Prop({ enum: ['MTN', 'ORANGE'] })
  mobileMoneyProvider?: string;

  // Auto-withdrawal settings
  @Prop({ default: false })
  autoWithdrawal?: boolean;

  @Prop()
  autoWithdrawalThreshold?: number;

  @Prop({ type: Object })
  withdrawalDetails?: {
    method?: string;
    accountNumber?: string;
    accountName?: string;
    bankCode?: string;
    [key: string]: any;
  };

  @Prop({ type: Object })
  metadata?: Record<string, any>;

  createdAt: Date;
  updatedAt: Date;
}

export const WalletSchema = SchemaFactory.createForClass(Wallet);

// Indexes to speed up lookups
WalletSchema.index({ userId: 1 });
WalletSchema.index({ balance: -1 });