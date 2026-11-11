import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model, Types } from 'mongoose';
import { Booking, BookingDocument, BookingStatus, CancelledBy, PaymentStatus } from '../bookings/schema/booking.schema';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/schemas/notification.schema';
import { HostPayoutsService } from '../payments/services/host-payouts.service';
import { CoHostsService } from '../co-hosts/co-hosts.service';
import { PaymentsService } from '../payments/services/payments.service';
import { UserRole } from '../users/schemas/user.schema';
import {
  BookingIssue,
  BookingIssueDocument,
  IssueCategory,
  IssueOutcome,
  IssueStatus,
} from './schemas/booking-issue.schema';

/** A problem can be reported from the check-in day until this long after check-out. */
export const REPORT_WINDOW_AFTER_CHECKOUT_MS = 72 * 3_600_000;
const PHOTO_FOLDER_PATH = '/horohouse/booking-issues/';

/** When a guest can report a problem with this booking, or null if they can't at all. */
export function reportWindow(booking: Pick<Booking, 'status' | 'paymentStatus' | 'checkIn' | 'checkOut'>, now = Date.now()) {
  const stayed = booking.status === BookingStatus.CONFIRMED || booking.status === BookingStatus.COMPLETED;
  if (!stayed || booking.paymentStatus !== PaymentStatus.PAID) return null;
  const opensAt = new Date(booking.checkIn);
  opensAt.setUTCHours(0, 0, 0, 0);
  const closesAt = new Date(new Date(booking.checkOut).getTime() + REPORT_WINDOW_AFTER_CHECKOUT_MS);
  return { opensAt, closesAt, isOpen: now >= opensAt.getTime() && now <= closesAt.getTime() };
}

type Actor = { _id?: any; id?: any; role?: string };
const idOf = (user: Actor) => String(user._id ?? user.id);

@Injectable()
export class BookingIssuesService {
  private readonly logger = new Logger(BookingIssuesService.name);

  constructor(
    @InjectModel(BookingIssue.name) private readonly issueModel: Model<BookingIssueDocument>,
    @InjectModel(Booking.name) private readonly bookingModel: Model<BookingDocument>,
    private readonly payments: PaymentsService,
    private readonly payouts: HostPayoutsService,
    private readonly notifications: NotificationsService,
    private readonly coHosts: CoHostsService,
  ) {}

  // ── Guest ───────────────────────────────────────────────────────────────────

  async report(
    user: Actor,
    dto: { bookingId: string; category: IssueCategory; description: string; photos?: string[] },
  ): Promise<BookingIssue> {
    const booking = await this.findBooking(dto.bookingId);
    if (String(booking.guestId) !== idOf(user)) {
      throw new ForbiddenException('Only the guest on this booking can report a problem');
    }
    const window = reportWindow(booking);
    if (!window) throw new BadRequestException('You can only report a problem with a paid, confirmed stay');
    if (!window.isOpen) {
      throw new BadRequestException(
        Date.now() < window.opensAt.getTime()
          ? 'You can report a problem from your check-in day. Before that, you can message your host or cancel.'
          : 'The time to report a problem with this stay has passed. Contact support for help.',
      );
    }
    const photos = dto.photos ?? [];
    if (photos.some((url) => !this.isOurPhoto(url))) throw new BadRequestException('One of the photos is not valid');

    let issue: BookingIssueDocument;
    try {
      issue = await this.issueModel.create({
        bookingId: booking._id,
        guestId: booking.guestId,
        hostId: booking.hostId,
        propertyId: booking.propertyId,
        category: dto.category,
        description: dto.description,
        photos,
      });
    } catch (err: any) {
      if (err?.code === 11000) throw new ConflictException('You already reported a problem with this stay');
      throw err;
    }

    issue.payoutFrozen = await this.payouts.freeze(String(booking._id));
    await issue.save();

    const bookingId = String(booking._id);
    await this.notify(String(booking.hostId), {
      title: 'A guest reported a problem',
      message: issue.payoutFrozen
        ? 'A guest reported a problem with their stay. Your payout for it is on hold until we review it. Add your side now.'
        : 'A guest reported a problem with their stay. Add your side now.',
      fr: { title: 'Un voyageur a signalé un problème', message: issue.payoutFrozen ? "Un voyageur a signalé un problème avec son séjour. Votre versement est bloqué le temps que nous l'examinions. Donnez votre version maintenant." : 'Un voyageur a signalé un problème avec son séjour. Donnez votre version maintenant.' },
      link: `/host/booking/${bookingId}`,
      metadata: { bookingId, propertyId: String(booking.propertyId) },
    });
    await this.coHosts.notifyCoHosts(booking.propertyId, {
      type: NotificationType.BOOKING_ISSUE,
      title: 'A guest reported a problem',
      message: 'A guest reported a problem with their stay. Add your side now.',
      fr: { title: 'Un voyageur a signalé un problème', message: 'Un voyageur a signalé un problème avec son séjour. Donnez votre version maintenant.' },
      link: `/host/booking/${bookingId}`,
      metadata: { bookingId, propertyId: String(booking.propertyId) },
    });
    await this.notifications.notifyAdmins({
      title: 'Stay problem to review',
      message: `Booking ${bookingId}: ${dto.category}. ${issue.payoutFrozen ? 'The host payout is frozen.' : 'The host was already paid.'}`,
      link: '/admin/issues',
      metadata: { bookingId, issueId: String(issue._id) },
    });
    return issue;
  }

