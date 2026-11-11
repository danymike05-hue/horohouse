import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

// ── Existing ──────────────────────────────────────────────────────────────────
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService }    from './analytics.service';
import { User,     UserSchema     } from '../users/schemas/user.schema';
import { Property, PropertySchema } from '../properties/schemas/property.schema';
import { Inquiry,  InquirySchema  } from '../properties/schemas/inquiry.schema';
import { History,  HistorySchema  } from '../history/schemas/history.schema';

// ── NEW: admin analytics layer ────────────────────────────────────────────────
import { AdminAnalyticsController } from './admin-analytics.controller';
import { AdminAnalyticsService }    from './admin-analytics.service';
import { Booking, BookingSchema }   from '../bookings/schema/booking.schema';
import { Review,  ReviewSchema  }   from '../reviews/schemas/review.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      // ── Existing schemas ──────────────────────────────────────────────────
      { name: User.name,     schema: UserSchema     },
      { name: Property.name, schema: PropertySchema },
      { name: Inquiry.name,  schema: InquirySchema  },
      { name: History.name,  schema: HistorySchema  },
      // ── NEW schemas ───────────────────────────────────────────────────────
      { name: Booking.name,  schema: BookingSchema  },
      { name: Review.name,   schema: ReviewSchema   },
    ]),
  ],
  controllers: [
    AnalyticsController,        // existing — untouched
    AdminAnalyticsController,   // NEW — mounted at /analytics/admin/*
  ],
  providers: [
    AnalyticsService,           // existing — untouched
    AdminAnalyticsService,      // NEW
  ],
  exports: [
    AnalyticsService,           // existing export preserved
    AdminAnalyticsService,      // NEW — exported in case other modules need it
  ],
})
export class AnalyticsModule {}