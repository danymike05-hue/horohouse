import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model } from 'mongoose';
import { Booking, BookingDocument, BookingStatus, PaymentStatus } from '../bookings/schema/booking.schema';
import { BookingsService } from '../bookings/bookings.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/schemas/notification.schema';
import { HostPayoutsService } from '../payments/services/host-payouts.service';
import { CoHostsService } from '../co-hosts/co-hosts.service';
import { PaymentsService } from '../payments/services/payments.service';
import { Property, PropertyDocument } from '../properties/schemas/property.schema';
import {
  BookingDateChange,
  BookingDateChangeDocument,
  DateChangeStatus,
} from './schemas/booking-date-change.schema';

const HOST_REPLY_MS = 48 * 3_600_000;
const GUEST_PAY_MS = 24 * 3_600_000;
const STUCK_AFTER_MS = 30 * 60_000;
/** Below what Mobile Money can charge, so it isn't worth asking the guest to pay */
const MIN_CHARGE = 100;

const OPEN = [DateChangeStatus.PENDING, DateChangeStatus.AWAITING_PAYMENT, DateChangeStatus.APPLYING];

type Actor = { _id?: any; id?: any; role?: string };
const idOf = (user: Actor) => String(user._id ?? user.id);
const day = (d: Date) => new Date(d).toISOString().split('T')[0];

export interface DateChangePayment {
  amount: number;
  providerReference?: string;
  merchantInvoiceId: string;
  paymentMethod: string;
  paidAt?: Date;
  checkoutPaymentId: string;
}

/**
 * Guests move a paid, confirmed stay before check-in; the host accepts or declines.
 *   costs more → the guest pays the difference, then the dates change
 *   costs less → the guest gets back what the cancellation policy allows, then they change
 *   same price → they change straight away
 * The booking keeps its old dates until all of that has worked, so a failed payment or
 * refund leaves the original stay exactly as it was.
 */
@Injectable()
export class BookingChangesService {
  private readonly logger = new Logger(BookingChangesService.name);
  private running = false;

  constructor(
    @InjectModel(BookingDateChange.name) private readonly changeModel: Model<BookingDateChangeDocument>,
    @InjectModel(Booking.name) private readonly bookingModel: Model<BookingDocument>,
    @InjectModel(Property.name) private readonly propertyModel: Model<PropertyDocument>,
    private readonly bookings: BookingsService,
    private readonly payments: PaymentsService,
    private readonly payouts: HostPayoutsService,
    private readonly notifications: NotificationsService,
    private readonly coHosts: CoHostsService,
  ) {}

  // ── Guest ───────────────────────────────────────────────────────────────────

  /** What the new dates would cost. Throws if they can't be booked. */
  async preview(user: Actor, dto: { bookingId: string; checkIn: string; checkOut: string }) {
    const booking = await this.findBooking(dto.bookingId);
    this.assertGuest(booking, user);
    this.assertChangeable(booking);
    const { checkIn, checkOut } = this.parseDates(dto.checkIn, dto.checkOut);
    if (checkIn.getTime() === new Date(booking.checkIn).getTime() && checkOut.getTime() === new Date(booking.checkOut).getTime()) {
      throw new BadRequestException('These are already your dates');
    }
    const { nights, priceBreakdown } = await this.bookings.quoteStayChange(booking, checkIn, checkOut);
    const currentTotal = booking.priceBreakdown.totalAmount;
    const difference = priceBreakdown.totalAmount - currentTotal;
    const refundAmount = difference < 0 ? await this.bookings.refundForCheaperStay(booking, -difference) : 0;
    return {
      checkIn,
      checkOut,
      nights,
      priceBreakdown,
      currentTotal,
      newTotal: priceBreakdown.totalAmount,
      difference,
      amountDue: difference >= MIN_CHARGE ? difference : 0,
      refundAmount,
    };
  }

