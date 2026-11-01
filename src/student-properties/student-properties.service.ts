import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import {
  Property,
  PropertyDocument,
  ApprovalStatus,
  PropertyStatus,
} from '../properties/schemas/property.schema';
import { User, UserDocument, UserRole } from '../users/schemas/user.schema';
import {
  StudentPropertySearchDto,
  MarkStudentFriendlyDto,
} from './dto/student-property.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/schemas/notification.schema';

@Injectable()
export class StudentPropertiesService {
  private readonly logger = new Logger(StudentPropertiesService.name);

  constructor(
    @InjectModel(Property.name)
    private propertyModel: Model<PropertyDocument>,
    @InjectModel(User.name)
    private userModel: Model<UserDocument>,
    private notificationsService: NotificationsService,
  ) {}

  // ══════════════════════════════════════════════════════════════════════════
  // SEARCH
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Student housing search.
   *
   * Queries only properties where isStudentFriendly === true.
   * All student-specific filters operate on the studentDetails subdocument.
   * Existing general filters (city, price, type) are also supported.
   * Never touches the existing findAll() path — completely additive.
   */
  async searchStudentProperties(dto: StudentPropertySearchDto): Promise<{
    properties: Property[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const {
      page = 1,
      limit = 20,
      sortBy = 'campusProximityMeters',
      sortOrder = 'asc',
    } = dto;
    const skip = (page - 1) * limit;

    // Base filter — only live, approved, student-friendly listings
    const filter: any = {
      isStudentFriendly: true,
      isActive: true,
      approvalStatus: ApprovalStatus.APPROVED,
      availability: PropertyStatus.ACTIVE,
    };

    // ── Location ─────────────────────────────────────────────────────────────
    if (dto.city) {
      filter.city = { $regex: dto.city, $options: 'i' };
    }
    if (dto.neighborhood) {
      filter.neighborhood = { $regex: dto.neighborhood, $options: 'i' };
    }
    if (dto.nearestCampus) {
      filter['studentDetails.nearestCampus'] = {
        $regex: dto.nearestCampus,
        $options: 'i',
      };
    }
    if (dto.maxCampusProximityMeters !== undefined) {
      filter['studentDetails.campusProximityMeters'] = {
        $lte: dto.maxCampusProximityMeters,
      };
    }

    // ── Per-person budget ─────────────────────────────────────────────────────
    if (dto.minPricePerPerson !== undefined || dto.maxPricePerPerson !== undefined) {
      filter['studentDetails.pricePerPersonMonthly'] = {};
      if (dto.minPricePerPerson !== undefined) {
        filter['studentDetails.pricePerPersonMonthly'].$gte = dto.minPricePerPerson;
      }
      if (dto.maxPricePerPerson !== undefined) {
        filter['studentDetails.pricePerPersonMonthly'].$lte = dto.maxPricePerPerson;
      }
    }

    // ── Infrastructure ────────────────────────────────────────────────────────
    if (dto.waterSource) {
      filter['studentDetails.waterSource'] = dto.waterSource;
    }
    if (dto.electricityBackup) {
      filter['studentDetails.electricityBackup'] = dto.electricityBackup;
    }
    if (dto.furnishingStatus) {
      filter['studentDetails.furnishingStatus'] = dto.furnishingStatus;
    }

    // ── House rules ───────────────────────────────────────────────────────────
    if (dto.genderRestriction) {
      filter['studentDetails.genderRestriction'] = dto.genderRestriction;
    }
    if (dto.noCurfew === true) {
      filter['studentDetails.curfewTime'] = { $in: [null, ''] };
    }
    if (dto.visitorsAllowed === true) {
      filter['studentDetails.visitorsAllowed'] = true;
    }

    // ── Security ──────────────────────────────────────────────────────────────
    if (dto.hasGatedCompound === true) {
      filter['studentDetails.hasGatedCompound'] = true;
    }
    if (dto.hasNightWatchman === true) {
      filter['studentDetails.hasNightWatchman'] = true;
    }

    // ── Landlord trust ────────────────────────────────────────────────────────
    if (dto.studentApprovedOnly === true) {
      filter['studentDetails.isStudentApproved'] = true;
    }
    if (dto.acceptsRentAdvanceScheme === true) {
      filter['studentDetails.acceptsRentAdvanceScheme'] = true;
    }
    if (dto.maxAdvanceMonths !== undefined) {
      filter['studentDetails.maxAdvanceMonths'] = { $lte: dto.maxAdvanceMonths };
    }

    // ── Colocation ────────────────────────────────────────────────────────────
    if (dto.hasAvailableBeds === true) {
      filter['studentDetails.availableBeds'] = { $gt: 0 };
    }
    if (dto.minAvailableBeds !== undefined) {
      filter['studentDetails.availableBeds'] = { $gte: dto.minAvailableBeds };
    }

    // ── Sort ──────────────────────────────────────────────────────────────────
    // Map frontend sort keys to their MongoDB paths
    const sortKeyMap: Record<string, string> = {
      campusProximityMeters: 'studentDetails.campusProximityMeters',
      pricePerPersonMonthly: 'studentDetails.pricePerPersonMonthly',
      price: 'price',
      createdAt: 'createdAt',
    };

    const mongoSortKey = sortKeyMap[sortBy] ?? 'createdAt';
    const sort: any = { [mongoSortKey]: sortOrder === 'asc' ? 1 : -1 };

    // Student-Approved listings always surface first within the sorted results
    sort['studentDetails.isStudentApproved'] = -1;

    const [properties, total] = await Promise.all([
      this.propertyModel
        .find(filter)
        .populate('ownerId', 'name phoneNumber profilePicture averageRating')
        .populate('agentId', 'name phoneNumber profilePicture agency')
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .exec(),
      this.propertyModel.countDocuments(filter),
    ]);

    this.logger.log(
      `Student property search: ${total} results (city: ${dto.city ?? 'any'})`,
    );

    return { properties, total, page, totalPages: Math.ceil(total / limit) };
  }

  // ══════════════════════════════════════════════════════════════════════════
  // LANDLORD — opt a listing into the student programme
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Landlord or agent marks one of their properties as student-friendly
   * and fills in the studentDetails subdocument.
   * Flips isStudentFriendly to true and saves studentDetails atomically.
   */
  async markAsStudentFriendly(
    propertyId: string,
    requestingUser: { _id: Types.ObjectId; role: UserRole },
    dto: MarkStudentFriendlyDto,
  ): Promise<Property> {
    if (!Types.ObjectId.isValid(propertyId)) {
      throw new BadRequestException('Invalid property ID');
    }

    const property = await this.propertyModel.findById(propertyId).exec();
    if (!property) throw new NotFoundException('Property not found');

    // Permission check — must be owner, agent on the listing, or admin
    const isOwner = property.ownerId.toString() === requestingUser._id.toString();
    const isAgent = property.agentId?.toString() === requestingUser._id.toString();
    const isAdmin = requestingUser.role === UserRole.ADMIN;

    if (!isOwner && !isAgent && !isAdmin) {
      throw new ForbiddenException(
        'You can only update student details for your own listings.',
      );
    }

    const updated = await this.propertyModel
      .findByIdAndUpdate(
        propertyId,
        {
          $set: {
            isStudentFriendly: true,
            studentDetails: {
              campusProximityMeters: dto.campusProximityMeters,
              nearestCampus: dto.nearestCampus,
              walkingMinutes: dto.walkingMinutes,
              taxiMinutes: dto.taxiMinutes,
              waterSource: dto.waterSource,
              electricityBackup: dto.electricityBackup,
              furnishingStatus: dto.furnishingStatus,
              genderRestriction: dto.genderRestriction,
              curfewTime: dto.curfewTime,
              visitorsAllowed: dto.visitorsAllowed,
              cookingAllowed: dto.cookingAllowed,
              hasGatedCompound: dto.hasGatedCompound,
              hasNightWatchman: dto.hasNightWatchman,
              hasFence: dto.hasFence,
              maxAdvanceMonths: dto.maxAdvanceMonths,
              acceptsRentAdvanceScheme: dto.acceptsRentAdvanceScheme ?? false,
              availableBeds: dto.availableBeds,
              totalBeds: dto.totalBeds,
              pricePerPersonMonthly: dto.pricePerPersonMonthly,
              // isStudentApproved is admin-only — never set from this endpoint
              isStudentApproved: property.studentDetails?.isStudentApproved ?? false,
            },
          },
        },
        { new: true },
      )
      .exec();

    this.logger.log(`✅ Property ${propertyId} marked as student-friendly`);
    return updated!;
  }

  /**
   * Remove student-friendly flag from a listing.
   * Clears studentDetails entirely.
   */
  async removeStudentFriendly(
    propertyId: string,
    requestingUser: { _id: Types.ObjectId; role: UserRole },
  ): Promise<Property> {
    if (!Types.ObjectId.isValid(propertyId)) {
      throw new BadRequestException('Invalid property ID');
    }

    const property = await this.propertyModel.findById(propertyId).exec();
    if (!property) throw new NotFoundException('Property not found');

    const isOwner = property.ownerId.toString() === requestingUser._id.toString();
    const isAgent = property.agentId?.toString() === requestingUser._id.toString();
    const isAdmin = requestingUser.role === UserRole.ADMIN;

    if (!isOwner && !isAgent && !isAdmin) {
      throw new ForbiddenException('You can only update your own listings.');
    }

    const updated = await this.propertyModel
      .findByIdAndUpdate(
        propertyId,
        { $set: { isStudentFriendly: false, studentDetails: null } },
        { new: true },
      )
      .exec();

    this.logger.log(`Property ${propertyId} removed from student programme`);
    return updated!;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ADMIN — Student-Approved badge
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Admin grants the Student-Approved badge to a property.
   * This boosts the listing in student search results.
   * Also notifies the landlord.
   */
  async grantStudentApproved(
    propertyId: string,
    adminId: string,
  ): Promise<Property> {
    if (!Types.ObjectId.isValid(propertyId)) {
      throw new BadRequestException('Invalid property ID');
    }

    const property = await this.propertyModel.findById(propertyId).exec();
    if (!property) throw new NotFoundException('Property not found');

    if (!property.isStudentFriendly) {
      throw new BadRequestException(
        'Property must be marked as student-friendly before receiving the Student-Approved badge.',
      );
    }

    const updated = await this.propertyModel
      .findByIdAndUpdate(
        propertyId,
        { $set: { 'studentDetails.isStudentApproved': true } },
        { new: true },
      )
      .exec();

    // Notify the property owner
    this.notificationsService.create({
      userId: property.ownerId.toString(),
      type: NotificationType.PROPERTY_UPDATE,
      title: 'Student-Approved badge awarded!',
      message: `Your property "${property.title}" has been awarded the Student-Approved badge and will rank higher in student housing searches.`,
      metadata: { propertyId, action: 'student_approved_granted' },
    }).catch((err) =>
      this.logger.warn(`Notification failed: ${err.message}`),
    );

    this.logger.log(
      `✅ Student-Approved badge granted to property ${propertyId} by admin ${adminId}`,
    );

    return updated!;
  }

  /**
   * Admin revokes the Student-Approved badge.
   */
  async revokeStudentApproved(
    propertyId: string,
    adminId: string,
  ): Promise<Property> {
    if (!Types.ObjectId.isValid(propertyId)) {
      throw new BadRequestException('Invalid property ID');
    }

    const property = await this.propertyModel.findById(propertyId).exec();
    if (!property) throw new NotFoundException('Property not found');

    const updated = await this.propertyModel
      .findByIdAndUpdate(
        propertyId,
        { $set: { 'studentDetails.isStudentApproved': false } },
        { new: true },
      )
      .exec();

    this.logger.log(
      `Student-Approved badge revoked from property ${propertyId} by admin ${adminId}`,
    );

    return updated!;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // STATS
  // ══════════════════════════════════════════════════════════════════════════

  async getStudentPropertyStats(): Promise<{
    total: number;
    studentApproved: number;
    byCity: Array<{ city: string; count: number }>;
    byWaterSource: Record<string, number>;
    byElectricityBackup: Record<string, number>;
    withAvailableBeds: number;
  }> {
    const baseFilter = {
      isStudentFriendly: true,
      isActive: true,
      approvalStatus: ApprovalStatus.APPROVED,
    };

    const [total, studentApproved, byCityAgg, waterAgg, electricityAgg, withBeds] =
      await Promise.all([
        this.propertyModel.countDocuments(baseFilter),
        this.propertyModel.countDocuments({
          ...baseFilter,
          'studentDetails.isStudentApproved': true,
        }),
        this.propertyModel.aggregate([
          { $match: baseFilter },
          { $group: { _id: '$city', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 10 },
          { $project: { _id: 0, city: '$_id', count: 1 } },
        ]),
        this.propertyModel.aggregate([
          { $match: { ...baseFilter, 'studentDetails.waterSource': { $exists: true } } },
          { $group: { _id: '$studentDetails.waterSource', count: { $sum: 1 } } },
        ]),
        this.propertyModel.aggregate([
          { $match: { ...baseFilter, 'studentDetails.electricityBackup': { $exists: true } } },
          { $group: { _id: '$studentDetails.electricityBackup', count: { $sum: 1 } } },
        ]),
        this.propertyModel.countDocuments({
          ...baseFilter,
          'studentDetails.availableBeds': { $gt: 0 },
        }),
      ]);

    return {
      total,
      studentApproved,
      byCity: byCityAgg,
      byWaterSource: waterAgg.reduce(
        (acc: Record<string, number>, s: any) => ({ ...acc, [s._id]: s.count }),
        {},
      ),
      byElectricityBackup: electricityAgg.reduce(
        (acc: Record<string, number>, s: any) => ({ ...acc, [s._id]: s.count }),
        {},
      ),
      withAvailableBeds: withBeds,
    };
  }
}