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
var ListingBoostService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ListingBoostService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const schedule_1 = require("@nestjs/schedule");
const listing_boost_schema_1 = require("../schemas/listing-boost.schema");
const transaction_schema_1 = require("../schemas/transaction.schema");
const property_schema_1 = require("../../properties/schemas/property.schema");
let ListingBoostService = ListingBoostService_1 = class ListingBoostService {
    listingBoostModel;
    transactionModel;
    propertyModel;
    logger = new common_1.Logger(ListingBoostService_1.name);
    BOOST_PRICING = {
        [listing_boost_schema_1.BoostType.STANDARD]: {
            24: 2000,
            168: 10000,
            720: 35000,
        },
        [listing_boost_schema_1.BoostType.FEATURED]: {
            24: 5000,
            168: 25000,
            720: 80000,
        },
        [listing_boost_schema_1.BoostType.HOMEPAGE]: {
            24: 10000,
            168: 50000,
            720: 150000,
        },
        [listing_boost_schema_1.BoostType.SOCIAL_MEDIA]: {
            24: 3000,
            168: 15000,
            720: 45000,
        },
    };
    constructor(listingBoostModel, transactionModel, propertyModel) {
        this.listingBoostModel = listingBoostModel;
        this.transactionModel = transactionModel;
        this.propertyModel = propertyModel;
    }
    getBoostPricing(boostType, duration) {
        const pricing = this.BOOST_PRICING[boostType];
        if (!pricing) {
            throw new common_1.BadRequestException('Invalid boost type');
        }
        if (pricing[duration]) {
            return pricing[duration];
        }
        const basePrice = pricing[24];
        return Math.ceil((duration / 24) * basePrice);
    }
    getBoostOptions() {
        return Object.entries(this.BOOST_PRICING).map(([boostType, durations]) => ({
            type: boostType,
            description: this.getBoostDescription(boostType),
            pricing: Object.entries(durations).map(([hours, price]) => ({
                duration: parseInt(hours),
                durationLabel: this.formatDuration(parseInt(hours)),
                price,
            })),
        }));
    }
    async createBoostRequest(userId, dto) {
        const property = await this.propertyModel.findById(dto.propertyId);
        if (!property) {
            throw new common_1.NotFoundException('Property not found');
        }
        if (property.ownerId.toString() !== userId && property.agentId?.toString() !== userId) {
            throw new common_1.BadRequestException('You can only boost your own properties');
        }
        const existingBoost = await this.listingBoostModel.findOne({
            propertyId: new mongoose_2.Types.ObjectId(dto.propertyId),
            status: listing_boost_schema_1.BoostStatus.ACTIVE,
            endDate: { $gte: new Date() },
        });
        if (existingBoost) {
            throw new common_1.BadRequestException('Property already has an active boost');
        }
        const price = this.getBoostPricing(dto.boostType, dto.duration);
        const startDate = new Date();
        const endDate = new Date(startDate.getTime() + dto.duration * 60 * 60 * 1000);
        const boost = new this.listingBoostModel({
            propertyId: new mongoose_2.Types.ObjectId(dto.propertyId),
            userId: new mongoose_2.Types.ObjectId(userId),
            boostType: dto.boostType,
            status: listing_boost_schema_1.BoostStatus.PENDING,
            duration: dto.duration,
            price,
            currency: 'XAF',
            startDate,
            endDate,
            metadata: dto.metadata,
        });
        await boost.save();
        this.logger.log(`Boost request created: ${boost._id}`);
        return { boost, price };
    }
    async activateBoost(transactionId) {
        try {
            this.logger.log(`Activating boost for transaction: ${transactionId}`);
            const transaction = await this.transactionModel.findById(transactionId);
            if (!transaction) {
                throw new common_1.NotFoundException('Transaction not found');
            }
            if (transaction.type !== transaction_schema_1.TransactionType.BOOST_LISTING) {
                throw new common_1.BadRequestException('Transaction is not for listing boost');
            }
            const boostId = transaction.boostId;
            if (!boostId) {
                throw new common_1.BadRequestException('No boost associated with transaction');
            }
            const boost = await this.listingBoostModel.findById(boostId);
            if (!boost) {
                throw new common_1.NotFoundException('Boost not found');
            }
            boost.status = listing_boost_schema_1.BoostStatus.ACTIVE;
            boost.transactionId = transaction._id;
            boost.paymentDate = new Date();
            boost.startDate = new Date();
            boost.endDate = new Date(boost.startDate.getTime() + boost.duration * 60 * 60 * 1000);
            await boost.save();
            if (boost.boostType === listing_boost_schema_1.BoostType.FEATURED || boost.boostType === listing_boost_schema_1.BoostType.HOMEPAGE) {
                await this.propertyModel.findByIdAndUpdate(boost.propertyId, {
                    isFeatured: true,
                });
            }
            this.logger.log(`Boost activated: ${boost._id}`);
            return boost;
        }
        catch (error) {
            this.logger.error('Activate boost error:', error);
            throw error;
        }
    }
    async getUserBoosts(userId, status) {
        const filter = { userId: new mongoose_2.Types.ObjectId(userId) };
        if (status) {
            filter.status = status;
        }
        return this.listingBoostModel
            .find(filter)
            .populate('propertyId', 'title images address')
            .sort({ createdAt: -1 })
            .exec();
    }
    async getPropertyBoosts(propertyId) {
        return this.listingBoostModel
            .find({ propertyId: new mongoose_2.Types.ObjectId(propertyId) })
            .sort({ createdAt: -1 })
            .exec();
    }
    async getActiveBoostedProperties(boostType, limit = 10) {
        const filter = {
            status: listing_boost_schema_1.BoostStatus.ACTIVE,
            startDate: { $lte: new Date() },
            endDate: { $gte: new Date() },
        };
        if (boostType) {
            filter.boostType = boostType;
        }
        return this.listingBoostModel
            .find(filter)
            .populate({
            path: 'propertyId',
            populate: [
                { path: 'ownerId', select: 'name profilePicture' },
                { path: 'agentId', select: 'name profilePicture agency' },
            ],
        })
            .sort({ startDate: -1 })
            .limit(limit)
            .exec();
    }
    async trackImpression(boostId) {
        await this.listingBoostModel.findByIdAndUpdate(boostId, {
            $inc: { impressions: 1 },
        });
    }
    async trackClick(boostId) {
        await this.listingBoostModel.findByIdAndUpdate(boostId, {
            $inc: { clicks: 1 },
        });
    }
    async trackInquiry(boostId) {
        await this.listingBoostModel.findByIdAndUpdate(boostId, {
            $inc: { inquiries: 1 },
        });
    }
    async cancelBoost(boostId, userId, reason) {
        const boost = await this.listingBoostModel.findOne({
            _id: boostId,
            userId: new mongoose_2.Types.ObjectId(userId),
        });
        if (!boost) {
            throw new common_1.NotFoundException('Boost not found');
        }
        if (boost.status === listing_boost_schema_1.BoostStatus.EXPIRED || boost.status === listing_boost_schema_1.BoostStatus.CANCELLED) {
            throw new common_1.BadRequestException('Boost already ended');
        }
        boost.status = listing_boost_schema_1.BoostStatus.CANCELLED;
        boost.cancelledAt = new Date();
        boost.cancellationReason = reason;
        await boost.save();
        if (boost.boostType === listing_boost_schema_1.BoostType.FEATURED || boost.boostType === listing_boost_schema_1.BoostType.HOMEPAGE) {
            await this.propertyModel.findByIdAndUpdate(boost.propertyId, {
                isFeatured: false,
            });
        }
        this.logger.log(`Boost cancelled: ${boost._id}`);
        return boost;
    }
    async checkExpiredBoosts() {
        try {
            this.logger.log('Running boost expiration check');
            const expiredBoosts = await this.listingBoostModel.find({
                status: listing_boost_schema_1.BoostStatus.ACTIVE,
                endDate: { $lte: new Date() },
            });
            for (const boost of expiredBoosts) {
                boost.status = listing_boost_schema_1.BoostStatus.EXPIRED;
                await boost.save();
                if (boost.boostType === listing_boost_schema_1.BoostType.FEATURED || boost.boostType === listing_boost_schema_1.BoostType.HOMEPAGE) {
                    await this.propertyModel.findByIdAndUpdate(boost.propertyId, {
                        isFeatured: false,
                    });
                }
                this.logger.log(`Boost expired: ${boost._id}`);
            }
            this.logger.log(`Processed ${expiredBoosts.length} expired boosts`);
        }
        catch (error) {
            this.logger.error('Error checking expired boosts:', error);
        }
    }
    getBoostDescription(boostType) {
        const descriptions = {
            [listing_boost_schema_1.BoostType.STANDARD]: 'Increase visibility in search results',
            [listing_boost_schema_1.BoostType.FEATURED]: 'Featured in category listings',
            [listing_boost_schema_1.BoostType.HOMEPAGE]: 'Premium placement on homepage',
            [listing_boost_schema_1.BoostType.SOCIAL_MEDIA]: 'Promoted on our social media channels',
        };
        return descriptions[boostType];
    }
    formatDuration(hours) {
        if (hours < 24) {
            return `${hours} hours`;
        }
        const days = Math.floor(hours / 24);
        return `${days} ${days === 1 ? 'day' : 'days'}`;
    }
};
exports.ListingBoostService = ListingBoostService;
__decorate([
    (0, schedule_1.Cron)(schedule_1.CronExpression.EVERY_HOUR),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ListingBoostService.prototype, "checkExpiredBoosts", null);
exports.ListingBoostService = ListingBoostService = ListingBoostService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(listing_boost_schema_1.ListingBoost.name)),
    __param(1, (0, mongoose_1.InjectModel)(transaction_schema_1.Transaction.name)),
    __param(2, (0, mongoose_1.InjectModel)(property_schema_1.Property.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model])
], ListingBoostService);
//# sourceMappingURL=listing-boost.service.js.map