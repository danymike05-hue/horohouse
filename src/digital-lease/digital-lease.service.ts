import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';

import {
  DigitalLease,
  DigitalLeaseDocument,
  LeaseStatus,
  ConditionRating,
} from './schemas/digital-lease.schema';
import {
  CreateDigitalLeaseDto,
  SignLeaseDto,
  AddConditionLogDto,
  TerminateLeaseDto,
} from './dto/digital-lease.dto';
import { User, UserDocument, UserRole } from '../users/schemas/user.schema';
import { Property, PropertyDocument } from '../properties/schemas/property.schema';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/schemas/notification.schema';
import { SplitPaymentsService } from '../split-payments/split-payments.service';

@Injectable()
export class DigitalLeaseService {
  private readonly logger = new Logger(DigitalLeaseService.name);

  /** Standard clauses injected into every HoroHouse lease */
  private readonly STANDARD_CLAUSES = [
    {
      heading: 'Payment terms',
      body: 'Rent is due on the 1st of each month. A grace period of 5 days is granted before late fees apply.',
    },
    {
      heading: 'Security deposit',
      body: 'The security deposit shall be returned within 30 days of the lease end date, less any deductions for damages documented in the move-out condition log.',
    },
    {
      heading: 'Maintenance',
      body: 'The landlord is responsible for structural repairs and major appliances. The tenant is responsible for minor maintenance and keeping the premises clean.',
    },
    {
      heading: 'Sub-letting',
      body: 'The tenant shall not sub-let the property or any part thereof without the prior written consent of the landlord.',
    },
    {
      heading: 'Termination notice',
      body: 'Either party must give 30 days written notice before terminating this lease early.',
    },
    {
      heading: 'Dispute resolution',
      body: 'Any disputes arising from this lease shall first be submitted to HoroHouse mediation before escalation to legal proceedings.',
    },
  ];

