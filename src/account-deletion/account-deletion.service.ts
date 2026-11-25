import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model, Types } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { v2 as cloudinary } from 'cloudinary';
import '../utils/cloudinary'; // configures it
import { AppleAuth } from '../auth/apple-auth';
import { EmailService } from '../email/email.service';
import { User, UserDocument, UserRole } from '../users/schemas/user.schema';

export const DELETED_NAME = 'Deleted user';
/** Below this a wallet can't be withdrawn, so it can't hold an account back either */
const MIN_WITHDRAWAL = 5_000;

export type DeletionBlocker = 'trips' | 'guests' | 'held_money' | 'balance' | 'withdrawal' | 'leases' | 'orders' | 'shop_orders' | 'admin';

export interface DeletionCheck {
  /** What has to be settled first. Empty: the account can be deleted now. */
  blockers: { code: DeletionBlocker; count?: number; amount?: number }[];
  needsPassword: boolean;
  /** Wallet money too small to withdraw, lost with the account */
  forfeits: number;
  /** The paid plan ends now */
  hasPlan: boolean;
}

/**
 * Deleting an account for good, from the app.
 *
 * Personal data goes: name, email, phone, photo, ID documents, sign-ins, devices, saved homes,
 * searches, history, notifications, student and language profiles. What other people or the law
 * still need stays without it: past bookings, payments, leases, reviews and messages show
 * "Deleted user".
 */
@Injectable()
export class AccountDeletionService {
  private readonly logger = new Logger(AccountDeletionService.name);

  constructor(
    @InjectConnection() private readonly connection: Connection,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly appleAuth: AppleAuth,
    private readonly email: EmailService,
  ) {}

  /** A collection of another module, without importing that module */
  private model(name: string): Model<any> | null {
    return (this.connection.models as any)[name] ?? null;
  }

  private async count(name: string, filter: Record<string, any>): Promise<number> {
    const m = this.model(name);
    // Not being able to look must not read as "nothing to settle"
    if (!m) throw new Error(`Model ${name} is not registered`);
    return m.countDocuments(filter).exec();
  }

  async check(userId: string): Promise<DeletionCheck> {
    const user: any = await this.userModel.findById(userId).select('+password role deletedAt').lean().exec();
    if (!user || user.deletedAt) throw new NotFoundException('User not found');
    const me = new Types.ObjectId(userId);
    const now = new Date();
    const open = { status: { $in: ['pending', 'confirmed'] }, checkOut: { $gte: now } };

    const shop: any = await this.model('EssShop')?.findOne({ ownerId: me }).select('_id').lean().exec();
    const wallet: any = await this.model('Wallet')?.findOne({ userId: me }).select('balance pendingBalance').lean().exec();
    const openPart = { $in: ['placed', 'accepted', 'packed', 'out', 'disputed'] };

    const [trips, guests, withdrawals, leases, orders, shopOrders, plans] = await Promise.all([
      this.count('Booking', { guestId: me, ...open }),
      this.count('Booking', { hostId: me, ...open }),
      this.count('Transaction', { userId: me, type: 'wallet_withdrawal', status: 'pending' }),
      this.count('DigitalLease', { landlordUserId: me, status: { $in: ['active', 'pending_tenant'] } }),
      this.count('EssOrder', { userId: me, status: 'paid', 'parts.status': openPart }),
      shop
        ? this.count('EssOrder', {
            status: 'paid',
            parts: { $elemMatch: { shopId: shop._id, $or: [{ status: openPart }, { 'payout.status': { $in: ['held', 'ready'] } }] } },
          })
        : Promise.resolve(0),
      this.count('Subscription', { userId: me, status: { $in: ['active', 'scheduled'] }, endDate: { $gt: now } }),
    ]);

    const balance = Math.max(0, Math.floor(wallet?.balance ?? 0));
    const held = Math.max(0, Math.floor(wallet?.pendingBalance ?? 0));
    const blockers: DeletionCheck['blockers'] = [];
    if (user.role === UserRole.ADMIN) blockers.push({ code: 'admin' });
    if (trips) blockers.push({ code: 'trips', count: trips });
    if (guests) blockers.push({ code: 'guests', count: guests });
    if (held) blockers.push({ code: 'held_money', amount: held });
    if (balance >= MIN_WITHDRAWAL) blockers.push({ code: 'balance', amount: balance });
    if (withdrawals) blockers.push({ code: 'withdrawal', count: withdrawals });
    if (leases) blockers.push({ code: 'leases', count: leases });
    if (orders) blockers.push({ code: 'orders', count: orders });
    if (shopOrders) blockers.push({ code: 'shop_orders', count: shopOrders });

    return {
      blockers,
      needsPassword: !!user.password,
      forfeits: balance > 0 && balance < MIN_WITHDRAWAL ? balance : 0,
      hasPlan: plans > 0,
    };
  }

