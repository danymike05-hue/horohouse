// The deletion reaches other modules' collections by name: this runs its real filters and
// updates through their real schemas, so a renamed field or collection fails here rather
// than silently leaving someone's data behind.
import * as mongoose from 'mongoose';
import { AccountDeletionService } from './account-deletion.service';
import { User, UserSchema } from '../users/schemas/user.schema';
import { Property, PropertySchema } from '../properties/schemas/property.schema';
import { Comparison, ComparisonSchema } from '../properties/schemas/comparison.schema';
import { Inquiry, InquirySchema } from '../properties/schemas/inquiry.schema';
import { Booking, BookingSchema } from '../bookings/schema/booking.schema';
import { Transaction, TransactionSchema } from '../payments/schemas/transaction.schema';
import { Wallet, WalletSchema } from '../payments/schemas/wallet.schema';
import { Subscription, SubscriptionSchema } from '../payments/schemas/subscription.schema';
import { DigitalLease, DigitalLeaseSchema } from '../digital-lease/schemas/digital-lease.schema';
import { EssCart, EssCartSchema, EssInterest, EssInterestSchema, EssOrder, EssOrderSchema, EssShop, EssShopSchema } from '../essentials/schemas/essentials.schema';
import { Notification, NotificationSchema } from '../notifications/schemas/notification.schema';
import { Wishlist, WishlistSchema } from '../wishlists/wishlist.schema';
import { SavedSearch, SavedSearchSchema } from '../saved-searches/schemas/saved-search.schema';
import { UserInteraction, UserInteractionSchema } from '../user-interactions/schemas/user-interaction.schema';
import { History, HistorySchema } from '../history/schemas/history.schema';
import { LeadActivity, LeadActivitySchema } from '../ai-chat/schema/lead-activity.schema';
import { Onboarding, OnboardingSchema } from '../onboarding/schemas/onboarding.schema';
import { Lead, LeadSchema } from '../leads/schemas/lead.schema';
import { SavedScholarship, SavedScholarshipSchema } from '../scholarships/schemas/scholarship.schema';
import { LanguageFollow, LanguageFollowSchema, LanguageMemory, LanguageMemorySchema, LanguageProfile, LanguageProfileSchema } from '../languages/schemas/language.schemas';
import { RoommateProfile, RoommateProfileSchema } from '../roommate/schemas/roommate-profile.schema';
import { RoommateMatch, RoommateMatchSchema } from '../roommate/schemas/roommate-match.schema';
import { StudentProfile, StudentProfileSchema } from '../student-profiles/schemas/student-profile.schema';
import { HostMessageTemplate, HostMessageTemplateSchema } from '../host-messages/schemas/host-message.schema';
import { PromoCode, PromoCodeSchema } from '../host-plans/promo-codes.service';
import { HostPlanState, HostPlanStateSchema } from '../host-plans/schemas/host-plan-state.schema';
import { CoHost, CoHostSchema } from '../co-hosts/schemas/co-host.schema';
import { Newsletter, NewsletterSchema } from '../newsletter/schemas/newsletter.schema';
import { Review, ReviewSchema } from '../reviews/schemas/review.schema';
import { CommunityPost, CommunityPostSchema } from '../community/schemas/community-post.schema';
import { Appointment, AppointmentSchema } from '../appointments/schemas/appointment.schema';
import { Feedback, FeedbackSchema } from '../feedback/feedback.schema';

const REAL: [any, mongoose.Schema][] = [
  [User, UserSchema], [Property, PropertySchema], [Comparison, ComparisonSchema], [Inquiry, InquirySchema], [Booking, BookingSchema],
  [Transaction, TransactionSchema], [Wallet, WalletSchema], [Subscription, SubscriptionSchema], [DigitalLease, DigitalLeaseSchema],
  [EssCart, EssCartSchema], [EssInterest, EssInterestSchema], [EssOrder, EssOrderSchema], [EssShop, EssShopSchema],
  [Notification, NotificationSchema], [Wishlist, WishlistSchema], [SavedSearch, SavedSearchSchema], [UserInteraction, UserInteractionSchema],
  [History, HistorySchema], [LeadActivity, LeadActivitySchema], [Onboarding, OnboardingSchema], [Lead, LeadSchema],
  [SavedScholarship, SavedScholarshipSchema], [LanguageFollow, LanguageFollowSchema], [LanguageMemory, LanguageMemorySchema],
  [LanguageProfile, LanguageProfileSchema], [RoommateProfile, RoommateProfileSchema], [RoommateMatch, RoommateMatchSchema],
  [StudentProfile, StudentProfileSchema], [HostMessageTemplate, HostMessageTemplateSchema], [PromoCode, PromoCodeSchema],
  [HostPlanState, HostPlanStateSchema], [CoHost, CoHostSchema], [Newsletter, NewsletterSchema], [Review, ReviewSchema],
  [CommunityPost, CommunityPostSchema], [Appointment, AppointmentSchema], [Feedback, FeedbackSchema],
] as any;

