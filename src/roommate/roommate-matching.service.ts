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
import { Cron, CronExpression } from '@nestjs/schedule';

import {
  RoommateProfile,
  RoommateProfileDocument,
  RoommateMode,
  MatchStatus,
  SleepSchedule,
  CleanlinessLevel,
  SocialHabit,
  StudyHabit,
} from './schemas/roommate-profile.schema';
import {
  RoommateMatch,
  RoommateMatchDocument,
} from './schemas/roommate-match.schema';
import {
  CreateRoommateProfileDto,
  UpdateRoommateProfileDto,
  SearchRoommatesDto,
} from './dto/roommate.dto';
import {
  StudentProfile,
  StudentProfileDocument,
} from '../student-profiles/schemas/student-profile.schema';
import { User, UserDocument, StudentVerificationStatus } from '../users/schemas/user.schema';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/schemas/notification.schema';
import { ChatService } from '../chat/chat.service';
import { CreateConversationDto } from '../chat/dto/chat.dto';

@Injectable()
export class RoommateMatchingService {
  private readonly logger = new Logger(RoommateMatchingService.name);

  /** How many days a PENDING match stays open before expiring */
  private readonly MATCH_EXPIRY_DAYS = 7;

  constructor(
    @InjectModel(RoommateProfile.name)
    private roommateProfileModel: Model<RoommateProfileDocument>,
    @InjectModel(RoommateMatch.name)
    private roommateMatchModel: Model<RoommateMatchDocument>,
    @InjectModel(StudentProfile.name)
    private studentProfileModel: Model<StudentProfileDocument>,
    @InjectModel(User.name)
    private userModel: Model<UserDocument>,
    private notificationsService: NotificationsService,
    private chatService: ChatService,
  ) { }

  // ══════════════════════════════════════════════════════════════════════════
  // PROFILE — CREATE / READ / UPDATE / DEACTIVATE
  // ══════════════════════════════════════════════════════════════════════════

  async createProfile(
    userId: string,
    dto: CreateRoommateProfileDto,
  ): Promise<RoommateProfile> {
    const userObjectId = new Types.ObjectId(userId);

    // Resolve the student profile — gates on verified status
    const studentProfile = await this.studentProfileModel
      .findOne({ userId: userObjectId })
      .exec();

    if (!studentProfile) {
      throw new NotFoundException(
        'Complete student onboarding before creating a roommate profile.',
      );
    }

    if (studentProfile.verificationStatus !== StudentVerificationStatus.VERIFIED) {
      throw new ForbiddenException(
        'Your student ID must be verified before you can join the roommate pool.',
      );
    }

    // Prevent duplicates
    const existing = await this.roommateProfileModel
      .findOne({ userId: userObjectId })
      .exec();

    if (existing) {
      throw new ConflictException(
        'You already have a roommate profile. Use PATCH /roommate-matching/me to update it.',
      );
    }

    // "have_room" mode requires a linked property
    if (dto.mode === RoommateMode.HAVE_ROOM && !dto.propertyId) {
      throw new BadRequestException(
        'Please link a property listing when mode is "have_room".',
      );
    }

    const profile = new this.roommateProfileModel({
      userId: userObjectId,
      studentProfileId: studentProfile._id,
      mode: dto.mode,
      propertyId: dto.propertyId ? new Types.ObjectId(dto.propertyId) : undefined,
      campusCity: dto.campusCity,
      preferredNeighborhood: dto.preferredNeighborhood,
      budgetPerPersonMax: dto.budgetPerPersonMax,
      budgetPerPersonMin: dto.budgetPerPersonMin ?? 0,
      moveInDate: new Date(dto.moveInDate),
      moveInFlexibilityDays: dto.moveInFlexibilityDays ?? 14,
      sleepSchedule: dto.sleepSchedule,
      cleanlinessLevel: dto.cleanlinessLevel,
      socialHabit: dto.socialHabit,
      studyHabit: dto.studyHabit,
      isSmoker: dto.isSmoker ?? false,
      acceptsSmoker: dto.acceptsSmoker ?? false,
      hasPet: dto.hasPet ?? false,
      acceptsPet: dto.acceptsPet ?? false,
      preferredRoommateGender: dto.preferredRoommateGender ?? 'any',
      bio: dto.bio,
      isActive: true,
    });

    await profile.save();

    // Back-link from student profile → roommate profile
    await this.studentProfileModel.findByIdAndUpdate(studentProfile._id, {
      $set: {
        roommateProfileId: profile._id,
        isSeekingRoommate: true,
        roommateMode: dto.mode,
      },
    }).exec();

    // Mirror roommateProfileId onto User subdocument
    // Mirror roommateProfileId onto User subdocument
    await this.userModel.findByIdAndUpdate(userObjectId, [
      {
        $set: {
          studentProfile: {
            $cond: {
              if: { $eq: ['$studentProfile', null] },
              then: {
                roommateProfileId: profile._id,
                isAmbassador: false,
                ambassadorEarnings: 0,
                verificationStatus: 'unverified',
              },
              else: {
                $mergeObjects: [
                  '$studentProfile',
                  { roommateProfileId: profile._id },
                ],
              },
            },
          },
        },
      },
    ]).exec();

    this.logger.log(`✅ Roommate profile created for user ${userId} (mode: ${dto.mode})`);
    return profile;
  }