  async remove(userId: string, dto: { password?: string; confirm?: boolean }): Promise<{ message: string }> {
    const user: any = await this.userModel.findById(userId).select('+password +appleRefreshToken').exec();
    if (!user || user.deletedAt) throw new NotFoundException('User not found');

    if (user.password) {
      if (!dto.password || !(await bcrypt.compare(dto.password, user.password))) {
        // Not a 401: the app would take it for a session that ended
        throw new BadRequestException({ message: 'Incorrect password', code: 'WRONG_PASSWORD' });
      }
    } else if (dto.confirm !== true) {
      throw new BadRequestException('Confirm that you want to delete your account');
    }

    const { blockers } = await this.check(userId);
    if (blockers.length) {
      throw new ConflictException({ message: 'Some things have to be settled first', code: 'DELETION_BLOCKED', blockers });
    }

    const { email, name, profilePicture, appleRefreshToken, appLanguage } = user;
    const documents: { id: string; types: string[] }[] = [
      { id: user.identityVerification?.documentPublicId, types: ['authenticated'] },
      { id: user.hostProfile?.governmentIdPublicId, types: ['authenticated', 'upload'] },
      { id: user.studentProfile?.studentIdPublicId, types: ['authenticated', 'upload'] },
    ].filter((d) => !!d.id);
    const student: any = await this.model('StudentProfile')?.findOne({ userId: user._id }).select('studentIdPublicId').lean().exec();
    if (student?.studentIdPublicId) documents.push({ id: student.studentIdPublicId, types: ['authenticated', 'upload'] });

    // The account is closed first, so nothing new can be booked or sent while the rest goes.
    await this.closeAccount(user._id);
    await this.clearRelated(user._id, email);

    // Best effort from here: the account itself is gone
    for (const d of documents) {
      for (const type of d.types) {
        await cloudinary.uploader.destroy(d.id, { type, resource_type: 'image', invalidate: true }).catch(() => undefined);
      }
    }
    const photoId = cloudinaryId(profilePicture);
    if (photoId) await cloudinary.uploader.destroy(photoId, { resource_type: 'image', invalidate: true }).catch(() => undefined);
    if (appleRefreshToken) await this.appleAuth.revoke(appleRefreshToken);
    if (email) void this.email.sendAccountDeletedEmail(email, name, appLanguage).catch(() => undefined);

    this.logger.log(`Account ${userId} deleted by its owner`);
    return { message: 'Account deleted' };
  }

  /** Takes every personal detail off the user row and ends every session */
  private async closeAccount(id: Types.ObjectId): Promise<void> {
    const unset = (keys: string[]) => Object.fromEntries(keys.map((k) => [k, 1]));
    await this.userModel.updateOne(
      { _id: id },
      {
        $set: {
          name: DELETED_NAME,
          // "temp_" marks a number that isn't one (the field is required and unique)
          phoneNumber: `temp_deleted_${id}`,
          role: UserRole.REGISTERED_USER,
          isActive: false,
          deletedAt: new Date(),
          emailVerified: false,
          phoneVerified: false,
          sessions: [],
          pushTokens: [],
          favorites: [],
          preferences: {},
          searchHistory: [],
          recentlyViewed: [],
          tenants: [],
          paymentNumbers: [],
          blockedUsers: [],
          specialties: [],
          serviceAreas: [],
          profilePicture: null,
          hostProfile: null,
          studentProfile: null,
          agentPreferences: null,
          identityVerification: { status: 'unverified' },
          location: { type: 'Point', coordinates: [0, 0] },
          emailNotifications: false,
          smsNotifications: false,
          pushNotifications: false,
        },
        $unset: unset([
          'email', 'googleId', 'appleId', 'appleRefreshToken', 'password', 'twoFactorSecret',
          'phoneVerificationCode', 'phoneVerificationExpires', 'phoneVerificationSentAt',
          'emailVerificationToken', 'emailVerificationExpires', 'resetPasswordToken', 'resetPasswordExpires',
          'oauthCodeHash', 'oauthCodeChallenge', 'oauthCodeExpires', 'oauthCodeNewUser', 'oauthLinkHash', 'oauthLinkExpires',
          'licenseNumber', 'agency', 'bio', 'website', 'address', 'city', 'country', 'referredByAmbassador', 'referredAt',
        ]),
      } as any,
    );
  }

  /** One step failing must not stop the others: it's logged so it can be finished by hand */
  private async step(label: string, run: () => Promise<any>): Promise<void> {
    try {
      await run();
    } catch (e: any) {
      this.logger.error(`Account deletion, ${label}: ${e?.message}`);
    }
  }

