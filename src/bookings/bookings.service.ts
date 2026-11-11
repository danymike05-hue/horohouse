import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
  ConflictException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import {
  BookingPriceBreakdown,
  Booking, BookingDocument, BookingStatus, PaymentStatus, CancelledBy } from './schema/booking.schema';
import { Property, PropertyDocument, PropertyStatus, ApprovalStatus } from '../properties/schemas/property.schema';
import { User, UserDocument, UserRole } from '../users/schemas/user.schema';
import { RoomsService } from '../rooms/rooms.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PaymentsService } from '../payments/services/payments.service';
import { HostPayoutsService } from '../payments/services/host-payouts.service';
import { CoHostsService } from '../co-hosts/co-hosts.service';
import {
  CreateBookingDto,
  CancelBookingDto,
  RespondToBookingDto,
  UpdatePaymentDto,
  BookingQueryDto,
} from './dto/booking.dto';
import { HostStatsDto } from './dto/host-stats.dto';

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * Guest-facing service fee rate.
 * Set to 0 — the platform commission is deducted from the HOST payout,
 * not added on top of the guest's payment (host-only commission model).
 */
const SERVICE_FEE_RATE = 0;

/**
 * Unpaid holds that block a calendar at the same time, per guest. Stops one account from
 * locking many listings with requests it never pays (security audit: calendar blocking).
 */
const MAX_OPEN_HOLDS_PER_GUEST = 3;

/** Instant-book: the guest must pay within this window or the dates are released. */
const INSTANT_BOOK_PAYMENT_MINUTES = 30;

/** Request-to-book: the host must answer within this window or the request expires. */
const REQUEST_RESPONSE_HOURS = 48;

/** After the host accepts a request, the guest has this long to pay. */
const PAYMENT_AFTER_ACCEPT_HOURS = 24;

/**
 * A booking only holds its dates while it is paid, has no deadline (legacy / cash), or its
 * deadline hasn't passed. Expired unpaid bookings stop blocking the calendar immediately,
 * even before the expiry job cancels them.
 */
function activeHoldFilter(now = new Date()) {
  return {
    $or: [
      { paymentStatus: PaymentStatus.PAID },
      { expiresAt: { $exists: false } },
      { expiresAt: null },
      { expiresAt: { $gt: now } },
    ],
  };
}

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface PaginatedBookings {
  bookings: Booking[];
  total: number;
  page: number;
  totalPages: number;
}

