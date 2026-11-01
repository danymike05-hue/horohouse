import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';

import {
  SplitPayment,
  SplitPaymentDocument,
  SplitPaymentStatus,
  TenantShareStatus,
} from './schemas/split-payment.schema';
import {
  CreateSplitPaymentDto,
  RecordTenantPaymentDto,
  InitiateTenantChargeDto,
  SplitRentCalculatorDto,
} from './dto/split-payment.dto';
import { User, UserDocument, UserRole } from '../users/schemas/user.schema';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/schemas/notification.schema';
import { CamerPayService } from '../payments/services/camerpay.service';

@Injectable()
export class SplitPaymentsService {
  private readonly logger = new Logger(SplitPaymentsService.name);

  constructor(
    @InjectModel(SplitPayment.name)
    private splitPaymentModel: Model<SplitPaymentDocument>,
    @InjectModel(User.name)
    private userModel: Model<UserDocument>,
    private notificationsService: NotificationsService,
    private camerpayService: CamerPayService,
  ) {}

  // ══════════════════════════════════════════════════════════════════════════
  // CALCULATOR — stateless, no DB write
  // ════════════════════════════════════════════

  /**
   * Pure calculation — returns per-tenant breakdown without writing to DB.
   * Used by the frontend split-rent widget before a lease is created.
   */
  calculateSplit(dto: SplitRentCalculatorDto): {
    totalRent: number;
    numberOfTenants: number;
    shares: Array<{ tenantIndex: number; amount: number; percentage: number }>;
    remainder: number;
  } {
    const { totalRent, numberOfTenants, customPercentages } = dto;

    if (customPercentages) {
      if (customPercentages.length !== numberOfTenants) {
        throw new BadRequestException(
          `customPercentages must have exactly ${numberOfTenants} entries.`,
        );
      }
      const sum = customPercentages.reduce((a, b) => a + b, 0);
      if (Math.abs(sum - 100) > 0.01) {
        throw new BadRequestException(
          `customPercentages must sum to 100 (got ${sum}).`,
        );
      }
    }

    const shares = Array.from({ length: numberOfTenants }, (_, i) => {
      const percentage = customPercentages
        ? customPercentages[i]
        : 100 / numberOfTenants;
      // Floor to whole XAF — remainder handled below
      const amount = Math.floor((totalRent * percentage) / 100);
      return { tenantIndex: i + 1, amount, percentage };
    });

    const distributed = shares.reduce((s, x) => s + x.amount, 0);
    const remainder = totalRent - distributed;

    // Add remainder to first tenant (standard rounding convention)
    if (remainder > 0) shares[0].amount += remainder;

    return { totalRent, numberOfTenants, shares, remainder };
  }

  // ══════════════════════════════════════════════════════════════════════════
  // LEDGER — CREATE & READ
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Create a billing-cycle ledger for a lease.
   * Called by DigitalLeaseService when a lease is activated,
   * or manually by the landlord for each month.
   *
   * Validates that tenant share amounts sum to totalRent.
   */
  async createCycle(
    landlordUserId: string,
    dto: CreateSplitPaymentDto,
  ): Promise<SplitPayment> {
    // Validate shares sum to totalRent
    const sharesSum = dto.tenantShares.reduce((s, t) => s + t.amountDue, 0);
    if (sharesSum !== dto.totalRent) {
      throw new BadRequestException(
        `Tenant shares sum to ${sharesSum} XAF but totalRent is ${dto.totalRent} XAF. They must match.`,
      );
    }

    // Prevent duplicate cycle for same lease + start date
    const existing = await this.splitPaymentModel
      .findOne({
        leaseId: new Types.ObjectId(dto.leaseId),
        cycleStart: new Date(dto.cycleStart),
      })
      .exec();

    if (existing) {
      throw new BadRequestException(
        `A payment cycle already exists for this lease starting ${dto.cycleStart}.`,
      );
    }

    const cycle = new this.splitPaymentModel({
      propertyId: new Types.ObjectId(dto.propertyId),
      leaseId: new Types.ObjectId(dto.leaseId),
      landlordUserId: new Types.ObjectId(landlordUserId),
      cycleLabel: dto.cycleLabel,
      cycleStart: new Date(dto.cycleStart),
      cycleEnd: new Date(dto.cycleEnd),
      totalRent: dto.totalRent,
      totalCollected: 0,
      status: SplitPaymentStatus.PENDING,
      tenantShares: dto.tenantShares.map((t) => ({
        tenantUserId: new Types.ObjectId(t.tenantUserId),
        tenantName: t.tenantName,
        tenantPhone: t.tenantPhone,
        amountDue: t.amountDue,
        amountPaid: 0,
        status: TenantShareStatus.UNPAID,
        momoPhone: t.momoPhone,
        momoProvider: t.momoProvider,
        dueDate: new Date(t.dueDate),
      })),
    });

    await cycle.save();

    // Notify each tenant of their share
    this.notifyTenantsOfNewCycle(cycle).catch((err) =>
      this.logger.warn(`Tenant cycle notification failed: ${err.message}`),
    );

    this.logger.log(
      `✅ Split payment cycle created: ${cycle._id} (${dto.cycleLabel}) — ${dto.tenantShares.length} tenants`,
    );

    return cycle;
  }

