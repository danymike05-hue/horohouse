import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Booking,
  BookingDocument,
  BookingStatus,
  PayoutStatus,
} from '../../bookings/schema/booking.schema';
import { NotificationsService } from '../../notifications/notifications.service';
import { NotificationType } from '../../notifications/schemas/notification.schema';
import { WalletService } from './wallet.service';

const DEFAULT_HOLD_HOURS = 24;
const DEFAULT_CHECK_IN_MINUTES = 14 * 60;

/**
 * When a booking's money can be withdrawn: `holdHours` after check-in time on the
 * check-in day. checkIn is a calendar day stored at UTC midnight, so counting from it
 * alone would release the money only hours after the guest arrives.
 */
export function payoutReleaseAt(checkIn: Date, checkInTime: string | undefined, holdHours: number): Date {
  const day = new Date(checkIn);
  day.setUTCHours(0, 0, 0, 0);
  const match = /^(\d{1,2}):(\d{2})/.exec((checkInTime ?? '').trim());
  const hours = match ? Number(match[1]) : NaN;
  const minutes = match ? Number(match[2]) : NaN;
  const valid = hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
  const checkInMinutes = valid ? hours * 60 + minutes : DEFAULT_CHECK_IN_MINUTES;
  return new Date(day.getTime() + checkInMinutes * 60_000 + holdHours * 3_600_000);
}

/**
 * Holds the host's share of a booking until about a day after check-in.
 *
 *   paid → HELD → RELEASED (withdrawable)
 *            ↕
 *          FROZEN (the guest reported a problem; an admin decides)
 *   any held state → REVERSED (fully refunded to the guest)
 *
 * Each step claims the booking with one atomic update on payout.status, so the release
 * job, a refund and a report arriving together can't move the same money twice.
 * PAYOUT_HOLD_HOURS changes the wait.
 */
@Injectable()
export class HostPayoutsService {
  private readonly logger = new Logger(HostPayoutsService.name);
  private readonly holdHours: number;
  private running = false;

  constructor(
    @InjectModel(Booking.name) private readonly bookingModel: Model<BookingDocument>,
    private readonly walletService: WalletService,
    private readonly notificationsService: NotificationsService,
    config: ConfigService,
  ) {
    const configured = Number(config.get('PAYOUT_HOLD_HOURS'));
    this.holdHours = Number.isFinite(configured) && configured >= 0 && config.get('PAYOUT_HOLD_HOURS') !== undefined
      ? configured
      : DEFAULT_HOLD_HOURS;
  }

  /** Returns when the money becomes withdrawable, or null if it was already held. */
  async hold(params: {
    bookingId: string;
    hostId: string;
    amount: number;
    checkIn: Date;
    checkInTime?: string;
  }): Promise<Date | null> {
    const releaseAt = payoutReleaseAt(params.checkIn, params.checkInTime, this.holdHours);
    // A repeated payment callback finds payout already set and holds nothing more.
    const claimed = await this.bookingModel.findOneAndUpdate(
      { _id: params.bookingId, 'payout.status': { $exists: false } },
      { $set: { payout: { status: PayoutStatus.HELD, amount: params.amount, releaseAt } } },
    );
    if (!claimed) {
      this.logger.warn(`hold: booking ${params.bookingId} already has a payout — nothing added`);
      return null;
    }
    await this.walletService.holdFunds(params.hostId, params.amount);
    return releaseAt;
  }

  /** The guest paid more (new dates): the host's extra share waits with the rest. */
  async addToHold(params: {
    bookingId: string;
    hostId: string;
    amount: number;
    checkIn: Date;
    checkInTime?: string;
  }): Promise<void> {
    const added = await this.bookingModel.findOneAndUpdate(
      { _id: params.bookingId, 'payout.status': { $in: [PayoutStatus.HELD, PayoutStatus.FROZEN] } },
      { $inc: { 'payout.amount': params.amount } },
    );
    if (added) {
      await this.walletService.holdFunds(params.hostId, params.amount);
      return;
    }
    // Paid before holds existed: only this extra share is held.
    if (await this.hold(params)) return;
    // Already released: nothing to wait for, so it goes straight to the balance.
    await this.walletService.holdFunds(params.hostId, params.amount);
    await this.walletService.releaseHeldFunds(params.hostId, params.amount, 'Booking income: date change', `PAYOUT-${params.bookingId}-CHANGE`);
  }

  /** The stay moved, so the wait moves with it. */
  async reschedule(bookingId: string, checkIn: Date, checkInTime?: string): Promise<void> {
    await this.bookingModel.updateOne(
      { _id: bookingId, 'payout.status': { $in: [PayoutStatus.HELD, PayoutStatus.FROZEN] } },
      { $set: { 'payout.releaseAt': payoutReleaseAt(checkIn, checkInTime, this.holdHours) } },
    );
  }

  /** A problem was reported. Returns true if the money was still held and is now frozen. */
  async freeze(bookingId: string): Promise<boolean> {
    const frozen = await this.bookingModel.findOneAndUpdate(
      { _id: bookingId, 'payout.status': PayoutStatus.HELD },
      { $set: { 'payout.status': PayoutStatus.FROZEN } },
    );
    return !!frozen;
  }

  /** The problem is decided: back to waiting, or paid now if the date has already passed. */
  async unfreeze(bookingId: string): Promise<void> {
    const back = await this.bookingModel.findOneAndUpdate(
      { _id: bookingId, 'payout.status': PayoutStatus.FROZEN },
      { $set: { 'payout.status': PayoutStatus.HELD } },
      { new: true },
    );
    if (back?.payout && back.payout.releaseAt.getTime() <= Date.now()) {
      await this.release(bookingId);
    }
  }