  private async clearRelated(id: Types.ObjectId, email?: string): Promise<void> {
    const mine: [string, Record<string, any>][] = [
      ['Notification', { userId: id }],
      ['Wishlist', { ownerId: id }],
      ['SavedSearch', { userId: id }],
      ['Comparison', { userId: id }],
      ['UserInteraction', { userId: id }],
      ['History', { userId: id }],
      ['LeadActivity', { userId: id }],
      ['Onboarding', { userId: id }],
      ['Lead', { ownerId: id }],
      ['SavedScholarship', { userId: id }],
      ['LanguageProfile', { userId: id }],
      ['LanguageMemory', { userId: id }],
      ['LanguageFollow', { $or: [{ userId: id }, { followId: id }] }],
      ['RoommateProfile', { userId: id }],
      ['RoommateMatch', { $or: [{ initiatorId: id }, { receiverId: id }] }],
      ['StudentProfile', { userId: id }],
      ['EssCart', { userId: id }],
      ['EssInterest', { userId: id }],
      ['HostMessageTemplate', { hostId: id }],
      ['PromoCode', { hostId: id }],
      ['HostPlanState', { userId: id }],
      ['CoHost', { $or: [{ userId: id }, { invitedBy: id }] }],
      ...(email ? ([['Newsletter', { email }]] as [string, Record<string, any>][]) : []),
    ];
    for (const [name, filter] of mine) {
      await this.step(name, async () => this.model(name)?.deleteMany(filter).exec());
    }

    // The AI assistant's chats are written by the ML service
    await this.step('chat_sessions', async () => this.connection.collection('chat_sessions').deleteMany({ userId: { $in: [id, String(id)] } }));

    const change = (name: string, filter: Record<string, any>, update: Record<string, any>, options: Record<string, any> = {}) =>
      this.step(name, async () => this.model(name)?.updateMany(filter, update, options).exec());

    await change('Property', { ownerId: id }, { $set: { isActive: false }, $unset: { contactPhone: 1, contactEmail: 1 } });
    await change('Subscription', { userId: id, status: { $in: ['active', 'scheduled', 'pending'] } }, { $set: { status: 'cancelled', cancelledAt: new Date() } });
    await change('Wallet', { userId: id }, {
      $unset: { bankAccountName: 1, bankAccountNumber: 1, bankName: 1, bankCode: 1, mobileMoneyNumber: 1, mobileMoneyProvider: 1, withdrawalDetails: 1 },
      $set: { autoWithdrawal: false },
    });
    await change('Review', { userId: id }, { $set: { userName: DELETED_NAME } });
    await change('CommunityPost', { authorId: id }, {
      $set: { 'authorSnapshot.name': DELETED_NAME, 'authorSnapshot.initials': 'D', 'authorSnapshot.avatar': '', isActive: false },
    });
    await change('Inquiry', { userId: id }, { $unset: { contactEmail: 1, contactPhone: 1 } });
    await change('Appointment', { clientId: id, date: { $gt: new Date() }, status: { $in: ['scheduled', 'rescheduled'] } }, { $set: { status: 'cancelled', cancelledBy: 'client' } });
    await change('Appointment', { agentId: id, date: { $gt: new Date() }, status: { $in: ['scheduled', 'rescheduled'] } }, { $set: { status: 'cancelled', cancelledBy: 'agent' } });
    await change('Appointment', { clientId: id }, { $set: { clientName: DELETED_NAME }, $unset: { clientEmail: 1, clientPhone: 1 } });
    await change('Feedback', { userId: id }, { $unset: { userId: 1 } });
    await change('EssOrder', { userId: id }, { $set: { recipient: { name: DELETED_NAME, phone: '' }, 'delivery.address': '' }, $unset: { 'delivery.note': 1, 'delivery.district': 1 } });
    await change('EssShop', { ownerId: id }, { $set: { paused: true, status: 'suspended', statusReason: 'Owner deleted their account', phone: '', documents: [] }, $unset: { whatsapp: 1, payoutMethod: 1 } });
    await change('User', { 'hostProfile.coHostIds': id }, { $pull: { 'hostProfile.coHostIds': id } });
    await change('User', { blockedUsers: id }, { $pull: { blockedUsers: id } });
    // Leases stay as signed (a contract between two people), without this person's contact details
    await change(
      'DigitalLease',
      { 'tenants.tenantUserId': id },
      { $unset: { 'tenants.$[me].tenantEmail': 1, 'tenants.$[me].tenantPhone': 1 } },
      { arrayFilters: [{ 'me.tenantUserId': id }] },
    );
  }
}

/** …/upload/v123/profile_pictures/abc.jpg → profile_pictures/abc. Only for our own uploads. */
export function cloudinaryId(url?: string | null): string | null {
  const m = /res\.cloudinary\.com\/[^/]+\/image\/upload\/(?:.*\/)?v\d+\/(.+)\.[a-z0-9]+$/i.exec(String(url ?? ''));
  return m ? decodeURIComponent(m[1]) : null;
}
