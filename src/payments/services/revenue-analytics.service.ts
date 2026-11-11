import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  Transaction,
  TransactionDocument,
  TransactionStatus,
  TransactionType,
} from '../schemas/transaction.schema';
import { Subscription, SubscriptionDocument, SubscriptionStatus } from '../schemas/subscription.schema';
import { ListingBoost, ListingBoostDocument } from '../schemas/listing-boost.schema';

export interface RevenueAnalytics {
  totalRevenue: number;
  monthlyRevenue: number;
  yearlyRevenue: number;
  todayRevenue: number;
  
  // Transaction stats
  totalTransactions: number;
  successfulTransactions: number;
  failedTransactions: number;
  pendingTransactions: number;
  averageTransactionValue: number;
  
  // Revenue breakdown
  revenueByType: {
    subscriptions: number;
    listingFees: number;
    boosts: number;
    commissions: number;
    digitalServices: number;
  };
  
  // MRR & ARR
  mrr: number; // Monthly Recurring Revenue
  arr: number; // Annual Recurring Revenue
  
  // ARPU
  arpu: number; // Average Revenue Per User
  
  // Conversion metrics
  conversionRate: number;
  
  // Growth metrics
  revenueGrowth: number; // Month-over-month growth %
  
  // Payment methods distribution
  paymentMethodsDistribution: Array<{
    method: string;
    count: number;
    revenue: number;
    percentage: number;
  }>;
}

export interface MonthlyRevenue {
  month: string;
  revenue: number;
  transactions: number;
  avgTransactionValue: number;
}

@Injectable()
export class RevenueAnalyticsService {
  private readonly logger = new Logger(RevenueAnalyticsService.name);

  constructor(
    @InjectModel(Transaction.name) private transactionModel: Model<TransactionDocument>,
    @InjectModel(Subscription.name) private subscriptionModel: Model<SubscriptionDocument>,
    @InjectModel(ListingBoost.name) private listingBoostModel: Model<ListingBoostDocument>,
  ) {}

  /**
   * Get comprehensive revenue analytics
   */
  async getRevenueAnalytics(): Promise<RevenueAnalytics> {
    try {
      this.logger.log('Generating revenue analytics');

      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startOfYear = new Date(now.getFullYear(), 0, 1);
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

      // Get all successful transactions
      const successfulTransactions = await this.transactionModel.find({
        status: TransactionStatus.SUCCESS,
      });

      const totalRevenue = successfulTransactions.reduce((sum, t) => sum + t.amount, 0);

      // Monthly revenue
      const monthlyTransactions = successfulTransactions.filter(
        t => t.completedAt && t.completedAt >= startOfMonth,
      );
      const monthlyRevenue = monthlyTransactions.reduce((sum, t) => sum + t.amount, 0);

      // Yearly revenue
      const yearlyTransactions = successfulTransactions.filter(
        t => t.completedAt && t.completedAt >= startOfYear,
      );
      const yearlyRevenue = yearlyTransactions.reduce((sum, t) => sum + t.amount, 0);

      // Today's revenue
      const todayTransactions = successfulTransactions.filter(
        t => t.completedAt && t.completedAt >= startOfDay,
      );
      const todayRevenue = todayTransactions.reduce((sum, t) => sum + t.amount, 0);

      // Transaction counts
      const allTransactions = await this.transactionModel.countDocuments();
      const successful = successfulTransactions.length;
      const failed = await this.transactionModel.countDocuments({ status: TransactionStatus.FAILED });
      const pending = await this.transactionModel.countDocuments({ status: TransactionStatus.PENDING });

      // Average transaction value
      const avgTransactionValue = successful > 0 ? totalRevenue / successful : 0;

      // Revenue by type
      const revenueByType = {
        subscriptions: 0,
        listingFees: 0,
        boosts: 0,
        commissions: 0,
        digitalServices: 0,
      };

      successfulTransactions.forEach(t => {
        switch (t.type) {
          case TransactionType.SUBSCRIPTION:
            revenueByType.subscriptions += t.amount;
            break;
          case TransactionType.LISTING_FEE:
            revenueByType.listingFees += t.amount;
            break;
          case TransactionType.BOOST_LISTING:
            revenueByType.boosts += t.amount;
            break;
          case TransactionType.COMMISSION:
            revenueByType.commissions += t.amount;
            break;
          case TransactionType.DIGITAL_SERVICE:
            revenueByType.digitalServices += t.amount;
            break;
        }
      });

      // MRR calculation
      const activeSubscriptions = await this.subscriptionModel.find({
        status: SubscriptionStatus.ACTIVE,
      });

      const mrr = activeSubscriptions.reduce((sum, sub) => {
        // Normalize to monthly
        let monthlyAmount = sub.price;
        if (sub.billingCycle === 'yearly') {
          monthlyAmount = sub.price / 12;
        } else if (sub.billingCycle === 'quarterly') {
          monthlyAmount = sub.price / 3;
        }
        return sum + monthlyAmount;
      }, 0);

      const arr = mrr * 12;

      // ARPU calculation
      const uniqueUserIds = new Set(successfulTransactions.map(t => t.userId.toString()));
      const totalUsers = uniqueUserIds.size;
      const arpu = totalUsers > 0 ? totalRevenue / totalUsers : 0;

      // Conversion rate (successful / total initiated)
      const conversionRate = allTransactions > 0 ? (successful / allTransactions) * 100 : 0;

      // Revenue growth (month-over-month)
      const lastMonthTransactions = await this.transactionModel.find({
        status: TransactionStatus.SUCCESS,
        completedAt: { $gte: lastMonth, $lte: endOfLastMonth },
      });
      const lastMonthRevenue = lastMonthTransactions.reduce((sum, t) => sum + t.amount, 0);
      const revenueGrowth = lastMonthRevenue > 0
        ? ((monthlyRevenue - lastMonthRevenue) / lastMonthRevenue) * 100
        : 0;

      // Payment methods distribution
      const paymentMethodsMap = new Map<string, { count: number; revenue: number }>();
      
      successfulTransactions.forEach(t => {
        const method = t.paymentMethod;
        const existing = paymentMethodsMap.get(method) || { count: 0, revenue: 0 };
        existing.count += 1;
        existing.revenue += t.amount;
        paymentMethodsMap.set(method, existing);
      });

      const paymentMethodsDistribution = Array.from(paymentMethodsMap.entries()).map(
        ([method, data]) => ({
          method,
          count: data.count,
          revenue: data.revenue,
          percentage: (data.revenue / totalRevenue) * 100,
        }),
      );

      return {
        totalRevenue,
        monthlyRevenue,
        yearlyRevenue,
        todayRevenue,
        totalTransactions: allTransactions,
        successfulTransactions: successful,
        failedTransactions: failed,
        pendingTransactions: pending,
        averageTransactionValue: avgTransactionValue,
        revenueByType,
        mrr,
        arr,
        arpu,
        conversionRate,
        revenueGrowth,
        paymentMethodsDistribution,
      };
    } catch (error) {
      this.logger.error('Error generating revenue analytics:', error);
      throw error;
    }
  }