  async request(user: Actor, dto: { bookingId: string; checkIn: string; checkOut: string; note?: string }): Promise<BookingDateChange> {
    const quote = await this.preview(user, dto);
    const booking = await this.findBooking(dto.bookingId);
    const checkInDay = new Date(booking.checkIn);
    checkInDay.setUTCHours(0, 0, 0, 0);

    let change: BookingDateChangeDocument;
    try {
      change = await this.changeModel.create({
        bookingId: booking._id,
        guestId: booking.guestId,
        hostId: booking.hostId,
        previousCheckIn: booking.checkIn,
        previousCheckOut: booking.checkOut,
        previousTotal: quote.currentTotal,
        checkIn: quote.checkIn,
        checkOut: quote.checkOut,
        nights: quote.nights,
        priceBreakdown: quote.priceBreakdown,
        amountDue: quote.amountDue,
        refundAmount: quote.refundAmount,
        guestNote: dto.note,
        expiresAt: new Date(Math.min(Date.now() + HOST_REPLY_MS, checkInDay.getTime())),
      });
    } catch (err: any) {
      if (err?.code === 11000) throw new ConflictException('You already have a date change waiting on this booking');
      throw err;
    }

    await this.notify(String(booking.hostId), {
      title: 'A guest wants to change their dates',
      message: `They’d like to stay ${day(quote.checkIn)} to ${day(quote.checkOut)} instead. Accept or decline within 48 hours.`,
      fr: { title: 'Un voyageur souhaite changer ses dates', message: `Il souhaite séjourner du ${day(quote.checkIn)} au ${day(quote.checkOut)} à la place. Acceptez ou refusez sous 48 heures.` },
      link: `/host/booking/${booking._id}`,
      metadata: { bookingId: String(booking._id), propertyId: String(booking.propertyId) },
    });
    await this.coHosts.notifyCoHosts(booking.propertyId, {
      type: NotificationType.BOOKING_DATE_CHANGE,
      title: 'A guest wants to change their dates',
      message: `They’d like to stay ${day(quote.checkIn)} to ${day(quote.checkOut)} instead.`,
      fr: { title: 'Un voyageur souhaite changer ses dates', message: `Il souhaite séjourner du ${day(quote.checkIn)} au ${day(quote.checkOut)} à la place.` },
      link: `/host/booking/${booking._id}`,
      metadata: { bookingId: String(booking._id), propertyId: String(booking.propertyId) },
    });
    return change;
  }

  async cancel(user: Actor, changeId: string): Promise<BookingDateChange> {
    const change = await this.findChange(changeId);
    if (String(change.guestId) !== idOf(user)) throw new ForbiddenException('This is not your booking');
    const closed = await this.closeIfOpen(changeId, DateChangeStatus.CANCELLED);
    if (!closed) throw new ConflictException('This request can no longer be withdrawn');
    if (change.status === DateChangeStatus.PENDING) {
      await this.notify(String(change.hostId), {
        title: 'Date change withdrawn',
        message: 'The guest withdrew their request. The booking keeps its original dates.',
        fr: { title: 'Changement de dates retiré', message: 'Le voyageur a retiré sa demande. La réservation garde ses dates initiales.' },
        link: `/host/booking/${change.bookingId}`,
        metadata: { bookingId: String(change.bookingId) },
      });
    }
    return closed;
  }

  // ── Guest and host ──────────────────────────────────────────────────────────

  async forBooking(user: Actor, bookingId: string) {
    const booking = await this.findBooking(bookingId);
    const isGuest = String(booking.guestId) === idOf(user);
    const isHost = String(booking.hostId) === idOf(user);
    if (!isGuest && !isHost && user.role !== 'admin' && !(await this.coHosts.isActive(idOf(user), booking.propertyId))) {
      throw new ForbiddenException('This is not your booking');
    }
    const latest = await this.changeModel.findOne({ bookingId: booking._id }).sort({ createdAt: -1 }).lean();
    return {
      change: latest,
      canRequest: isGuest && this.isChangeable(booking) && !latest?.active,
    };
  }

  // ── Host ────────────────────────────────────────────────────────────────────

