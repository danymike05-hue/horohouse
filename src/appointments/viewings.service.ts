import {
  BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, isValidObjectId } from 'mongoose';
import { Appointment, AppointmentDocument, AppointmentStatus, AppointmentType } from './schemas/appointment.schema';
import { Property, PropertyDocument } from '../properties/schemas/property.schema';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/schemas/notification.schema';

/** Cameroon time (WAT, UTC+1, no daylight saving), for times typed as a date and an hour */
const WAT_OFFSET_MIN = 60;
const DURATION_MIN = 60;
/** A viewing is booked at least this long ahead, and at most this far out */
const MIN_NOTICE_MIN = 60;
const MAX_AHEAD_DAYS = 60;
const OPEN = [AppointmentStatus.SCHEDULED, AppointmentStatus.RESCHEDULED];

export interface BookViewingInput {
  propertyId: string;
  /** The exact moment, from the app (preferred) */
  startsAt?: string;
  /** Or a date and "HH:mm", read as Cameroon time (the website sends these) */
  viewingDate?: string;
  viewingTime?: string;
  tourType: AppointmentType;
  name: string;
  email?: string;
  phone?: string;
  message?: string;
}

type Actor = { _id: any; role?: string; name?: string };
type Side = 'agent' | 'client';

/**
 * Property viewings for homes to rent or buy: a client asks for a time, the listing's
 * agent (or its owner when there is no agent) confirms, moves or cancels it, and marks it
 * done or a no-show afterwards. Either side can cancel. Each step tells the other side.
 *
 * Before, the app couldn't book one, and the server trusted the agent id it was sent: a
 * viewing could land on any agent's calendar, or on the client's own when none was sent.
 */
@Injectable()
export class ViewingsService {
  private readonly logger = new Logger(ViewingsService.name);
  private remindersRunning = false;

  constructor(
    @InjectModel(Appointment.name) private readonly appointmentModel: Model<AppointmentDocument>,
    @InjectModel(Property.name) private readonly propertyModel: Model<PropertyDocument>,
    private readonly notifications: NotificationsService,
  ) { }

  // ─── Booking ──────────────────────────────────────────────────────────────

  async book(input: BookViewingInput, user: Actor): Promise<Appointment> {
    if (!isValidObjectId(input.propertyId)) throw new NotFoundException('Listing not found');
    const property: any = await this.propertyModel
      .findById(input.propertyId)
      .select('title ownerId agentId listingType isActive')
      .lean()
      .exec();
    if (!property || property.isActive === false) throw new NotFoundException('Listing not found');
    if (property.listingType === 'short_term') {
      throw new BadRequestException('Viewings are for homes to rent or buy. Book this stay instead.');
    }
    // The listing decides who shows it, never the request
    const agentId = property.agentId ?? property.ownerId;
    if (!agentId) throw new BadRequestException('This listing has no one to show it yet.');
    if (String(agentId) === String(user._id) || String(property.ownerId) === String(user._id)) {
      throw new ForbiddenException('This is your own listing.');
    }

    const start = this.startOf(input);
    this.assertBookable(start);

    const already = await this.appointmentModel.exists({
      clientId: user._id,
      propertyId: property._id,
      status: { $in: OPEN },
      date: { $gte: new Date() },
    });
    if (already) throw new ConflictException('You already have a viewing booked for this home.');
    await this.assertAgentFree(agentId, start);

    const created = await this.appointmentModel.create({
      title: `Viewing: ${property.title ?? 'listing'}`.slice(0, 200),
      property: property.title,
      propertyId: property._id,
      agentId,
      clientId: user._id,
      clientName: input.name?.trim() || user.name || 'Client',
      clientEmail: input.email?.trim() || undefined,
      clientPhone: input.phone?.trim() || undefined,
      type: input.tourType ?? AppointmentType.IN_PERSON,
      description: input.message?.trim().slice(0, 1000) || undefined,
      date: start,
      duration: DURATION_MIN,
      status: AppointmentStatus.SCHEDULED,
    });

    const who = input.name?.trim() || user.name || 'Someone';
    await this.tell(String(agentId), {
      title: 'New viewing request',
      message: `${who} would like to visit ${property.title} on ${this.when(start, 'en')}. Confirm or suggest another time.`,
      fr: {
        title: 'Nouvelle demande de visite',
        message: `${who} souhaite visiter ${property.title} le ${this.when(start, 'fr')}. Confirmez ou proposez un autre horaire.`,
      },
      link: '/(tabs)/viewings',
      appointmentId: String(created._id),
      propertyId: String(property._id),
    });
    return created;
  }

