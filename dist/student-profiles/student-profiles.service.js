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
var StudentProfilesService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.StudentProfilesService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const config_1 = require("@nestjs/config");
const cloudinary_1 = require("cloudinary");
const student_profile_schema_1 = require("./schemas/student-profile.schema");
const user_schema_1 = require("../users/schemas/user.schema");
const notifications_service_1 = require("../notifications/notifications.service");
const notification_schema_1 = require("../notifications/schemas/notification.schema");
let StudentProfilesService = StudentProfilesService_1 = class StudentProfilesService {
    studentProfileModel;
    userModel;
    configService;
    notificationsService;
    logger = new common_1.Logger(StudentProfilesService_1.name);
    constructor(studentProfileModel, userModel, configService, notificationsService) {
        this.studentProfileModel = studentProfileModel;
        this.userModel = userModel;
        this.configService = configService;
        this.notificationsService = notificationsService;
        cloudinary_1.v2.config({
            cloud_name: this.configService.get('CLOUDINARY_CLOUD_NAME'),
            api_key: this.configService.get('CLOUDINARY_API_KEY'),
            api_secret: this.configService.get('CLOUDINARY_API_SECRET'),
        });
    }
    async create(userId, dto) {
        if (!mongoose_2.Types.ObjectId.isValid(userId)) {
            throw new common_1.BadRequestException('Invalid user ID');
        }
        const userObjectId = new mongoose_2.Types.ObjectId(userId);
        const user = await this.userModel.findById(userObjectId).exec();
        if (!user)
            throw new common_1.NotFoundException('User not found');
        const existing = await this.studentProfileModel
            .findOne({ userId: userObjectId })
            .exec();
        if (existing) {
            throw new common_1.ConflictException('A student profile already exists for this account. Use PATCH /student-profiles/me to update it.');
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
            verificationStatus: user_schema_1.StudentVerificationStatus.UNVERIFIED,
            isAmbassador: false,
            ambassadorEarnings: 0,
            referralCount: 0,
            landlordReferralCount: 0,
        });
        await profile.save();
        await this.userModel.findByIdAndUpdate(userObjectId, {
            $set: {
                role: user_schema_1.UserRole.STUDENT,
                'studentProfile.universityName': dto.universityName,
                'studentProfile.faculty': dto.faculty,
                'studentProfile.studyLevel': dto.studyLevel,
                'studentProfile.enrollmentYear': dto.enrollmentYear,
                'studentProfile.campusCity': dto.campusCity,
                'studentProfile.campusLatitude': dto.campusLatitude,
                'studentProfile.campusLongitude': dto.campusLongitude,
                'studentProfile.verificationStatus': user_schema_1.StudentVerificationStatus.UNVERIFIED,
                'studentProfile.isAmbassador': false,
                'studentProfile.roommateProfileId': null,
            },
        }).exec();
        this.logger.log(`✅ Student profile created for user ${userId}`);
        return profile;
    }
    async findMyProfile(userId) {
        const profile = await this.studentProfileModel
            .findOne({ userId: new mongoose_2.Types.ObjectId(userId) })
            .exec();
        if (!profile) {
            throw new common_1.NotFoundException('No student profile found. Complete student onboarding first.');
        }
        return profile;
    }
    async findById(profileId) {
        if (!mongoose_2.Types.ObjectId.isValid(profileId)) {
            throw new common_1.BadRequestException('Invalid profile ID');
        }
        const profile = await this.studentProfileModel
            .findById(profileId)
            .populate('userId', 'name email phoneNumber profilePicture')
            .exec();
        if (!profile)
            throw new common_1.NotFoundException('Student profile not found');
        return profile;
    }
    async findAll(query) {
        const { page = 1, limit = 20, verificationStatus, campusCity, isAmbassador } = query;
        const skip = (page - 1) * limit;
        const filter = {};
        if (verificationStatus)
            filter.verificationStatus = verificationStatus;
        if (campusCity)
            filter.campusCity = { $regex: campusCity, $options: 'i' };
        if (typeof isAmbassador === 'boolean')
            filter.isAmbassador = isAmbassador;
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
    async update(userId, dto) {
        const profile = await this.studentProfileModel
            .findOneAndUpdate({ userId: new mongoose_2.Types.ObjectId(userId) }, { $set: dto }, { new: true })
            .exec();
        if (!profile) {
            throw new common_1.NotFoundException('No student profile found. Complete student onboarding first.');
        }
        const mirrorFields = {};
        if (dto.universityName)
            mirrorFields['studentProfile.universityName'] = dto.universityName;
        if (dto.faculty)
            mirrorFields['studentProfile.faculty'] = dto.faculty;
        if (dto.studyLevel)
            mirrorFields['studentProfile.studyLevel'] = dto.studyLevel;
        if (dto.campusCity)
            mirrorFields['studentProfile.campusCity'] = dto.campusCity;
        if (dto.campusLatitude)
            mirrorFields['studentProfile.campusLatitude'] = dto.campusLatitude;
        if (dto.campusLongitude)
            mirrorFields['studentProfile.campusLongitude'] = dto.campusLongitude;
        if (Object.keys(mirrorFields).length > 0) {
            await this.userModel.findByIdAndUpdate(userId, { $set: mirrorFields }).exec();
        }
        this.logger.log(`✅ Student profile updated for user ${userId}`);
        return profile;
    }
    async uploadStudentId(userId, file) {
        this.logger.log(`Cloudinary config: cloud=${this.configService.get('CLOUDINARY_CLOUD_NAME')}, key=${this.configService.get('CLOUDINARY_API_KEY') ? 'SET' : 'MISSING'}, secret=${this.configService.get('CLOUDINARY_API_SECRET') ? 'SET' : 'MISSING'}`);
        const profile = await this.studentProfileModel
            .findOne({ userId: new mongoose_2.Types.ObjectId(userId) })
            .exec();
        if (!profile) {
            throw new common_1.NotFoundException('Create your student profile before uploading an ID.');
        }
        if (profile.studentIdPublicId) {
            try {
                await cloudinary_1.v2.uploader.destroy(profile.studentIdPublicId);
            }
            catch (err) {
                this.logger.warn(`Could not delete old student ID asset: ${profile.studentIdPublicId}`);
            }
        }
        const uploadResult = await new Promise((resolve, reject) => {
            const stream = cloudinary_1.v2.uploader.upload_stream({
                folder: 'horohouse/student-ids',
                resource_type: 'image',
                transformation: [{ quality: 80, fetch_format: 'auto' }],
                tags: ['student-id', 'pending-review'],
            }, (error, result) => {
                if (error)
                    reject(error);
                else
                    resolve(result);
            });
            stream.end(file.buffer);
        });
        const updated = await this.studentProfileModel
            .findOneAndUpdate({ userId: new mongoose_2.Types.ObjectId(userId) }, {
            $set: {
                studentIdUrl: uploadResult.secure_url,
                studentIdPublicId: uploadResult.public_id,
                verificationStatus: user_schema_1.StudentVerificationStatus.PENDING,
                verificationSubmittedAt: new Date(),
                verificationRejectionReason: null,
            },
        }, { new: true })
            .exec();
        await this.userModel.findByIdAndUpdate(userId, {
            $set: {
                'studentProfile.studentIdUrl': uploadResult.secure_url,
                'studentProfile.studentIdPublicId': uploadResult.public_id,
                'studentProfile.verificationStatus': user_schema_1.StudentVerificationStatus.PENDING,
                'studentProfile.verificationSubmittedAt': new Date(),
            },
        }).exec();
        this.logger.log(`✅ Student ID uploaded for user ${userId} — status: PENDING`);
        this.notifyAdminsOfPendingId(userId).catch((err) => this.logger.warn(`Admin notification failed: ${err.message}`));
        return updated;
    }
    async reviewStudentId(profileId, adminId, dto) {
        if (!mongoose_2.Types.ObjectId.isValid(profileId)) {
            throw new common_1.BadRequestException('Invalid profile ID');
        }
        if (dto.decision === user_schema_1.StudentVerificationStatus.REJECTED &&
            !dto.rejectionReason) {
            throw new common_1.BadRequestException('A rejection reason is required so the student knows what to fix.');
        }
        const profile = await this.studentProfileModel.findById(profileId).exec();
        if (!profile)
            throw new common_1.NotFoundException('Student profile not found');
        if (profile.verificationStatus !== user_schema_1.StudentVerificationStatus.PENDING) {
            throw new common_1.BadRequestException(`Cannot review a profile with status "${profile.verificationStatus}". Only PENDING profiles can be reviewed.`);
        }
        const updateFields = {
            verificationStatus: dto.decision,
            verificationReviewedAt: new Date(),
            verificationReviewedBy: new mongoose_2.Types.ObjectId(adminId),
        };
        if (dto.decision === user_schema_1.StudentVerificationStatus.REJECTED) {
            updateFields.verificationRejectionReason = dto.rejectionReason;
        }
        else {
            updateFields.verificationRejectionReason = null;
        }
        const updated = await this.studentProfileModel
            .findByIdAndUpdate(profileId, { $set: updateFields }, { new: true })
            .populate('userId', 'name email phoneNumber')
            .exec();
        const mirrorUpdate = {
            'studentProfile.verificationStatus': dto.decision,
            'studentProfile.verificationReviewedAt': new Date(),
        };
        if (dto.rejectionReason) {
            mirrorUpdate['studentProfile.verificationRejectionReason'] = dto.rejectionReason;
        }
        await this.userModel
            .findByIdAndUpdate(profile.userId, { $set: mirrorUpdate })
            .exec();
        this.notifyStudentOfReview(profile.userId.toString(), dto.decision, dto.rejectionReason).catch((err) => this.logger.warn(`Student notification failed: ${err.message}`));
        this.logger.log(`✅ Student ID ${dto.decision} for profile ${profileId} by admin ${adminId}`);
        return updated;
    }
    async grantAmbassador(profileId, dto) {
        if (!mongoose_2.Types.ObjectId.isValid(profileId)) {
            throw new common_1.BadRequestException('Invalid profile ID');
        }
        const codeConflict = await this.studentProfileModel
            .findOne({ ambassadorCode: dto.ambassadorCode.toUpperCase() })
            .exec();
        if (codeConflict) {
            throw new common_1.ConflictException(`Ambassador code "${dto.ambassadorCode}" is already in use.`);
        }
        const profile = await this.studentProfileModel.findById(profileId).exec();
        if (!profile)
            throw new common_1.NotFoundException('Student profile not found');
        if (profile.verificationStatus !== user_schema_1.StudentVerificationStatus.VERIFIED) {
            throw new common_1.ForbiddenException('Only verified students can be appointed as campus ambassadors.');
        }
        const updated = await this.studentProfileModel
            .findByIdAndUpdate(profileId, {
            $set: {
                isAmbassador: true,
                ambassadorCode: dto.ambassadorCode.toUpperCase(),
            },
        }, { new: true })
            .exec();
        await this.userModel
            .findByIdAndUpdate(profile.userId, {
            $set: {
                'studentProfile.isAmbassador': true,
                'studentProfile.ambassadorCode': dto.ambassadorCode.toUpperCase(),
            },
        })
            .exec();
        this.logger.log(`✅ Ambassador granted to profile ${profileId} — code: ${dto.ambassadorCode}`);
        return updated;
    }
    async resolveAmbassadorCode(code) {
        const profile = await this.studentProfileModel
            .findOne({ ambassadorCode: code.toUpperCase(), isAmbassador: true })
            .select('userId _id')
            .exec();
        if (!profile)
            return null;
        return {
            userId: profile.userId,
            profileId: profile._id,
        };
    }
    async creditAmbassadorEarning(profileId, amountXaf, type = 'student') {
        const increment = type === 'landlord'
            ? { ambassadorEarnings: amountXaf, landlordReferralCount: 1 }
            : { ambassadorEarnings: amountXaf, referralCount: 1 };
        await this.studentProfileModel
            .findByIdAndUpdate(profileId, { $inc: increment })
            .exec();
        this.logger.log(`✅ Credited ${amountXaf} XAF to ambassador profile ${profileId} (type: ${type})`);
    }
    async getStats() {
        const [statusAgg, cityAgg, ambassadors, seekingRoommate, total] = await Promise.all([
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
            byVerificationStatus: statusAgg.reduce((acc, s) => ({ ...acc, [s._id]: s.count }), {}),
            byCampusCity: cityAgg,
            ambassadors,
            seekingRoommate,
        };
    }
    async notifyAdminsOfPendingId(studentUserId) {
        const admins = await this.userModel
            .find({ role: user_schema_1.UserRole.ADMIN, isActive: true })
            .select('_id')
            .exec();
        await Promise.all(admins.map((admin) => this.notificationsService.create({
            userId: admin._id.toString(),
            type: notification_schema_1.NotificationType.SYSTEM,
            title: 'New student ID pending review',
            message: 'A student has submitted their university ID and is waiting for verification.',
            metadata: { studentUserId, action: 'review_student_id' },
        })));
    }
    async notifyStudentOfReview(studentUserId, decision, rejectionReason) {
        const isApproved = decision === user_schema_1.StudentVerificationStatus.VERIFIED;
        await this.notificationsService.create({
            userId: studentUserId,
            type: notification_schema_1.NotificationType.SYSTEM,
            title: isApproved ? 'Student ID verified!' : 'Student ID review update',
            message: isApproved
                ? 'Your student ID has been approved. You now have full access to roommate matching and student-verified listings.'
                : `Your student ID was not approved. Reason: ${rejectionReason}. Please upload a valid document.`,
            metadata: { action: 'student_id_review_result', decision },
        });
    }
};
exports.StudentProfilesService = StudentProfilesService;
exports.StudentProfilesService = StudentProfilesService = StudentProfilesService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(student_profile_schema_1.StudentProfile.name)),
    __param(1, (0, mongoose_1.InjectModel)(user_schema_1.User.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Model,
        config_1.ConfigService,
        notifications_service_1.NotificationsService])
], StudentProfilesService);
//# sourceMappingURL=student-profiles.service.js.map