  async findMyProfile(userId: string): Promise<RoommateProfile> {
    const profile = await this.roommateProfileModel
      .findOne({ userId: new Types.ObjectId(userId) })
      .populate('propertyId', 'title address city images price studentDetails')
      .exec();

    if (!profile) {
      throw new NotFoundException(
        'No roommate profile found. Create one at POST /roommate-matching/profile.',
      );
    }

    return profile;
  }

  async findProfileById(profileId: string): Promise<RoommateProfile> {
    if (!Types.ObjectId.isValid(profileId)) {
      throw new BadRequestException('Invalid profile ID');
    }

    const profile = await this.roommateProfileModel
      .findById(profileId)
      .populate('userId', 'name profilePicture')
      .populate('propertyId', 'title address city images price studentDetails')
      .exec();

    if (!profile || !profile.isActive) {
      throw new NotFoundException('Roommate profile not found');
    }

    return profile;
  }

  async updateProfile(
    userId: string,
    dto: UpdateRoommateProfileDto,
  ): Promise<RoommateProfile> {
    const updateData: any = { ...dto };

    if (dto.moveInDate) {
      updateData.moveInDate = new Date(dto.moveInDate);
    }
    if (dto.propertyId) {
      updateData.propertyId = new Types.ObjectId(dto.propertyId);
    }

    const profile = await this.roommateProfileModel
      .findOneAndUpdate(
        { userId: new Types.ObjectId(userId) },
        { $set: updateData },
        { new: true },
      )
      .exec();

    if (!profile) {
      throw new NotFoundException(
        'No roommate profile found. Create one first.',
      );
    }

    // Sync mode change back to student profile
    if (dto.mode) {
      await this.studentProfileModel.findOneAndUpdate(
        { userId: new Types.ObjectId(userId) },
        { $set: { roommateMode: dto.mode } },
      ).exec();
    }

    this.logger.log(`✅ Roommate profile updated for user ${userId}`);
    return profile;
  }

  /** Soft-deactivate — keeps match history intact */
  async deactivateProfile(userId: string): Promise<{ message: string }> {
    await this.roommateProfileModel
      .findOneAndUpdate(
        { userId: new Types.ObjectId(userId) },
        { $set: { isActive: false } },
      )
      .exec();

    await this.studentProfileModel.findOneAndUpdate(
      { userId: new Types.ObjectId(userId) },
      { $set: { isSeekingRoommate: false } },
    ).exec();

    return { message: 'Your roommate profile has been paused. You can reactivate it anytime.' };
  }