  constructor(
    @InjectModel(DigitalLease.name)
    private leaseModel: Model<DigitalLeaseDocument>,
    @InjectModel(User.name)
    private userModel: Model<UserDocument>,
    @InjectModel(Property.name)
    private propertyModel: Model<PropertyDocument>,
    private configService: ConfigService,
    private notificationsService: NotificationsService,
    private splitPaymentsService: SplitPaymentsService,
  ) {
    cloudinary.config({
      cloud_name: this.configService.get<string>('CLOUDINARY_CLOUD_NAME'),
      api_key: this.configService.get<string>('CLOUDINARY_API_KEY'),
      api_secret: this.configService.get<string>('CLOUDINARY_API_SECRET'),
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // CREATE
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Landlord creates a lease draft.
   * Validates tenant rent shares sum to monthlyRent.
   * Injects standard HoroHouse clauses automatically.
   * Status starts as DRAFT until the landlord signs.
   */
  async create(
    landlordUserId: string,
    dto: CreateDigitalLeaseDto,
  ): Promise<DigitalLease> {
    // Validate property belongs to this landlord
    const property = await this.propertyModel
      .findOne({
        _id: new Types.ObjectId(dto.propertyId),
        $or: [
          { ownerId: new Types.ObjectId(landlordUserId) },
          { agentId: new Types.ObjectId(landlordUserId) },
        ],
      })
      .exec();

    if (!property) {
      throw new NotFoundException(
        'Property not found or does not belong to you.',
      );
    }

    // Validate rent shares sum to monthlyRent
    const sharesSum = dto.tenants.reduce((s, t) => s + t.rentShare, 0);
    if (sharesSum !== dto.monthlyRent) {
      throw new BadRequestException(
        `Tenant rent shares sum to ${sharesSum} XAF but monthlyRent is ${dto.monthlyRent} XAF. They must match.`,
      );
    }

    // Validate dates
    const start = new Date(dto.leaseStart);
    const end = new Date(dto.leaseEnd);
    if (end <= start) {
      throw new BadRequestException('Lease end date must be after start date.');
    }

    const lease = new this.leaseModel({
      propertyId: new Types.ObjectId(dto.propertyId),
      landlordUserId: new Types.ObjectId(landlordUserId),
      tenants: dto.tenants.map((t) => ({
        tenantUserId: new Types.ObjectId(t.tenantUserId),
        tenantName: t.tenantName,
        tenantEmail: t.tenantEmail,
        tenantPhone: t.tenantPhone,
        rentShare: t.rentShare,
      })),
      leaseStart: start,
      leaseEnd: end,
      monthlyRent: dto.monthlyRent,
      depositAmount: dto.depositAmount ?? 0,
      advanceMonths: dto.advanceMonths ?? 1,
      status: LeaseStatus.DRAFT,
      clauses: this.STANDARD_CLAUSES,
      customClauses: dto.customClauses ?? [],
      conditionLogs: [],
    });

    await lease.save();

    this.logger.log(`✅ Lease draft created: ${lease._id} for property ${dto.propertyId}`);
    return lease;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // READ
  // ══════════════════════════════════════════════════════════════════════════

  async findById(leaseId: string): Promise<DigitalLease> {
    if (!Types.ObjectId.isValid(leaseId)) {
      throw new BadRequestException('Invalid lease ID');
    }

    const lease = await this.leaseModel
      .findById(leaseId)
      .populate('propertyId', 'title address city images studentDetails')
      .populate('landlordUserId', 'name email phoneNumber profilePicture')
      .exec();

    if (!lease) throw new NotFoundException('Lease not found');
    return lease;
  }

  async findByLandlord(
    landlordUserId: string,
    status?: LeaseStatus,
  ): Promise<DigitalLease[]> {
    const filter: any = {
      landlordUserId: new Types.ObjectId(landlordUserId),
    };
    if (status) filter.status = status;

    return this.leaseModel
      .find(filter)
      .populate('propertyId', 'title address city images')
      .sort({ leaseStart: -1 })
      .exec();
  }

  async findByTenant(tenantUserId: string): Promise<DigitalLease[]> {
    return this.leaseModel
      .find({ 'tenants.tenantUserId': new Types.ObjectId(tenantUserId) })
      .populate('propertyId', 'title address city images studentDetails')
      .populate('landlordUserId', 'name email phoneNumber profilePicture')
      .sort({ leaseStart: -1 })
      .exec();
  }

  // ══════════════════════════════════════════════════════════════════════════
  // E-SIGNATURE
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Uploads a base64 signature PNG to Cloudinary and records the
   * signing event for either the landlord or a tenant.
   *
   * Signing flow:
   *   1. Landlord signs → status: DRAFT → PENDING_TENANT, tenants notified
   *   2. All tenants sign → status: PENDING_TENANT → ACTIVE
   *      → first SplitPayment cycle auto-created
   */
  async sign(
    leaseId: string,
    signingUserId: string,
    dto: SignLeaseDto,
  ): Promise<DigitalLease> {
    const lease = await this.leaseModel.findById(leaseId).exec();
    if (!lease) throw new NotFoundException('Lease not found');

    if (lease.status === LeaseStatus.ACTIVE) {
      throw new BadRequestException('This lease is already fully signed.');
    }
    if (
      lease.status === LeaseStatus.EXPIRED ||
      lease.status === LeaseStatus.TERMINATED
    ) {
      throw new BadRequestException(
        `Cannot sign a lease with status "${lease.status}".`,
      );
    }

    // Upload signature to Cloudinary
    const signatureUrl = await this.uploadSignature(
      dto.signatureBase64,
      leaseId,
      signingUserId,
    );

    const isLandlord =
      lease.landlordUserId.toString() === signingUserId;
    const tenantIndex = lease.tenants.findIndex(
      (t) => t.tenantUserId.toString() === signingUserId,
    );
    const isTenant = tenantIndex !== -1;

    if (!isLandlord && !isTenant) {
      throw new ForbiddenException(
        'You are not a party to this lease.',
      );
    }

    const now = new Date();

    if (isLandlord) {
      if (lease.landlordSignedAt) {
        throw new BadRequestException('You have already signed this lease.');
      }
      lease.landlordSignatureUrl = signatureUrl;
      lease.landlordSignedAt = now;
      lease.status = LeaseStatus.PENDING_TENANT;

      // Notify all tenants to sign
      await this.notifyTenantsToSign(lease);
    } else {
      if (lease.tenants[tenantIndex].signedAt) {
        throw new BadRequestException('You have already signed this lease.');
      }
      if (lease.status !== LeaseStatus.PENDING_TENANT) {
        throw new BadRequestException(
          'The landlord must sign before tenants can sign.',
        );
      }

      lease.tenants[tenantIndex].signatureUrl = signatureUrl;
      lease.tenants[tenantIndex].signedAt = now;
      lease.markModified('tenants');

      // Check if all tenants have now signed
      const allSigned = lease.tenants.every((t) => !!t.signedAt);
      if (allSigned) {
        lease.status = LeaseStatus.ACTIVE;
        await this.onLeaseActivated(lease);
      }
    }

    await lease.save();

    this.logger.log(
      `✅ Lease ${leaseId} signed by ${isLandlord ? 'landlord' : 'tenant'} ${signingUserId}`,
    );

    return lease;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // CONDITION LOG
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Add a move-in or move-out condition log entry.
   * Photos are uploaded separately via uploadConditionPhotos().
   */
  async addConditionLog(
    leaseId: string,
    loggedByUserId: string,
    dto: AddConditionLogDto,
  ): Promise<DigitalLease> {
    const lease = await this.leaseModel.findById(leaseId).exec();
    if (!lease) throw new NotFoundException('Lease not found');

    const isParty = this.isPartyToLease(lease, loggedByUserId);
    if (!isParty) {
      throw new ForbiddenException('You are not a party to this lease.');
    }

    // Prevent duplicate log type
    const existingType = lease.conditionLogs.find((l) => l.type === dto.type);
    if (existingType) {
      throw new BadRequestException(
        `A ${dto.type.replace('_', '-')} condition log has already been recorded for this lease.`,
      );
    }

    const logEntry = {
      loggedByUserId: new Types.ObjectId(loggedByUserId),
      loggedAt: new Date(),
      type: dto.type,
      overallNotes: dto.overallNotes,
      items: dto.items.map((item) => ({
        label: item.label,
        rating: item.rating,
        notes: item.notes,
        photoUrls: [], // Photos added separately via uploadConditionPhotos
      })),
    };

    lease.conditionLogs.push(logEntry as any);
    await lease.save();

    this.logger.log(
      `✅ ${dto.type} condition log added to lease ${leaseId} by ${loggedByUserId}`,
    );

    return lease;
  }

  /**
   * Upload condition log photos for a specific item in the latest log entry.
   * Accepts multipart files already buffered by the controller.
   */
  async uploadConditionPhotos(
    leaseId: string,
    logType: 'move_in' | 'move_out',
    itemLabel: string,
    files: Array<{ buffer: Buffer }>,
    uploadedByUserId: string,
  ): Promise<DigitalLease> {
    const lease = await this.leaseModel.findById(leaseId).exec();
    if (!lease) throw new NotFoundException('Lease not found');

    if (!this.isPartyToLease(lease, uploadedByUserId)) {
      throw new ForbiddenException('You are not a party to this lease.');
    }

    const logIndex = lease.conditionLogs.findIndex((l) => l.type === logType);
    if (logIndex === -1) {
      throw new NotFoundException(
        `No ${logType} condition log found. Add the log entry first.`,
      );
    }

    const itemIndex = lease.conditionLogs[logIndex].items.findIndex(
      (i) => i.label.toLowerCase() === itemLabel.toLowerCase(),
    );
    if (itemIndex === -1) {
      throw new NotFoundException(
        `Item "${itemLabel}" not found in the ${logType} log.`,
      );
    }

    // Upload all photos to Cloudinary in parallel
    const uploadedUrls = await Promise.all(
      files.map((file, idx) =>
        new Promise<string>((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            {
              folder: `horohouse/leases/${leaseId}/condition`,
              resource_type: 'image',
              transformation: [{ quality: 75, fetch_format: 'auto' }],
            },
            (error, result) => {
              if (error) reject(error);
              else resolve(result!.secure_url);
            },
          );
          stream.end(file.buffer);
        }),
      ),
    );

    lease.conditionLogs[logIndex].items[itemIndex].photoUrls.push(
      ...uploadedUrls,
    );
    lease.markModified('conditionLogs');
    await lease.save();

    this.logger.log(
      `✅ ${uploadedUrls.length} condition photo(s) uploaded for lease ${leaseId} item "${itemLabel}"`,
    );

    return lease;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // TERMINATION
  // ══════════════════════════════════════════════════════════════════════════

  async terminate(
    leaseId: string,
    requestingUserId: string,
    dto: TerminateLeaseDto,
  ): Promise<DigitalLease> {
    const lease = await this.leaseModel.findById(leaseId).exec();
    if (!lease) throw new NotFoundException('Lease not found');

    if (!this.isPartyToLease(lease, requestingUserId)) {
      throw new ForbiddenException('You are not a party to this lease.');
    }

    if (
      lease.status === LeaseStatus.EXPIRED ||
      lease.status === LeaseStatus.TERMINATED
    ) {
      throw new BadRequestException(
        `Lease is already ${lease.status}.`,
      );
    }

    const updated = await this.leaseModel
      .findByIdAndUpdate(
        leaseId,
        {
          $set: {
            status: LeaseStatus.TERMINATED,
            terminationReason: dto.reason,
            terminatedAt: new Date(),
            terminatedByUserId: new Types.ObjectId(requestingUserId),
          },
        },
        { new: true },
      )
      .exec();

    // Notify the other party
    const otherPartyIds = this.getOtherPartyIds(lease, requestingUserId);
    await Promise.all(
      otherPartyIds.map((userId) =>
        this.notificationsService.create({
          userId,
          type: NotificationType.SYSTEM,
          title: 'Lease terminated',
          message: `The lease for your property has been terminated. Reason: ${dto.reason}`,
          metadata: { leaseId },
        }),
      ),
    );

    this.logger.log(
      `Lease ${leaseId} terminated by ${requestingUserId}. Reason: ${dto.reason}`,
    );

    return updated!;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // CRON — expire leases past end date
  // ══════════════════════════════════════════════════════════════════════════

  @Cron('0 1 * * *') // 01:00 daily
  async expireLeases(): Promise<void> {
    const result = await this.leaseModel
      .updateMany(
        {
          status: LeaseStatus.ACTIVE,
          leaseEnd: { $lt: new Date() },
        },
        { $set: { status: LeaseStatus.EXPIRED } },
      )
      .exec();

    if (result.modifiedCount > 0) {
      this.logger.log(`⏰ Expired ${result.modifiedCount} leases`);
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PRIVATE HELPERS
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Called when all parties have signed.
   * Creates the first SplitPayment billing cycle automatically.
   */
  private async onLeaseActivated(lease: DigitalLeaseDocument): Promise<void> {
    // Notify all parties
    const allPartyIds = [
      lease.landlordUserId.toString(),
      ...lease.tenants.map((t) => t.tenantUserId.toString()),
    ];

    await Promise.all(
      allPartyIds.map((userId) =>
        this.notificationsService.create({
          userId,
          type: NotificationType.SYSTEM,
          title: 'Lease activated!',
          message: 'All parties have signed. Your lease is now active.',
          metadata: { leaseId: (lease._id as Types.ObjectId).toString() },
        }),
      ),
    );

    // Auto-create the first billing cycle
    const cycleStart = lease.leaseStart;
    const cycleEnd = new Date(cycleStart);
    cycleEnd.setMonth(cycleEnd.getMonth() + 1);
    cycleEnd.setDate(cycleEnd.getDate() - 1);

    const cycleLabel = cycleStart.toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    });

    const dueDate = new Date(cycleStart);
    dueDate.setDate(5); // Due on the 5th of the month

    await this.splitPaymentsService.createCycle(
      lease.landlordUserId.toString(),
      {
        propertyId: lease.propertyId.toString(),
        leaseId: (lease._id as Types.ObjectId).toString(),
        cycleLabel,
        cycleStart: cycleStart.toISOString().split('T')[0],
        cycleEnd: cycleEnd.toISOString().split('T')[0],
        totalRent: lease.monthlyRent,
        tenantShares: lease.tenants.map((t) => ({
          tenantUserId: t.tenantUserId.toString(),
          tenantName: t.tenantName,
          tenantPhone: t.tenantPhone,
          amountDue: t.rentShare,
          dueDate: dueDate.toISOString().split('T')[0],
        })),
      },
    );

    this.logger.log(
      `✅ First billing cycle auto-created for lease ${lease._id} (${cycleLabel})`,
    );
  }

  private async uploadSignature(
    base64: string,
    leaseId: string,
    userId: string,
  ): Promise<string> {
    // Strip data URI prefix if present
    const data = base64.includes(',') ? base64.split(',')[1] : base64;
    const buffer = Buffer.from(data, 'base64');

    return new Promise<string>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: `horohouse/leases/${leaseId}/signatures`,
          resource_type: 'image',
          public_id: `sig_${userId}_${Date.now()}`,
          transformation: [{ quality: 90 }],
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result!.secure_url);
        },
      );
      stream.end(buffer);
    });
  }

  private async notifyTenantsToSign(lease: DigitalLeaseDocument): Promise<void> {
    await Promise.all(
      lease.tenants.map((t) =>
        this.notificationsService.create({
          userId: t.tenantUserId.toString(),
          type: NotificationType.SYSTEM,
          title: 'Lease ready for your signature',
          message: 'Your landlord has signed the lease. Please review and sign to activate it.',
          metadata: {
            leaseId: (lease._id as Types.ObjectId).toString(),
            action: 'sign_lease',
          },
        }),
      ),
    );
  }

  private isPartyToLease(lease: DigitalLease, userId: string): boolean {
    const isLandlord = lease.landlordUserId.toString() === userId;
    const isTenant = lease.tenants.some(
      (t) => t.tenantUserId.toString() === userId,
    );
    return isLandlord || isTenant;
  }

  private getOtherPartyIds(
    lease: DigitalLease,
    excludeUserId: string,
  ): string[] {
    const all = [
      lease.landlordUserId.toString(),
      ...lease.tenants.map((t) => t.tenantUserId.toString()),
    ];
    return [...new Set(all.filter((id) => id !== excludeUserId))];
  }
}