  async findById(cycleId: string): Promise<SplitPayment> {
    if (!Types.ObjectId.isValid(cycleId)) {
      throw new BadRequestException('Invalid cycle ID');
    }

    const cycle = await this.splitPaymentModel
      .findById(cycleId)
      .populate('propertyId', 'title address city')
      .exec();

    if (!cycle) throw new NotFoundException('Payment cycle not found');
    return cycle;
  }

  /** Get all cycles for a lease, newest first */
  async findByLease(leaseId: string): Promise<SplitPayment[]> {
    return this.splitPaymentModel
      .find({ leaseId: new Types.ObjectId(leaseId) })
      .populate('propertyId', 'title address city')
      .sort({ cycleStart: -1 })
      .exec();
  }

  /** Get all cycles where the requesting user is a tenant */
  async findMyPayments(tenantUserId: string): Promise<SplitPayment[]> {
    return this.splitPaymentModel
      .find({ 'tenantShares.tenantUserId': new Types.ObjectId(tenantUserId) })
      .populate('propertyId', 'title address city images')
      .sort({ cycleStart: -1 })
      .exec();
  }

  /** Get all cycles for a landlord */
  async findByLandlord(
    landlordUserId: string,
    status?: SplitPaymentStatus,
  ): Promise<SplitPayment[]> {
    const filter: any = { landlordUserId: new Types.ObjectId(landlordUserId) };
    if (status) filter.status = status;

    return this.splitPaymentModel
      .find(filter)
      .populate('propertyId', 'title address city')
      .sort({ cycleStart: -1 })
      .exec();
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PAYMENT RECORDING
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Record that a tenant has paid their share.
   * Called by the Flutterwave webhook handler or manually by the landlord.
   * Automatically recalculates cycle status after recording.
   */
  async recordPayment(
    cycleId: string,
    dto: RecordTenantPaymentDto,
    requestingUserId: string,
  ): Promise<SplitPayment> {
    const cycle = await this.splitPaymentModel.findById(cycleId).exec();
    if (!cycle) throw new NotFoundException('Payment cycle not found');

    // Only the landlord or an admin can record payments manually
    const requestingUser = await this.userModel
      .findById(requestingUserId)
      .select('role')
      .exec();

    const isLandlord = cycle.landlordUserId.toString() === requestingUserId;
    const isAdmin = requestingUser?.role === UserRole.ADMIN;
    const isTenant = cycle.tenantShares.some(
      (s) => s.tenantUserId.toString() === dto.tenantUserId,
    );

    if (!isLandlord && !isAdmin && !isTenant) {
      throw new ForbiddenException('You are not authorised to record this payment.');
    }

    // Find the tenant share to update
    const shareIndex = cycle.tenantShares.findIndex(
      (s) => s.tenantUserId.toString() === dto.tenantUserId,
    );

    if (shareIndex === -1) {
      throw new NotFoundException('Tenant share not found in this cycle.');
    }

    const share = cycle.tenantShares[shareIndex];

    if (share.status === TenantShareStatus.PAID) {
      throw new BadRequestException('This tenant has already paid for this cycle.');
    }

    // Update the share
    cycle.tenantShares[shareIndex].amountPaid = dto.amountPaid;
    cycle.tenantShares[shareIndex].status =
      dto.amountPaid >= share.amountDue
        ? TenantShareStatus.PAID
        : TenantShareStatus.UNPAID; // Partial — stays UNPAID until full
    cycle.tenantShares[shareIndex].paidAt = new Date();

    if (dto.momoTransactionId) {
      cycle.tenantShares[shareIndex].momoTransactionId = dto.momoTransactionId;
    }
    if (dto.momoProvider) {
      cycle.tenantShares[shareIndex].momoProvider = dto.momoProvider;
    }

    // Recalculate totals and cycle status
    cycle.totalCollected = cycle.tenantShares.reduce(
      (s, t) => s + t.amountPaid,
      0,
    );
    cycle.status = this.deriveCycleStatus(cycle.tenantShares);

    // Mark mongoose subdocument array as modified
    cycle.markModified('tenantShares');
    await cycle.save();

    // Notify landlord when all tenants have paid
    if (cycle.status === SplitPaymentStatus.COMPLETE) {
      this.notificationsService.create({
        userId: cycle.landlordUserId.toString(),
        type: NotificationType.PAYMENT_RECEIVED,
        title: 'All tenants have paid!',
        message: `Full rent of ${cycle.totalRent.toLocaleString()} XAF collected for ${cycle.cycleLabel}. Ready for disbursement.`,
        metadata: {
          cycleId: (cycle._id as Types.ObjectId).toString(),
          amount: cycle.totalRent,
          currency: 'XAF',
        },
      }).catch((err) => this.logger.warn(`Notification failed: ${err.message}`));
    }

    this.logger.log(
      `✅ Payment recorded: tenant ${dto.tenantUserId} paid ${dto.amountPaid} XAF in cycle ${cycleId}`,
    );

    return cycle;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // MOMO CHARGE INITIATION (via existing FlutterwaveService)
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Initiates a MoMo payment request to a specific tenant via Flutterwave.
   * Uses the existing FlutterwaveService — no new gateway integration needed.
   *
   * Fluttterwave will call the webhook on payment completion,
   * which should call recordPayment() with the transaction reference.
   */
  async initiateCharge(
    cycleId: string,
    dto: InitiateTenantChargeDto,
    requestingUserId: string,
  ): Promise<{ message: string; reference: string }> {
    const cycle = await this.splitPaymentModel.findById(cycleId).exec();
    if (!cycle) throw new NotFoundException('Payment cycle not found');

    // Only the landlord can initiate charges
    if (cycle.landlordUserId.toString() !== requestingUserId) {
      const requestingUser = await this.userModel
        .findById(requestingUserId)
        .select('role')
        .exec();
      if (requestingUser?.role !== UserRole.ADMIN) {
        throw new ForbiddenException('Only the landlord can initiate payment charges.');
      }
    }

    const share = cycle.tenantShares.find(
      (s) => s.tenantUserId.toString() === dto.tenantUserId,
    );

    if (!share) {
      throw new NotFoundException('Tenant share not found in this cycle.');
    }

    if (share.status === TenantShareStatus.PAID) {
      throw new BadRequestException('This tenant has already paid.');
    }

    // Fetch tenant details for Flutterwave
    const tenant = await this.userModel
      .findById(dto.tenantUserId)
      .select('name email')
      .exec();

    if (!tenant) throw new NotFoundException('Tenant user not found.');

    // Delegate to existing FlutterwaveService via initializeMobileMoneyPayment
    // tx_ref is structured so the webhook can identify cycle + tenant on callback
    const txRef = `SPLIT-${cycleId}-${dto.tenantUserId}-${Date.now()}`;

    await this.camerpayService.initializePayment({
      merchant_invoice_id: txRef,
      amount: share.amountDue,
      currency: 'XAF',
      payment_method: dto.momoProvider === 'mtn' ? 'mtn_momo' : 'orange_money',
      customer_name: tenant.name ?? 'Tenant',
      customer_phone: dto.momoPhone,
      callback_url: '',   // webhook not needed for split-payment charges
      return_url: '',
    });

    // Store the pending transaction reference on the share
    const shareIndex = cycle.tenantShares.findIndex(
      (s) => s.tenantUserId.toString() === dto.tenantUserId,
    );
    cycle.tenantShares[shareIndex].momoTransactionId = txRef;
    cycle.tenantShares[shareIndex].momoPhone = dto.momoPhone;
    cycle.tenantShares[shareIndex].momoProvider = dto.momoProvider;
    cycle.markModified('tenantShares');
    await cycle.save();

    this.logger.log(
      `✅ MoMo charge initiated: ${dto.momoPhone} — ${share.amountDue} XAF (ref: ${txRef})`,
    );

    return {
      message: `Payment request sent to ${dto.momoPhone}. The tenant will receive a prompt on their phone.`,
      reference: txRef,
    };
  }

  // ══════════════════════════════════════════════════════════════════════════
  // DISBURSEMENT
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Mark a COMPLETE cycle as DISBURSED after the landlord has been paid.
   * In a future phase this will trigger an automatic Flutterwave payout.
   */
  async markDisbursed(
    cycleId: string,
    adminUserId: string,
    disbursementTransactionId?: string,
  ): Promise<SplitPayment> {
    const cycle = await this.splitPaymentModel.findById(cycleId).exec();
    if (!cycle) throw new NotFoundException('Payment cycle not found');

    if (cycle.status !== SplitPaymentStatus.COMPLETE) {
      throw new BadRequestException(
        `Cannot disburse a cycle with status "${cycle.status}". All tenants must have paid first.`,
      );
    }

    const updated = await this.splitPaymentModel
      .findByIdAndUpdate(
        cycleId,
        {
          $set: {
            status: SplitPaymentStatus.DISBURSED,
            disbursedAt: new Date(),
            disbursementTransactionId,
          },
        },
        { new: true },
      )
      .exec();

    // Notify landlord
    this.notificationsService.create({
      userId: cycle.landlordUserId.toString(),
      type: NotificationType.PAYMENT_RECEIVED,
      title: 'Rent disbursed',
      message: `${cycle.totalRent.toLocaleString()} XAF for ${cycle.cycleLabel} has been sent to your account.`,
      metadata: {
        cycleId,
        amount: cycle.totalRent,
        currency: 'XAF',
      },
    }).catch((err) => this.logger.warn(`Notification failed: ${err.message}`));

    this.logger.log(`✅ Cycle ${cycleId} marked as DISBURSED by admin ${adminUserId}`);
    return updated!;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // CRON — mark overdue shares
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Runs daily at 08:00. Marks any UNPAID tenant shares past their due date
   * as OVERDUE and flips the cycle status accordingly.
   */
  @Cron('0 8 * * *')
  async markOverdueShares(): Promise<void> {
    const now = new Date();

    const staleCycles = await this.splitPaymentModel
      .find({
        status: { $in: [SplitPaymentStatus.PENDING, SplitPaymentStatus.PARTIAL] },
        'tenantShares.dueDate': { $lt: now },
        'tenantShares.status': TenantShareStatus.UNPAID,
      })
      .exec();

    let overdueCount = 0;

    for (const cycle of staleCycles) {
      let modified = false;

      for (const share of cycle.tenantShares) {
        if (
          share.status === TenantShareStatus.UNPAID &&
          share.dueDate < now
        ) {
          share.status = TenantShareStatus.OVERDUE;
          modified = true;
          overdueCount++;

          // Notify the overdue tenant
          this.notificationsService.create({
            userId: share.tenantUserId.toString(),
            type: NotificationType.SYSTEM,
            title: 'Rent payment overdue',
            message: `Your rent share of ${share.amountDue.toLocaleString()} XAF for ${cycle.cycleLabel} is now overdue.`,
            metadata: {
              cycleId: (cycle._id as Types.ObjectId).toString(),
              amount: share.amountDue,
              currency: 'XAF',
            },
          }).catch(() => {});
        }
      }

      if (modified) {
        cycle.status = this.deriveCycleStatus(cycle.tenantShares);
        cycle.markModified('tenantShares');
        await cycle.save();
      }
    }

    if (overdueCount > 0) {
      this.logger.log(`⏰ Marked ${overdueCount} tenant shares as OVERDUE`);
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PRIVATE HELPERS
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Derives the aggregate cycle status from the individual tenant share statuses.
   * Called after every payment recording.
   */
  private deriveCycleStatus(
    shares: SplitPayment['tenantShares'],
  ): SplitPaymentStatus {
    const statuses = shares.map((s) => s.status);

    if (statuses.every((s) => s === TenantShareStatus.PAID)) {
      return SplitPaymentStatus.COMPLETE;
    }
    if (statuses.some((s) => s === TenantShareStatus.OVERDUE)) {
      return SplitPaymentStatus.OVERDUE;
    }
    if (statuses.some((s) => s === TenantShareStatus.PAID)) {
      return SplitPaymentStatus.PARTIAL;
    }
    return SplitPaymentStatus.PENDING;
  }

  private async notifyTenantsOfNewCycle(cycle: SplitPaymentDocument): Promise<void> {
    await Promise.all(
      cycle.tenantShares.map((share) =>
        this.notificationsService.create({
          userId: share.tenantUserId.toString(),
          type: NotificationType.SYSTEM,
          title: `Rent due — ${cycle.cycleLabel}`,
          message: `Your share of ${share.amountDue.toLocaleString()} XAF is due by ${share.dueDate.toLocaleDateString()}.`,
          metadata: {
            cycleId: (cycle._id as Types.ObjectId).toString(),
            amount: share.amountDue,
            currency: 'XAF',
          },
        }),
      ),
    );
  }
}