  /** Reactivate a previously paused profile */
  async reactivateProfile(userId: string): Promise<RoommateProfile> {
    const profile = await this.roommateProfileModel
      .findOneAndUpdate(
        { userId: new Types.ObjectId(userId) },
        { $set: { isActive: true } },
        { new: true },
      )
      .exec();

    if (!profile) {
      throw new NotFoundException('No roommate profile found to reactivate.');
    }

    await this.studentProfileModel.findOneAndUpdate(
      { userId: new Types.ObjectId(userId) },
      { $set: { isSeekingRoommate: true } },
    ).exec();

    return profile;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SEARCH & BROWSE
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Browse the roommate pool with optional filters.
   * Excludes the calling user's own profile and any profiles they've
   * already interacted with (matched or rejected).
   * Results are sorted by compatibility score desc.
   */
  async searchProfiles(
    requestingUserId: string,
    dto: SearchRoommatesDto,
  ): Promise<{
    profiles: Array<RoommateProfile & { compatibilityScore: number }>;
    total: number;
    page: number;
    totalPages: number;
  }> {
    const { page = 1, limit = 20 } = dto;
    const skip = (page - 1) * limit;
    const requestingObjectId = new Types.ObjectId(requestingUserId);

    // Get IDs the user has already interacted with — exclude them
    const existingMatches = await this.roommateMatchModel
      .find({
        $or: [
          { initiatorId: requestingObjectId },
          { receiverId: requestingObjectId },
        ],
        status: { $in: [MatchStatus.PENDING, MatchStatus.MATCHED, MatchStatus.REJECTED] },
      })
      .select('initiatorId receiverId')
      .lean()
      .exec();

    const excludedIds = new Set<string>([requestingUserId]);
    existingMatches.forEach((m) => {
      excludedIds.add(m.initiatorId.toString());
      excludedIds.add(m.receiverId.toString());
    });

    const filter: any = {
      isActive: true,
      userId: { $nin: Array.from(excludedIds).map((id) => new Types.ObjectId(id)) },
    };

    if (dto.campusCity) filter.campusCity = { $regex: dto.campusCity, $options: 'i' };
    if (dto.mode) filter.mode = dto.mode;
    if (dto.maxBudget) filter.budgetPerPersonMax = { $lte: dto.maxBudget };
    if (dto.sleepSchedule) filter.sleepSchedule = dto.sleepSchedule;
    if (dto.cleanlinessLevel) filter.cleanlinessLevel = dto.cleanlinessLevel;
    if (typeof dto.acceptsSmoker === 'boolean') filter.acceptsSmoker = dto.acceptsSmoker;
    if (typeof dto.acceptsPet === 'boolean') filter.acceptsPet = dto.acceptsPet;

    if (dto.preferredRoommateGender && dto.preferredRoommateGender !== 'any') {
      filter.preferredRoommateGender = { $in: [dto.preferredRoommateGender, 'any'] };
    }

    const [rawProfiles, total] = await Promise.all([
      this.roommateProfileModel
        .find(filter)
        .populate('userId', 'name profilePicture')
        .populate('propertyId', 'title address city images price studentDetails')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      this.roommateProfileModel.countDocuments(filter),
    ]);

    // Attach compatibility score to each result
    const myProfile = await this.roommateProfileModel
      .findOne({ userId: requestingObjectId })
      .lean()
      .exec();

    const profiles = rawProfiles.map((p) => ({
      ...p,
      compatibilityScore: myProfile
        ? this.computeCompatibilityScore(myProfile as any, p as any)
        : 0,
    }));

    // Sort highest compatibility first
    profiles.sort((a, b) => b.compatibilityScore - a.compatibilityScore);

    return { profiles: profiles as any, total, page, totalPages: Math.ceil(total / limit) };
  }

  // ══════════════════════════════════════════════════════════════════════════
  // MATCH FLOW  — express interest → accept → chat unlocked
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Student A expresses interest in Student B.
   * If B already liked A (reverse pending match exists), auto-mutually match.
   */
  async expressInterest(
    initiatorUserId: string,
    receiverUserId: string,
  ): Promise<{ status: MatchStatus; chatRoomId?: string; message: string }> {
    if (initiatorUserId === receiverUserId) {
      throw new BadRequestException('You cannot match with yourself.');
    }

    const [initiatorObjectId, receiverObjectId] = [
      new Types.ObjectId(initiatorUserId),
      new Types.ObjectId(receiverUserId),
    ];

    // Ensure both have active profiles
    const [initiatorProfile, receiverProfile] = await Promise.all([
      this.roommateProfileModel.findOne({ userId: initiatorObjectId, isActive: true }).exec(),
      this.roommateProfileModel.findOne({ userId: receiverObjectId, isActive: true }).exec(),
    ]);

    if (!initiatorProfile) {
      throw new NotFoundException('Create an active roommate profile before expressing interest.');
    }
    if (!receiverProfile) {
      throw new NotFoundException('This roommate profile is no longer active.');
    }

    // Check for an existing match in either direction
    const existingForward = await this.roommateMatchModel
      .findOne({ initiatorId: initiatorObjectId, receiverId: receiverObjectId })
      .exec();

    if (existingForward) {
      if (existingForward.status === MatchStatus.MATCHED) {
        return { status: MatchStatus.MATCHED, chatRoomId: existingForward.chatRoomId?.toString(), message: 'You are already matched.' };
      }
      if (existingForward.status === MatchStatus.PENDING) {
        return { status: MatchStatus.PENDING, message: 'You have already expressed interest. Waiting for their response.' };
      }
    }

    // Check if the receiver already liked the initiator (reverse direction)
    const reverseMatch = await this.roommateMatchModel
      .findOne({
        initiatorId: receiverObjectId,
        receiverId: initiatorObjectId,
        status: MatchStatus.PENDING,
      })
      .exec();

    if (reverseMatch) {
      // Mutual interest — upgrade to MATCHED
      return this.confirmMatch(reverseMatch, initiatorProfile, receiverProfile);
    }

    // No prior interaction — create a new PENDING match
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + this.MATCH_EXPIRY_DAYS);

    const score = this.computeCompatibilityScore(initiatorProfile, receiverProfile);

    const match = new this.roommateMatchModel({
      initiatorId: initiatorObjectId,
      receiverId: receiverObjectId,
      initiatorProfileId: initiatorProfile._id,
      receiverProfileId: receiverProfile._id,
      status: MatchStatus.PENDING,
      compatibilityScore: score,
      expiresAt,
    });

    await match.save();

    // Notify receiver of the interest
    this.notificationsService.create({
      userId: receiverUserId,
      type: NotificationType.MESSAGE,
      title: 'Someone is interested in rooming with you!',
      message: 'A student has expressed interest in matching with you. Check your roommate matches.',
      metadata: { action: 'roommate_interest', matchId: (match._id as Types.ObjectId).toString() },
    }).catch((err) => this.logger.warn(`Notification failed: ${err.message}`));

    this.logger.log(`✅ Interest expressed: ${initiatorUserId} → ${receiverUserId}`);
    return { status: MatchStatus.PENDING, message: 'Interest sent! They will be notified.' };
  }

