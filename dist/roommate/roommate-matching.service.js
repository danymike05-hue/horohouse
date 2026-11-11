"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var RoommateMatchingService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.RoommateMatchingService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const schedule_1 = require("@nestjs/schedule");
const roommate_profile_schema_1 = require("./schemas/roommate-profile.schema");
const roommate_match_schema_1 = require("./schemas/roommate-match.schema");
const student_profile_schema_1 = require("../student-profiles/schemas/student-profile.schema");
const user_schema_1 = require("../users/schemas/user.schema");
const notifications_service_1 = require("../notifications/notifications.service");
const notification_schema_1 = require("../notifications/schemas/notification.schema");
const chat_service_1 = require("../chat/chat.service");
let RoommateMatchingService = RoommateMatchingService_1 = class RoommateMatchingService {
    roommateProfileModel;
    roommateMatchModel;
    studentProfileModel;
    userModel;
    notificationsService;
    chatService;
    logger = new common_1.Logger(RoommateMatchingService_1.name);
    MATCH_EXPIRY_DAYS = 7;
    constructor(roommateProfileModel, roommateMatchModel, studentProfileModel, userModel, notificationsService, chatService) {
        this.roommateProfileModel = roommateProfileModel;
        this.roommateMatchModel = roommateMatchModel;
        this.studentProfileModel = studentProfileModel;
        this.userModel = userModel;
        this.notificationsService = notificationsService;
        this.chatService = chatService;
    }
    async createProfile(userId, dto) {
        const userObjectId = new mongoose_2.Types.ObjectId(userId);
        const studentProfile = await this.studentProfileModel
            .findOne({ userId: userObjectId })
            .exec();
        if (!studentProfile) {
            throw new common_1.NotFoundException('Complete student onboarding before creating a roommate profile.');
        }
        if (studentProfile.verificationStatus !== user_schema_1.StudentVerificationStatus.VERIFIED) {
            throw new common_1.ForbiddenException('Your student ID must be verified before you can join the roommate pool.');
        }
        const existing = await this.roommateProfileModel
            .findOne({ userId: userObjectId })
            .exec();
        if (existing) {
            throw new common_1.ConflictException('You already have a roommate profile. Use PATCH /roommate-matching/me to update it.');
        }
        if (dto.mode === roommate_profile_schema_1.RoommateMode.HAVE_ROOM && !dto.propertyId) {
            throw new common_1.BadRequestException('Please link a property listing when mode is "have_room".');
        }
        const profile = new this.roommateProfileModel({
            userId: userObjectId,
            studentProfileId: studentProfile._id,
            mode: dto.mode,
            propertyId: dto.propertyId ? new mongoose_2.Types.ObjectId(dto.propertyId) : undefined,
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
        await this.studentProfileModel.findByIdAndUpdate(studentProfile._id, {
            $set: {
                roommateProfileId: profile._id,
                isSeekingRoommate: true,
                roommateMode: dto.mode,
            },
        }).exec();
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
    async findMyProfile(userId) {
        const profile = await this.roommateProfileModel
            .findOne({ userId: new mongoose_2.Types.ObjectId(userId) })
            .populate('propertyId', 'title address city images price studentDetails')
            .exec();
        if (!profile) {
            throw new common_1.NotFoundException('No roommate profile found. Create one at POST /roommate-matching/profile.');
        }
        return profile;
    }
    async findProfileById(profileId) {
        if (!mongoose_2.Types.ObjectId.isValid(profileId)) {
            throw new common_1.BadRequestException('Invalid profile ID');
        }
        const profile = await this.roommateProfileModel
            .findById(profileId)
            .populate('userId', 'name profilePicture')
            .populate('propertyId', 'title address city images price studentDetails')
            .exec();
        if (!profile || !profile.isActive) {
            throw new common_1.NotFoundException('Roommate profile not found');
        }
        return profile;
    }
    async updateProfile(userId, dto) {
        const updateData = { ...dto };
        if (dto.moveInDate) {
            updateData.moveInDate = new Date(dto.moveInDate);
        }
        if (dto.propertyId) {
            updateData.propertyId = new mongoose_2.Types.ObjectId(dto.propertyId);
        }
        const profile = await this.roommateProfileModel
            .findOneAndUpdate({ userId: new mongoose_2.Types.ObjectId(userId) }, { $set: updateData }, { new: true })
            .exec();
        if (!profile) {
            throw new common_1.NotFoundException('No roommate profile found. Create one first.');
        }
        if (dto.mode) {
            await this.studentProfileModel.findOneAndUpdate({ userId: new mongoose_2.Types.ObjectId(userId) }, { $set: { roommateMode: dto.mode } }).exec();
        }
        this.logger.log(`✅ Roommate profile updated for user ${userId}`);
        return profile;
    }
    async deactivateProfile(userId) {
        await this.roommateProfileModel
            .findOneAndUpdate({ userId: new mongoose_2.Types.ObjectId(userId) }, { $set: { isActive: false } })
            .exec();
        await this.studentProfileModel.findOneAndUpdate({ userId: new mongoose_2.Types.ObjectId(userId) }, { $set: { isSeekingRoommate: false } }).exec();
        return { message: 'Your roommate profile has been paused. You can reactivate it anytime.' };
    }
    async reactivateProfile(userId) {
        const profile = await this.roommateProfileModel
            .findOneAndUpdate({ userId: new mongoose_2.Types.ObjectId(userId) }, { $set: { isActive: true } }, { new: true })
            .exec();
        if (!profile) {
            throw new common_1.NotFoundException('No roommate profile found to reactivate.');
        }
        await this.studentProfileModel.findOneAndUpdate({ userId: new mongoose_2.Types.ObjectId(userId) }, { $set: { isSeekingRoommate: true } }).exec();
        return profile;
    }
    async searchProfiles(requestingUserId, dto) {
        const { page = 1, limit = 20 } = dto;
        const skip = (page - 1) * limit;
        const requestingObjectId = new mongoose_2.Types.ObjectId(requestingUserId);
        const existingMatches = await this.roommateMatchModel
            .find({
            $or: [
                { initiatorId: requestingObjectId },
                { receiverId: requestingObjectId },
            ],
            status: { $in: [roommate_profile_schema_1.MatchStatus.PENDING, roommate_profile_schema_1.MatchStatus.MATCHED, roommate_profile_schema_1.MatchStatus.REJECTED] },
        })
            .select('initiatorId receiverId')
            .lean()
            .exec();
        const excludedIds = new Set([requestingUserId]);
        existingMatches.forEach((m) => {
            excludedIds.add(m.initiatorId.toString());
            excludedIds.add(m.receiverId.toString());
        });
        const filter = {
            isActive: true,
            userId: { $nin: Array.from(excludedIds).map((id) => new mongoose_2.Types.ObjectId(id)) },
        };
        if (dto.campusCity)
            filter.campusCity = { $regex: dto.campusCity, $options: 'i' };
        if (dto.mode)
            filter.mode = dto.mode;
        if (dto.maxBudget)
            filter.budgetPerPersonMax = { $lte: dto.maxBudget };
        if (dto.sleepSchedule)
            filter.sleepSchedule = dto.sleepSchedule;
        if (dto.cleanlinessLevel)
            filter.cleanlinessLevel = dto.cleanlinessLevel;
        if (typeof dto.acceptsSmoker === 'boolean')
            filter.acceptsSmoker = dto.acceptsSmoker;
        if (typeof dto.acceptsPet === 'boolean')
            filter.acceptsPet = dto.acceptsPet;
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
        const myProfile = await this.roommateProfileModel
            .findOne({ userId: requestingObjectId })
            .lean()
            .exec();
        const profiles = rawProfiles.map((p) => ({
            ...p,
            compatibilityScore: myProfile
                ? this.computeCompatibilityScore(myProfile, p)
                : 0,
        }));
        profiles.sort((a, b) => b.compatibilityScore - a.compatibilityScore);
        return { profiles: profiles, total, page, totalPages: Math.ceil(total / limit) };
    }
    async expressInterest(initiatorUserId, receiverUserId) {
        if (initiatorUserId === receiverUserId) {
            throw new common_1.BadRequestException('You cannot match with yourself.');
        }
        const [initiatorObjectId, receiverObjectId] = [
            new mongoose_2.Types.ObjectId(initiatorUserId),
            new mongoose_2.Types.ObjectId(receiverUserId),
        ];
        const [initiatorProfile, receiverProfile] = await Promise.all([
            this.roommateProfileModel.findOne({ userId: initiatorObjectId, isActive: true }).exec(),
            this.roommateProfileModel.findOne({ userId: receiverObjectId, isActive: true }).exec(),
        ]);
        if (!initiatorProfile) {
            throw new common_1.NotFoundException('Create an active roommate profile before expressing interest.');
        }
        if (!receiverProfile) {
            throw new common_1.NotFoundException('This roommate profile is no longer active.');
        }
        const existingForward = await this.roommateMatchModel
            .findOne({ initiatorId: initiatorObjectId, receiverId: receiverObjectId })
            .exec();
        if (existingForward) {
            if (existingForward.status === roommate_profile_schema_1.MatchStatus.MATCHED) {
                return { status: roommate_profile_schema_1.MatchStatus.MATCHED, chatRoomId: existingForward.chatRoomId?.toString(), message: 'You are already matched.' };
            }
            if (existingForward.status === roommate_profile_schema_1.MatchStatus.PENDING) {
                return { status: roommate_profile_schema_1.MatchStatus.PENDING, message: 'You have already expressed interest. Waiting for their response.' };
            }
        }
        const reverseMatch = await this.roommateMatchModel
            .findOne({
            initiatorId: receiverObjectId,
            receiverId: initiatorObjectId,
            status: roommate_profile_schema_1.MatchStatus.PENDING,
        })
            .exec();
        if (reverseMatch) {
            return this.confirmMatch(reverseMatch, initiatorProfile, receiverProfile);
        }
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + this.MATCH_EXPIRY_DAYS);
        const score = this.computeCompatibilityScore(initiatorProfile, receiverProfile);
        const match = new this.roommateMatchModel({
            initiatorId: initiatorObjectId,
            receiverId: receiverObjectId,
            initiatorProfileId: initiatorProfile._id,
            receiverProfileId: receiverProfile._id,
            status: roommate_profile_schema_1.MatchStatus.PENDING,
            compatibilityScore: score,
            expiresAt,
        });
        await match.save();
        this.notificationsService.create({
            userId: receiverUserId,
            type: notification_schema_1.NotificationType.MESSAGE,
            title: 'Someone is interested in rooming with you!',
            message: 'A student has expressed interest in matching with you. Check your roommate matches.',
            metadata: { action: 'roommate_interest', matchId: match._id.toString() },
        }).catch((err) => this.logger.warn(`Notification failed: ${err.message}`));
        this.logger.log(`✅ Interest expressed: ${initiatorUserId} → ${receiverUserId}`);
        return { status: roommate_profile_schema_1.MatchStatus.PENDING, message: 'Interest sent! They will be notified.' };
    }
    async acceptMatch(receiverUserId, matchId) {
        if (!mongoose_2.Types.ObjectId.isValid(matchId)) {
            throw new common_1.BadRequestException('Invalid match ID');
        }
        const match = await this.roommateMatchModel
            .findOne({
            _id: new mongoose_2.Types.ObjectId(matchId),
            receiverId: new mongoose_2.Types.ObjectId(receiverUserId),
            status: roommate_profile_schema_1.MatchStatus.PENDING,
        })
            .exec();
        if (!match) {
            throw new common_1.NotFoundException('Pending match not found or already resolved.');
        }
        const [initiatorProfile, receiverProfile] = await Promise.all([
            this.roommateProfileModel.findById(match.initiatorProfileId).exec(),
            this.roommateProfileModel.findById(match.receiverProfileId).exec(),
        ]);
        const result = await this.confirmMatch(match, receiverProfile, initiatorProfile);
        return result;
    }
    async rejectMatch(receiverUserId, matchId) {
        if (!mongoose_2.Types.ObjectId.isValid(matchId)) {
            throw new common_1.BadRequestException('Invalid match ID');
        }
        const match = await this.roommateMatchModel
            .findOneAndUpdate({
            _id: new mongoose_2.Types.ObjectId(matchId),
            receiverId: new mongoose_2.Types.ObjectId(receiverUserId),
            status: roommate_profile_schema_1.MatchStatus.PENDING,
        }, { $set: { status: roommate_profile_schema_1.MatchStatus.REJECTED } }, { new: true })
            .exec();
        if (!match) {
            throw new common_1.NotFoundException('Pending match not found or already resolved.');
        }
        this.logger.log(`Match ${matchId} rejected by ${receiverUserId}`);
        return { message: 'Match declined.' };
    }
    async getMyMatches(userId) {
        const userObjectId = new mongoose_2.Types.ObjectId(userId);
        const allMatches = await this.roommateMatchModel
            .find({
            $or: [{ initiatorId: userObjectId }, { receiverId: userObjectId }],
            status: { $in: [roommate_profile_schema_1.MatchStatus.PENDING, roommate_profile_schema_1.MatchStatus.MATCHED] },
        })
            .populate('initiatorId', 'name profilePicture')
            .populate('receiverId', 'name profilePicture')
            .populate('initiatorProfileId', 'mode campusCity budgetPerPersonMax sleepSchedule bio')
            .populate('receiverProfileId', 'mode campusCity budgetPerPersonMax sleepSchedule bio')
            .sort({ createdAt: -1 })
            .exec();
        return {
            pending: allMatches.filter((m) => m.status === roommate_profile_schema_1.MatchStatus.PENDING),
            matched: allMatches.filter((m) => m.status === roommate_profile_schema_1.MatchStatus.MATCHED),
        };
    }
    computeCompatibilityScore(a, b) {
        let score = 0;
        if (a.sleepSchedule === b.sleepSchedule) {
            score += 20;
        }
        else if (a.sleepSchedule === roommate_profile_schema_1.SleepSchedule.FLEXIBLE ||
            b.sleepSchedule === roommate_profile_schema_1.SleepSchedule.FLEXIBLE) {
            score += 10;
        }
        if (a.cleanlinessLevel === b.cleanlinessLevel) {
            score += 20;
        }
        else {
            const levels = [
                roommate_profile_schema_1.CleanlinessLevel.VERY_NEAT,
                roommate_profile_schema_1.CleanlinessLevel.NEAT,
                roommate_profile_schema_1.CleanlinessLevel.RELAXED,
            ];
            const diff = Math.abs(levels.indexOf(a.cleanlinessLevel) - levels.indexOf(b.cleanlinessLevel));
            if (diff === 1)
                score += 10;
        }
        if (a.socialHabit === b.socialHabit) {
            score += 15;
        }
        else {
            const habits = [
                roommate_profile_schema_1.SocialHabit.INTROVERTED,
                roommate_profile_schema_1.SocialHabit.BALANCED,
                roommate_profile_schema_1.SocialHabit.SOCIAL,
            ];
            const diff = Math.abs(habits.indexOf(a.socialHabit) - habits.indexOf(b.socialHabit));
            if (diff === 1)
                score += 7;
        }
        if (a.studyHabit === b.studyHabit)
            score += 10;
        else
            score += 5;
        const budgetRatio = Math.min(a.budgetPerPersonMax, b.budgetPerPersonMax) /
            Math.max(a.budgetPerPersonMax, b.budgetPerPersonMax);
        score += Math.round(budgetRatio * 15);
        const smokingOk = (a.isSmoker && b.acceptsSmoker) ||
            (b.isSmoker && a.acceptsSmoker) ||
            (!a.isSmoker && !b.isSmoker);
        if (smokingOk)
            score += 10;
        const petOk = (a.hasPet && b.acceptsPet) ||
            (b.hasPet && a.acceptsPet) ||
            (!a.hasPet && !b.hasPet);
        if (petOk)
            score += 10;
        return Math.min(score, 100);
    }
    async expireStaleMatches() {
        const result = await this.roommateMatchModel
            .updateMany({ status: roommate_profile_schema_1.MatchStatus.PENDING, expiresAt: { $lt: new Date() } }, { $set: { status: roommate_profile_schema_1.MatchStatus.EXPIRED } })
            .exec();
        if (result.modifiedCount > 0) {
            this.logger.log(`⏰ Expired ${result.modifiedCount} stale roommate matches`);
        }
    }
    async confirmMatch(match, profileA, profileB) {
        const conversationDto = {
            participantId: match.receiverId.toString(),
        };
        const chatRoom = await this.chatService.createConversation(match.initiatorId.toString(), conversationDto);
        const updatedMatch = await this.roommateMatchModel
            .findByIdAndUpdate(match._id, {
            $set: {
                status: roommate_profile_schema_1.MatchStatus.MATCHED,
                chatRoomId: chatRoom._id,
                matchedAt: new Date(),
                compatibilityScore: this.computeCompatibilityScore(profileA, profileB),
            },
        }, { new: true })
            .exec();
        const chatRoomId = chatRoom._id.toString();
        await Promise.all([
            this.notificationsService.create({
                userId: match.initiatorId.toString(),
                type: notification_schema_1.NotificationType.MESSAGE,
                title: "It's a match! 🎉",
                message: 'You and your potential roommate both expressed interest. Start chatting!',
                metadata: {
                    action: 'roommate_matched',
                    matchId: match._id.toString(),
                    chatRoomId,
                },
            }),
            this.notificationsService.create({
                userId: match.receiverId.toString(),
                type: notification_schema_1.NotificationType.MESSAGE,
                title: "It's a match! 🎉",
                message: 'You and your potential roommate both expressed interest. Start chatting!',
                metadata: {
                    action: 'roommate_matched',
                    matchId: match._id.toString(),
                    chatRoomId,
                },
            }),
        ]);
        this.logger.log(`✅ Roommate match confirmed: ${match.initiatorId} ↔ ${match.receiverId} | chat: ${chatRoomId}`);
        return {
            status: roommate_profile_schema_1.MatchStatus.MATCHED,
            chatRoomId,
            message: "It's a match! You can now chat with your potential roommate.",
        };
    }
};
exports.RoommateMatchingService = RoommateMatchingService;
__decorate([
    (0, schedule_1.Cron)(schedule_1.CronExpression.EVERY_HOUR),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], RoommateMatchingService.prototype, "expireStaleMatches", null);
exports.RoommateMatchingService = RoommateMatchingService = RoommateMatchingService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(roommate_profile_schema_1.RoommateProfile.name)),
    __param(1, (0, mongoose_1.InjectModel)(roommate_match_schema_1.RoommateMatch.name)),
    __param(2, (0, mongoose_1.InjectModel)(student_profile_schema_1.StudentProfile.name)),
    __param(3, (0, mongoose_1.InjectModel)(user_schema_1.User.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model,
        notifications_service_1.NotificationsService,
        chat_service_1.ChatService])
], RoommateMatchingService);
//# sourceMappingURL=roommate-matching.service.js.map