  async accept(user: Actor, changeId: string): Promise<BookingDateChange> {
    const change = await this.findChange(changeId);
    const booking = await this.findBooking(String(change.bookingId));
    const isCoHost = await this.assertHost(change, booking, user);
    if (change.status !== DateChangeStatus.PENDING) throw new ConflictException('This request has already been answered');
    if (change.expiresAt.getTime() <= Date.now()) throw new ConflictException('This request has expired');
    // Co-hosts never move money: a change that refunds the guest cuts the owner's payout.
    if (isCoHost && change.refundAmount > 0) {
      throw new ForbiddenException('This change refunds the guest, so the listing’s host has to accept it');
    }
    this.assertChangeable(booking);
    // Someone else may have booked those dates since the guest asked.
    await this.bookings.quoteStayChange(booking, change.checkIn, change.checkOut);

    if (change.amountDue > 0) {
      const waiting = await this.changeModel.findOneAndUpdate(
        { _id: changeId, status: DateChangeStatus.PENDING },
        { $set: { status: DateChangeStatus.AWAITING_PAYMENT, expiresAt: new Date(Date.now() + GUEST_PAY_MS) } },
        { new: true },
      );
      if (!waiting) throw new ConflictException('This request has already been answered');
      await this.notify(String(change.guestId), {
        title: 'Your host accepted the new dates',
        message: `Pay the ${change.amountDue} ${booking.currency ?? 'XAF'} difference within 24 hours to confirm them.`,
        fr: { title: 'Votre hôte a accepté les nouvelles dates', message: `Payez la différence de ${change.amountDue} ${booking.currency ?? 'XAF'} sous 24 heures pour les confirmer.` },
        link: `/booking/${booking._id}`,
        metadata: { bookingId: String(booking._id), propertyId: String(booking.propertyId) },
      });
      return waiting;
    }

    const claimed = await this.changeModel.findOneAndUpdate(
      { _id: changeId, status: DateChangeStatus.PENDING },
      { $set: { status: DateChangeStatus.APPLYING } },
      { new: true },
    );
    if (!claimed) throw new ConflictException('This request has already been answered');

    if (claimed.refundAmount > 0) {
      const back = () => this.changeModel.updateOne(
        { _id: changeId, status: DateChangeStatus.APPLYING },
        { $set: { status: DateChangeStatus.PENDING } },
      );
      let refunded = false;
      try {
        refunded = await this.payments.processBookingRefund(String(booking._id), claimed.refundAmount, 'Date change', 'date_change');
      } catch (err: any) {
        await back();
        throw new BadGatewayException(`The guest’s refund did not go through, so the dates were not changed: ${err?.message ?? err}`);
      }
      if (!refunded) {
        await back();
        throw new BadGatewayException('The guest’s refund did not go through, so the dates were not changed.');
      }
    }
    return this.finish(claimed, booking);
  }

  async decline(user: Actor, changeId: string, reason?: string): Promise<BookingDateChange> {
    const change = await this.findChange(changeId);
    await this.assertHost(change, await this.findBooking(String(change.bookingId)), user);
    const declined = await this.changeModel.findOneAndUpdate(
      { _id: changeId, status: DateChangeStatus.PENDING },
      { $set: { status: DateChangeStatus.DECLINED, active: false, declineReason: reason } },
      { new: true },
    );
    if (!declined) throw new ConflictException('This request has already been answered');
    await this.notify(String(change.guestId), {
      title: 'Your host declined the new dates',
      message: `Your booking keeps its original dates.${reason ? ` ${reason}` : ''}`,
      fr: { title: 'Votre hôte a refusé les nouvelles dates', message: `Votre réservation garde ses dates initiales.${reason ? ` ${reason}` : ''}` },
      link: `/booking/${change.bookingId}`,
      metadata: { bookingId: String(change.bookingId) },
    });
    return declined;
  }

  // ── Checkout ────────────────────────────────────────────────────────────────

  /** For the payment screen: what the guest owes on an accepted change. */
  async payable(userId: string, changeId: string): Promise<{ change: BookingDateChange; title: string }> {
    const change = await this.findChange(changeId);
    if (String(change.guestId) !== String(userId)) throw new ForbiddenException('This is not your booking');
    if (change.status !== DateChangeStatus.AWAITING_PAYMENT || change.expiresAt.getTime() <= Date.now() || !(change.amountDue > 0)) {
      throw new ConflictException('This date change is no longer waiting for payment');
    }
    const booking = await this.findBooking(String(change.bookingId));
    this.assertChangeable(booking);
    const property: any = await this.propertyModel.findById(booking.propertyId).select('title').lean();
    return { change, title: property?.title ?? '' };
  }