  /**
   * The receiver explicitly accepts a pending match.
   * Also handles the case where expressInterest auto-calls this internally.
   */
  async acceptMatch(
    receiverUserId: string,
    matchId: string,
  ): Promise<{ status: MatchStatus; chatRoomId: string; message: string }> {
    if (!Types.ObjectId.isValid(matchId)) {
      throw new BadRequestException('Invalid match ID');
    }

    const match = await this.roommateMatchModel
      .findOne({
        _id: new Types.ObjectId(matchId),
        receiverId: new Types.ObjectId(receiverUserId),
        status: MatchStatus.PENDING,
      })
      .exec();

    if (!match) {
      throw new NotFoundException('Pending match not found or already resolved.');
    }

    const [initiatorProfile, receiverProfile] = await Promise.all([
      this.roommateProfileModel.findById(match.initiatorProfileId).exec(),
      this.roommateProfileModel.findById(match.receiverProfileId).exec(),
    ]);

    const result = await this.confirmMatch(match, receiverProfile!, initiatorProfile!);
    return result as any;
  }

  /**
   * The receiver rejects a pending match.
   */
  async rejectMatch(
    receiverUserId: string,
    matchId: string,
  ): Promise<{ message: string }> {
    if (!Types.ObjectId.isValid(matchId)) {
      throw new BadRequestException('Invalid match ID');
    }

    const match = await this.roommateMatchModel
      .findOneAndUpdate(
        {
          _id: new Types.ObjectId(matchId),
          receiverId: new Types.ObjectId(receiverUserId),
          status: MatchStatus.PENDING,
        },
        { $set: { status: MatchStatus.REJECTED } },
        { new: true },
      )
      .exec();

    if (!match) {
      throw new NotFoundException('Pending match not found or already resolved.');
    }

    this.logger.log(`Match ${matchId} rejected by ${receiverUserId}`);
    return { message: 'Match declined.' };
  }

