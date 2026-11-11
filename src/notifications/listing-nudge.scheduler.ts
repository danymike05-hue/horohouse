import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument } from '../users/schemas/user.schema';
import { Property, ListingType, ApprovalStatus } from '../properties/schemas/property.schema';
import { Booking, BookingStatus } from '../bookings/schema/booking.schema';
import { PushNotificationsService } from './push-notifications.service';
import { listingCoverUrl } from './push-image';

/**
 * "Homes in Douala are going fast! Book <listing> before someone else does."
 *
 * Once a day, people who looked at a short-stay listing in the last few days
 * but haven't booked get one push with that listing's photo. Rules:
 *  - only if they kept "Tips and offers" on (Settings → Notifications) and push is on
 *  - at most one every NUDGE_EVERY_DAYS (default 7) per person
 *  - never for their own listing, a hidden/unapproved one, or one they've booked
 *  - nothing if they booked anything in the last 3 days (they've found a place)
 *  - "going fast" is only said when it's true: at least NUDGE_CITY_MIN
 *    (default 3) bookings in that city in the last 14 days. Otherwise a softer
 *    "Still thinking about <city>?" is sent.
 * Turn the whole thing off with LISTING_NUDGES=off.
 */
const VIEW_WINDOW_MS = 3 * 24 * 3600_000; // looked in the last 3 days…
const VIEW_MIN_AGE_MS = 2 * 3600_000; //   …but not in the last 2 hours
const DEMAND_WINDOW_MS = 14 * 24 * 3600_000;
const BATCH = 500;
const ACTIVE = [BookingStatus.PENDING, BookingStatus.CONFIRMED, BookingStatus.COMPLETED];

type Lang = 'en' | 'fr';

const TEXT: Record<Lang, {
  hotTitle: (city: string) => string;
  hotBody: (title: string) => string;
  softTitle: (city: string) => string;
  softBody: (title: string) => string;
}> = {
  en: {
    hotTitle: (c) => `Homes in ${c} are going fast!`,
    hotBody: (t) => `Book ${t} before someone else does.`,
    softTitle: (c) => `Still thinking about ${c}?`,
    softBody: (t) => `Take another look at ${t}.`,
  },
  fr: {
    hotTitle: (c) => `Les logements à ${c} partent vite !`,
    hotBody: (t) => `Réservez ${t} avant quelqu’un d’autre.`,
    softTitle: (c) => `Vous pensez toujours à ${c} ?`,
    softBody: (t) => `Jetez un nouvel œil à ${t}.`,
  },
};