  isOurPhoto(url: string): boolean {
    const cloud = process.env.CLOUDINARY_CLOUD_NAME;
    return !!cloud
      && url.startsWith(`https://res.cloudinary.com/${cloud}/image/upload/`)
      && url.includes(PHOTO_FOLDER_PATH);
  }

  // ── Guest and host ──────────────────────────────────────────────────────────

  /** The report on a booking (the latest one), and whether a new one can be made. */
  async forBooking(user: Actor, bookingId: string) {
    const booking = await this.findBooking(bookingId);
    const isGuest = String(booking.guestId) === idOf(user);
    const isHost = String(booking.hostId) === idOf(user);
    if (!isGuest && !isHost && user.role !== UserRole.ADMIN && !(await this.coHosts.isActive(idOf(user), booking.propertyId))) {
      throw new ForbiddenException('This is not your booking');
    }
    const issue = await this.issueModel.findOne({ bookingId: booking._id }).sort({ createdAt: -1 }).lean();
    const window = reportWindow(booking);
    return {
      issue,
      canReport: isGuest && !!window?.isOpen && !(issue && issue.active),
      reportOpensAt: window?.opensAt ?? null,
      reportClosesAt: window?.closesAt ?? null,
    };
  }

  // ── Host ────────────────────────────────────────────────────────────────────

  async respond(user: Actor, issueId: string, message: string): Promise<BookingIssue> {
    const issue = await this.findIssue(issueId);
    if (String(issue.hostId) !== idOf(user) && !(await this.coHosts.isActive(idOf(user), issue.propertyId))) {
      throw new ForbiddenException('This is not your booking');
    }
    if (issue.status !== IssueStatus.OPEN) throw new BadRequestException('This report has already been decided');
    issue.hostResponse = message;
    issue.hostRespondedAt = new Date();
    await issue.save();
    await this.notifications.notifyAdmins({
      title: 'Host replied to a stay problem',
      message: `Booking ${issue.bookingId}: the host added their side.`,
      link: '/admin/issues',
      metadata: { bookingId: String(issue.bookingId), issueId },
    });
    return issue;
  }

  // ── Admin ───────────────────────────────────────────────────────────────────

  async adminList(state: 'open' | 'resolved' = 'open', limit = 50) {
    const statuses = state === 'open' ? [IssueStatus.OPEN, IssueStatus.RESOLVING] : [IssueStatus.RESOLVED];
    const [items, openCount] = await Promise.all([
      this.issueModel
        .find({ status: { $in: statuses } })
        .sort({ createdAt: state === 'open' ? 1 : -1 })
        .limit(Math.min(limit, 100))
        .populate('guestId', 'name email phoneNumber')
        .populate('hostId', 'name email phoneNumber')
        .populate('propertyId', 'title')
        .populate('bookingId', 'checkIn checkOut status paymentStatus priceBreakdown.totalAmount currency payout issueRefundAmount')
        .lean(),
      this.issueModel.countDocuments({ status: { $in: [IssueStatus.OPEN, IssueStatus.RESOLVING] } }),
    ]);
    return { items, openCount };
  }