  /**
   * The guest got `hostPortion` back. Returns true if it came out of the hold; false means
   * nothing is held (already released, or paid before holds existed), so the caller has
   * to take it from the host's balance.
   */
  async reduceHold(bookingId: string, hostPortion: number, fullRefund: boolean): Promise<boolean> {
    const previous = await this.bookingModel.findOneAndUpdate(
      { _id: bookingId, 'payout.status': { $in: [PayoutStatus.HELD, PayoutStatus.FROZEN] } },
      [
        {
          $set: {
            'payout.amount': fullRefund ? 0 : { $max: [0, { $subtract: ['$payout.amount', hostPortion] }] },
            'payout.status': {
              $cond: [
                fullRefund ? true : { $lte: [{ $subtract: ['$payout.amount', hostPortion] }, 0] },
                PayoutStatus.REVERSED,
                '$payout.status',
              ],
            },
          },
        },
      ] as any,
    );
    if (!previous?.payout) return false;
    const removed = fullRefund ? previous.payout.amount : Math.min(previous.payout.amount, hostPortion);
    await this.walletService.dropHeldFunds(String(previous.hostId), removed);
    return true;
  }

  /** The booking was cancelled and refunded: pay what's left without waiting for check-in. */
  async settleNow(bookingId: string): Promise<void> {
    await this.release(bookingId);
  }

  /** Moves the money to the host's withdrawable balance. Returns false if nothing was held. */
  async release(bookingId: string): Promise<boolean> {
    const claimed = await this.bookingModel
      .findOneAndUpdate(
        { _id: bookingId, 'payout.status': PayoutStatus.HELD, 'payout.amount': { $gt: 0 } },
        { $set: { 'payout.status': PayoutStatus.RELEASED, 'payout.releasedAt': new Date() } },
        { new: true },
      )
      .populate('propertyId', 'title');
    if (!claimed?.payout) return false;

    const title = (claimed.propertyId as any)?.title ?? 'Property';
    const amount = claimed.payout.amount;
    try {
      await this.walletService.releaseHeldFunds(
        String(claimed.hostId),
        amount,
        `Booking income: ${title} - ${claimed.nights} night${claimed.nights !== 1 ? 's' : ''}`,
        `PAYOUT-${bookingId}`,
      );
    } catch (err) {
      await this.bookingModel.updateOne(
        { _id: bookingId, 'payout.status': PayoutStatus.RELEASED },
        { $set: { 'payout.status': PayoutStatus.HELD }, $unset: { 'payout.releasedAt': 1 } },
      );
      throw err;
    }

    try {
      await this.notificationsService.create({
        userId: String(claimed.hostId),
        type: NotificationType.PAYOUT_RELEASED,
        title: 'Your earnings are ready',
        message: `${amount} ${claimed.currency ?? 'XAF'} from your booking at ${title} can now be withdrawn.`,
        link: '/host/withdraw',
        metadata: { bookingId, amount },
      } as any, {
        title: 'Vos revenus sont disponibles',
        message: `${amount} ${claimed.currency ?? 'XAF'} de votre réservation à ${title} peuvent maintenant être retirés.`,
      });
    } catch (err: any) {
      this.logger.warn(`release: notification failed for ${bookingId}: ${err?.message}`);
    }
    return true;
  }

  /** Bookings whose hold is over. A cancelled booking whose refund failed stays held. */
  async releaseDue(batchSize = 200): Promise<number> {
    const due = await this.bookingModel
      .find({
        'payout.status': PayoutStatus.HELD,
        'payout.releaseAt': { $lte: new Date() },
        status: { $nin: [BookingStatus.PENDING, BookingStatus.REJECTED] },
        'cancellation.refundStatus': { $nin: ['pending', 'failed'] },
      })
      .select('_id')
      .limit(batchSize)
      .lean();
    let released = 0;
    for (const booking of due) {
      try {
        if (await this.release(String(booking._id))) released++;
      } catch (err: any) {
        this.logger.error(`releaseDue: booking ${booking._id}: ${err?.message}`);
      }
    }
    return released;
  }

  @Cron(CronExpression.EVERY_10_MINUTES, { name: 'release-host-payouts' })
  async runReleaseJob(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const released = await this.releaseDue();
      if (released) this.logger.log(`Released ${released} host payout(s)`);
    } catch (err: any) {
      this.logger.error(`release-host-payouts failed: ${err?.message}`, err?.stack);
    } finally {
      this.running = false;
    }
  }

  /** What the host is still waiting for, soonest first. */
  async listHeld(hostId: string) {
    const bookings = await this.bookingModel
      .find({
        hostId: new Types.ObjectId(hostId),
        'payout.status': { $in: [PayoutStatus.HELD, PayoutStatus.FROZEN] },
      })
      .select('payout checkIn checkOut propertyId currency')
      .populate('propertyId', 'title')
      .sort({ 'payout.releaseAt': 1 })
      .limit(100)
      .lean();
    return bookings.map((b: any) => ({
      bookingId: String(b._id),
      propertyTitle: b.propertyId?.title ?? '',
      checkIn: b.checkIn,
      checkOut: b.checkOut,
      amount: b.payout.amount,
      currency: b.currency ?? 'XAF',
      status: b.payout.status,
      releaseAt: b.payout.releaseAt,
    }));
  }
}