export interface AvailabilityResult {
  available: boolean;
  /** Host-blocked ranges. source = 'manual' | 'ical' on room calendars (only manual can be unblocked). */
  unavailableDates: { from: Date; to: Date; reason?: string; source?: string }[];
  /** Room calendars only: how many identical rooms this type has. */
  capacity?: number;
  bookedRanges: Array<{
    checkIn: Date;
    checkOut: Date;
    roomId?: string;
    // Guest details below are only included for the host / admin (see getAvailability)
    status?: string;
    guests?: number;
    guestCount?: number;
    totalPrice?: number;
    guestName?: string;
    guestAvatar?: string | null;
    guest?: { name?: string; profilePicture?: string };
  }>;
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class BookingsService {
  private readonly logger = new Logger(BookingsService.name);

  constructor(
    @InjectModel(Booking.name) private bookingModel: Model<BookingDocument>,
    @InjectModel(Property.name) private propertyModel: Model<PropertyDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private readonly roomsService: RoomsService,
    private readonly notificationsService: NotificationsService,
    @Inject(forwardRef(() => PaymentsService))
    private readonly paymentsService: PaymentsService,
    @Inject(forwardRef(() => HostPayoutsService))
    private readonly hostPayouts: HostPayoutsService,
    private readonly coHosts: CoHostsService,
  ) { }

  // ════════════════════════════════════════════════════════════════════════════
  // PUBLIC — GUEST ACTIONS
  // ════════════════════════════════════════════════════════════════════════════

  /**
   * Create a new booking request.
   * Validates: property exists & is short-term, dates are free, min/max nights,
   * max guests. Computes full price breakdown. If property.isInstantBookable,
   * status is set to CONFIRMED immediately.
   */
  async createBooking(dto: CreateBookingDto, guest: User): Promise<Booking> {
    // ── 1. Resolve & validate the property ──────────────────────────────────
    const property = await this.propertyModel
      .findById(dto.propertyId)
      .populate('ownerId', 'name email phoneNumber')
      .exec();

    if (!property) {
      throw new NotFoundException('Property not found');
    }

    if (property.approvalStatus !== ApprovalStatus.APPROVED || !property.isActive) {
      throw new BadRequestException('This property is not available for booking');
    }

    if (property.listingType !== 'short_term') {
      throw new BadRequestException(
        'This property does not accept short-term bookings. Use the inquiry system instead.',
      );
    }

    if (property.availability !== PropertyStatus.ACTIVE) {
      throw new BadRequestException('This property is not currently available');
    }

    // ── 2. Dates: valid, stay length, advance notice, booking window ─────────
    const { checkIn, checkOut, nights } = this.assertStayAllowed(property, new Date(dto.checkIn), new Date(dto.checkOut));

    // ── 2c. Hotel room: load it so price, fees and capacity come from the room ─
    // (computePrice used to charge property.price for every room type.)
    let room: any = null;
    if (dto.roomId) {
      room = await this.roomsService.getRoomById(dto.roomId); // 400 / 404 on a bad ID
      if (String(room.propertyId) !== String(dto.propertyId)) {
        throw new BadRequestException('This room does not belong to this property');
      }
      if (room.isActive === false) {
        throw new BadRequestException('This room type is no longer available');
      }
    }
    // Breakfast rate: only when the room offers it
    const breakfastPrice = Number(room?.breakfastPrice) || 0;
    if (dto.withBreakfast && !(breakfastPrice > 0)) {
      throw new BadRequestException('This room does not offer breakfast');
    }
    const withBreakfast = !!dto.withBreakfast && breakfastPrice > 0;

    // ── 3. Check guest count ─────────────────────────────────────────────────
    const maxGuests = room?.maxGuests ?? (property as any).shortTermAmenities?.maxGuests ?? 99;
    const totalGuests = dto.guests.adults + (dto.guests.children ?? 0);

    if (totalGuests > maxGuests) {
      throw new BadRequestException(
        `This property accommodates a maximum of ${maxGuests} guest(s)`,
      );
    }

    // House rules the host set (missing = allowed, as on listings created before the rules)
    const rules = (property as any).houseRules ?? {};
    if (rules.childrenAllowed === false && (dto.guests.children ?? 0) > 0) {
      throw new BadRequestException('This place is not suitable for children (house rules).');
    }
    if (rules.infantsAllowed === false && (dto.guests.infants ?? 0) > 0) {
      throw new BadRequestException('This place is not suitable for infants (house rules).');
    }

    // ── 3b. Same guest, same stay, still unpaid → hand back that booking ─────
    // (guest went back from the payment step and tapped Reserve again). Without this the
    // guest's own hold makes the availability check below fail with a 409.
    const now = new Date();
    const RESUME_MIN_MS = 5 * 60_000; // the gateway refuses to start a payment with < 2 min left
    const existingHold = await this.bookingModel.findOne({
      guestId: guest._id,
      propertyId: new Types.ObjectId(dto.propertyId),
      roomId: dto.roomId ? new Types.ObjectId(dto.roomId) : null,
      checkIn,
      checkOut,
      status: BookingStatus.PENDING,
      paymentStatus: { $ne: PaymentStatus.PAID },
      expiresAt: { $gt: now },
    }).exec();
    if (existingHold) {
      // Same stay but the guest switched breakfast on/off: price differs, so start over
      const sameRate = !!(existingHold as any).withBreakfast === withBreakfast;
      if (sameRate && existingHold.expiresAt!.getTime() > now.getTime() + RESUME_MIN_MS) {
        return existingHold;
      }
      // Almost expired: release it now, or its own hold would make this new attempt a 409.
      await this.bookingModel.updateOne(
        { _id: existingHold._id, status: BookingStatus.PENDING, paymentStatus: { $ne: PaymentStatus.PAID } },
        {
          $set: {
            status: BookingStatus.CANCELLED,
            cancellation: { cancelledBy: CancelledBy.SYSTEM, cancelledAt: now, reason: 'replaced_by_new_attempt', refundAmount: 0 },
          },
        },
      );
    }

    // ── 3c. Limit open unpaid holds per guest ────────────────────────────────
    const openHolds = await this.bookingModel.countDocuments({
      guestId: guest._id,
      status: BookingStatus.PENDING,
      paymentStatus: { $ne: PaymentStatus.PAID },
      expiresAt: { $gt: now },
    });
    if (openHolds >= MAX_OPEN_HOLDS_PER_GUEST) {
      throw new BadRequestException(
        `You already have ${openHolds} reservations waiting for payment or a host reply. ` +
        `Finish or cancel one before booking another.`,
      );
    }

    // ── 4. Availability check ────────────────────────────────────────────────
    // If a roomId is provided, delegate to room-level check; otherwise check property-wide
    if (dto.roomId) {
      await this.roomsService.assertRoomDatesAvailable(dto.roomId, checkIn, checkOut);
    } else {
      await this.assertDatesAvailable(dto.propertyId, checkIn, checkOut);
    }

    // ── 5. Build price breakdown ─────────────────────────────────────────────
    const priceBreakdown: any = this.computePrice(property, nights, room, checkIn, totalGuests);
    if (withBreakfast) {
      // Per guest (infants eat free) per night; not part of the stay discount
      const breakfastFee = Math.round(breakfastPrice * totalGuests * nights);
      priceBreakdown.breakfastFee = breakfastFee;
      priceBreakdown.totalAmount += breakfastFee;
    }

    // ── 6. Determine host ────────────────────────────────────────────────────
    const rawHostRef = property.ownerId ?? property.agentId;
    const hostIdStr: string | undefined = (rawHostRef as any)?._id
      ? (rawHostRef as any)._id.toString()
      : rawHostRef?.toString();
    const validHostObjectId = hostIdStr && Types.ObjectId.isValid(hostIdStr)
      ? new Types.ObjectId(hostIdStr)
      : undefined;

    // ── 7. Instant book? Payment required before confirmation either way ────
    // Hosts can keep Instant Book for verified guests only; everyone else sends a request.
    let guestVerified = false;
    if ((property as any).instantBookRequiresVerifiedGuest) {
      const fresh: any = await this.userModel
        .findById(guest._id)
        .select('identityVerification.status hostProfile.verificationStatus')
        .lean()
        .exec();
      guestVerified =
        fresh?.identityVerification?.status === 'verified' ||
        fresh?.hostProfile?.verificationStatus === 'verified';
    }
    const isInstantBook =
      !!(property as any).isInstantBookable &&
      (!(property as any).instantBookRequiresVerifiedGuest || guestVerified);
    const initialStatus = BookingStatus.PENDING;
    const confirmedAt = undefined;

    // Instant-book: guest must pay within 30 min or the slot releases.
    // Non-instant: host must respond within 48h or the request expires.
    const expiresAt = isInstantBook
      ? new Date(Date.now() + INSTANT_BOOK_PAYMENT_MINUTES * 60 * 1000)
      : new Date(Date.now() + REQUEST_RESPONSE_HOURS * 60 * 60 * 1000);

    // ── 8. Persist ───────────────────────────────────────────────────────────
    const booking = new this.bookingModel({
      propertyId: new Types.ObjectId(dto.propertyId),
      ...(dto.roomId ? { roomId: new Types.ObjectId(dto.roomId) } : {}),
      guestId: guest._id,
      ...(validHostObjectId ? { hostId: validHostObjectId } : {}),
      checkIn,
      checkOut,
      nights,
      guests: {
        adults: dto.guests.adults,
        children: dto.guests.children ?? 0,
        infants: dto.guests.infants ?? 0,
        pets: dto.guests.pets ?? 0,
      },
      priceBreakdown,
      currency: dto.currency ?? (property as any).currency ?? 'XAF',
      status: initialStatus,
      paymentStatus: PaymentStatus.UNPAID,
      isInstantBook,
      confirmedAt,
      expiresAt,
      guestNote: dto.guestNote,
      withBreakfast,
    });

    const saved = await booking.save();

    const fmt = (d: Date) => d.toISOString().split('T')[0];
    const propertyTitle = (property as any).title ?? 'your property';
    const guestIdStr = guest._id.toString();
    const bookingIdStr = saved._id.toString();

    // ── Send notifications (non-fatal — booking already persisted) ────────────
    try {
      if (isInstantBook) {
        // Nothing yet: this is an unpaid 30-minute hold. Once the payment lands,
        // BookingPaymentGateway.markPaid → PaymentsService.processSuccessfulPayment confirms the
        // booking and notifies the host. (Telling the guest "confirmed" here was premature.)
      } else {
        // Host & Guest: booking request submitted (non-instant)
        await this.notificationsService.notifyBookingRequest(hostIdStr ?? '', {
          guestId: guestIdStr,
          bookingId: bookingIdStr,
          propertyId: dto.propertyId,
          propertyTitle,
          guestName: guest.name,
          checkIn: fmt(checkIn),
          checkOut: fmt(checkOut),
        });
        await this.coHosts.notifyCoHosts(dto.propertyId, {
          title: 'New booking request',
          message: `${guest.name} asked to stay at ${propertyTitle} from ${fmt(checkIn)} to ${fmt(checkOut)}.`,
          fr: { title: 'Nouvelle demande de réservation', message: `${guest.name} souhaite séjourner à ${propertyTitle} du ${fmt(checkIn)} au ${fmt(checkOut)}.` },
          link: `/host/booking/${bookingIdStr}`,
          metadata: { bookingId: bookingIdStr, propertyId: dto.propertyId },
        });
      }
    } catch (notifErr: any) {
      // Non-fatal: the booking is already saved. Log so it's visible in server logs.
      this.logger.warn(
        `createBooking: notification delivery failed for booking ${bookingIdStr}: ${notifErr?.message}`,
      );
    }

    return saved;
  }

  /**
   * Guest cancels their own booking.
   * Applies refund logic based on the property's cancellation policy.
   * Notifies both guest and host via in-app + push after cancellation.
   */
  async cancelBooking(
    bookingId: string,
    dto: CancelBookingDto,
    user: User,
  ): Promise<Booking> {
    const booking = await this.findBookingOrThrow(bookingId);

    // Only the guest, host, or admin can cancel
    const isGuest = booking.guestId.toString() === user._id.toString();
    const isHost = booking.hostId.toString() === user._id.toString();
    const isAdmin = user.role === UserRole.ADMIN;

    if (!isGuest && !isHost && !isAdmin) {
      throw new ForbiddenException('You are not authorized to cancel this booking');
    }

    const cancellableStatuses = [BookingStatus.PENDING, BookingStatus.CONFIRMED];
    if (!cancellableStatuses.includes(booking.status)) {
      throw new BadRequestException(
        `Cannot cancel a booking with status "${booking.status}"`,
      );
    }

    const cancelledBy: CancelledBy = isAdmin
      ? CancelledBy.ADMIN
      : isGuest
        ? CancelledBy.GUEST
        : CancelledBy.HOST;

    // Guest cancels: the listing's cancellation policy decides. Host or admin cancels:
    // the guest gets everything back (it used to apply the guest policy here too, so a
    // host cancelling a week before a strict listing kept half the guest's money).
    const refundAmount = await this.computeRefund(booking, cancelledBy);

    const updated = await this.bookingModel
      .findByIdAndUpdate(
        bookingId,
        {
          status: BookingStatus.CANCELLED,
          cancellation: {
            cancelledBy,
            cancelledAt: new Date(),
            reason: dto.reason,
            refundAmount,
            refundStatus: refundAmount > 0 ? 'pending' : undefined,
          },
        },
        { new: true },
      )
      .exec();

    this.logger.log(`Booking ${bookingId} cancelled by ${cancelledBy}`);

    // ── Trigger refund if applicable ────────────────────────────────────────
    // Runs AFTER the booking is already CANCELLED in the DB, so the cancellation
    // itself always succeeds even if the payment provider is temporarily unavailable.
    let refundSettled = refundAmount === 0;
    if (refundAmount > 0) {
      try {
        refundSettled = await this.paymentsService.processBookingRefund(
          bookingId,
          refundAmount,
          dto.reason,
        );
      } catch (refundErr: any) {
        // The booking is already cancelled. The refund failed (e.g. CamerPay error).
        // The guest's refundStatus is already 'failed' (set by processBookingRefund).
        // Log for support — do NOT throw; the cancellation response still returns 200.
        this.logger.error(
          `cancelBooking: Refund failed for booking ${bookingId}: ${refundErr.message}. ` +
            `Manual refund required.`,
        );
      }
    }

    // The stay won't happen, so what the policy leaves the host doesn't need to wait for
    // check-in. If the refund failed, it stays held until an admin sorts it out.
    if (refundSettled) {
      try {
        await this.hostPayouts.settleNow(bookingId);
      } catch (payoutErr: any) {
        this.logger.warn(`cancelBooking: payout not settled for ${bookingId}: ${payoutErr?.message}`);
      }
    }

    // ── Notify both parties (in-app + push) ────────────────────────────────
    try {
      const [property, guest, host] = await Promise.all([
        this.propertyModel.findById(booking.propertyId).select('title').lean(),
        this.userModel.findById(booking.guestId).select('name').lean(),
        this.userModel.findById(booking.hostId).select('name').lean(),
      ]);
      const fmt = (d: Date) => new Date(d).toISOString().split('T')[0];

      // Note: refundAmount is intentionally NOT passed here.
      // The refund notification is sent inside processBookingRefund()
      // ONLY after CamerPay confirms the refund — not optimistically.
      await this.notificationsService.notifyBookingCancelled({
        guestId: booking.guestId.toString(),
        hostId: booking.hostId.toString(),
        bookingId,
        propertyId: booking.propertyId.toString(),
        propertyTitle: (property as any)?.title ?? 'the property',
        guestName: (guest as any)?.name ?? 'Guest',
        hostName: (host as any)?.name ?? 'Host',
        checkIn: fmt(booking.checkIn),
        checkOut: fmt(booking.checkOut),
        cancelledByGuest: cancelledBy === CancelledBy.GUEST,
        // Deliberately omitting refundAmount — the refund notification is
        // handled separately in processBookingRefund() after CamerPay confirms.
      });
    } catch (notifErr: any) {
      // Non-fatal: the cancellation already succeeded
      this.logger.warn(`cancelBooking: notification failed for ${bookingId}: ${notifErr.message}`);
    }
    return updated!;
  }

  /**
   * Guest retrieves their own bookings.
   */
  async getGuestBookings(guestId: string, query: BookingQueryDto): Promise<PaginatedBookings> {
    return this.paginateBookings({ guestId: new Types.ObjectId(guestId) }, query);
  }

  // ════════════════════════════════════════════════════════════════════════════
  // HOST ACTIONS
  // ════════════════════════════════════════════════════════════════════════════

  /**
   * Host confirms a pending booking.
   */
  async confirmBooking(bookingId: string, dto: RespondToBookingDto, host: User): Promise<Booking> {
    const booking = await this.findBookingOrThrow(bookingId);
    await this.assertIsHost(booking, host);

    if (booking.status !== BookingStatus.PENDING) {
      throw new BadRequestException(
        `Only PENDING bookings can be confirmed. Current status: ${booking.status}`,
      );
    }

    // Instant book: the guest's payment confirms it. A host "approving" an unpaid
    // instant hold turned its 30-minute payment window into a 24-hour one.
    if (booking.isInstantBook) {
      throw new BadRequestException('Instant bookings are confirmed when the guest pays — there is nothing to approve');
    }

    if (booking.expiresAt && booking.expiresAt.getTime() <= Date.now() && booking.paymentStatus !== PaymentStatus.PAID) {
      throw new BadRequestException('This request has expired. The guest needs to send a new one.');
    }

    // Re-check availability (another booking may have snuck in), excluding this booking.
    // Hotel bookings are checked against their room type (and its number of units);
    // a property-wide check would wrongly clash with the hotel's other rooms.
    if (booking.roomId) {
      await this.roomsService.assertRoomDatesAvailable(
        booking.roomId.toString(),
        booking.checkIn,
        booking.checkOut,
        bookingId,
      );
    } else {
      await this.assertDatesAvailable(
        booking.propertyId.toString(),
        booking.checkIn,
        booking.checkOut,
        bookingId,
      );
    }

    // Guest now has 24h to pay, or the confirmed slot auto-releases
    const paymentDeadline = new Date(Date.now() + PAYMENT_AFTER_ACCEPT_HOURS * 60 * 60 * 1000);

    const updated = await this.bookingModel
      .findByIdAndUpdate(
        bookingId,
        {
          status: BookingStatus.CONFIRMED,
          confirmedAt: new Date(),
          hostNote: dto.hostNote,
          expiresAt: paymentDeadline,
        },
        { new: true },
      )
      .exec();

    const property = await this.propertyModel.findById(booking.propertyId).select('title').lean();
    const fmt = (d: Date) => d.toISOString().split('T')[0];

    await this.notificationsService.notifyBookingConfirmed(booking.guestId.toString(), {
      bookingId: bookingId,
      propertyId: booking.propertyId.toString(),
      propertyTitle: (property as any)?.title ?? 'your property',
      hostName: host.name,
      checkIn: fmt(booking.checkIn),
      checkOut: fmt(booking.checkOut),
    });

    this.logger.log(`Booking ${bookingId} confirmed by host ${host._id}`);
    return updated!;
  }

  /**
   * Host rejects a pending booking.
   */
  async rejectBooking(bookingId: string, dto: RespondToBookingDto, host: User): Promise<Booking> {
    const booking = await this.findBookingOrThrow(bookingId);
    await this.assertIsHost(booking, host);

    if (booking.status !== BookingStatus.PENDING) {
      throw new BadRequestException('Only PENDING bookings can be rejected');
    }

    const updated = await this.bookingModel
      .findByIdAndUpdate(
        bookingId,
        {
          status: BookingStatus.REJECTED,
          hostNote: dto.hostNote,
          cancellation: {
            cancelledBy: CancelledBy.HOST,
            cancelledAt: new Date(),
            reason: dto.reason,
            refundAmount: 0,
          },
        },
        { new: true },
      )
      .exec();
    const property = await this.propertyModel.findById(booking.propertyId).select('title').lean();
    const fmt = (d: Date) => d.toISOString().split('T')[0];

    await this.notificationsService.notifyBookingRejected(booking.guestId.toString(), {
      bookingId: bookingId,
      propertyId: booking.propertyId.toString(),
      propertyTitle: (property as any)?.title ?? 'your property',
      hostName: host.name,
      checkIn: fmt(booking.checkIn),
      checkOut: fmt(booking.checkOut),
    });

    this.logger.log(`Booking ${bookingId} rejected by host ${host._id}`);
    return updated!;
  }

  /**
   * Host marks a booking as completed (after checkout).
   */
  async completeBooking(bookingId: string, host: User): Promise<Booking> {
    const booking = await this.findBookingOrThrow(bookingId);
    await this.assertIsHost(booking, host);
    return this.markCompleted(booking);
  }

  /**
   * Closes paid stays automatically once checkout day has passed (noon UTC that day,
   * after the usual 11:00 check-out in Cameroon), so guests and hosts get the review
   * prompt without the host having to tap "complete". Called hourly by BookingsScheduler.
   */
  async completeFinishedStays(batchSize = 100): Promise<number> {
    const cutoff = new Date(Date.now() - 12 * 60 * 60 * 1000);
    const due = await this.bookingModel
      .find({
        status: BookingStatus.CONFIRMED,
        paymentStatus: PaymentStatus.PAID,
        checkOut: { $lte: cutoff },
      })
      .limit(batchSize)
      .exec();
    let done = 0;
    for (const booking of due) {
      try {
        await this.markCompleted(booking);
        done++;
      } catch (err: any) {
        this.logger.warn(`completeFinishedStays: ${booking._id}: ${err?.message}`);
      }
    }
    return done;
  }

  private async markCompleted(booking: BookingDocument): Promise<Booking> {
    const bookingId = booking._id.toString();
    if (booking.status !== BookingStatus.CONFIRMED) {
      throw new BadRequestException('Only CONFIRMED bookings can be completed');
    }
    // Completing triggers review requests and counts toward the host's stays, so the
    // stay must have been paid and must be over (checkout day reached).
    if (booking.paymentStatus !== PaymentStatus.PAID) {
      throw new BadRequestException('This stay was never paid, so it can’t be completed');
    }
    const checkoutDay = new Date(booking.checkOut);
    checkoutDay.setUTCHours(0, 0, 0, 0);
    if (checkoutDay.getTime() > Date.now()) {
      throw new BadRequestException('You can mark the stay as completed from the check-out day');
    }

    const updated = await this.bookingModel
      .findByIdAndUpdate(
        bookingId,
        {
          status: BookingStatus.COMPLETED,
          actualCheckOut: new Date(),
        },
        { new: true },
      )
      .exec();

    this.logger.log(`Booking ${bookingId} marked as completed`);

    // ── Notify both parties and trigger review prompts ──────────────────────
    try {
      const [property, guest] = await Promise.all([
        this.propertyModel.findById(booking.propertyId).select('title').lean(),
        this.userModel.findById(booking.guestId).select('name').lean(),
      ]);
      await this.notificationsService.notifyBookingCompleted({
        guestId:       booking.guestId.toString(),
        hostId:        booking.hostId.toString(),
        bookingId,
        propertyId:    booking.propertyId.toString(),
        propertyTitle: (property as any)?.title ?? 'the property',
        guestName:     (guest as any)?.name ?? 'Guest',
      });
    } catch (notifErr: any) {
      // Non-fatal: the completion already succeeded
      this.logger.warn(`completeBooking: notification failed for ${bookingId}: ${notifErr.message}`);
    }

    return updated!;
  }

  /**
   * Host retrieves all bookings for their properties.
   */
  async getHostBookings(hostId: string, query: BookingQueryDto): Promise<PaginatedBookings> {
    const coHosted = await this.coHosts.propertyIdsFor(hostId);
    const mine = { hostId: new Types.ObjectId(hostId) };
    return this.paginateBookings(coHosted.length ? { $or: [mine, { propertyId: { $in: coHosted } }] } : mine, query);
  }

  /**
   * Get all bookings for a specific property. Only that property's owner / agent or an admin:
   * the role guard alone let ANY host read another host's guests (names, emails, phones).
   */
  async getPropertyBookings(propertyId: string, query: BookingQueryDto, user: User): Promise<PaginatedBookings> {
    await this.assertCanManageProperty(propertyId, user);
    return this.paginateBookings({ propertyId: new Types.ObjectId(propertyId) }, query);
  }


  async getHostStats(hostId: string): Promise<HostStatsDto> {
    const hostObjectId = new Types.ObjectId(hostId);
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [bookingStats, propertyStats] = await Promise.all([

      this.bookingModel.aggregate([
        { $match: { hostId: hostObjectId } },
        {
          $facet: {

            completedStays: [
              { $match: { status: { $in: ['completed', 'checked_out'] } } },
              { $count: 'total' },
            ],

            currentMonthEarnings: [
              {
                $match: {
                  status: { $in: ['confirmed', 'completed', 'checked_out'] },
                  checkIn: { $gte: monthStart },
                },
              },
              { $group: { _id: null, total: { $sum: '$priceBreakdown.totalAmount' } } },
            ],

            occupiedPropertyIds: [
              {
                $match: {
                  status: { $in: ['confirmed', 'checked_in'] },
                  checkIn: { $lte: now },
                  checkOut: { $gte: now },
                },
              },
              { $group: { _id: '$propertyId' } },
            ],
          }
        },
      ]),

      this.propertyModel.aggregate([
        { $match: { ownerId: hostObjectId, isActive: true } },
        {
          $group: {
            _id: null,
            totalListings: { $sum: 1 },
            avgRating: {
              $avg: {
                $cond: [{ $gt: ['$averageRating', 0] }, '$averageRating', null],
              },
            },
          },
        },
      ]),
    ]);

    const bStats = bookingStats[0];
    const completedStays = bStats.completedStays[0]?.total ?? 0;
    const currentMonthEarnings = bStats.currentMonthEarnings[0]?.total ?? 0;
    const occupiedCount = bStats.occupiedPropertyIds.length;
    const totalListings = propertyStats[0]?.totalListings ?? 0;
    const avgRating = propertyStats[0]?.avgRating ?? 0;
    const occupancyRate = totalListings > 0 ? (occupiedCount / totalListings) * 100 : 0;
    const isSuperhost = completedStays >= 10 && avgRating >= 4.8;

    return {
      totalListings,
      completedStays,
      currentMonthEarnings,
      avgRating: Math.round(avgRating * 10) / 10,
      occupancyRate: Math.round(occupancyRate * 10) / 10,
      isSuperhost,
    };
  }

  // ════════════════════════════════════════════════════════════════════════════
  // AVAILABILITY
  // ════════════════════════════════════════════════════════════════════════════

  /**
   * Returns blocked date ranges for a property (or specific room) within a date window.
   * Used by the frontend calendar widget.
   */
  /**
   * @param opts.includeGuestDetails Guest name / photo / price per booking. Only for the
   *   host or an admin (the /details route). The public calendar gets dates only: the
   *   public endpoint used to expose every guest's name, photo and booking total.
   */
  async getAvailability(
    propertyId: string,
    from: Date,
    to: Date,
    roomId?: string,
    opts: { includeGuestDetails?: boolean } = {},
  ): Promise<AvailabilityResult> {
    const property = await this.propertyModel.findById(propertyId).exec();
    if (!property) throw new NotFoundException('Property not found');

    // Host calendar for one hotel room type: every booking with who made it, so the host
    // sees "2 of 5 rooms booked" and the guests. The public room calendar stays dates-only.
    if (roomId && opts.includeGuestDetails) {
      return this.getRoomAvailabilityForHost(propertyId, roomId, from, to);
    }

    // If a roomId is provided, delegate to room-level availability
    if (roomId) {
      const roomResult = await this.roomsService.getRoomAvailability(roomId, from, to);
      return {
        available: roomResult.available,
        unavailableDates: roomResult.unavailableDates.map((r) => ({ from: r.from, to: r.to })),
        bookedRanges: roomResult.bookedRanges.map((r) => ({ checkIn: r.checkIn, checkOut: r.checkOut, roomId })),
      };
    }

    // 1. Host-blocked ranges stored directly on the property
    const hostBlockedRanges: { from: Date; to: Date }[] =
      ((property as any).unavailableDates ?? []).filter(
        (r: any) => r.from < to && r.to > from,
      );

    // 2. Bookings in the window that still hold their dates (property-wide, no room)
    const query = this.bookingModel
      .find({
        propertyId: new Types.ObjectId(propertyId),
        $and: [
          { $or: [{ roomId: { $exists: false } }, { roomId: null }] },
          activeHoldFilter(),
        ],
        status: { $in: [BookingStatus.CONFIRMED, BookingStatus.PENDING, BookingStatus.COMPLETED] },
        checkIn: { $lt: to },
        checkOut: { $gt: from },
      })
      .select(opts.includeGuestDetails
        ? 'checkIn checkOut status guests priceBreakdown.totalAmount guestId'
        : 'checkIn checkOut');
    if (opts.includeGuestDetails) query.populate('guestId', 'name profilePicture');
    const bookings = await query.lean().exec();

    const bookedRanges = bookings.map((b: any) => {
      if (!opts.includeGuestDetails) return { checkIn: b.checkIn, checkOut: b.checkOut };
      // The old select asked for guestCount / totalPrice, which don't exist on the schema.
      const guestCount = (b.guests?.adults ?? 0) + (b.guests?.children ?? 0);
      return {
        checkIn: b.checkIn,
        checkOut: b.checkOut,
        status: b.status,
        guests: guestCount,
        guestCount,
        totalPrice: b.priceBreakdown?.totalAmount,
        guestName: b.guestId?.name ?? 'Guest',
        guestAvatar: b.guestId?.profilePicture ?? null,
        guest: b.guestId ? { name: b.guestId.name, profilePicture: b.guestId.profilePicture } : undefined,
      };
    });

    const available = hostBlockedRanges.length === 0 && bookedRanges.length === 0;

    return { available, unavailableDates: hostBlockedRanges, bookedRanges };
  }

  private async getRoomAvailabilityForHost(
    propertyId: string,
    roomId: string,
    from: Date,
    to: Date,
  ): Promise<AvailabilityResult> {
    const room: any = await this.roomsService.getRoomById(roomId); // 400 / 404 on a bad ID
    if (String(room.propertyId?._id ?? room.propertyId) !== String(propertyId)) {
      throw new NotFoundException('Room not found for this property');
    }
    const quantity = Number(room.quantity);
    const capacity = Number.isFinite(quantity) && quantity >= 1 ? Math.floor(quantity) : 1;

    const bookings = await this.bookingModel
      .find({
        roomId: new Types.ObjectId(roomId),
        $and: [activeHoldFilter()],
        status: { $in: [BookingStatus.CONFIRMED, BookingStatus.PENDING, BookingStatus.COMPLETED] },
        checkIn: { $lt: to },
        checkOut: { $gt: from },
      })
      .select('checkIn checkOut status guests priceBreakdown.totalAmount guestId')
      .populate('guestId', 'name profilePicture')
      .sort({ checkIn: 1 })
      .lean()
      .exec();

    const bookedRanges = bookings.map((b: any) => {
      const guestCount = (b.guests?.adults ?? 0) + (b.guests?.children ?? 0);
      return {
        checkIn: b.checkIn,
        checkOut: b.checkOut,
        roomId,
        status: b.status,
        guests: guestCount,
        guestCount,
        totalPrice: b.priceBreakdown?.totalAmount,
        guestName: b.guestId?.name ?? 'Guest',
        guestAvatar: b.guestId?.profilePicture ?? null,
        guest: b.guestId ? { name: b.guestId.name, profilePicture: b.guestId.profilePicture } : undefined,
      };
    });

    const unavailableDates = ((room.unavailableDates ?? []) as any[])
      .filter((r) => new Date(r.from) < to && new Date(r.to) > from)
      .map((r) => ({ from: r.from, to: r.to, reason: r.reason, source: r.source ?? 'manual' }));

    return {
      available: unavailableDates.length === 0 && bookedRanges.length < capacity,
      unavailableDates,
      bookedRanges,
      capacity,
    };
  }

  // ════════════════════════════════════════════════════════════════════════════
  // EXPIRY (called every few minutes by BookingsScheduler)
  // ════════════════════════════════════════════════════════════════════════════

  /**
   * Cancels unpaid bookings whose deadline passed:
   *  - instant-book not paid within 30 min,
   *  - request the host didn't answer within 48 h,
   *  - request the host accepted but the guest didn't pay within 24 h.
   * Paid bookings are never touched. A payment that lands after this is caught by the
   * checkout webhook ("paid_after_booking_closed") and flagged for a refund.
   */
  async expireOverdueBookings(batchSize = 200): Promise<number> {
    const now = new Date();
    const overdue = await this.bookingModel
      .find({
        status: { $in: [BookingStatus.PENDING, BookingStatus.CONFIRMED] },
        paymentStatus: { $ne: PaymentStatus.PAID },
        expiresAt: { $lte: now },
      })
      .select('_id status isInstantBook guestId hostId propertyId checkIn checkOut')
      .limit(batchSize)
      .lean()
      .exec();

    let expired = 0;
    for (const b of overdue as any[]) {
      const reason =
        b.status === BookingStatus.CONFIRMED
          ? 'payment_not_received_after_acceptance'
          : b.isInstantBook
            ? 'payment_timeout'
            : 'host_did_not_respond';

      // Conditional update: a payment or host action that lands meanwhile wins.
      const res = await this.bookingModel.updateOne(
        {
          _id: b._id,
          status: { $in: [BookingStatus.PENDING, BookingStatus.CONFIRMED] },
          paymentStatus: { $ne: PaymentStatus.PAID },
        },
        {
          $set: {
            status: BookingStatus.CANCELLED,
            cancellation: { cancelledBy: CancelledBy.SYSTEM, cancelledAt: now, reason, refundAmount: 0 },
          },
        },
      );
      if (!res.modifiedCount) continue;
      expired++;

      try {
        const [property, guest, host] = await Promise.all([
          this.propertyModel.findById(b.propertyId).select('title').lean(),
          this.userModel.findById(b.guestId).select('name').lean(),
          this.userModel.findById(b.hostId).select('name').lean(),
        ]);
        const fmt = (d: Date) => new Date(d).toISOString().split('T')[0];
        await this.notificationsService.notifyBookingCancelled({
          guestId: b.guestId.toString(),
          hostId: b.hostId.toString(),
          bookingId: b._id.toString(),
          propertyId: b.propertyId.toString(),
          propertyTitle: (property as any)?.title ?? 'the property',
          guestName: (guest as any)?.name ?? 'Guest',
          hostName: (host as any)?.name ?? 'Host',
          checkIn: fmt(b.checkIn),
          checkOut: fmt(b.checkOut),
          cancelledByGuest: false,
        });
      } catch (err: any) {
        this.logger.warn(`expireOverdueBookings: notification failed for ${b._id}: ${err?.message}`);
      }
    }

    if (expired) this.logger.log(`Expired ${expired} unpaid booking(s)`);
    return expired;
  }

  // ════════════════════════════════════════════════════════════════════════════
  // ADMIN ACTIONS
  // ════════════════════════════════════════════════════════════════════════════

  async getAllBookings(query: BookingQueryDto): Promise<PaginatedBookings> {
    return this.paginateBookings({}, query);
  }

  async getBookingById(bookingId: string, user: User): Promise<Booking> {
    if (!Types.ObjectId.isValid(bookingId)) throw new BadRequestException('Invalid booking ID');
    const booking = await this.bookingModel
      .findById(bookingId)
      // cancellationPolicy + check-in times: the booking screen shows them.
      .populate('propertyId', 'title address city neighborhood images price cancellationPolicy isInstantBookable shortTermAmenities.checkInTime shortTermAmenities.checkOutTime shortTermAmenities.petsAllowed shortTermAmenities.smokingAllowed shortTermAmenities.partiesAllowed houseRules')
      .populate('guestId', 'name email phoneNumber profilePicture')
      .populate('hostId', 'name email phoneNumber profilePicture')
      .exec();

    if (!booking) throw new NotFoundException('Booking not found');

    const guestId = (booking.guestId as any)?._id ?? booking.guestId;
    const hostId = (booking.hostId as any)?._id ?? booking.hostId;

    const isGuest = guestId.toString() === user._id.toString();
    const isHost = hostId.toString() === user._id.toString();
    const isAdmin = user.role === UserRole.ADMIN;

    if (!isGuest && !isHost && !isAdmin) {
      const propertyId = (booking.propertyId as any)?._id ?? booking.propertyId;
      if (!(await this.coHosts.isActive(user._id, propertyId))) {
        throw new ForbiddenException('You do not have access to this booking');
      }
      // A co-host runs the stay, not the money: the owner's payout stays private.
      const forCoHost: any = booking.toObject();
      delete forCoHost.payout;
      forCoHost.viewerIsCoHost = true;
      return forCoHost;
    }

    return booking;
  }

  /**
   * Admin or payment webhook updates payment status.
   */
  async updatePayment(bookingId: string, dto: UpdatePaymentDto): Promise<Booking> {
    const updateData: any = { paymentStatus: dto.paymentStatus };

    if (dto.paymentReference) updateData.paymentReference = dto.paymentReference;
    if (dto.paymentMethod) updateData.paymentMethod = dto.paymentMethod;
    if (dto.paymentStatus === 'paid') updateData.paidAt = new Date();

    const updated = await this.bookingModel
      .findByIdAndUpdate(bookingId, updateData, { new: true })
      .exec();

    if (!updated) throw new NotFoundException('Booking not found');
    return updated;
  }

  /**
   * Admin gets overall booking statistics.
   */
  async getBookingStats(): Promise<any> {
    const stats = await this.bookingModel.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalRevenue: { $sum: '$priceBreakdown.totalAmount' },
        },
      },
    ]);

    const totalBookings = await this.bookingModel.countDocuments();
    const totalRevenue = await this.bookingModel.aggregate([
      { $match: { status: { $in: [BookingStatus.CONFIRMED, BookingStatus.COMPLETED] } } },
      { $group: { _id: null, total: { $sum: '$priceBreakdown.totalAmount' } } },
    ]);

    return {
      totalBookings,
      totalRevenue: totalRevenue[0]?.total ?? 0,
      byStatus: stats.reduce((acc: any, s: any) => {
        acc[s._id] = { count: s.count, revenue: s.totalRevenue };
        return acc;
      }, {}),
    };
  }

  // ════════════════════════════════════════════════════════════════════════════
  // PRIVATE HELPERS
  // ════════════════════════════════════════════════════════════════════════════

  /** Rules every stay has to meet, for a new booking or for new dates on an existing one. */
  private assertStayAllowed(property: any, checkIn: Date, checkOut: Date): { checkIn: Date; checkOut: Date; nights: number } {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (isNaN(checkIn.getTime()) || isNaN(checkOut.getTime())) {
      throw new BadRequestException('Invalid check-in or check-out date');
    }

    if (checkIn < today) {
      throw new BadRequestException('Check-in date cannot be in the past');
    }

    if (checkOut <= checkIn) {
      throw new BadRequestException('Check-out must be after check-in');
    }

    const nights = Math.ceil(
      (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24),
    );

    const minNights = (property as any).minNights ?? 1;
    const maxNights = (property as any).maxNights ?? 365;

    if (nights < minNights) {
      throw new BadRequestException(
        `Minimum stay for this property is ${minNights} night(s)`,
      );
    }

    if (nights > maxNights) {
      throw new BadRequestException(
        `Maximum stay for this property is ${maxNights} night(s)`,
      );
    }

    // ── 2b. Advance notice & booking window validation ───────────────────────
    // The host calendar saves noticeDays / windowMonths; older listings use
    // advanceNoticeDays / bookingWindowDays. Only the old fields were checked, so the
    // calendar's settings had no effect. windowMonths null = "Any time".
    const advanceNoticeDays = Math.max(
      Number((property as any).noticeDays ?? 0),
      Number((property as any).advanceNoticeDays ?? 0),
    );
    const windowMonths = (property as any).windowMonths;
    const bookingWindowDays =
      windowMonths === null
        ? Number.POSITIVE_INFINITY
        : typeof windowMonths === 'number' && windowMonths > 0
          ? Math.round(windowMonths * 30.44)
          : Number((property as any).bookingWindowDays ?? 365);
    const daysTilCheckin = Math.ceil(
      (checkIn.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (daysTilCheckin < advanceNoticeDays) {
      throw new BadRequestException(
        `This property requires at least ${advanceNoticeDays} day(s) advance notice before check-in`,
      );
    }

    if (daysTilCheckin > bookingWindowDays) {
      throw new BadRequestException(
        `Bookings can only be made up to ${bookingWindowDays} day(s) in advance for this property`,
      );
    }

    return { checkIn, checkOut, nights };
  }

  /**
   * The price of an existing booking on new dates, at today's rates. Throws if the listing
   * can't take them. Its own booking doesn't count as a conflict.
   */
  async quoteStayChange(
    booking: BookingDocument,
    checkInRaw: Date,
    checkOutRaw: Date,
  ): Promise<{ nights: number; priceBreakdown: BookingPriceBreakdown }> {
    const property: any = await this.propertyModel.findById(booking.propertyId).exec();
    if (!property) throw new NotFoundException('Property not found');
    if (property.approvalStatus !== ApprovalStatus.APPROVED || !property.isActive) {
      throw new BadRequestException('This property is not available for booking');
    }
    const { checkIn, checkOut, nights } = this.assertStayAllowed(property, new Date(checkInRaw), new Date(checkOutRaw));

    const room: any = booking.roomId ? await this.roomsService.getRoomById(String(booking.roomId)) : null;
    if (room) {
      await this.roomsService.assertRoomDatesAvailable(String(booking.roomId), checkIn, checkOut, String(booking._id));
    } else {
      await this.assertDatesAvailable(String(booking.propertyId), checkIn, checkOut, String(booking._id));
    }

    const guests = (booking.guests?.adults ?? 1) + (booking.guests?.children ?? 0);
    const priceBreakdown: any = this.computePrice(property, nights, room, checkIn, guests);
    const breakfastPrice = Number(room?.breakfastPrice) || 0;
    if ((booking as any).withBreakfast && breakfastPrice > 0) {
      const breakfastFee = Math.round(breakfastPrice * guests * nights);
      priceBreakdown.breakfastFee = breakfastFee;
      priceBreakdown.totalAmount += breakfastFee;
    }
    return { nights, priceBreakdown };
  }

  /**
   * New dates cost less. The guest gets back the share the cancellation policy would give
   * them today, so shortening a stay isn't a way around the policy.
   */
  async refundForCheaperStay(booking: BookingDocument, cheaperBy: number): Promise<number> {
    const total = booking.priceBreakdown.totalAmount;
    if (!(total > 0)) return 0;
    const policyRefund = await this.computeRefund(booking, CancelledBy.GUEST);
    return Math.round(cheaperBy * Math.min(1, policyRefund / total));
  }

  /**
   * Throws ConflictException if the given date range overlaps any confirmed
   * or pending booking on the property (excluding `excludeBookingId`).
   */
  private async assertDatesAvailable(
    propertyId: string,
    checkIn: Date,
    checkOut: Date,
    excludeBookingId?: string,
  ): Promise<void> {
    const filter: any = {
      propertyId: new Types.ObjectId(propertyId),
      status: { $in: [BookingStatus.CONFIRMED, BookingStatus.PENDING] },
      // Overlap condition: existing.checkIn < newCheckOut AND existing.checkOut > newCheckIn
      checkIn: { $lt: checkOut },
      checkOut: { $gt: checkIn },
      // Expired unpaid holds no longer block (the expiry job cancels them shortly after)
      ...activeHoldFilter(),
    };

    if (excludeBookingId) {
      filter._id = { $ne: new Types.ObjectId(excludeBookingId) };
    }

    const conflict = await this.bookingModel.findOne(filter).select('_id checkIn checkOut').lean();

    if (conflict) {
      throw new ConflictException(
        `The property is already booked from ` +
        `${conflict.checkIn.toISOString().split('T')[0]} to ` +
        `${conflict.checkOut.toISOString().split('T')[0]}`,
      );
    }

    // Also check host-blocked dates stored on the property
    const property = await this.propertyModel
      .findById(propertyId)
      .select('unavailableDates')
      .lean()
      .exec();

    const blocked = ((property as any)?.unavailableDates ?? []) as { from: Date; to: Date }[];
    const isBlocked = blocked.some(
      (r) => new Date(r.from) < checkOut && new Date(r.to) > checkIn,
    );

    if (isBlocked) {
      throw new ConflictException('Selected dates are blocked by the host');
    }
  }

  /**
   * Compute the full price breakdown at booking time.
   * Prices are locked in so later edits to the property don't affect existing bookings.
   */
  private computePrice(property: any, nights: number, room?: any, checkIn?: Date, guests = 1) {
    // Hotel bookings use the chosen room type's own price and cleaning fee.
    const rates = this.nightlyRates(property, nights, room, checkIn);
    // Extra-guest fee: part of the nightly price, so stay discounts apply to it too
    // (same as stayNightsTotal + extraGuestTotal in the app).
    const included = Number(property.guestsIncluded) || 0;
    const feePerGuest = Number(property.extraGuestFee) || 0;
    const extraGuests = !room && included > 0 && feePerGuest > 0 ? Math.max(0, guests - included) : 0;
    const extraGuestFee = extraGuests * feePerGuest * nights;
    const subtotal = rates.reduce((sum, r) => sum + r, 0) + extraGuestFee;
    // Average when weekend / custom prices make nights differ.
    const pricePerNight = nights > 0 ? Math.round(subtotal / nights) : 0;
    const cleaningFee = room?.cleaningFee ?? property.cleaningFee ?? 0;
    const serviceFee = Math.round(subtotal * SERVICE_FEE_RATE);
    const taxAmount = 0; // extend as needed
    // Only discounts the host actually set. The old 10% / 15% fallbacks were never shown
    // in the app, so guests were charged a different total than the one on screen.
    const discountAmount = this.computeDiscount(
      subtotal,
      nights,
      property.weeklyDiscountPercent ?? 0,
      property.monthlyDiscountPercent ?? 0,
      property.customDiscountNights,
      property.customDiscountPercent,
    );
    const totalAmount = subtotal + cleaningFee + serviceFee + taxAmount - discountAmount;

    return {
      pricePerNight,
      nights,
      subtotal,
      cleaningFee,
      serviceFee,
      taxAmount,
      discountAmount,
      totalAmount,
      extraGuests,
      extraGuestFee,
    };
  }

  /**
   * Price of each night. The host calendar sets a weekend price (Friday and Saturday
   * nights) and custom prices per date; they used to be saved but never charged, so
   * every guest paid the base price. Same rule as stayNightsTotal() in the app.
   * Hotel room types keep their own flat price.
   */
  private nightlyRates(property: any, nights: number, room?: any, checkIn?: Date): number[] {
    const base = Number(property.price ?? 0);
    if (room) return Array(nights).fill(Number(room.price ?? base));
    if (!checkIn) return Array(nights).fill(base);
    const overrides: Record<string, number> = property.priceOverrides ?? {};
    const weekend = Number(property.weekendPrice || 0);
    const d = new Date(Date.UTC(checkIn.getUTCFullYear(), checkIn.getUTCMonth(), checkIn.getUTCDate()));
    const rates: number[] = [];
    for (let i = 0; i < nights; i++) {
      const override = Number(overrides[d.toISOString().slice(0, 10)] || 0);
      const day = d.getUTCDay();
      rates.push(override > 0 ? override : weekend > 0 && (day === 5 || day === 6) ? weekend : base);
      d.setUTCDate(d.getUTCDate() + 1);
    }
    return rates;
  }

  /**
   * Apply weekly (≥7 nights), monthly (≥28 nights), or custom length-of-stay discount (e.g. -5% from 4 nights)
   * using host-configured percentage rates stored on the property.
   */
  private computeDiscount(
    subtotal: number,
    nights: number,
    weeklyPct: number,
    monthlyPct: number,
    customNights?: number,
    customPct?: number,
  ): number {
    let effectivePct = 0;
    if (nights >= 28 && monthlyPct > 0) {
      effectivePct = Math.max(effectivePct, monthlyPct);
    }
    if (nights >= 7 && weeklyPct > 0) {
      effectivePct = Math.max(effectivePct, weeklyPct);
    }
    if (customNights && customPct && nights >= customNights && customPct > 0) {
      effectivePct = Math.max(effectivePct, customPct);
    }
    return effectivePct > 0 ? Math.round(subtotal * (effectivePct / 100)) : 0;
  }

  /**
   * Compute refund amount based on the property's cancellation policy
   * and how far in advance the guest is cancelling.
   */
  private async computeRefund(booking: BookingDocument, cancelledBy: CancelledBy = CancelledBy.GUEST): Promise<number> {
    if (booking.paymentStatus !== PaymentStatus.PAID) return 0;
    // What is left of the payments: it can differ from the price after a date change
    // or an earlier partial refund.
    const refundable = await this.paymentsService.refundableAmount(booking._id as Types.ObjectId);
    if (cancelledBy !== CancelledBy.GUEST) return refundable || booking.priceBreakdown.totalAmount;

    const property = await this.propertyModel
      .findById(booking.propertyId)
      .select('cancellationPolicy')
      .lean()
      .exec();

    const policy = (property as any)?.cancellationPolicy ?? 'flexible';
    const paidAmount = refundable
      ? Math.min(booking.priceBreakdown.totalAmount, refundable)
      : booking.priceBreakdown.totalAmount;
    const daysUntilCheckin = Math.ceil(
      (booking.checkIn.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
    );

    switch (policy) {
      case 'flexible':
        return daysUntilCheckin >= 1 ? paidAmount : 0;

      case 'moderate':
        return daysUntilCheckin >= 5 ? paidAmount : 0;

      case 'strict':
        if (daysUntilCheckin >= 7) return Math.round(paidAmount * 0.5);
        return 0;

      case 'no_refund':
      default:
        return 0;
    }
  }

  /**
   * What cancelling would do right now, from the same rules cancelBooking() applies,
   * so the app can say "You'll get 45 000 FCFA back" before the guest confirms.
   */
  async getCancellationPreview(bookingId: string, user: User): Promise<{
    canCancel: boolean;
    cancelledBy: CancelledBy;
    paidAmount: number;
    refundAmount: number;
    policy: string;
  }> {
    const booking = await this.findBookingOrThrow(bookingId);
    const isGuest = booking.guestId.toString() === user._id.toString();
    const isHost = booking.hostId.toString() === user._id.toString();
    const isAdmin = user.role === UserRole.ADMIN;
    if (!isGuest && !isHost && !isAdmin) {
      throw new ForbiddenException('You are not authorized to view this booking');
    }
    const cancelledBy = isAdmin ? CancelledBy.ADMIN : isGuest ? CancelledBy.GUEST : CancelledBy.HOST;
    const property = await this.propertyModel.findById(booking.propertyId).select('cancellationPolicy').lean().exec();
    const paid = booking.paymentStatus === PaymentStatus.PAID;
    return {
      canCancel: [BookingStatus.PENDING, BookingStatus.CONFIRMED].includes(booking.status),
      cancelledBy,
      paidAmount: paid ? booking.priceBreakdown.totalAmount : 0,
      refundAmount: await this.computeRefund(booking, cancelledBy),
      policy: (property as any)?.cancellationPolicy ?? 'flexible',
    };
  }

  /** Reusable paginated query helper */
  private async paginateBookings(
    baseFilter: Record<string, any>,
    query: BookingQueryDto,
  ): Promise<PaginatedBookings> {
    const { page = 1, limit = 20, status, fromDate, toDate, sortOrder = 'desc' } = query;
    const skip = (page - 1) * limit;

    const filter: any = { ...baseFilter };

    if (status) filter.status = status;
    if (fromDate) filter.checkIn = { ...(filter.checkIn ?? {}), $gte: new Date(fromDate) };
    if (toDate) filter.checkOut = { ...(filter.checkOut ?? {}), $lte: new Date(toDate) };

    const [bookings, total] = await Promise.all([
      this.bookingModel
        .find(filter)
        .populate('propertyId', 'title address city images price')
        .populate('guestId', 'name email phoneNumber profilePicture')
        .populate('hostId', 'name email phoneNumber profilePicture')
        .sort({ createdAt: sortOrder === 'asc' ? 1 : -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.bookingModel.countDocuments(filter),
    ]);

    return { bookings, total, page, totalPages: Math.ceil(total / limit) };
  }

  private async findBookingOrThrow(id: string): Promise<BookingDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid booking ID');
    }
    const booking = await this.bookingModel.findById(id).exec();
    if (!booking) throw new NotFoundException('Booking not found');
    return booking;
  }

  /** Owner, agent or co-host of the property, or an admin. */
  async assertCanManageProperty(propertyId: string, user: User): Promise<void> {
    if (user.role === UserRole.ADMIN) return;
    if (!Types.ObjectId.isValid(propertyId)) throw new BadRequestException('Invalid property ID');
    const property = await this.propertyModel.findById(propertyId).select('ownerId agentId').lean().exec();
    if (!property) throw new NotFoundException('Property not found');
    const uid = user._id.toString();
    const ownerId = (property as any).ownerId?.toString();
    const agentId = (property as any).agentId?.toString();
    if (ownerId !== uid && agentId !== uid && !(await this.coHosts.isActive(uid, propertyId))) {
      throw new ForbiddenException('You do not manage this property');
    }
  }

  private async assertIsHost(booking: Booking, user: User): Promise<void> {
    const isHost = booking.hostId.toString() === user._id.toString();
    const isAdmin = user.role === UserRole.ADMIN;
    if (!isHost && !isAdmin && !(await this.coHosts.isActive(user._id, booking.propertyId))) {
      throw new ForbiddenException('Only the host or an admin can perform this action');
    }
  }
}
