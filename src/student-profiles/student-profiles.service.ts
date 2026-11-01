import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';

import {
  StudentProfile,
  StudentProfileDocument,
} from './schemas/student-profile.schema';
import {
  CreateStudentProfileDto,
  UpdateStudentProfileDto,
  ReviewStudentIdDto,
  GrantAmbassadorDto,
  GetStudentProfilesQueryDto,
} from './dto/student-profile.dto';
import { User, UserDocument, UserRole, StudentVerificationStatus } from '../users/schemas/user.schema';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/schemas/notification.schema';

@Injectable()
export class StudentProfilesService {
  private readonly logger = new Logger(StudentProfilesService.name);

  constructor(
    @InjectModel(StudentProfile.name)
    private studentProfileModel: Model<StudentProfileDocument>,
    @InjectModel(User.name)
    private userModel: Model<UserDocument>,
    private configService: ConfigService,
    private notificationsService: NotificationsService,
  ) {
    cloudinary.config({
      cloud_name: this.configService.get<string>('CLOUDINARY_CLOUD_NAME'),
      api_key: this.configService.get<string>('CLOUDINARY_API_KEY'),
      api_secret: this.configService.get<string>('CLOUDINARY_API_SECRET'),
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ONBOARDING
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Create a StudentProfile for an existing user and flip their role to STUDENT.
   * Called once during onboarding — throws ConflictException if they already have one.
   */
  async create(
    userId: string,
    dto: CreateStudentProfileDto,
  ): Promise<StudentProfile> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user ID');
    }

    const userObjectId = new Types.ObjectId(userId);

    const user = await this.userModel.findById(userObjectId).exec();
    if (!user) throw new NotFoundException('User not found');

    const existing = await this.studentProfileModel
      .findOne({ userId: userObjectId })
      .exec();
    if (existing) {
      throw new ConflictException(
        'A student profile already exists for this account. Use PATCH /student-profiles/me to update it.',
      );
    }

    const profile = new this.studentProfileModel({
      userId: userObjectId,
      universityName: dto.universityName,
      faculty: dto.faculty,
      studyLevel: dto.studyLevel,
      enrollmentYear: dto.enrollmentYear,
      campusCity: dto.campusCity,
      campusName: dto.campusName,
      campusLatitude: dto.campusLatitude,
      campusLongitude: dto.campusLongitude,
      verificationStatus: StudentVerificationStatus.UNVERIFIED,
      isAmbassador: false,
      ambassadorEarnings: 0,
      referralCount: 0,
      landlordReferralCount: 0,
    });

    await profile.save();

    await this.userModel.findByIdAndUpdate(userObjectId, {
      $set: {
        role: UserRole.STUDENT,
        'studentProfile.universityName': dto.universityName,
        'studentProfile.faculty': dto.faculty,
        'studentProfile.studyLevel': dto.studyLevel,
        'studentProfile.enrollmentYear': dto.enrollmentYear,
        'studentProfile.campusCity': dto.campusCity,
        'studentProfile.campusLatitude': dto.campusLatitude,
        'studentProfile.campusLongitude': dto.campusLongitude,
        'studentProfile.verificationStatus': StudentVerificationStatus.UNVERIFIED,
        'studentProfile.isAmbassador': false,
        'studentProfile.roommateProfileId': null,
      },
    }).exec();

    this.logger.log(`✅ Student profile created for user ${userId}`);
    return profile;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // READ
  // ══════════════════════════════════════════════════════════════════════════

  async findMyProfile(userId: string): Promise<StudentProfile> {
    const profile = await this.studentProfileModel
      .findOne({ userId: new Types.ObjectId(userId) })
      .exec();

    if (!profile) {
      throw new NotFoundException(
        'No student profile found. Complete student onboarding first.',
      );
    }

    return profile;
  }

  async findById(profileId: string): Promise<StudentProfile> {
    if (!Types.ObjectId.isValid(profileId)) {
      throw new BadRequestException('Invalid profile ID');
    }

    const profile = await this.studentProfileModel
      .findById(profileId)
      .populate('userId', 'name email phoneNumber profilePicture')
      .exec();

    if (!profile) throw new NotFoundException('Student profile not found');
    return profile;
  }

  async findAll(query: GetStudentProfilesQueryDto): Promise<{
    profiles: StudentProfile[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const { page = 1, limit = 20, verificationStatus, campusCity, isAmbassador } = query;
    const skip = (page - 1) * limit;

    const filter: any = {};
    if (verificationStatus) filter.verificationStatus = verificationStatus;
    if (campusCity) filter.campusCity = { $regex: campusCity, $options: 'i' };
    if (typeof isAmbassador === 'boolean') filter.isAmbassador = isAmbassador;

    const [profiles, total] = await Promise.all([
      this.studentProfileModel
        .find(filter)
        .populate('userId', 'name email phoneNumber profilePicture')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.studentProfileModel.countDocuments(filter),
    ]);

    return { profiles, total, page, totalPages: Math.ceil(total / limit) };
  }

  // ══════════════════════════════════════════════════════════════════════════
  // UPDATE
  // ══════════════════════════════════════════════════════════════════════════

  async update(
    userId: string,
    dto: UpdateStudentProfileDto,
  ): Promise<StudentProfile> {
    const profile = await this.studentProfileModel
      .findOneAndUpdate(
        { userId: new Types.ObjectId(userId) },
        { $set: dto },
        { new: true },
      )
      .exec();

    if (!profile) {
      throw new NotFoundException(
        'No student profile found. Complete student onboarding first.',
      );
    }

    const mirrorFields: any = {};
    if (dto.universityName) mirrorFields['studentProfile.universityName'] = dto.universityName;
    if (dto.faculty) mirrorFields['studentProfile.faculty'] = dto.faculty;
    if (dto.studyLevel) mirrorFields['studentProfile.studyLevel'] = dto.studyLevel;
    if (dto.campusCity) mirrorFields['studentProfile.campusCity'] = dto.campusCity;
    if (dto.campusLatitude) mirrorFields['studentProfile.campusLatitude'] = dto.campusLatitude;
    if (dto.campusLongitude) mirrorFields['studentProfile.campusLongitude'] = dto.campusLongitude;

    if (Object.keys(mirrorFields).length > 0) {
      await this.userModel.findByIdAndUpdate(userId, { $set: mirrorFields }).exec();
    }

    this.logger.log(`✅ Student profile updated for user ${userId}`);
    return profile;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // STUDENT ID UPLOAD & VERIFICATION
  // ══════════════════════════════════════════════════════════════════════════

  async uploadStudentId(

    userId: string,
    file: { buffer: Buffer; mimetype: string },
  ): Promise<StudentProfile> {
    this.logger.log(`Cloudinary config: cloud=${this.configService.get('CLOUDINARY_CLOUD_NAME')}, key=${this.configService.get('CLOUDINARY_API_KEY') ? 'SET' : 'MISSING'}, secret=${this.configService.get('CLOUDINARY_API_SECRET') ? 'SET' : 'MISSING'}`);
    const profile = await this.studentProfileModel
      .findOne({ userId: new Types.ObjectId(userId) })
      .exec();

    if (!profile) {
      throw new NotFoundException(
        'Create your student profile before uploading an ID.',
      );
    }

    if (profile.studentIdPublicId) {
      try {
        await cloudinary.uploader.destroy(profile.studentIdPublicId);
      } catch (err) {
        this.logger.warn(`Could not delete old student ID asset: ${profile.studentIdPublicId}`);
      }
    }

    const uploadResult = await new Promise<any>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: 'horohouse/student-ids',
          resource_type: 'image',
          transformation: [{ quality: 80, fetch_format: 'auto' }],
          tags: ['student-id', 'pending-review'],
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        },
      );
      stream.end(file.buffer);
    });

    const updated = await this.studentProfileModel
      .findOneAndUpdate(
        { userId: new Types.ObjectId(userId) },
        {
          $set: {
            studentIdUrl: uploadResult.secure_url,
            studentIdPublicId: uploadResult.public_id,
            verificationStatus: StudentVerificationStatus.PENDING,
            verificationSubmittedAt: new Date(),
            verificationRejectionReason: null,
          },
        },
        { new: true },
      )
      .exec();

    await this.userModel.findByIdAndUpdate(userId, {
      $set: {
        'studentProfile.studentIdUrl': uploadResult.secure_url,
        'studentProfile.studentIdPublicId': uploadResult.public_id,
        'studentProfile.verificationStatus': StudentVerificationStatus.PENDING,
        'studentProfile.verificationSubmittedAt': new Date(),
      },
    }).exec();

    this.logger.log(`✅ Student ID uploaded for user ${userId} — status: PENDING`);

    this.notifyAdminsOfPendingId(userId).catch((err) =>
      this.logger.warn(`Admin notification failed: ${err.message}`),
    );

    return updated!;
  }

