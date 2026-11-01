import { IsOptional, IsDateString, IsIn, IsEnum } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

// ─── Query DTOs ───────────────────────────────────────────────────────────────

export class AdminDateRangeDto {
  @ApiPropertyOptional({ example: '2026-01-01', description: 'Start date (ISO 8601). Defaults to 30 days ago.' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ example: '2026-03-02', description: 'End date (ISO 8601). Defaults to today.' })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}

export class AdminAnalyticsQueryDto extends AdminDateRangeDto {
  @ApiPropertyOptional({ enum: ['day', 'week', 'month'], default: 'day' })
  @IsOptional()
  @IsIn(['day', 'week', 'month'])
  granularity?: 'day' | 'week' | 'month' = 'day';
}

export class OccupancyQueryDto extends AdminDateRangeDto {
  @ApiPropertyOptional({ description: 'Filter by property ID' })
  @IsOptional()
  propertyId?: string;

  @ApiPropertyOptional({ description: 'Filter by city' })
  @IsOptional()
  city?: string;

  @ApiPropertyOptional({ enum: ['day', 'week', 'month'], default: 'month' })
  @IsOptional()
  @IsIn(['day', 'week', 'month'])
  granularity?: 'day' | 'week' | 'month' = 'month';
}

export class RevenueQueryDto extends AdminDateRangeDto {
  @ApiPropertyOptional({ enum: ['day', 'week', 'month'], default: 'month' })
  @IsOptional()
  @IsIn(['day', 'week', 'month'])
  granularity?: 'day' | 'week' | 'month' = 'month';

  @ApiPropertyOptional({ description: 'Filter by host user ID' })
  @IsOptional()
  hostId?: string;

  @ApiPropertyOptional({ description: 'Filter by property type' })
  @IsOptional()
  propertyType?: string;
}

// ─── Response shapes (interfaces — not validated, used for typing) ─────────────

export interface PlatformKPIs {
  // Bookings
  totalBookings:       number;
  confirmedBookings:   number;
  cancelledBookings:   number;
  completedBookings:   number;
  pendingBookings:     number;
  cancellationRate:    number;   // %
  // Revenue
  grossRevenue:        number;   // sum of all booking totalAmounts
  platformFeeRevenue:  number;   // sum of serviceFee collected
  averageBookingValue: number;
  // Occupancy
  averageOccupancyRate: number;  // % across all active short-term properties
  averageNightsBooked:  number;  // mean nights per booking
  averageLeadTime:      number;  // mean days between createdAt and checkIn
  // Guests & hosts
  totalGuests:          number;  // unique guestIds in confirmed/completed bookings
  totalHosts:           number;  // unique hostIds with at least one booking
  newGuestsThisPeriod:  number;  // guests whose first booking falls in range
  // Reviews
  totalReviews:         number;
  averageRating:        number;
  reviewCompletionRate: number;  // % of completed bookings that have a guest review
}

export interface RevenueDataPoint {
  period:         string;   // 'YYYY-MM', 'YYYY-WW', or 'YYYY-MM-DD'
  grossRevenue:   number;
  platformFees:   number;
  bookingCount:   number;
  averageValue:   number;
}

export interface OccupancyDataPoint {
  period:        string;
  occupancyRate: number;   // %
  nightsBooked:  number;
  nightsAvailable: number;
  propertyCount: number;
}

export interface TopProperty {
  propertyId:    string;
  title:         string;
  city:          string;
  type:          string;
  hostName:      string;
  bookingCount:  number;
  revenue:       number;
  occupancyRate: number;
  averageRating: number;
  reviewCount:   number;
}

export interface BookingStatusBreakdown {
  status:     string;
  count:      number;
  percentage: number;
  revenue:    number;
}

export interface PropertyTypeBreakdown {
  type:          string;
  bookingCount:  number;
  revenue:       number;
  occupancyRate: number;
  averageRating: number;
  percentage:    number;   // % of total bookings
}

export interface CityPerformance {
  city:          string;
  bookingCount:  number;
  revenue:       number;
  propertyCount: number;
  averageRating: number;
  occupancyRate: number;
}

export interface HostLeaderboard {
  hostId:       string;
  hostName:     string;
  bookingCount: number;
  revenue:      number;
  averageRating: number;
  propertyCount: number;
  cancellationRate: number;
}

export interface AdminDashboardAnalytics {
  kpis:                   PlatformKPIs;
  revenueOverTime:        RevenueDataPoint[];
  occupancyOverTime:      OccupancyDataPoint[];
  bookingStatusBreakdown: BookingStatusBreakdown[];
  propertyTypeBreakdown:  PropertyTypeBreakdown[];
  topProperties:          TopProperty[];
  cityPerformance:        CityPerformance[];
  hostLeaderboard:        HostLeaderboard[];
  period: {
    startDate: string;
    endDate:   string;
  };
}