  /**
   * Decide a report. A refund sends real money, so the report is claimed first: two
   * admins can't refund the same one. If CamerPay refuses, it goes back to open and
   * can be tried again.
   */
  async resolve(
    admin: Actor,
    issueId: string,
    dto: { outcome: IssueOutcome; amount?: number; note: string },
  ): Promise<BookingIssue> {
    const current = await this.findIssue(issueId);
    const booking = await this.findBooking(String(current.bookingId));

    let refundAmount = 0;
    if (dto.outcome === IssueOutcome.REFUND) {
      const left = booking.paymentStatus === PaymentStatus.PAID ? await this.payments.refundableAmount(booking._id as Types.ObjectId) : 0;
      if (!(left > 0)) {
        throw new BadRequestException('This booking has already been refunded. Close the report with no refund.');
      }
      refundAmount = dto.amount ?? left;
      if (refundAmount <= 0 || refundAmount > left) {
        throw new BadRequestException(`The refund must be between 1 and ${left} ${booking.currency ?? 'XAF'}`);
      }
    }

    const claimed = await this.issueModel.findOneAndUpdate(
      // "No refund" can also close one stuck mid-refund (the server died during the call),
      // once the admin has checked CamerPay. A new refund can't start on a stuck one.
      {
        _id: issueId,
        status: dto.outcome === IssueOutcome.NO_REFUND
          ? { $in: [IssueStatus.OPEN, IssueStatus.RESOLVING] }
          : IssueStatus.OPEN,
      },
      { $set: { status: IssueStatus.RESOLVING, resolvedBy: new Types.ObjectId(idOf(admin)) } },
      { new: true },
    );
    if (!claimed) throw new ConflictException('This report has already been decided, or is being decided');

    if (refundAmount > 0) {
      await this.sendRefund(claimed, booking, refundAmount, dto.note);
    }

    // Whatever is left belongs to the host. A full refund already reversed the payout.
    try {
      if (claimed.payoutFrozen) await this.payouts.unfreeze(String(booking._id));
    } catch (err: any) {
      // Still safe: it went back to held, and the release job will pay it.
      this.logger.error(`resolve: payout for booking ${booking._id} not released yet: ${err?.message}`);
    }

    claimed.status = IssueStatus.RESOLVED;
    claimed.active = false;
    claimed.outcome = dto.outcome;
    claimed.refundAmount = refundAmount || undefined;
    claimed.resolutionNote = dto.note;
    claimed.resolvedAt = new Date();
    await claimed.save();

    const bookingId = String(booking._id);
    const summary = refundAmount > 0
      ? `${refundAmount} ${booking.currency ?? 'XAF'} was refunded to the guest.`
      : 'No refund was given.';
    await this.notify(String(booking.guestId), {
      title: 'We reviewed your report',
      message: `${summary} ${dto.note}`,
      fr: { title: 'Nous avons examiné votre signalement', message: `${refundAmount > 0 ? `${refundAmount} ${booking.currency ?? 'XAF'} ont été remboursés au voyageur.` : "Aucun remboursement n'a été accordé."} ${dto.note}` },
      link: `/booking/${bookingId}`,
      metadata: { bookingId, propertyId: String(booking.propertyId) },
    });
    await this.notify(String(booking.hostId), {
      title: 'We reviewed the reported problem',
      message: `${summary} ${dto.note}`,
      fr: { title: 'Nous avons examiné le problème signalé', message: `${refundAmount > 0 ? `${refundAmount} ${booking.currency ?? 'XAF'} ont été remboursés au voyageur.` : "Aucun remboursement n'a été accordé."} ${dto.note}` },
      link: `/host/booking/${bookingId}`,
      metadata: { bookingId, propertyId: String(booking.propertyId) },
    });
    return claimed;
  }

  private async sendRefund(issue: BookingIssueDocument, booking: BookingDocument, amount: number, note: string) {
    const backToOpen = () => this.issueModel.updateOne(
      { _id: issue._id, status: IssueStatus.RESOLVING },
      { $set: { status: IssueStatus.OPEN }, $unset: { resolvedBy: 1 } },
    );
    let refunded = false;
    try {
      refunded = await this.payments.processBookingRefund(String(booking._id), amount, note, 'stay_issue');
    } catch (err: any) {
      await backToOpen();
      throw new BadGatewayException(`CamerPay refused the refund: ${err?.message ?? err}`);
    }
    if (!refunded) {
      await backToOpen();
      throw new BadGatewayException('The refund did not go through. No money was sent.');
    }

    // A full refund of a stay that hadn't finished ends the booking, which frees its dates.
    const left = await this.payments.refundableAmount(booking._id as Types.ObjectId);
    if (left === 0 && booking.status === BookingStatus.CONFIRMED) {
      await this.bookingModel.updateOne(
        { _id: booking._id, status: BookingStatus.CONFIRMED },
        {
          $set: {
            status: BookingStatus.CANCELLED,
            cancellation: {
              cancelledBy: CancelledBy.ADMIN,
              cancelledAt: new Date(),
              reason: note,
              refundAmount: amount,
              refundStatus: 'processed',
            },
          },
        },
      );
    }
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  private async findBooking(bookingId: string): Promise<BookingDocument> {
    if (!isValidObjectId(bookingId)) throw new NotFoundException('Booking not found');
    const booking = await this.bookingModel.findById(bookingId);
    if (!booking) throw new NotFoundException('Booking not found');
    return booking;
  }

  private async findIssue(issueId: string): Promise<BookingIssueDocument> {
    if (!isValidObjectId(issueId)) throw new NotFoundException('Report not found');
    const issue = await this.issueModel.findById(issueId);
    if (!issue) throw new NotFoundException('Report not found');
    return issue;
  }

  /** The report and the decision are already saved: a failed notice must not undo them. */
  private async notify(
    userId: string,
    params: { title: string; message: string; fr?: { title: string; message: string }; link: string; metadata: Record<string, any> },
  ): Promise<void> {
    try {
      await this.notifications.create({ userId, type: NotificationType.BOOKING_ISSUE, ...params } as any);
    } catch (err: any) {
      this.logger.warn(`Notification to ${userId} failed: ${err?.message}`);
    }
  }
}
