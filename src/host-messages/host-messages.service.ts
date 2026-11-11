import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { v2 as cloudinary } from 'cloudinary';
import {
  HostMessageDelivery,
  HostMessageDeliveryDocument,
  HostMessageTemplate,
  HostMessageTemplateDocument,
  MessageTrigger,
  TemplateKind,
} from './schemas/host-message.schema';
import { CheckInGuideDto, CreateTemplateDto, UpdateTemplateDto } from './dto/host-messages.dto';
import { Property, PropertyDocument } from '../properties/schemas/property.schema';
import { Booking, BookingDocument, BookingStatus, PaymentStatus } from '../bookings/schema/booking.schema';
import { User, UserDocument, UserRole } from '../users/schemas/user.schema';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/schemas/notification.schema';
import { ModuleRef } from '@nestjs/core';
import { ChatService } from '../chat/chat.service';
import { ChatGateway } from '../chat/chat.gateway';

const MAX_TEMPLATES = 30;
const MAX_GUIDE_PHOTOS = 8;
/** Guests can open the check-in guide this many days before check-in */
export const GUIDE_DAYS_BEFORE = 2;
/** Cameroon (WAT) is UTC+1 all year */
const WAT_OFFSET_HOURS = 1;
/** A scheduled message more than this late is skipped (e.g. server was down for days) */
const LATE_LIMIT_MS = 24 * 3600_000;
const DAY = 86_400_000;

export const TEMPLATE_TOKENS = [
  'guest_name', 'host_name', 'listing', 'check_in_date', 'check_out_date',
  'check_in_time', 'check_out_time', 'nights', 'guests', 'address', 'wifi_name', 'wifi_password',
] as const;