  // ─── Lists ────────────────────────────────────────────────────────────────

  /** The viewings this user booked, soonest first. */
  async mine(user: Actor): Promise<Appointment[]> {
    return this.appointmentModel
      .find({ clientId: user._id })
      .populate('propertyId', 'title city address images price listingType')
      .populate('agentId', 'name profilePicture phoneNumber')
      .sort({ date: 1 })
      .limit(100)
      .lean()
      .exec() as any;
  }

  // ─── Steps ────────────────────────────────────────────────────────────────

  async confirm(id: string, user: Actor) {
    const { appt, property } = await this.load(id, user, ['agent']);
    this.assertOpen(appt);
    if (new Date(appt.date).getTime() <= Date.now()) throw new BadRequestException('This viewing time has passed.');
    const updated = await this.appointmentModel.findOneAndUpdate(
      { _id: appt._id, status: { $in: OPEN } },
      { $set: { confirmedAt: new Date() } },
      { new: true },
    );
    if (!updated) throw new ConflictException('This viewing was just changed. Refresh and try again.');
    await this.tellClient(appt, {
      title: 'Your viewing is confirmed',
      message: `See you at ${property?.title ?? 'the property'} on ${this.when(appt.date, 'en')}.`,
      fr: { title: 'Votre visite est confirmée', message: `Rendez-vous à ${property?.title ?? 'la propriété'} le ${this.when(appt.date, 'fr')}.` },
    });
    return updated;
  }

  async reschedule(id: string, startsAt: string, user: Actor, reason?: string) {
    const { appt, property } = await this.load(id, user, ['agent']);
    this.assertOpen(appt);
    const start = this.startOf({ startsAt } as BookViewingInput);
    this.assertBookable(start);
    await this.assertAgentFree(appt.agentId, start, appt._id);
    const updated = await this.appointmentModel.findOneAndUpdate(
      { _id: appt._id, status: { $in: OPEN } },
      {
        $set: { date: start, status: AppointmentStatus.RESCHEDULED, confirmedAt: new Date(), reminderSent: false, hourReminderSent: false },
        $push: { rescheduleHistory: { from: appt.date, to: start, reason: reason?.trim().slice(0, 300) || 'Rescheduled' } },
      },
      { new: true },
    );
    if (!updated) throw new ConflictException('This viewing was just changed. Refresh and try again.');
    await this.tellClient(appt, {
      title: 'Your viewing has a new time',
      message: `Your visit to ${property?.title ?? 'the property'} is now on ${this.when(start, 'en')}.${reason ? ` ${reason}` : ''}`,
      fr: { title: 'Votre visite a un nouvel horaire', message: `Votre visite de ${property?.title ?? 'la propriété'} est maintenant le ${this.when(start, 'fr')}.${reason ? ` ${reason}` : ''}` },
    });
    return updated;
  }

  async cancel(id: string, user: Actor, reason?: string) {
    const { appt, property, side } = await this.load(id, user, ['agent', 'client']);
    this.assertOpen(appt);
    const why = reason?.trim().slice(0, 500) || undefined;
    const updated = await this.appointmentModel.findOneAndUpdate(
      { _id: appt._id, status: { $in: OPEN } },
      { $set: { status: AppointmentStatus.CANCELLED, cancelledBy: side, ...(why ? { cancelReason: why } : {}) } },
      { new: true },
    );
    if (!updated) throw new ConflictException('This viewing was just changed. Refresh and try again.');
    const title = property?.title ?? 'the property';
    if (side === 'client') {
      await this.tell(String(appt.agentId), {
        title: 'A viewing was cancelled',
        message: `${appt.clientName} cancelled the visit to ${title} on ${this.when(appt.date, 'en')}.${why ? ` ${why}` : ''}`,
        fr: { title: 'Une visite a été annulée', message: `${appt.clientName} a annulé la visite de ${title} du ${this.when(appt.date, 'fr')}.${why ? ` ${why}` : ''}` },
        link: '/(tabs)/viewings',
        appointmentId: String(appt._id),
      });
    } else {
      await this.tellClient(appt, {
        title: 'Your viewing was cancelled',
        message: `Your visit to ${title} on ${this.when(appt.date, 'en')} was cancelled.${why ? ` ${why}` : ''} You can book another time.`,
        fr: { title: 'Votre visite a été annulée', message: `Votre visite de ${title} du ${this.when(appt.date, 'fr')} a été annulée.${why ? ` ${why}` : ''} Vous pouvez réserver un autre horaire.` },
      });
    }
    return updated;
  }

