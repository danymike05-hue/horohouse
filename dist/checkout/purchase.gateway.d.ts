import { Model } from 'mongoose';
import { TransactionDocument } from '../payments/schemas/transaction.schema';
import { ListingBoostDocument } from '../payments/schemas/listing-boost.schema';
import { WalletDocument } from '../payments/schemas/wallet.schema';
import { SubscriptionDocument } from '../payments/schemas/subscription.schema';
import { SubscriptionsService } from '../payments/services/subscriptions.service';
import { ListingBoostService } from '../payments/services/listing-boost.service';
import { WalletService } from '../payments/services/wallet.service';
import { PropertyDocument } from '../properties/schemas/property.schema';
import { UserDocument } from '../users/schemas/user.schema';
import type { CheckoutPaymentDocument, CheckoutPurchase, CheckoutPurpose } from './schemas/checkout-payment.schema';
export interface PurchaseRequest {
    purpose: Exclude<CheckoutPurpose, 'booking'>;
    planName?: string;
    billingCycle?: 'monthly' | 'quarterly' | 'yearly';
    propertyId?: string;
    boostType?: string;
    duration?: number;
}
export interface PurchaseQuote {
    amount: number;
    purchase: CheckoutPurchase;
    key: string;
    customerName?: string;
    customerPhone?: string;
}
export interface QuoteView {
    purpose: 'subscription' | 'boost';
    amount: number;
    currency: 'XAF';
    label: string;
    purchase: CheckoutPurchase;
    walletBalance: number;
    canUseWallet: boolean;
    planBoostsLeft: number;
    canUsePlanCredit: boolean;
}
export type PurchaseResult = 'activated' | 'already_done' | 'not_possible';
export declare class PurchaseGateway {
    private readonly transactions;
    private readonly boosts;
    private readonly properties;
    private readonly users;
    private readonly wallets;
    private readonly subscriptionDocs;
    private readonly subscriptions;
    private readonly listingBoosts;
    private readonly walletService;
    private readonly logger;
    constructor(transactions: Model<TransactionDocument>, boosts: Model<ListingBoostDocument>, properties: Model<PropertyDocument>, users: Model<UserDocument>, wallets: Model<WalletDocument>, subscriptionDocs: Model<SubscriptionDocument>, subscriptions: SubscriptionsService, listingBoosts: ListingBoostService, walletService: WalletService);
    quote(userId: string, req: PurchaseRequest): Promise<PurchaseQuote>;
    quoteView(userId: string, req: PurchaseRequest): Promise<QuoteView>;
    chargeWallet(userId: string, amount: number, label: string, reference: string): Promise<void>;
    refundWallet(userId: string, amount: number, label: string, reference: string): Promise<void>;
    usePlanBoost(userId: string): Promise<boolean>;
    releasePlanBoost(userId: string): Promise<void>;
    activate(payment: CheckoutPaymentDocument, save: (p: CheckoutPurchase) => Promise<void>): Promise<{
        result: PurchaseResult;
        purchase: CheckoutPurchase;
        reason?: string;
    }>;
    activeBoostFor(propertyId: string): Promise<{
        endDate?: Date;
    } | null>;
    private methodOf;
}