  /**
   * The difference has been paid. Money really moved, so this also accepts a payment that
   * lands just after the request expired, as long as the dates are still free. Otherwise
   * it reports why, and checkout flags the payment for an admin to refund.
   */
  async applyPaid(changeId: string, payment: DateChangePayment): Promise<{ ok: true; checkOut: Date } | { ok: false; reason: string }> {
    const change = await this.findChange(changeId);
    if (change.status === DateChangeStatus.APPLIED) return { ok: true, checkOut: change.checkOut };

    const booking = await this.findBooking(String(change.bookingId));
    if (!this.isChangeable(booking)) return { ok: false, reason: 'the booking can no longer be changed' };

    try {
      await this.bookings.quoteStayChange(booking, change.checkIn, change.checkOut);
    } catch (err: any) {
      return { ok: false, reason: String(err?.message ?? err) };
    }

    let claimed: BookingDateChangeDocument | null;
    try {
      claimed = await this.changeModel.findOneAndUpdate(
        {
          _id: changeId,
          status: { $in: [DateChangeStatus.AWAITING_PAYMENT, DateChangeStatus.EXPIRED, DateChangeStatus.APPLYING] },
        },
        { $set: { status: DateChangeStatus.APPLYING, active: true } },
        { new: true },
      );
    } catch (err: any) {
      if (err?.code === 11000) return { ok: false, reason: 'another date change is open on this booking' };
      throw err;
    }
    if (!claimed) return { ok: false, reason: `the request is ${change.status}` };

    await this.payments.recordDateChangePayment(booking, payment);

    // Exactly once, even if the webhook is delivered again after a crash here.
    const firstTime = await this.changeModel.findOneAndUpdate(
      { _id: changeId, holdAdded: { $ne: true } },
      { $set: { holdAdded: true } },
    );
    if (firstTime) {
      const property: any = await this.propertyModel.findById(booking.propertyId).select('checkInTime').lean();
      await this.payouts.addToHold({
        bookingId: String(booking._id),
        hostId: String(booking.hostId),
        amount: this.payments.hostShareOf(payment.amount),
        checkIn: change.checkIn,
        checkInTime: property?.checkInTime,
      });
    }

    await this.finish(claimed, booking);
    return { ok: true, checkOut: change.checkOut };
  }

  // ── Jobs ────────────────────────────────────────────────────────────────────

