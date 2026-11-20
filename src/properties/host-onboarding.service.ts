import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, Logger, NotFoundException, forwardRef } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as crypto from 'crypto';
import { User, UserDocument, UserRole, OnboardingStatus } from '../users/schemas/user.schema';
import { Property, PropertyDocument } from './schemas/property.schema';
import { UsersService } from '../users/users.service';
import { EmailService } from '../email/email.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/schemas/notification.schema';

/** Accounts that can own a listing */
const OWNER_ROLES: string[] = [UserRole.HOST, UserRole.AGENT, UserRole.LANDLORD];
/** Regular accounts that are switched to a host account when the team sets up a home for them */
const UPGRADABLE_ROLES: string[] = [UserRole.REGISTERED_USER, UserRole.GUEST];
/** The "choose your password" link in the invite stays valid this long */
const INVITE_VALID_MS = 7 * 86_400_000;

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** "6 99 00 00 00", "237699000000", "+237 699…" → "+237699000000" */
export function normalizeCameroonPhone(raw: string): string {
  let p = String(raw ?? '').replace(/[^\d+]/g, '');
  if (p.startsWith('00')) p = `+${p.slice(2)}`;
  if (/^\d{9}$/.test(p)) p = `+237${p}`;
  else if (/^237\d{9}$/.test(p)) p = `+${p}`;
  if (!/^\+\d{8,15}$/.test(p)) throw new BadRequestException('Enter a valid phone number, e.g. 6 99 00 00 00');
  return p;
}

export interface HostForListing {
  id: string;
  name: string;
  email?: string;
  phoneNumber: string;
  role: string;
  /** A new account was made for them */
  created: boolean;
  /** Their regular account was switched to a host account */
  upgraded: boolean;
}

/**
 * The HoroHouse team publishing homes for hosts who don't have the time. The listing is
 * created under the host's own account (see PropertiesService.create, onBehalfOf), so
 * bookings, payouts, calendar and inbox work as if they had published it, and it stays
 * hidden until the host checks it and taps "Publish".
 */
@Injectable()
export class HostOnboardingService {
  private readonly logger = new Logger(HostOnboardingService.name);

  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Property.name) private readonly propertyModel: Model<PropertyDocument>,
    @Inject(forwardRef(() => UsersService)) private readonly usersService: UsersService,
    private readonly emailService: EmailService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Find the host's account by phone or email, or make one. Regular accounts become host accounts. */
  async findOrCreateHost(input: { name?: string; email?: string; phoneNumber: string }): Promise<HostForListing> {
    const phoneNumber = normalizeCameroonPhone(input.phoneNumber);
    const email = input.email?.trim().toLowerCase() || undefined;
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new BadRequestException('Enter a valid email address');

    const byPhone = await this.userModel.findOne({ phoneNumber }).exec();
    const byEmail = email
      ? await this.userModel.findOne({ email: { $regex: `^${escapeRegex(email)}$`, $options: 'i' } }).exec()
      : null;
    if (byPhone && byEmail && String(byPhone._id) !== String(byEmail._id)) {
      throw new ConflictException('This phone number and this email belong to two different accounts');
    }
    let user = byPhone ?? byEmail;
    let created = false;
    let upgraded = false;

    if (!user) {
      const name = input.name?.trim();
      if (!name) throw new BadRequestException('Enter the host’s name');
      if (!email) throw new BadRequestException('Enter the host’s email: it’s how they sign in to their new account');
      user = await new this.userModel({
        name,
        email,
        phoneNumber,
        role: UserRole.REGISTERED_USER,
        isActive: true,
        onboardingStatus: OnboardingStatus.COMPLETED,
      }).save();
      created = true;
    }
    if (user.isActive === false) throw new ForbiddenException('This account is deactivated');
    if (user.role === UserRole.ADMIN) throw new BadRequestException('This is an admin account');

    if (!OWNER_ROLES.includes(user.role)) {
      if (!UPGRADABLE_ROLES.includes(user.role)) {
        // Students keep their student account (their profile and leases depend on it)
        throw new BadRequestException(`This is a ${user.role} account: it can’t own a listing`);
      }
      await this.usersService.setRole(String(user._id), UserRole.HOST);
      upgraded = !created;
      user.role = UserRole.HOST;
    }
    if (created) this.logger.log(`Host account created by an admin for listing set-up: ${user._id}`);

    return {
      id: String(user._id),
      name: user.name,
      email: user.email,
      phoneNumber: user.phoneNumber,
      role: user.role,
      created,
      upgraded,
    };
  }

  /**
   * After an admin finished setting up the listing (photos included): tell the host. In-app
   * notification, plus an email with a "choose your password" link for accounts that have no
   * password yet (new ones), or a plain heads-up for the others.
   */
  async sendToHost(propertyId: string, admin: { _id?: any; id?: any }): Promise<{ notified: boolean; emailed: boolean }> {
    if (!Types.ObjectId.isValid(propertyId)) throw new BadRequestException('Invalid listing ID');
    const property = await this.propertyModel.findById(propertyId).select('title ownerId awaitingHostConfirmation publishedBy').lean().exec();
    if (!property) throw new NotFoundException('Listing not found');
    if (!(property as any).awaitingHostConfirmation) throw new BadRequestException('This listing isn’t waiting for its host');

    const host = await this.userModel.findById((property as any).ownerId).select('+password name email').exec();
    if (!host) throw new NotFoundException('Host not found');
    const title = String((property as any).title ?? '');

    let notified = false;
    try {
      await this.notifications.create(
        {
          userId: String(host._id),
          type: NotificationType.PROPERTY_UPDATE,
          title: 'Your home is ready to publish',
          message: `The HoroHouse team set up "${title}" for you. Check it and tap Publish to open it to guests.`,
          link: '/(tabs)/properties',
        } as any,
        {
          title: 'Votre logement est prêt à être publié',
          message: `L’équipe HoroHouse a préparé « ${title} » pour vous. Vérifiez-le et touchez Publier pour l’ouvrir aux voyageurs.`,
        },
      );
      notified = true;
    } catch (e: any) {
      this.logger.warn(`Listing-ready notification failed for ${host._id}: ${e?.message}`);
    }

    let emailed = false;
    if (host.email) {
      let token: string | null = null;
      // No password yet (made for them, or Google-only): a link to choose one
      if (!(host as any).password) {
        token = crypto.randomBytes(32).toString('hex');
        (host as any).resetPasswordToken = crypto.createHash('sha256').update(token).digest('hex');
        (host as any).resetPasswordExpires = new Date(Date.now() + INVITE_VALID_MS);
        await host.save();
      }
      try {
        await this.emailService.sendHostListingInviteEmail(host.email, host.name, title, token);
        emailed = true;
      } catch (e: any) {
        this.logger.warn(`Listing-ready email failed for ${host._id}: ${e?.message}`);
      }
    }
    this.logger.log(`Listing ${propertyId} sent to host ${host._id} by admin ${String(admin?._id ?? admin?.id)}`);
    return { notified, emailed };
  }

  /** Listings the team set up that their hosts haven't confirmed yet (admin follow-up) */
  async awaitingConfirmation(): Promise<any[]> {
    return this.propertyModel
      .find({ awaitingHostConfirmation: true })
      .select('title city images createdAt ownerId publishedBy')
      .populate('ownerId', 'name phoneNumber email')
      .sort({ createdAt: -1 })
      .limit(100)
      .lean()
      .exec();
  }
}