const fmtDate = (d?: Date | string | null) => {
  if (!d) return '';
  const x = new Date(d);
  const dd = String(x.getUTCDate()).padStart(2, '0');
  const mm = String(x.getUTCMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${x.getUTCFullYear()}`;
};
const firstName = (n?: string) => String(n ?? '').trim().split(/\s+/)[0] || '';
const idStr = (v: any) => String(v?._id ?? v ?? '');

/** Replace {tokens}; unknown tokens are left as typed so the host notices them */
export function renderTemplate(body: string, ctx: Partial<Record<(typeof TEMPLATE_TOKENS)[number], string>>): string {
  return body.replace(/\{([a-z_]+)\}/g, (m, key) => (key in ctx ? String((ctx as any)[key] ?? '') : m));
}

/** UTC instant of `date` (a stay date stored at UTC midnight) + shiftDays, at hh:mm Cameroon time */
export function dueAt(date: Date, shiftDays: number, hhmm: string): Date {
  const [h, m] = (hhmm || '10:00').split(':').map((x) => parseInt(x, 10));
  return new Date(Date.UTC(
    date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + shiftDays,
    (Number.isFinite(h) ? h : 10) - WAT_OFFSET_HOURS, Number.isFinite(m) ? m : 0,
  ));
}

/** When a scheduled template is due for a booking (null = never for this booking) */
export function dueFor(t: Pick<HostMessageTemplate, 'trigger' | 'daysOffset' | 'sendTime'>, b: any): Date | null {
  const offset = Math.max(0, Number(t.daysOffset ?? 0));
  switch (t.trigger) {
    case MessageTrigger.BOOKING_CONFIRMED:
      return b.confirmedAt ? new Date(b.confirmedAt) : b.paidAt ? new Date(b.paidAt) : null;
    case MessageTrigger.BEFORE_CHECKIN:
      return dueAt(new Date(b.checkIn), -Math.max(1, offset), t.sendTime);
    case MessageTrigger.CHECKIN_DAY:
      return dueAt(new Date(b.checkIn), 0, t.sendTime);
    case MessageTrigger.BEFORE_CHECKOUT:
      return dueAt(new Date(b.checkOut), -offset, t.sendTime);
    case MessageTrigger.AFTER_CHECKOUT:
      return dueAt(new Date(b.checkOut), offset, t.sendTime);
    default:
      return null;
  }
}

@Injectable()
export class HostMessagesService {
  private readonly logger = new Logger(HostMessagesService.name);

  constructor(
    @InjectModel(HostMessageTemplate.name) private readonly templateModel: Model<HostMessageTemplateDocument>,
    @InjectModel(HostMessageDelivery.name) private readonly deliveryModel: Model<HostMessageDeliveryDocument>,
    @InjectModel(Property.name) private readonly propertyModel: Model<PropertyDocument>,
    @InjectModel(Booking.name) private readonly bookingModel: Model<BookingDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly moduleRef: ModuleRef,
    @Optional() private readonly notifications?: NotificationsService,
  ) {}

  /**
   * Posts the message in the host ↔ guest conversation (created if needed), as if the
   * host had sent it, and pushes it to open chats. Returns false if chat isn't available.
   */
  private async postToChat(b: any, body: string): Promise<boolean> {
    try {
      const chat = this.moduleRef.get(ChatService, { strict: false });
      if (!chat) return false;
      const hostId = idStr(b.hostId);
      const conv: any = await chat.createConversation(hostId, {
        participantId: idStr(b.guestId),
        propertyId: idStr(b.propertyId),
      } as any);
      const conversationId = idStr(conv?._id);
      if (!conversationId) return false;
      const message = await chat.sendMessage(hostId, { conversationId, content: body } as any);
      try {
        const gateway = this.moduleRef.get(ChatGateway, { strict: false });
        gateway?.broadcastNewMessage(conversationId, message);
      } catch { /* realtime is a bonus; the message is saved */ }
      return true;
    } catch (err: any) {
      this.logger.warn(`scheduled message not posted in chat (booking ${idStr(b._id)}): ${err?.message}`);
      return false;
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  // Templates (quick replies + scheduled messages)
  // ════════════════════════════════════════════════════════════════════════

  async listTemplates(user: User, kind?: TemplateKind) {
    const q: any = { hostId: user._id };
    if (kind && Object.values(TemplateKind).includes(kind)) q.kind = kind;
    return this.templateModel.find(q).sort({ kind: 1, createdAt: 1 }).lean().exec();
  }

  private async assertOwnListings(user: User, ids?: string[]) {
    if (!ids?.length) return;
    const count = await this.propertyModel.countDocuments({
      _id: { $in: ids.map((i) => new Types.ObjectId(i)) },
      $or: [{ ownerId: user._id }, { agentId: user._id }],
    });
    if (count !== new Set(ids).size) throw new ForbiddenException('You can only pick your own listings');
  }

  private checkScheduled(kind: TemplateKind, trigger?: MessageTrigger) {
    if (kind === TemplateKind.SCHEDULED && !trigger) throw new BadRequestException('Choose when the message is sent');
  }

  async createTemplate(user: User, dto: CreateTemplateDto) {
    const count = await this.templateModel.countDocuments({ hostId: user._id });
    if (count >= MAX_TEMPLATES) throw new BadRequestException(`You can save up to ${MAX_TEMPLATES} messages`);
    this.checkScheduled(dto.kind, dto.trigger);
    await this.assertOwnListings(user, dto.propertyIds);
    const doc = await this.templateModel.create({
      ...dto,
      hostId: user._id,
      trigger: dto.kind === TemplateKind.SCHEDULED ? dto.trigger : undefined,
      propertyIds: (dto.propertyIds ?? []).map((i) => new Types.ObjectId(i)),
    });
    return doc.toObject();
  }

  async updateTemplate(user: User, id: string, dto: UpdateTemplateDto) {
    if (!Types.ObjectId.isValid(id)) throw new BadRequestException('Invalid id');
    const current = await this.templateModel.findOne({ _id: id, hostId: user._id }).lean().exec();
    if (!current) throw new NotFoundException('Message not found');
    const kind = dto.kind ?? current.kind;
    this.checkScheduled(kind, dto.trigger ?? current.trigger);
    await this.assertOwnListings(user, dto.propertyIds);
    const set: any = { ...dto };
    if (dto.propertyIds) set.propertyIds = dto.propertyIds.map((i) => new Types.ObjectId(i));
    if (kind === TemplateKind.QUICK_REPLY) set.trigger = undefined;
    return this.templateModel.findByIdAndUpdate(id, { $set: set }, { new: true }).lean().exec();
  }

  async deleteTemplate(user: User, id: string) {
    if (!Types.ObjectId.isValid(id)) throw new BadRequestException('Invalid id');
    const res = await this.templateModel.deleteOne({ _id: id, hostId: user._id });
    if (!res.deletedCount) throw new NotFoundException('Message not found');
    return { deleted: true };
  }

  /** Values for {tokens}, from a booking (or just names when there is none) */
  private async contextFor(booking: any | null, host: any, guest: any, property: any) {
    const guide: any = property?._id
      ? (await this.propertyModel.findById(property._id).select('+checkInGuide').lean().exec() as any)?.checkInGuide ?? {}
      : {};
    const g = booking?.guests ?? {};
    const guestCount = (Number(g.adults) || 0) + (Number(g.children) || 0);
    return {
      guest_name: firstName(guest?.name),
      host_name: firstName(host?.name),
      listing: property?.title ?? '',
      check_in_date: fmtDate(booking?.checkIn),
      check_out_date: fmtDate(booking?.checkOut),
      check_in_time: property?.shortTermAmenities?.checkInTime ?? '',
      check_out_time: property?.shortTermAmenities?.checkOutTime ?? '',
      nights: booking?.nights ? String(booking.nights) : '',
      guests: guestCount ? String(guestCount) : '',
      address: [property?.address, property?.neighborhood, property?.city].filter(Boolean).join(', '),
      wifi_name: guide.wifiName ?? '',
      wifi_password: guide.wifiPassword ?? '',
    };
  }

  /**
   * Quick replies filled in for a conversation: the latest booking between this host and
   * guest (for that listing when given) supplies dates and names.
   */
  async quickReplies(user: User, guestId?: string, propertyId?: string) {
    const templates = await this.templateModel
      .find({ hostId: user._id, kind: TemplateKind.QUICK_REPLY, isActive: true })
      .sort({ createdAt: 1 })
      .lean()
      .exec();
    if (!templates.length) return [];

    let booking: any = null;
    let guest: any = null;
    let property: any = null;
    if (guestId && Types.ObjectId.isValid(guestId)) {
      const q: any = { hostId: user._id, guestId: new Types.ObjectId(guestId) };
      if (propertyId && Types.ObjectId.isValid(propertyId)) q.propertyId = new Types.ObjectId(propertyId);
      booking = await this.bookingModel.findOne(q).sort({ checkIn: -1 }).lean().exec();
      guest = await this.userModel.findById(guestId).select('name').lean().exec();
    }
    const pid = booking?.propertyId ?? (propertyId && Types.ObjectId.isValid(propertyId) ? propertyId : null);
    if (pid) {
      property = await this.propertyModel
        .findOne({ _id: pid, $or: [{ ownerId: user._id }, { agentId: user._id }] })
        .select('title address neighborhood city shortTermAmenities.checkInTime shortTermAmenities.checkOutTime')
        .lean()
        .exec();
    }
    const ctx = await this.contextFor(booking, user, guest, property);
    return templates.map((tpl) => ({ id: idStr(tpl._id), title: tpl.title, text: renderTemplate(tpl.body, ctx) }));
  }

  // ════════════════════════════════════════════════════════════════════════
  // Check-in guide
  // ════════════════════════════════════════════════════════════════════════

  private async loadOwnedProperty(propertyId: string, user: User, extra = '') {
    if (!Types.ObjectId.isValid(propertyId)) throw new BadRequestException('Invalid listing id');
    const p: any = await this.propertyModel
      .findById(propertyId)
      .select(`ownerId agentId title +checkInGuide ${extra}`)
      .lean()
      .exec();
    if (!p) throw new NotFoundException('Listing not found');
    const isAdmin = user.role === UserRole.ADMIN;
    if (!isAdmin && idStr(p.ownerId) !== idStr(user._id) && idStr(p.agentId) !== idStr(user._id)) {
      throw new ForbiddenException('Not your listing');
    }
    return p;
  }

  private signPhotos(guide: any) {
    const photos = Array.isArray(guide?.photos) ? guide.photos : [];
    return {
      ...guide,
      photos: photos.map((ph: any) => ({
        publicId: ph.publicId,
        caption: ph.caption ?? '',
        // Private on Cloudinary: a signed link valid for a day
        url: cloudinary.url(ph.publicId, {
          type: 'authenticated',
          resource_type: 'image',
          sign_url: true,
          secure: true,
          transformation: [{ width: 1200, crop: 'limit', quality: 'auto', fetch_format: 'auto' }],
        } as any),
      })),
    };
  }

  static guideHasContent(g: any): boolean {
    if (!g) return false;
    return !!(g.wifiName || g.wifiPassword || g.directions || g.accessInstructions || g.parking || g.houseManual || g.emergencyPhone || g.photos?.length);
  }

  async getGuideForHost(propertyId: string, user: User) {
    const p = await this.loadOwnedProperty(propertyId, user);
    return this.signPhotos(p.checkInGuide ?? {});
  }

  async updateGuide(propertyId: string, dto: CheckInGuideDto, user: User) {
    await this.loadOwnedProperty(propertyId, user);
    const set: Record<string, any> = { 'checkInGuide.updatedAt': new Date() };
    for (const [k, v] of Object.entries(dto)) {
      if (v !== undefined) set[`checkInGuide.${k}`] = typeof v === 'string' ? v.trim() : v;
    }
    await this.propertyModel.updateOne({ _id: propertyId }, { $set: set });
    return this.getGuideForHost(propertyId, user);
  }

  async addGuidePhoto(propertyId: string, buffer: Buffer, caption: string | undefined, user: User) {
    const p = await this.loadOwnedProperty(propertyId, user);
    const count = p.checkInGuide?.photos?.length ?? 0;
    if (count >= MAX_GUIDE_PHOTOS) throw new BadRequestException(`Up to ${MAX_GUIDE_PHOTOS} photos in the guide`);
    const up = await new Promise<any>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: 'horohouse/check-in-guides', resource_type: 'image', type: 'authenticated' },
        (err, result) => (err ? reject(err) : resolve(result)),
      );
      stream.end(buffer);
    });
    await this.propertyModel.updateOne(
      { _id: propertyId },
      {
        $push: { 'checkInGuide.photos': { url: up.secure_url, publicId: up.public_id, caption: (caption ?? '').slice(0, 120) } },
        $set: { 'checkInGuide.updatedAt': new Date() },
      },
    );
    return this.getGuideForHost(propertyId, user);
  }

  async removeGuidePhoto(propertyId: string, publicId: string, user: User) {
    const p = await this.loadOwnedProperty(propertyId, user);
    const wanted = decodeURIComponent(publicId);
    const photos: any[] = p.checkInGuide?.photos ?? [];
    if (!photos.some((x) => x.publicId === wanted)) throw new NotFoundException('Photo not found');
    await this.propertyModel.updateOne({ _id: propertyId }, { $pull: { 'checkInGuide.photos': { publicId: wanted } } });
    cloudinary.uploader.destroy(wanted, { type: 'authenticated', resource_type: 'image' }).catch(() => undefined);
    return this.getGuideForHost(propertyId, user);
  }

  private async loadBookingFor(bookingId: string, user: User) {
    if (!Types.ObjectId.isValid(bookingId)) throw new BadRequestException('Invalid booking id');
    const b: any = await this.bookingModel.findById(bookingId).lean().exec();
    if (!b) throw new NotFoundException('Booking not found');
    const isGuest = idStr(b.guestId) === idStr(user._id);
    const isHost = idStr(b.hostId) === idStr(user._id);
    const isAdmin = user.role === UserRole.ADMIN;
    if (!isGuest && !isHost && !isAdmin) throw new ForbiddenException('Not your booking');
    return { b, isGuest, isHost: isHost || isAdmin };
  }

  /** Guest view: only for a paid, confirmed stay, from 2 days before check-in until the day after checkout */
  async getGuideForBooking(bookingId: string, user: User) {
    const { b, isHost } = await this.loadBookingFor(bookingId, user);
    const property: any = await this.propertyModel
      .findById(b.propertyId)
      .select('title address neighborhood city latitude longitude houseRules shortTermAmenities.checkInTime shortTermAmenities.checkOutTime +checkInGuide')
      .lean()
      .exec();
    if (!property) throw new NotFoundException('Listing not found');

    const availableFrom = new Date(new Date(b.checkIn).getTime() - GUIDE_DAYS_BEFORE * DAY);
    const availableUntil = new Date(new Date(b.checkOut).getTime() + DAY);
    const paidStay = b.status === BookingStatus.CONFIRMED && b.paymentStatus === PaymentStatus.PAID;
    const now = new Date();
    const open = isHost || (paidStay && now >= availableFrom && now <= availableUntil);
    const hasGuide = HostMessagesService.guideHasContent(property.checkInGuide);

    const base = {
      available: open && hasGuide,
      hasGuide,
      availableFrom,
      listing: { title: property.title },
      checkInTime: property.shortTermAmenities?.checkInTime ?? null,
      checkOutTime: property.shortTermAmenities?.checkOutTime ?? null,
    };
    if (!open || !hasGuide) {
      return { ...base, reason: !paidStay && !isHost ? 'not_confirmed' : !hasGuide ? 'no_guide' : now < availableFrom ? 'too_early' : 'ended' };
    }
    return {
      ...base,
      address: [property.address, property.neighborhood, property.city].filter(Boolean).join(', '),
      latitude: property.latitude ?? null,
      longitude: property.longitude ?? null,
      checkInMethod: property.houseRules?.checkInMethod ?? null,
      guide: this.signPhotos(property.checkInGuide ?? {}),
    };
  }

  async messagesForBooking(bookingId: string, user: User) {
    const { b } = await this.loadBookingFor(bookingId, user);
    return this.deliveryModel
      .find({ bookingId: b._id })
      .select('title body sentAt')
      .sort({ sentAt: 1 })
      .lean()
      .exec();
  }

  // ════════════════════════════════════════════════════════════════════════
  // Scheduler jobs
  // ════════════════════════════════════════════════════════════════════════

  /** Sends due scheduled messages. Returns how many were sent. */
  async runScheduledMessages(now = new Date()): Promise<number> {
    const templates = await this.templateModel
      .find({ kind: TemplateKind.SCHEDULED, isActive: true, trigger: { $exists: true, $ne: null } })
      .lean()
      .exec();
    if (!templates.length) return 0;

    const byHost = new Map<string, any[]>();
    for (const t of templates) {
      const k = idStr(t.hostId);
      if (!byHost.has(k)) byHost.set(k, []);
      byHost.get(k)!.push(t);
    }

    // Stays close enough to now for any trigger (offsets are at most 14 days)
    const from = new Date(now.getTime() - 16 * DAY);
    const to = new Date(now.getTime() + 16 * DAY);
    let sent = 0;

    for (const [hostId, hostTemplates] of byHost) {
      const bookings = await this.bookingModel
        .find({
          hostId: new Types.ObjectId(hostId),
          paymentStatus: PaymentStatus.PAID,
          status: { $in: [BookingStatus.CONFIRMED, BookingStatus.COMPLETED] },
          $or: [{ checkIn: { $gte: from, $lte: to } }, { checkOut: { $gte: from, $lte: to } }, { confirmedAt: { $gte: from } }],
        })
        .lean()
        .exec();
      if (!bookings.length) continue;

      const done = new Set(
        (await this.deliveryModel
          .find({ bookingId: { $in: bookings.map((b: any) => b._id) }, templateId: { $in: hostTemplates.map((t) => t._id) } })
          .select('templateId bookingId')
          .lean()
          .exec()).map((d: any) => `${d.templateId}:${d.bookingId}`),
      );

      for (const b of bookings as any[]) {
        for (const t of hostTemplates) {
          if (done.has(`${t._id}:${b._id}`)) continue;
          if (t.propertyIds?.length && !t.propertyIds.some((p: any) => idStr(p) === idStr(b.propertyId))) continue;
          // Messages meant for the stay itself are not sent once it's over
          if (b.status === BookingStatus.COMPLETED && t.trigger !== MessageTrigger.AFTER_CHECKOUT && t.trigger !== MessageTrigger.BEFORE_CHECKOUT) continue;
          const due = dueFor(t, b);
          if (!due || now < due || now.getTime() - due.getTime() > LATE_LIMIT_MS) continue;
          if (await this.deliver(t, b)) sent++;
        }
      }
    }
    return sent;
  }

  private async deliver(t: any, b: any): Promise<boolean> {
    const [host, guest, property] = await Promise.all([
      this.userModel.findById(b.hostId).select('name').lean().exec(),
      this.userModel.findById(b.guestId).select('name').lean().exec(),
      this.propertyModel
        .findById(b.propertyId)
        .select('title address neighborhood city shortTermAmenities.checkInTime shortTermAmenities.checkOutTime')
        .lean()
        .exec(),
    ]);
    const ctx = await this.contextFor(b, host, guest, property);
    const body = renderTemplate(t.body, ctx).slice(0, 2000);
    const title = `${firstName((host as any)?.name) || 'Your host'} · ${(property as any)?.title ?? 'HoroHouse'}`.slice(0, 120);

    // The unique index (templateId, bookingId) makes this the "send once" lock
    try {
      await this.deliveryModel.create({
        templateId: t._id,
        bookingId: b._id,
        hostId: b.hostId,
        guestId: b.guestId,
        title,
        body,
        sentAt: new Date(),
      });
    } catch (e: any) {
      if (e?.code === 11000) return false; // another instance sent it
      throw e;
    }

    // In the conversation, like a message the host typed (Airbnb scheduled messages)
    const inChat = await this.postToChat(b, body);

    await this.notifications
      ?.create({
        userId: idStr(b.guestId),
        type: NotificationType.MESSAGE,
        title,
        message: body.length > 180 ? `${body.slice(0, 177)}…` : body,
        link: inChat ? '/(tabs)/messages' : `/bookings/${idStr(b._id)}`,
        metadata: { bookingId: idStr(b._id), templateId: idStr(t._id), kind: 'host_scheduled_message', inChat },
      } as any)
      .catch((err: any) => this.logger.warn(`scheduled message notification failed: ${err?.message}`));
    return true;
  }

  /**
   * Tells guests their check-in guide is ready: the day before check-in from 09:00
   * Cameroon time, or right away for bookings made at the last minute.
   */
  async sendCheckInGuideNotices(now = new Date()): Promise<number> {
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const tomorrow = new Date(today.getTime() + DAY);
    const notBefore = dueAt(tomorrow, -1, '09:00');
    const bookings: any[] = await this.bookingModel
      .find({
        status: BookingStatus.CONFIRMED,
        paymentStatus: PaymentStatus.PAID,
        checkIn: now >= notBefore ? { $gte: today, $lte: tomorrow } : { $gte: today, $lt: tomorrow },
        checkInGuideNotifiedAt: { $exists: false },
      })
      .select('_id guestId propertyId checkIn')
      .limit(500)
      .lean()
      .exec();
    let sent = 0;
    for (const b of bookings) {
      const p: any = await this.propertyModel.findById(b.propertyId).select('title +checkInGuide').lean().exec();
      // Mark as handled even without a guide, so the listing isn't re-read every run
      const claimed = await this.bookingModel.updateOne(
        { _id: b._id, checkInGuideNotifiedAt: { $exists: false } },
        { $set: { checkInGuideNotifiedAt: new Date() } },
      );
      if (!claimed.modifiedCount || !HostMessagesService.guideHasContent(p?.checkInGuide)) continue;
      await this.notifications
        ?.create({
          userId: idStr(b.guestId),
          type: NotificationType.BOOKING_REMINDER,
          title: 'Your check-in guide is ready 🔑',
          message: `Wi-Fi, directions and how to get in at ${p?.title ?? 'your stay'}.`,
          fr: { title: "Votre guide d'arrivée est prêt 🔑", message: `Wi-Fi, itinéraire et accès à ${p?.title ?? 'votre logement'}.` },
          link: `/bookings/${idStr(b._id)}`,
          metadata: { bookingId: idStr(b._id), kind: 'check_in_guide' },
        } as any)
        .catch((err: any) => this.logger.warn(`guide notification failed: ${err?.message}`));
      sent++;
    }
    return sent;
  }
}
