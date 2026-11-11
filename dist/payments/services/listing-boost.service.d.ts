import { Model } from 'mongoose';
import { ListingBoost, ListingBoostDocument, BoostType, BoostStatus } from '../schemas/listing-boost.schema';
import { TransactionDocument } from '../schemas/transaction.schema';
import { PropertyDocument } from '../../properties/schemas/property.schema';
import { CreateListingBoostDto } from '../dto/payment.dto';
export declare class ListingBoostService {
    private listingBoostModel;
    private transactionModel;
    private propertyModel;
    private readonly logger;
    private readonly BOOST_PRICING;
    constructor(listingBoostModel: Model<ListingBoostDocument>, transactionModel: Model<TransactionDocument>, propertyModel: Model<PropertyDocument>);
    getBoostPricing(boostType: BoostType, duration: number): number;
    getBoostOptions(): {
        type: string;
        description: string;
        pricing: {
            duration: number;
            durationLabel: string;
            price: number;
        }[];
    }[];
    createBoostRequest(userId: string, dto: CreateListingBoostDto): Promise<{
        boost: ListingBoost;
        price: number;
    }>;
    activateBoost(transactionId: string): Promise<ListingBoost>;
    getUserBoosts(userId: string, status?: BoostStatus): Promise<ListingBoost[]>;
    getPropertyBoosts(propertyId: string): Promise<ListingBoost[]>;
    getActiveBoostedProperties(boostType?: BoostType, limit?: number): Promise<ListingBoost[]>;
    trackImpression(boostId: string): Promise<void>;
    trackClick(boostId: string): Promise<void>;
    trackInquiry(boostId: string): Promise<void>;
    cancelBoost(boostId: string, userId: string, reason: string): Promise<ListingBoost>;
    checkExpiredBoosts(): Promise<void>;
    private getBoostDescription;
    private formatDuration;
}
