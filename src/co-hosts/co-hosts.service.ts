import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model, Types } from 'mongoose';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/schemas/notification.schema';
import { Property, PropertyDocument } from '../properties/schemas/property.schema';
import { User, UserDocument, UserRole } from '../users/schemas/user.schema';
import { CoHost, CoHostDocument, CoHostStatus } from './schemas/co-host.schema';

export const MAX_CO_HOSTS_PER_LISTING = 5;
const INVITE_VALID_MS = 7 * 86_400_000;
/** Host screens and routes are limited to these roles, so a co-host needs one of them. */
const HOSTING_ROLES: string[] = [UserRole.HOST, UserRole.AGENT, UserRole.LANDLORD];

type Actor = { _id?: any; id?: any; role?: string };
const idOf = (user: Actor) => String(user._id ?? user.id);
const NOT_FOUND = 'We couldn’t find a host account with that email or phone number. They need to sign up as a host first.';

@Injectable()
export class CoHostsService {
  private readonly logger = new Logger(CoHostsService.name);

  constructor(
    @InjectModel(CoHost.name) private readonly coHostModel: Model<CoHostDocument>,
    @InjectModel(Property.name) private readonly propertyModel: Model<PropertyDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly notifications: NotificationsService,
  ) {}

  // ── Access checks, used by bookings, calendars, reported problems ───────────

  async isActive(userId: unknown, propertyId: unknown): Promise<boolean> {
    if (!userId || !propertyId || !isValidObjectId(String(userId)) || !isValidObjectId(String(propertyId))) return false;
    return !!(await this.coHostModel.exists({
      userId: new Types.ObjectId(String(userId)),
      propertyId: new Types.ObjectId(String(propertyId)),
      status: CoHostStatus.ACTIVE,
    }));
  }

  /** The listings this person helps run. */
  async propertyIdsFor(userId: string): Promise<Types.ObjectId[]> {
    const rows = await this.coHostModel
      .find({ userId: new Types.ObjectId(userId), status: CoHostStatus.ACTIVE })
      .select('propertyId')
      .lean();
    return rows.map((row) => row.propertyId);
  }

  /** Copies a notice to a listing's co-hosts. Never fails the action it's reporting. */
  async notifyCoHosts(
    propertyId: unknown,
    params: { type?: NotificationType; title: string; message: string; fr?: { title: string; message: string }; link: string; metadata?: Record<string, any> },
  ): Promise<void> {
    try {
      const rows = await this.coHostModel
        .find({ propertyId: new Types.ObjectId(String(propertyId)), status: CoHostStatus.ACTIVE })
        .select('userId')
        .lean();
      for (const row of rows) {
        await this.notifications.create({ type: NotificationType.SYSTEM, ...params, userId: String(row.userId) } as any);
      }
    } catch (err: any) {
      this.logger.warn(`Notifying co-hosts of ${propertyId} failed: ${err?.message}`);
    }
  }

  // ── Owner ───────────────────────────────────────────────────────────────────

  async invite(owner: Actor, propertyId: string, contactRaw: string): Promise<CoHost> {
    const property = await this.assertOwner(owner, propertyId);
    const contact = contactRaw.trim();
    const invitee = await this.findHostAccount(contact);
    if (!invitee) throw new NotFoundException(NOT_FOUND);

    const inviteeId = String(invitee._id);
    const ownerIds = [String((property as any).ownerId), String((property as any).agentId ?? '')];
    if (ownerIds.includes(inviteeId)) throw new BadRequestException('This person already manages this listing');

    const count = await this.coHostModel.countDocuments({ propertyId: property._id, open: true });
    if (count >= MAX_CO_HOSTS_PER_LISTING) {
      throw new BadRequestException(`A listing can have up to ${MAX_CO_HOSTS_PER_LISTING} co-hosts`);
    }

    let invite: CoHostDocument;
    try {
      invite = await this.coHostModel.create({
        propertyId: property._id,
        invitedBy: new Types.ObjectId(idOf(owner)),
        userId: invitee._id,
        contact,
      });
    } catch (err: any) {
      if (err?.code === 11000) throw new ConflictException('This person has already been invited to this listing');
      throw err;
    }

    await this.notify(inviteeId, {
      title: 'You’re invited to co-host',
      message: `You’ve been invited to help run ${(property as any).title ?? 'a listing'}.`,
      fr: { title: 'Vous êtes invité à co-gérer une annonce', message: `Vous êtes invité à aider à gérer ${(property as any).title ?? 'une annonce'}.` },
      link: '/host/co-hosts',
      metadata: { propertyId: String(property._id) },
    });
    return this.publicView(invite);
  }

  /** The owner sees a co-host's name only once they accept. */
  async forProperty(owner: Actor, propertyId: string) {
    const property = await this.assertOwner(owner, propertyId);
    const rows = await this.coHostModel
      .find({ propertyId: property._id, open: true })
      .populate('userId', 'name profilePicture')
      .sort({ createdAt: 1 })
      .lean();
    return rows.map((row: any) => ({
      _id: String(row._id),
      status: row.status,
      contact: row.contact,
      name: row.status === CoHostStatus.ACTIVE ? row.userId?.name : undefined,
      profilePicture: row.status === CoHostStatus.ACTIVE ? row.userId?.profilePicture : undefined,
    }));
  }