  /** After the time: it happened (which also lets the client review the agent) or nobody came. */
  async finish(id: string, user: Actor, outcome: 'completed' | 'no-show') {
    const { appt } = await this.load(id, user, ['agent']);
    this.assertOpen(appt);
    if (new Date(appt.date).getTime() > Date.now()) throw new BadRequestException('This viewing hasn’t happened yet.');
    const status = outcome === 'completed' ? AppointmentStatus.COMPLETED : AppointmentStatus.NO_SHOW;
    const updated = await this.appointmentModel.findOneAndUpdate(
      { _id: appt._id, status: { $in: OPEN } },
      { $set: { status } },
      { new: true },
    );
    if (!updated) throw new ConflictException('This viewing was just changed. Refresh and try again.');
    if (outcome === 'completed') {
      // A completed viewing is what lets the client review the agent
      const property: any = appt.propertyId
        ? await this.propertyModel.findById(appt.propertyId).select('title').lean().exec()
        : null;
      const place = property?.title ?? 'the property';
      if (appt.clientId) {
        await this.tell(String(appt.clientId), {
          title: 'How was your visit?',
          message: `Tell others how the visit to ${place} went: review the agent who showed you around.`,
          fr: { title: 'Comment s’est passée votre visite ?', message: `Dites aux autres comment s’est passée la visite de ${place} : évaluez l’agent qui vous a fait visiter.` },
          link: `/review/agent/${String(appt.agentId)}`,
          appointmentId: String(appt._id),
        });
      }
    }
    return updated;
  }

  // ─── Reminders ────────────────────────────────────────────────────────────

  /**
   * Both sides hear about an open viewing the day before (when it was booked more than a
   * few hours ahead) and an hour before. Each is claimed atomically, so a reminder goes
   * out once even with several servers or a slow run.
   */
  @Cron(CronExpression.EVERY_10_MINUTES, { name: 'viewing-reminders' })
  async sendReminders(now = Date.now()): Promise<number> {
    if (this.remindersRunning) return 0;
    this.remindersRunning = true;
    let sent = 0;
    try {
      sent += await this.remind('day', {
        reminderSent: { $ne: true },
        date: { $gt: new Date(now + 3 * 3_600_000), $lte: new Date(now + 24 * 3_600_000) },
      });
      sent += await this.remind('hour', {
        hourReminderSent: { $ne: true },
        date: { $gt: new Date(now), $lte: new Date(now + 75 * 60_000) },
      });
    } catch (err: any) {
      this.logger.error(`Viewing reminders failed: ${err?.message}`);
    } finally {
      this.remindersRunning = false;
    }
    return sent;
  }

  private async remind(kind: 'day' | 'hour', window: Record<string, any>): Promise<number> {
    const flag = kind === 'day' ? 'reminderSent' : 'hourReminderSent';
    let sent = 0;
    for (let i = 0; i < 200; i++) {
      const appt: any = await this.appointmentModel.findOneAndUpdate(
        { status: { $in: OPEN }, ...window },
        { $set: { [flag]: true } },
        { new: true },
      ).lean().exec();
      if (!appt) break;
      const property: any = appt.propertyId
        ? await this.propertyModel.findById(appt.propertyId).select('title').lean().exec()
        : null;
      const place = property?.title ?? 'the property';
      const lieu = property?.title ?? 'la propriété';
      const en = this.when(appt.date, 'en');
      const fr = this.when(appt.date, 'fr');
      const soon = kind === 'hour';
      if (appt.clientId) {
        await this.tell(String(appt.clientId), {
          title: soon ? 'Your viewing starts soon' : 'Your viewing is coming up',
          message: `${place}, ${en}.${appt.confirmedAt ? '' : ' It isn’t confirmed yet.'}`,
          fr: {
            title: soon ? 'Votre visite commence bientôt' : 'Votre visite approche',
            message: `${lieu}, ${fr}.${appt.confirmedAt ? '' : ' Elle n’est pas encore confirmée.'}`,
          },
          link: '/viewings',
          appointmentId: String(appt._id),
        });
      }
      await this.tell(String(appt.agentId), {
        title: soon ? 'A viewing starts soon' : 'Viewing coming up',
        message: `${appt.clientName} · ${place}, ${en}.${appt.confirmedAt ? '' : ' You haven’t confirmed it yet.'}`,
        fr: {
          title: soon ? 'Une visite commence bientôt' : 'Visite à venir',
          message: `${appt.clientName} · ${lieu}, ${fr}.${appt.confirmedAt ? '' : ' Vous ne l’avez pas encore confirmée.'}`,
        },
        link: '/(tabs)/viewings',
        appointmentId: String(appt._id),
      });
      sent++;
    }
    return sent;
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private startOf(input: BookViewingInput): Date {
    if (input.startsAt) return new Date(input.startsAt);
    const day = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(input.viewingDate ?? ''));
    const time = /^(\d{1,2}):(\d{2})/.exec(String(input.viewingTime ?? ''));
    if (!day || !time) throw new BadRequestException('Choose a date and a time for the viewing.');
    const utc = Date.UTC(+day[1], +day[2] - 1, +day[3], +time[1], +time[2]) - WAT_OFFSET_MIN * 60_000;
    return new Date(utc);
  }