  async reviewStudentId(
    profileId: string,
    adminId: string,
    dto: ReviewStudentIdDto,
  ): Promise<StudentProfile> {
    if (!Types.ObjectId.isValid(profileId)) {
      throw new BadRequestException('Invalid profile ID');
    }

    if (
      dto.decision === StudentVerificationStatus.REJECTED &&
      !dto.rejectionReason
    ) {
      throw new BadRequestException(
        'A rejection reason is required so the student knows what to fix.',
      );
    }

    const profile = await this.studentProfileModel.findById(profileId).exec();
    if (!profile) throw new NotFoundException('Student profile not found');

    if (profile.verificationStatus !== StudentVerificationStatus.PENDING) {
      throw new BadRequestException(
        `Cannot review a profile with status "${profile.verificationStatus}". Only PENDING profiles can be reviewed.`,
      );
    }

    const updateFields: any = {
      verificationStatus: dto.decision,
      verificationReviewedAt: new Date(),
      verificationReviewedBy: new Types.ObjectId(adminId),
    };

    if (dto.decision === StudentVerificationStatus.REJECTED) {
      updateFields.verificationRejectionReason = dto.rejectionReason;
    } else {
      updateFields.verificationRejectionReason = null;
    }

    const updated = await this.studentProfileModel
      .findByIdAndUpdate(profileId, { $set: updateFields }, { new: true })
      .populate('userId', 'name email phoneNumber')
      .exec();

    const mirrorUpdate: any = {
      'studentProfile.verificationStatus': dto.decision,
      'studentProfile.verificationReviewedAt': new Date(),
    };
    if (dto.rejectionReason) {
      mirrorUpdate['studentProfile.verificationRejectionReason'] = dto.rejectionReason;
    }

    await this.userModel
      .findByIdAndUpdate(profile.userId, { $set: mirrorUpdate })
      .exec();

    this.notifyStudentOfReview(
      profile.userId.toString(),
      dto.decision,
      dto.rejectionReason,
    ).catch((err) =>
      this.logger.warn(`Student notification failed: ${err.message}`),
    );

    this.logger.log(
      `✅ Student ID ${dto.decision} for profile ${profileId} by admin ${adminId}`,
    );

    return updated!;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // AMBASSADOR MANAGEMENT
  // ══════════════════════════════════════════════════════════════════════════

  async grantAmbassador(
    profileId: string,
    dto: GrantAmbassadorDto,
  ): Promise<StudentProfile> {
    if (!Types.ObjectId.isValid(profileId)) {
      throw new BadRequestException('Invalid profile ID');
    }

    const codeConflict = await this.studentProfileModel
      .findOne({ ambassadorCode: dto.ambassadorCode.toUpperCase() })
      .exec();

    if (codeConflict) {
      throw new ConflictException(
        `Ambassador code "${dto.ambassadorCode}" is already in use.`,
      );
    }

    const profile = await this.studentProfileModel.findById(profileId).exec();
    if (!profile) throw new NotFoundException('Student profile not found');

    if (profile.verificationStatus !== StudentVerificationStatus.VERIFIED) {
      throw new ForbiddenException(
        'Only verified students can be appointed as campus ambassadors.',
      );
    }

    const updated = await this.studentProfileModel
      .findByIdAndUpdate(
        profileId,
        {
          $set: {
            isAmbassador: true,
            ambassadorCode: dto.ambassadorCode.toUpperCase(),
          },
        },
        { new: true },
      )
      .exec();

    await this.userModel
      .findByIdAndUpdate(profile.userId, {
        $set: {
          'studentProfile.isAmbassador': true,
          'studentProfile.ambassadorCode': dto.ambassadorCode.toUpperCase(),
        },
      })
      .exec();

    this.logger.log(
      `✅ Ambassador granted to profile ${profileId} — code: ${dto.ambassadorCode}`,
    );
    return updated!;
  }

  async resolveAmbassadorCode(
    code: string,
  ): Promise<{ userId: Types.ObjectId; profileId: Types.ObjectId } | null> {
    const profile = await this.studentProfileModel
      .findOne({ ambassadorCode: code.toUpperCase(), isAmbassador: true })
      .select('userId _id')
      .exec();

    if (!profile) return null;

    return {
      userId: profile.userId,
      profileId: profile._id as Types.ObjectId,
    };
  }

  async creditAmbassadorEarning(
    profileId: string,
    amountXaf: number,
    type: 'student' | 'landlord' = 'student',
  ): Promise<void> {
    const increment =
      type === 'landlord'
        ? { ambassadorEarnings: amountXaf, landlordReferralCount: 1 }
        : { ambassadorEarnings: amountXaf, referralCount: 1 };

    await this.studentProfileModel
      .findByIdAndUpdate(profileId, { $inc: increment })
      .exec();

    this.logger.log(
      `✅ Credited ${amountXaf} XAF to ambassador profile ${profileId} (type: ${type})`,
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // STATS
  // ══════════════════════════════════════════════════════════════════════════

  async getStats(): Promise<{
    total: number;
    byVerificationStatus: Record<string, number>;
    byCampusCity: Array<{ city: string; count: number }>;
    ambassadors: number;
    seekingRoommate: number;
  }> {
    const [statusAgg, cityAgg, ambassadors, seekingRoommate, total] =
      await Promise.all([
        this.studentProfileModel.aggregate([
          { $group: { _id: '$verificationStatus', count: { $sum: 1 } } },
        ]),
        this.studentProfileModel.aggregate([
          { $group: { _id: '$campusCity', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 10 },
          { $project: { _id: 0, city: '$_id', count: 1 } },
        ]),
        this.studentProfileModel.countDocuments({ isAmbassador: true }),
        this.studentProfileModel.countDocuments({ isSeekingRoommate: true }),
        this.studentProfileModel.countDocuments(),
      ]);

    return {
      total,
      byVerificationStatus: statusAgg.reduce(
        (acc, s) => ({ ...acc, [s._id]: s.count }),
        {},
      ),
      byCampusCity: cityAgg,
      ambassadors,
      seekingRoommate,
    };
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PRIVATE HELPERS
  // ══════════════════════════════════════════════════════════════════════════

  private async notifyAdminsOfPendingId(studentUserId: string): Promise<void> {
    const admins = await this.userModel
      .find({ role: UserRole.ADMIN, isActive: true })
      .select('_id')
      .exec();

    await Promise.all(
      admins.map((admin) =>
        this.notificationsService.create({
          userId: (admin._id as Types.ObjectId).toString(),
          type: NotificationType.SYSTEM,
          title: 'New student ID pending review',
          message: 'A student has submitted their university ID and is waiting for verification.',
          metadata: { studentUserId, action: 'review_student_id' },
        }),
      ),
    );
  }

  private async notifyStudentOfReview(
    studentUserId: string,
    decision: StudentVerificationStatus,
    rejectionReason?: string,
  ): Promise<void> {
    const isApproved = decision === StudentVerificationStatus.VERIFIED;

    await this.notificationsService.create({
      userId: studentUserId,
      type: NotificationType.SYSTEM,
      title: isApproved ? 'Student ID verified!' : 'Student ID review update',
      message: isApproved
        ? 'Your student ID has been approved. You now have full access to roommate matching and student-verified listings.'
        : `Your student ID was not approved. Reason: ${rejectionReason}. Please upload a valid document.`,
      metadata: { action: 'student_id_review_result', decision },
    });
  }
}