  /**
   * Get revenue by month for the past 12 months
   */
  async getMonthlyRevenueChart(months: number = 12): Promise<MonthlyRevenue[]> {
    try {
      const monthlyData: MonthlyRevenue[] = [];
      const now = new Date();

      for (let i = months - 1; i >= 0; i--) {
        const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);

        const transactions = await this.transactionModel.find({
          status: TransactionStatus.SUCCESS,
          completedAt: { $gte: monthStart, $lte: monthEnd },
        });

        const revenue = transactions.reduce((sum, t) => sum + t.amount, 0);
        const avgValue = transactions.length > 0 ? revenue / transactions.length : 0;

        monthlyData.push({
          month: monthStart.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
          revenue,
          transactions: transactions.length,
          avgTransactionValue: avgValue,
        });
      }

      return monthlyData;
    } catch (error) {
      this.logger.error('Error generating monthly revenue chart:', error);
      throw error;
    }
  }

  /**
   * Get subscription analytics
   */
  async getSubscriptionAnalytics() {
    try {
      const activeSubscriptions = await this.subscriptionModel.countDocuments({
        status: SubscriptionStatus.ACTIVE,
      });

      const expiredSubscriptions = await this.subscriptionModel.countDocuments({
        status: SubscriptionStatus.EXPIRED,
      });

      const cancelledSubscriptions = await this.subscriptionModel.countDocuments({
        status: SubscriptionStatus.CANCELLED,
      });

      const subscriptionsByPlan = await this.subscriptionModel.aggregate([
        { $match: { status: SubscriptionStatus.ACTIVE } },
        { $group: { _id: '$plan', count: { $sum: 1 } } },
      ]);

      const churnRate = (expiredSubscriptions + cancelledSubscriptions) > 0
        ? (cancelledSubscriptions / (activeSubscriptions + expiredSubscriptions + cancelledSubscriptions)) * 100
        : 0;

      return {
        activeSubscriptions,
        expiredSubscriptions,
        cancelledSubscriptions,
        subscriptionsByPlan,
        churnRate,
      };
    } catch (error) {
      this.logger.error('Error generating subscription analytics:', error);
      throw error;
    }
  }

  /**
   * Get listing boost analytics
   */
  async getBoostAnalytics() {
    try {
      const totalBoosts = await this.listingBoostModel.countDocuments();
      const activeBoosts = await this.listingBoostModel.countDocuments({
        status: { $eq: 'active' } as any,
      });

      const boostsByType = await this.listingBoostModel.aggregate([
        { $group: { _id: '$boostType', count: { $sum: 1 } } },
      ]);

      const boostRevenue = await this.transactionModel.aggregate([
        {
          $match: {
            type: TransactionType.BOOST_LISTING,
            status: TransactionStatus.SUCCESS,
          },
        },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]);

      // Performance metrics
      const boosts = await this.listingBoostModel.find({ status: { $eq: 'active' } as any });
      const totalImpressions = boosts.reduce((sum, b) => sum + (b.impressions ?? 0), 0);
      const totalClicks = boosts.reduce((sum, b) => sum + (b.clicks ?? 0), 0);
      const avgCTR = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;

      return {
        totalBoosts,
        activeBoosts,
        boostsByType,
        boostRevenue: boostRevenue[0]?.total || 0,
        totalImpressions,
        totalClicks,
        averageCTR: avgCTR,
      };
    } catch (error) {
      this.logger.error('Error generating boost analytics:', error);
      throw error;
    }
  }

  /**
   * Get top revenue generating users
   */
  async getTopRevenueUsers(limit: number = 10) {
    try {
      return this.transactionModel.aggregate([
        { $match: { status: TransactionStatus.SUCCESS } },
        {
          $group: {
            _id: '$userId',
            totalRevenue: { $sum: '$amount' },
            transactionCount: { $sum: 1 },
          },
        },
        { $sort: { totalRevenue: -1 } },
        { $limit: limit },
        {
          $lookup: {
            from: 'users',
            localField: '_id',
            foreignField: '_id',
            as: 'user',
          },
        },
        { $unwind: '$user' },
        {
          $project: {
            userId: '$_id',
            userName: '$user.name',
            userEmail: '$user.email',
            totalRevenue: 1,
            transactionCount: 1,
          },
        },
      ]);
    } catch (error) {
      this.logger.error('Error getting top revenue users:', error);
      throw error;
    }
  }
}