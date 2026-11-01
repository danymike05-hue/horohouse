import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  ListingBoost,
  ListingBoostDocument,
  BoostType,
  BoostStatus,
} from '../schemas/listing-boost.schema';
import { Transaction, TransactionDocument, TransactionType } from '../schemas/transaction.schema';
import { Property, PropertyDocument } from '../../properties/schemas/property.schema';
import { CreateListingBoostDto } from '../dto/payment.dto';

@Injectable()
export class ListingBoostService {
  private readonly logger = new Logger(ListingBoostService.name);

  // Boost pricing in XAF
  private readonly BOOST_PRICING = {
    [BoostType.STANDARD]: {
      24: 2000,   // 24 hours
      168: 10000, // 7 days
      720: 35000, // 30 days
    },
    [BoostType.FEATURED]: {
      24: 5000,
      168: 25000,
      720: 80000,
    },
    [BoostType.HOMEPAGE]: {
      24: 10000,
      168: 50000,
      720: 150000,
    },
    [BoostType.SOCIAL_MEDIA]: {
      24: 3000,
      168: 15000,
      720: 45000,
    },
  };

  constructor(
    @InjectModel(ListingBoost.name) private listingBoostModel: Model<ListingBoostDocument>,
    @InjectModel(Transaction.name) private transactionModel: Model<TransactionDocument>,
    @InjectModel(Property.name) private propertyModel: Model<PropertyDocument>,
  ) {}

  /**
   * Get boost pricing
   */
  getBoostPricing(boostType: BoostType, duration: number): number {
    const pricing = this.BOOST_PRICING[boostType];
    
    if (!pricing) {
      throw new BadRequestException('Invalid boost type');
    }

    // Find closest duration or calculate proportionally
    if (pricing[duration]) {
      return pricing[duration];
    }

    // Calculate proportional price for custom durations
    const basePrice = pricing[24]; // 24-hour base price
    return Math.ceil((duration / 24) * basePrice);
  }

  /**
   * Get available boost options
   */
  getBoostOptions() {
    return Object.entries(this.BOOST_PRICING).map(([boostType, durations]) => ({
      type: boostType,
      description: this.getBoostDescription(boostType as BoostType),
      pricing: Object.entries(durations).map(([hours, price]) => ({
        duration: parseInt(hours),
        durationLabel: this.formatDuration(parseInt(hours)),
        price,
      })),
    }));
  }