@Injectable()
export class ListingNudgeScheduler {
  private readonly logger = new Logger(ListingNudgeScheduler.name);
  private running = false;

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Property.name) private propertyModel: Model<any>,
    @InjectModel(Booking.name) private bookingModel: Model<any>,
    private push: PushNotificationsService,
  ) {}

  // 18:00 in Cameroon: after work, when people plan trips
  @Cron('0 18 * * *', { name: 'listing-nudges', timeZone: 'Africa/Douala' })
  async run(): Promise<void> {
    if ((process.env.LISTING_NUDGES ?? '').toLowerCase() === 'off') return;
    if (this.running) return;
    this.running = true;
    try {
      const sent = await this.sendBatch();
      if (sent) this.logger.log(`Listing reminders sent: ${sent}`);
    } catch (err: any) {
      this.logger.error(`Listing reminders failed: ${err?.message}`);
    } finally {
      this.running = false;
    }
  }

  async sendBatch(now = new Date()): Promise<number> {
    const everyDays = Math.max(1, Number(process.env.NUDGE_EVERY_DAYS) || 7);
    const cityMin = Math.max(1, Number(process.env.NUDGE_CITY_MIN) || 3);
    const viewFrom = new Date(now.getTime() - VIEW_WINDOW_MS);
    const viewTo = new Date(now.getTime() - VIEW_MIN_AGE_MS);
    const lastNudgeBefore = new Date(now.getTime() - everyDays * 24 * 3600_000);

    const users: any[] = await this.userModel
      .find({
        isActive: { $ne: false },
        pushNotifications: { $ne: false },
        'notificationPrefs.offers': { $ne: false },
        'pushTokens.0': { $exists: true },
        recentlyViewed: { $elemMatch: { viewedAt: { $gte: viewFrom, $lte: viewTo } } },
        $or: [{ lastListingNudgeAt: { $exists: false } }, { lastListingNudgeAt: { $lte: lastNudgeBefore } }],
      })
      .select('_id recentlyViewed appLanguage')
      .limit(BATCH)
      .lean()
      .exec();
    if (!users.length) return 0;

    const cityDemand = await this.bookingsPerCity(new Date(now.getTime() - DEMAND_WINDOW_MS), cityMin);

    let sent = 0;
    for (const u of users) {
      try {
        if (await this.nudgeOne(u, now, viewFrom, viewTo, lastNudgeBefore, cityDemand, cityMin)) sent++;
      } catch (err: any) {
        this.logger.warn(`Listing reminder for ${u._id} failed: ${err?.message}`);
      }
    }
    return sent;
  }

  private async nudgeOne(
    u: any,
    now: Date,
    viewFrom: Date,
    viewTo: Date,
    lastNudgeBefore: Date,
    cityDemand: Map<string, number>,
    cityMin: number,
  ): Promise<boolean> {
    const userId = new Types.ObjectId(String(u._id));

    // Booked anything lately? Then they've found a place — leave them alone.
    const recentBooking = await this.bookingModel
      .exists({ guestId: userId, status: { $in: ACTIVE }, createdAt: { $gte: new Date(now.getTime() - 3 * 24 * 3600_000) } });
    if (recentBooking) return false;

    const viewedIds: Types.ObjectId[] = (u.recentlyViewed ?? [])
      .filter((v: any) => v?.propertyId && v.viewedAt && new Date(v.viewedAt) >= viewFrom && new Date(v.viewedAt) <= viewTo)
      .sort((a: any, b: any) => new Date(b.viewedAt).getTime() - new Date(a.viewedAt).getTime())
      .map((v: any) => v.propertyId)
      .slice(0, 10);
    if (!viewedIds.length) return false;

    const props: any[] = await this.propertyModel
      .find({
        _id: { $in: viewedIds },
        isActive: true,
        approvalStatus: ApprovalStatus.APPROVED,
        listingType: ListingType.SHORT_TERM,
        ownerId: { $ne: userId },
      })
      .select('_id title city images')
      .lean()
      .exec();
    if (!props.length) return false;

    // Already holding / booked an upcoming stay there? Skip that listing.
    const booked = await this.bookingModel
      .find({
        guestId: userId,
        propertyId: { $in: props.map((p) => p._id) },
        status: { $in: [BookingStatus.PENDING, BookingStatus.CONFIRMED] },
        checkOut: { $gte: now },
      })
      .select('propertyId')
      .lean()
      .exec();
    const bookedSet = new Set(booked.map((b: any) => String(b.propertyId)));

    // Most recently viewed first, and it must have a photo
    const byId = new Map(props.map((p) => [String(p._id), p]));
    const pick = viewedIds
      .map((id) => byId.get(String(id)))
      .find((p) => p && !bookedSet.has(String(p._id)) && listingCoverUrl(p.images) && p.title && p.city);
    if (!pick) return false;

    // Claim the slot first so a crash/retry can never double-send
    const claimed = await this.userModel.updateOne(
      {
        _id: userId,
        $or: [
          { lastListingNudgeAt: { $exists: false } },
          { lastListingNudgeAt: { $lte: lastNudgeBefore } },
        ],
      },
      { $set: { lastListingNudgeAt: now } },
    );
    if (!claimed.modifiedCount) return false;

    const lang: Lang = u.appLanguage === 'en' ? 'en' : 'fr';
    const city = String(pick.city).trim();
    const title = String(pick.title).trim().slice(0, 60);
    const hot = (cityDemand.get(city.toLowerCase()) ?? 0) >= cityMin;
    const txt = TEXT[lang];

    await this.push.sendToUser(String(userId), {
      title: hot ? txt.hotTitle(city) : txt.softTitle(city),
      body: hot ? txt.hotBody(title) : txt.softBody(title),
      image: listingCoverUrl(pick.images),
      data: {
        route: `/property/${pick._id}`,
        type: 'listing_reminder',
        propertyId: String(pick._id),
      },
    });
    return true;
  }

  /** Bookings made in each city since `from` (city name lower-cased) */
  private async bookingsPerCity(from: Date, cityMin: number): Promise<Map<string, number>> {
    const perProperty: Array<{ _id: Types.ObjectId; n: number }> = await this.bookingModel.aggregate([
      { $match: { createdAt: { $gte: from }, status: { $in: ACTIVE } } },
      { $group: { _id: '$propertyId', n: { $sum: 1 } } },
    ]);
    const map = new Map<string, number>();
    if (!perProperty.length) return map;
    const cities: any[] = await this.propertyModel
      .find({ _id: { $in: perProperty.map((p) => p._id) } })
      .select('city')
      .lean()
      .exec();
    const cityOf = new Map(cities.map((c) => [String(c._id), String(c.city ?? '').trim().toLowerCase()]));
    for (const p of perProperty) {
      const c = cityOf.get(String(p._id));
      if (c) map.set(c, (map.get(c) ?? 0) + p.n);
    }
    this.logger.debug(`Cities with ≥${cityMin} recent bookings: ${[...map].filter(([, n]) => n >= cityMin).length}`);
    return map;
  }
}