  /**
   * Get all matches for the calling user, grouped by status.
   */
  async getMyMatches(userId: string): Promise<{
    pending: RoommateMatch[];
    matched: RoommateMatch[];
  }> {
    const userObjectId = new Types.ObjectId(userId);

    const allMatches = await this.roommateMatchModel
      .find({
        $or: [{ initiatorId: userObjectId }, { receiverId: userObjectId }],
        status: { $in: [MatchStatus.PENDING, MatchStatus.MATCHED] },
      })
      .populate('initiatorId', 'name profilePicture')
      .populate('receiverId', 'name profilePicture')
      .populate('initiatorProfileId', 'mode campusCity budgetPerPersonMax sleepSchedule bio')
      .populate('receiverProfileId', 'mode campusCity budgetPerPersonMax sleepSchedule bio')
      .sort({ createdAt: -1 })
      .exec();

    return {
      pending: allMatches.filter((m) => m.status === MatchStatus.PENDING),
      matched: allMatches.filter((m) => m.status === MatchStatus.MATCHED),
    };
  }

  // ══════════════════════════════════════════════════════════════════════════
  // COMPATIBILITY SCORING
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Computes a 0–100 compatibility score between two roommate profiles.
   *
   * Weights:
   *   Sleep schedule match    20 pts
   *   Cleanliness match       20 pts
   *   Social habit match      15 pts
   *   Study habit match       10 pts
   *   Budget overlap          15 pts
   *   Smoking compatibility   10 pts
   *   Pet compatibility       10 pts
   */
  computeCompatibilityScore(
    a: RoommateProfile,
    b: RoommateProfile,
  ): number {
    let score = 0;

    // Sleep schedule (20)
    if (a.sleepSchedule === b.sleepSchedule) {
      score += 20;
    } else if (
      a.sleepSchedule === SleepSchedule.FLEXIBLE ||
      b.sleepSchedule === SleepSchedule.FLEXIBLE
    ) {
      score += 10;
    }

    // Cleanliness (20)
    if (a.cleanlinessLevel === b.cleanlinessLevel) {
      score += 20;
    } else {
      const levels = [
        CleanlinessLevel.VERY_NEAT,
        CleanlinessLevel.NEAT,
        CleanlinessLevel.RELAXED,
      ];
      const diff = Math.abs(
        levels.indexOf(a.cleanlinessLevel) - levels.indexOf(b.cleanlinessLevel),
      );
      // Adjacent levels get partial credit
      if (diff === 1) score += 10;
    }

    // Social habit (15)
    if (a.socialHabit === b.socialHabit) {
      score += 15;
    } else {
      const habits = [
        SocialHabit.INTROVERTED,
        SocialHabit.BALANCED,
        SocialHabit.SOCIAL,
      ];
      const diff = Math.abs(
        habits.indexOf(a.socialHabit) - habits.indexOf(b.socialHabit),
      );
      if (diff === 1) score += 7;
    }

    // Study habit (10)
    if (a.studyHabit === b.studyHabit) score += 10;
    else score += 5; // Different habits are compatible — one studies out, one is home

    // Budget overlap (15)
    // Full points if max budgets are within 20% of each other
    const budgetRatio = Math.min(a.budgetPerPersonMax, b.budgetPerPersonMax) /
      Math.max(a.budgetPerPersonMax, b.budgetPerPersonMax);
    score += Math.round(budgetRatio * 15);

    // Smoking compatibility (10)
    const smokingOk =
      (a.isSmoker && b.acceptsSmoker) ||
      (b.isSmoker && a.acceptsSmoker) ||
      (!a.isSmoker && !b.isSmoker);
    if (smokingOk) score += 10;

    // Pet compatibility (10)
    const petOk =
      (a.hasPet && b.acceptsPet) ||
      (b.hasPet && a.acceptsPet) ||
      (!a.hasPet && !b.hasPet);
    if (petOk) score += 10;

    return Math.min(score, 100);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // CRON — expire stale PENDING matches
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Runs every hour. Flips PENDING matches past their expiresAt to EXPIRED.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async expireStaleMatches(): Promise<void> {
    const result = await this.roommateMatchModel
      .updateMany(
        { status: MatchStatus.PENDING, expiresAt: { $lt: new Date() } },
        { $set: { status: MatchStatus.EXPIRED } },
      )
      .exec();

    if (result.modifiedCount > 0) {
      this.logger.log(`⏰ Expired ${result.modifiedCount} stale roommate matches`);
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PRIVATE HELPERS
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Upgrades an existing match (or a new reverse match) to MATCHED status.
   * Creates a ChatRoom between the two users via ChatService.
   */
  private async confirmMatch(
    match: RoommateMatchDocument,
    profileA: RoommateProfileDocument,
    profileB: RoommateProfileDocument,
  ): Promise<{ status: MatchStatus; chatRoomId: string; message: string }> {
    // Open a conversation between the two matched students via ChatService
    const conversationDto: CreateConversationDto = {
      participantId: match.receiverId.toString(),
    };
    const chatRoom = await this.chatService.createConversation(
      match.initiatorId.toString(),
      conversationDto,
    );

    const updatedMatch = await this.roommateMatchModel
      .findByIdAndUpdate(
        match._id,
        {
          $set: {
            status: MatchStatus.MATCHED,
            chatRoomId: chatRoom._id,
            matchedAt: new Date(),
            compatibilityScore: this.computeCompatibilityScore(profileA, profileB),
          },
        },
        { new: true },
      )
      .exec();

    const chatRoomId = chatRoom._id.toString();

    // Notify both parties
    await Promise.all([
      this.notificationsService.create({
        userId: match.initiatorId.toString(),
        type: NotificationType.MESSAGE,
        title: "It's a match! 🎉",
        message: 'You and your potential roommate both expressed interest. Start chatting!',
        metadata: {
          action: 'roommate_matched',
          matchId: (match._id as Types.ObjectId).toString(),
          chatRoomId,
        },
      }),
      this.notificationsService.create({
        userId: match.receiverId.toString(),
        type: NotificationType.MESSAGE,
        title: "It's a match! 🎉",
        message: 'You and your potential roommate both expressed interest. Start chatting!',
        metadata: {
          action: 'roommate_matched',
          matchId: (match._id as Types.ObjectId).toString(),
          chatRoomId,
        },
      }),
    ]);

    this.logger.log(
      `✅ Roommate match confirmed: ${match.initiatorId} ↔ ${match.receiverId} | chat: ${chatRoomId}`,
    );

    return {
      status: MatchStatus.MATCHED,
      chatRoomId,
      message: "It's a match! You can now chat with your potential roommate.",
    };
  }
}