  /**
   * Create boost request
   */
  async createBoostRequest(
    userId: string,
    dto: CreateListingBoostDto,
  ): Promise<{ boost: ListingBoost; price: number }> {
    // Validate property exists and user owns it
    const property = await this.propertyModel.findById(dto.propertyId);

    if (!property) {
      throw new NotFoundException('Property not found');
    }

    if (property.ownerId.toString() !== userId && property.agentId?.toString() !== userId) {
      throw new BadRequestException('You can only boost your own properties');
    }

    // Check for existing active boost
    const existingBoost = await this.listingBoostModel.findOne({
      propertyId: new Types.ObjectId(dto.propertyId),
      status: BoostStatus.ACTIVE,
      endDate: { $gte: new Date() },
    });

    if (existingBoost) {
      throw new BadRequestException('Property already has an active boost');
    }

    // Calculate price
    const price = this.getBoostPricing(dto.boostType, dto.duration);

    // Create boost record
    const startDate = new Date();
    const endDate = new Date(startDate.getTime() + dto.duration * 60 * 60 * 1000);

    const boost = new this.listingBoostModel({
      propertyId: new Types.ObjectId(dto.propertyId),
      userId: new Types.ObjectId(userId),
      boostType: dto.boostType,
      status: BoostStatus.PENDING,
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

  /**
   * Activate boost after successful payment
   */
  async activateBoost(transactionId: string): Promise<ListingBoost> {
    try {
      this.logger.log(`Activating boost for transaction: ${transactionId}`);

      const transaction = await this.transactionModel.findById(transactionId);

      if (!transaction) {
        throw new NotFoundException('Transaction not found');
      }

      if (transaction.type !== TransactionType.BOOST_LISTING) {
        throw new BadRequestException('Transaction is not for listing boost');
      }

      const boostId = transaction.boostId;
      if (!boostId) {
        throw new BadRequestException('No boost associated with transaction');
      }

      const boost = await this.listingBoostModel.findById(boostId);

      if (!boost) {
        throw new NotFoundException('Boost not found');
      }

      // Activate boost
      boost.status = BoostStatus.ACTIVE;
      boost.transactionId = transaction._id as Types.ObjectId;
      boost.paymentDate = new Date();

      // Update start and end dates to now
      boost.startDate = new Date();
      boost.endDate = new Date(boost.startDate.getTime() + boost.duration * 60 * 60 * 1000);

      await boost.save();

      // Update property's featured status if needed
      if (boost.boostType === BoostType.FEATURED || boost.boostType === BoostType.HOMEPAGE) {
        await this.propertyModel.findByIdAndUpdate(boost.propertyId, {
          isFeatured: true,
        });
      }

      this.logger.log(`Boost activated: ${boost._id}`);
      return boost;
    } catch (error) {
      this.logger.error('Activate boost error:', error);
      throw error;
    }
  }

  /**
   * Get user's active boosts
   */
  async getUserBoosts(
    userId: string,
    status?: BoostStatus,
  ): Promise<ListingBoost[]> {
    const filter: any = { userId: new Types.ObjectId(userId) };
    if (status) {
      filter.status = status;
    }

    return this.listingBoostModel
      .find(filter)
      .populate('propertyId', 'title images address')
      .sort({ createdAt: -1 })
      .exec();
  }

  /**
   * Get property boost history
   */
  async getPropertyBoosts(propertyId: string): Promise<ListingBoost[]> {
    return this.listingBoostModel
      .find({ propertyId: new Types.ObjectId(propertyId) })
      .sort({ createdAt: -1 })
      .exec();
  }

  /**
   * Get active boosted properties for display
   */
  async getActiveBoostedProperties(
    boostType?: BoostType,
    limit: number = 10,
  ): Promise<ListingBoost[]> {
    const filter: any = {
      status: BoostStatus.ACTIVE,
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

  /**
   * Track boost impression
   */
  async trackImpression(boostId: string): Promise<void> {
    await this.listingBoostModel.findByIdAndUpdate(boostId, {
      $inc: { impressions: 1 },
    });
  }

  /**
   * Track boost click
   */
  async trackClick(boostId: string): Promise<void> {
    await this.listingBoostModel.findByIdAndUpdate(boostId, {
      $inc: { clicks: 1 },
    });
  }

  /**
   * Track boost inquiry
   */
  async trackInquiry(boostId: string): Promise<void> {
    await this.listingBoostModel.findByIdAndUpdate(boostId, {
      $inc: { inquiries: 1 },
    });
  }

  /**
   * Cancel boost
   */
  async cancelBoost(boostId: string, userId: string, reason: string): Promise<ListingBoost> {
    const boost = await this.listingBoostModel.findOne({
      _id: boostId,
      userId: new Types.ObjectId(userId),
    });

    if (!boost) {
      throw new NotFoundException('Boost not found');
    }

    if (boost.status === BoostStatus.EXPIRED || boost.status === BoostStatus.CANCELLED) {
      throw new BadRequestException('Boost already ended');
    }

    boost.status = BoostStatus.CANCELLED;
    boost.cancelledAt = new Date();
    boost.cancellationReason = reason;

    await boost.save();

    // Remove featured status from property if needed
    if (boost.boostType === BoostType.FEATURED || boost.boostType === BoostType.HOMEPAGE) {
      await this.propertyModel.findByIdAndUpdate(boost.propertyId, {
        isFeatured: false,
      });
    }

    this.logger.log(`Boost cancelled: ${boost._id}`);
    return boost;
  }

  /**
   * Cron job: Check and expire boosts hourly
   */
  @Cron(CronExpression.EVERY_HOUR)
  async checkExpiredBoosts(): Promise<void> {
    try {
      this.logger.log('Running boost expiration check');

      const expiredBoosts = await this.listingBoostModel.find({
        status: BoostStatus.ACTIVE,
        endDate: { $lte: new Date() },
      });

      for (const boost of expiredBoosts) {
        boost.status = BoostStatus.EXPIRED;
        await boost.save();

        // Remove featured status from property
        if (boost.boostType === BoostType.FEATURED || boost.boostType === BoostType.HOMEPAGE) {
          await this.propertyModel.findByIdAndUpdate(boost.propertyId, {
            isFeatured: false,
          });
        }

        this.logger.log(`Boost expired: ${boost._id}`);
      }

      this.logger.log(`Processed ${expiredBoosts.length} expired boosts`);
    } catch (error) {
      this.logger.error('Error checking expired boosts:', error);
    }
  }

  // ==========================================
  // PRIVATE HELPER METHODS
  // ==========================================

  private getBoostDescription(boostType: BoostType): string {
    const descriptions = {
      [BoostType.STANDARD]: 'Increase visibility in search results',
      [BoostType.FEATURED]: 'Featured in category listings',
      [BoostType.HOMEPAGE]: 'Premium placement on homepage',
      [BoostType.SOCIAL_MEDIA]: 'Promoted on our social media channels',
    };
    return descriptions[boostType];
  }

  private formatDuration(hours: number): string {
    if (hours < 24) {
      return `${hours} hours`;
    }
    const days = Math.floor(hours / 24);
    return `${days} ${days === 1 ? 'day' : 'days'}`;
  }
}