/** Plain keys of a filter, inside $or and $elemMatch too */
function paths(filter: any, prefix = ''): string[] {
  return Object.entries(filter).flatMap(([k, v]: [string, any]) => {
    if (k === '$or' || k === '$and') return v.flatMap((x: any) => paths(x, prefix));
    if (v && typeof v === 'object' && v.$elemMatch) return paths(v.$elemMatch, `${prefix}${k}.`);
    return [`${prefix}${k}`];
  });
}

describe('account deletion and the real schemas', () => {
  const connection = mongoose.createConnection(); // never connected
  for (const [cls, schema] of REAL) {
    schema.set('autoIndex', false);
    schema.set('autoCreate', false);
    connection.model(cls.name, schema);
  }
  const asked: { name: string; kind: string; filter: any; update?: any }[] = [];
  const unknown: string[] = [];

  /** Only records; fails for a collection that doesn't exist */
  const models = new Proxy({}, {
    get: (_t, name: string) => {
      if (!connection.models[name]) { unknown.push(String(name)); return undefined; }
      const done = (v: any) => ({ exec: () => Promise.resolve(v), select: () => ({ lean: () => ({ exec: () => Promise.resolve(v) }) }) });
      return {
        countDocuments: (filter: any) => { asked.push({ name, kind: 'count', filter }); return done(0); },
        deleteMany: (filter: any) => { asked.push({ name, kind: 'delete', filter }); return done({}); },
        updateMany: (filter: any, update: any) => { asked.push({ name, kind: 'update', filter, update }); return done({}); },
        findOne: (filter: any) => { asked.push({ name, kind: 'find', filter }); return done(name === 'EssShop' ? { _id: new mongoose.Types.ObjectId() } : null); },
      };
    },
  });

  const known = (name: string, path: string) => {
    const schema = connection.models[name].schema;
    const clean = path.replace(/\.\$\[\w+\]/g, '');
    const type = schema.pathType(clean);
    if (type !== 'adhocOrUndefined') return true;
    // Inside an untyped object (order parts, delivery…) any key is stored
    const parts = clean.split('.');
    for (let i = parts.length - 1; i > 0; i--) {
      const p: any = schema.path(parts.slice(0, i).join('.'));
      if (p) return p.instance === 'Mixed' || p.instance === 'Array' || !!p.$isMongooseDocumentArray || p.instance === 'Map';
    }
    return false;
  };

  beforeAll(async () => {
    const user = { _id: new mongoose.Types.ObjectId(), role: 'host', email: 'a@b.cm', name: 'A' };
    const userModel: any = {
      findById: () => ({ select: () => ({ lean: () => ({ exec: () => Promise.resolve(user) }), exec: () => Promise.resolve(user) }) }),
      updateOne: async (filter: any, update: any) => { asked.push({ name: 'User', kind: 'update', filter, update }); },
    };
    const service = new AccountDeletionService(
      { models, collection: () => ({ deleteMany: async () => ({}) }) } as any, userModel,
      { revoke: async () => true } as any, { sendAccountDeletedEmail: async () => undefined } as any,
    );
    (service as any).logger = { log: () => undefined, warn: () => undefined, error: (m: string) => { throw new Error(m); } };
    await service.remove(String(user._id), { confirm: true });
  });

  it('every collection it names exists', () => {
    expect(unknown).toEqual([]);
    expect(asked.length).toBeGreaterThan(40);
  });

  it('every field it filters on or changes exists', () => {
    const missing: string[] = [];
    for (const a of asked) {
      for (const p of paths(a.filter)) if (p !== '_id' && !known(a.name, p)) missing.push(`${a.name}.${p}`);
      for (const op of Object.values(a.update ?? {})) {
        for (const p of Object.keys(op as any)) if (!known(a.name, p)) missing.push(`${a.name}.${p}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it('the values it sets are accepted', () => {
    for (const a of asked.filter((x) => x.update?.$set)) {
      for (const [path, value] of Object.entries(a.update.$set)) {
        const type: any = connection.models[a.name].schema.path(path);
        if (type?.options?.enum && typeof value === 'string') expect([a.name, path, type.enumValues]).toEqual([a.name, path, expect.arrayContaining([value])]);
        if (type && value !== null) expect(() => type.castForQuery ? type.cast(value, new (connection.models[a.name] as any)()) : value).not.toThrow();
      }
    }
  });
});