  /** Owner removes someone, or a co-host leaves. */
  async remove(user: Actor, id: string): Promise<void> {
    const row = await this.findRow(id);
    if (String(row.userId) !== idOf(user)) await this.assertOwner(user, String(row.propertyId));
    const leaving = String(row.userId) === idOf(user);
    const removed = await this.coHostModel.findOneAndUpdate(
      { _id: id, open: true },
      { $set: { status: CoHostStatus.REMOVED, open: false, respondedAt: new Date() } },
    );
    if (!removed) return;
    if (removed.status !== CoHostStatus.ACTIVE) return;
    const property: any = await this.propertyModel.findById(row.propertyId).select('title').lean();
    const title = property?.title ?? 'a listing';
    await this.notify(leaving ? String(row.invitedBy) : String(row.userId), {
      title: leaving ? 'A co-host left' : 'You’re no longer a co-host',
      message: leaving ? `A co-host stopped helping with ${title}.` : `You no longer help run ${title}.`,
      fr: { title: leaving ? 'Un co-hôte est parti' : "Vous n'êtes plus co-hôte", message: leaving ? `Un co-hôte a cessé d'aider avec ${property?.title ?? 'une annonce'}.` : `Vous n'aidez plus à gérer ${property?.title ?? 'une annonce'}.` },
      link: '/host/co-hosts',
      metadata: { propertyId: String(row.propertyId) },
    });
  }

  // ── Invited person ──────────────────────────────────────────────────────────

  async mine(user: Actor) {
    const rows = await this.coHostModel
      .find({ userId: new Types.ObjectId(idOf(user)), status: { $in: [CoHostStatus.PENDING, CoHostStatus.ACTIVE] } })
      .populate('propertyId', 'title images type listingType city')
      .sort({ createdAt: -1 })
      .lean();
    return rows
      .filter((row: any) => row.propertyId)
      .filter((row: any) => row.status === CoHostStatus.ACTIVE || !this.inviteExpired(row))
      .map((row: any) => ({ _id: String(row._id), status: row.status, property: row.propertyId }));
  }

  async respond(user: Actor, id: string, accept: boolean): Promise<void> {
    const row = await this.findRow(id);
    if (String(row.userId) !== idOf(user)) throw new ForbiddenException('This invitation is not for you');
    if (accept && this.inviteExpired(row)) throw new ConflictException('This invitation has expired. Ask for a new one.');
    const updated = await this.coHostModel.findOneAndUpdate(
      { _id: id, status: CoHostStatus.PENDING },
      {
        $set: accept
          ? { status: CoHostStatus.ACTIVE, respondedAt: new Date() }
          : { status: CoHostStatus.DECLINED, open: false, respondedAt: new Date() },
      },
    );
    if (!updated) throw new ConflictException('This invitation has already been answered');
    const property: any = await this.propertyModel.findById(row.propertyId).select('title').lean();
    await this.notify(String(row.invitedBy), {
      title: accept ? 'Your co-host accepted' : 'Your co-host invitation was declined',
      message: `${accept ? 'They can now help run' : 'They won’t be helping with'} ${property?.title ?? 'your listing'}.`,
      fr: { title: accept ? 'Votre co-hôte a accepté' : 'Votre invitation de co-hôte a été refusée', message: `${accept ? 'Cette personne peut maintenant aider à gérer' : "Cette personne n'aidera pas avec"} ${property?.title ?? 'votre annonce'}.` },
      link: '/host/co-hosts',
      metadata: { propertyId: String(row.propertyId) },
    });
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  /** A listing's owner or agent. Co-hosts themselves can't invite or remove anyone. */
  private async assertOwner(user: Actor, propertyId: string): Promise<PropertyDocument> {
    if (!isValidObjectId(propertyId)) throw new NotFoundException('Listing not found');
    const property = await this.propertyModel.findById(propertyId).select('ownerId agentId title');
    if (!property) throw new NotFoundException('Listing not found');
    const uid = idOf(user);
    const isOwner = String((property as any).ownerId) === uid || String((property as any).agentId ?? '') === uid;
    if (!isOwner && user.role !== UserRole.ADMIN) throw new ForbiddenException('Only the listing’s host can manage co-hosts');
    return property;
  }

  private async findHostAccount(contact: string): Promise<UserDocument | null> {
    const query = contact.includes('@')
      ? { email: contact.toLowerCase() }
      : { phoneNumber: { $in: this.phoneForms(contact) } };
    return this.userModel.findOne({ ...query, role: { $in: HOSTING_ROLES }, isActive: { $ne: false } }).select('_id');
  }

  /** Numbers are stored with or without the country code. */
  private phoneForms(contact: string): string[] {
    const digits = contact.replace(/\D/g, '');
    const local = digits.replace(/^237/, '');
    return [...new Set([contact, digits, local, `237${local}`, `+237${local}`])];
  }

  private inviteExpired(row: { status: CoHostStatus; createdAt: Date }): boolean {
    return row.status === CoHostStatus.PENDING && new Date(row.createdAt).getTime() + INVITE_VALID_MS < Date.now();
  }

  private publicView(row: CoHostDocument) {
    return { _id: String(row._id), status: row.status, contact: row.contact } as unknown as CoHost;
  }

  private async findRow(id: string): Promise<CoHostDocument> {
    if (!isValidObjectId(id)) throw new NotFoundException('Invitation not found');
    const row = await this.coHostModel.findById(id);
    if (!row) throw new NotFoundException('Invitation not found');
    return row;
  }

  private async notify(userId: string, params: { title: string; message: string; fr?: { title: string; message: string }; link: string; metadata: Record<string, any> }) {
    try {
      await this.notifications.create({ userId, type: NotificationType.SYSTEM, ...params } as any);
    } catch (err: any) {
      this.logger.warn(`Notification to ${userId} failed: ${err?.message}`);
    }
  }
}