  private assertBookable(start: Date) {
    const t = start.getTime();
    if (!Number.isFinite(t)) throw new BadRequestException('Choose a valid date and time.');
    if (t < Date.now() + MIN_NOTICE_MIN * 60_000) throw new BadRequestException('Choose a time at least an hour from now.');
    if (t > Date.now() + MAX_AHEAD_DAYS * 86_400_000) throw new BadRequestException(`Viewings can be booked up to ${MAX_AHEAD_DAYS} days ahead.`);
  }

  private async assertAgentFree(agentId: any, start: Date, except?: any) {
    const end = new Date(start.getTime() + DURATION_MIN * 60_000);
    const clash = await this.appointmentModel.findOne({
      ...(except ? { _id: { $ne: except } } : {}),
      agentId,
      status: { $in: OPEN },
      date: { $lt: end, $gt: new Date(start.getTime() - 4 * 3_600_000) },
      $expr: { $gt: [{ $add: ['$date', { $multiply: [{ $ifNull: ['$duration', DURATION_MIN] }, 60_000] }] }, start] },
    }).select('_id').lean().exec();
    if (clash) throw new ConflictException('That time is already taken. Please choose another.');
  }

  private assertOpen(appt: any) {
    if (!OPEN.includes(appt.status)) throw new BadRequestException('This viewing is already closed.');
  }

  /** The viewing, and which side this user is on; refuses anyone else. */
  private async load(id: string, user: Actor, allowed: Side[]) {
    if (!isValidObjectId(id)) throw new NotFoundException('Viewing not found');
    const appt: any = await this.appointmentModel.findById(id).lean().exec();
    if (!appt) throw new NotFoundException('Viewing not found');
    const property: any = appt.propertyId
      ? await this.propertyModel.findById(appt.propertyId).select('title ownerId').lean().exec()
      : null;
    const me = String(user._id);
    const isAgent = String(appt.agentId) === me || (property && String(property.ownerId) === me) || user.role === 'admin';
    const isClient = !!appt.clientId && String(appt.clientId) === me;
    const side: Side | null = isAgent && allowed.includes('agent') ? 'agent' : isClient && allowed.includes('client') ? 'client' : null;
    if (!side) throw new ForbiddenException('This isn’t your viewing.');
    return { appt, property, side };
  }

  /** "Tuesday 12 November at 14:30" in Cameroon time */
  when(date: Date | string, lang: 'en' | 'fr'): string {
    const d = new Date(date);
    const locale = lang === 'fr' ? 'fr-FR' : 'en-GB';
    const day = d.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Africa/Douala' });
    const time = d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Africa/Douala' });
    return lang === 'fr' ? `${day} à ${time}` : `${day} at ${time}`;
  }

  private async tellClient(appt: any, text: { title: string; message: string; fr: { title: string; message: string } }) {
    if (!appt.clientId) return; // added by hand by the agent, for someone without an account
    await this.tell(String(appt.clientId), { ...text, link: '/viewings', appointmentId: String(appt._id) });
  }

  private async tell(userId: string, n: {
    title: string; message: string; fr: { title: string; message: string }; link: string; appointmentId: string; propertyId?: string;
  }) {
    try {
      await this.notifications.create(
        {
          userId,
          type: NotificationType.VIEWING,
          title: n.title,
          message: n.message,
          link: n.link,
          metadata: { appointmentId: n.appointmentId, ...(n.propertyId ? { propertyId: n.propertyId } : {}) },
        } as any,
        n.fr,
      );
    } catch (err: any) {
      // The viewing itself is saved either way
      this.logger.warn(`Viewing ${n.appointmentId}: notification not sent: ${err?.message}`);
    }
  }
}