  @Cron(CronExpression.EVERY_10_MINUTES, { name: 'expire-date-changes' })
  async runJob(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await this.expireOverdue();
      await this.alertStuck();
    } catch (err: any) {
      this.logger.error(`expire-date-changes failed: ${err?.message}`, err?.stack);
    } finally {
      this.running = false;
    }
  }

  async expireOverdue(batchSize = 200): Promise<number> {
    const due = await this.changeModel
      .find({ status: { $in: [DateChangeStatus.PENDING, DateChangeStatus.AWAITING_PAYMENT] }, expiresAt: { $lte: new Date() } })
      .limit(batchSize);
    let expired = 0;
    for (const change of due) {
      if (!(await this.closeIfOpen(String(change._id), DateChangeStatus.EXPIRED))) continue;
      expired++;
      await this.notify(String(change.guestId), {
        title: 'Your date change expired',
        message: change.status === DateChangeStatus.PENDING
          ? 'Your host didn’t answer in time. Your booking keeps its original dates.'
          : 'The difference wasn’t paid in time. Your booking keeps its original dates.',
        fr: { title: 'Votre changement de dates a expiré', message: change.status === DateChangeStatus.PENDING ? "Votre hôte n'a pas répondu à temps. Votre réservation garde ses dates initiales." : "La différence n'a pas été payée à temps. Votre réservation garde ses dates initiales." },
        link: `/booking/${change.bookingId}`,
        metadata: { bookingId: String(change.bookingId) },
      });
    }
    return expired;
  }

  /** The server stopped mid-way: a person has to check whether the money moved. */
  private async alertStuck(): Promise<void> {
    const stuck = await this.changeModel.find({
      status: DateChangeStatus.APPLYING,
      updatedAt: { $lte: new Date(Date.now() - STUCK_AFTER_MS) },
      stuckAlertedAt: { $exists: false },
    }).limit(50);
    for (const change of stuck) {
      await this.notifications.notifyAdmins({
        title: 'Date change stuck',
        message: `The date change on booking ${change.bookingId} stopped half-way. Check CamerPay and the booking’s dates.`,
        metadata: { bookingId: String(change.bookingId), changeId: String(change._id) },
      });
      await this.changeModel.updateOne({ _id: change._id }, { $set: { stuckAlertedAt: new Date() } });
    }
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  /** Money is settled: the booking takes its new dates. */
  private async finish(change: BookingDateChangeDocument, booking: BookingDocument): Promise<BookingDateChange> {
    const moved = await this.bookingModel.updateOne(
      { _id: booking._id, status: BookingStatus.CONFIRMED },
      {
        $set: {
          checkIn: change.checkIn,
          checkOut: change.checkOut,
          nights: change.nights,
          priceBreakdown: change.priceBreakdown,
        },
      },
    );
    if (!moved.matchedCount) {
      // Cancelled in the moment since the checks ran. The money has already moved.
      await this.notifications.notifyAdmins({
        title: 'Date change could not be applied',
        message: `Booking ${booking._id} was closed while its date change was being applied. Check its payments.`,
        metadata: { bookingId: String(booking._id), changeId: String(change._id) },
      });
    }

    const property: any = await this.propertyModel.findById(booking.propertyId).select('checkInTime').lean();
    await this.payouts.reschedule(String(booking._id), change.checkIn, property?.checkInTime);

    const done = await this.changeModel.findByIdAndUpdate(
      change._id,
      { $set: { status: DateChangeStatus.APPLIED, active: false, appliedAt: new Date() } },
      { new: true },
    );

    const when = `${day(change.checkIn)} to ${day(change.checkOut)}`;
    const metadata = { bookingId: String(booking._id), propertyId: String(booking.propertyId) };
    await this.notify(String(booking.guestId), {
      title: 'Your new dates are confirmed',
      message: `Your stay is now ${when}.`,
      fr: { title: 'Vos nouvelles dates sont confirmées', message: `Votre séjour est maintenant du ${day(change.checkIn)} au ${day(change.checkOut)}.` },
      link: `/booking/${booking._id}`,
      metadata,
    });
    await this.notify(String(booking.hostId), {
      title: 'Booking dates changed',
      message: `This stay is now ${when}.`,
      fr: { title: 'Dates de réservation modifiées', message: `Ce séjour est maintenant du ${day(change.checkIn)} au ${day(change.checkOut)}.` },
      link: `/host/booking/${booking._id}`,
      metadata,
    });
    return done!;
  }

  private closeIfOpen(changeId: string, status: DateChangeStatus) {
    return this.changeModel.findOneAndUpdate(
      { _id: changeId, status: { $in: OPEN.filter((s) => s !== DateChangeStatus.APPLYING) } },
      { $set: { status, active: false } },
      { new: true },
    );
  }

  /** Paid, confirmed, and check-in day hasn't arrived. */
  private isChangeable(booking: BookingDocument): boolean {
    const checkInDay = new Date(booking.checkIn);
    checkInDay.setUTCHours(0, 0, 0, 0);
    return booking.status === BookingStatus.CONFIRMED
      && booking.paymentStatus === PaymentStatus.PAID
      && checkInDay.getTime() > Date.now();
  }

  private assertChangeable(booking: BookingDocument): void {
    if (!this.isChangeable(booking)) {
      throw new BadRequestException('Dates can only be changed on a paid, confirmed booking before check-in day');
    }
  }

  private assertGuest(booking: BookingDocument, user: Actor): void {
    if (String(booking.guestId) !== idOf(user)) throw new ForbiddenException('Only the guest can change the dates');
  }

  /** Returns true when they're a co-host rather than the host. */
  private async assertHost(change: BookingDateChangeDocument, booking: BookingDocument, user: Actor): Promise<boolean> {
    if (String(change.hostId) === idOf(user)) return false;
    if (await this.coHosts.isActive(idOf(user), booking.propertyId)) return true;
    throw new ForbiddenException('This is not your booking');
  }

  private parseDates(checkInRaw: string, checkOutRaw: string): { checkIn: Date; checkOut: Date } {
    const checkIn = new Date(checkInRaw);
    const checkOut = new Date(checkOutRaw);
    if (isNaN(checkIn.getTime()) || isNaN(checkOut.getTime())) throw new BadRequestException('Invalid dates');
    return { checkIn, checkOut };
  }

  private async findBooking(bookingId: string): Promise<BookingDocument> {
    if (!isValidObjectId(bookingId)) throw new NotFoundException('Booking not found');
    const booking = await this.bookingModel.findById(bookingId);
    if (!booking) throw new NotFoundException('Booking not found');
    return booking;
  }

  private async findChange(changeId: string): Promise<BookingDateChangeDocument> {
    if (!isValidObjectId(changeId)) throw new NotFoundException('Request not found');
    const change = await this.changeModel.findById(changeId);
    if (!change) throw new NotFoundException('Request not found');
    return change;
  }

  /** The change itself is already saved: a failed notice must not undo it. */
  private async notify(
    userId: string,
    params: { title: string; message: string; fr?: { title: string; message: string }; link: string; metadata: Record<string, any> },
  ): Promise<void> {
    try {
      await this.notifications.create({ userId, type: NotificationType.BOOKING_DATE_CHANGE, ...params } as any);
    } catch (err: any) {
      this.logger.warn(`Notification to ${userId} failed: ${err?.message}`);
    }
  }
}
