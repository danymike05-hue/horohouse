import { ListingBoostService } from '../services/listing-boost.service';
import { CreateListingBoostDto } from '../dto/payment.dto';
import { BoostType, BoostStatus } from '../schemas/listing-boost.schema';
declare class PricingQuery {
    boostType?: BoostType;
    duration?: number;
}
declare class CancelDto {
    reason: string;
}
export declare class ListingBoostController {
    private readonly listingBoostService;
    constructor(listingBoostService: ListingBoostService);
    getOptions(): {
        type: string;
        description: string;
        pricing: {
            duration: number;
            durationLabel: string;
            price: number;
        }[];
    }[];
    getPricing(q: PricingQuery): {
        price: number;
    };
    createBoost(dto: CreateListingBoostDto, req: any): Promise<{
        boost: import("../schemas/listing-boost.schema").ListingBoost;
        price: number;
    }>;
    activateBoost(transactionId: string): Promise<import("../schemas/listing-boost.schema").ListingBoost>;
    getUserBoosts(req: any, status?: BoostStatus): Promise<import("../schemas/listing-boost.schema").ListingBoost[]>;
    getPropertyBoosts(propertyId: string): Promise<import("../schemas/listing-boost.schema").ListingBoost[]>;
    getActiveBoostedProperties(boostType?: BoostType, limit?: string): Promise<import("../schemas/listing-boost.schema").ListingBoost[]>;
    trackImpression(boostId: string): Promise<{
        status: string;
    }>;
    trackClick(boostId: string): Promise<{
        status: string;
    }>;
    trackInquiry(boostId: string): Promise<{
        status: string;
    }>;
    cancelBoost(boostId: string, req: any, dto: CancelDto): Promise<import("../schemas/listing-boost.schema").ListingBoost>;
}
export {};
