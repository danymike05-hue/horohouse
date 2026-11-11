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
var TrustService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.TrustService = exports.ID_MAX_BYTES = exports.ID_MIME_TYPES = exports.ID_DOCUMENT_TYPES = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const cloudinary_1 = require("cloudinary");
const user_schema_1 = require("../users/schemas/user.schema");
const booking_schema_1 = require("../bookings/schema/booking.schema");
const review_schema_1 = require("../reviews/schemas/review.schema");
const notifications_service_1 = require("../notifications/notifications.service");
const notification_schema_1 = require("../notifications/schemas/notification.schema");
exports.ID_DOCUMENT_TYPES = ['national_id', 'passport', 'residence_permit', 'driving_licence'];
exports.ID_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
exports.ID_MAX_BYTES = 10 * 1024 * 1024;
let TrustService = TrustService_1 = class TrustService {
    userModel;
    bookingModel;
    reviewModel;
    notifications;
    logger = new common_1.Logger(TrustService_1.name);
    constructor(userModel, bookingModel, reviewModel, notifications) {
        this.userModel = userModel;
        this.bookingModel = bookingModel;
        this.reviewModel = reviewModel;
        this.notifications = notifications;
    }
    static isVerified(u) {
        return u?.identityVerification?.status === 'verified' || u?.hostProfile?.verificationStatus === 'verified';
    }
    async getMyIdentity(userId) {
        const u = await this.userModel
            .findById(userId)
            .select('identityVerification hostProfile.verificationStatus')
            .lean()
            .exec();
        if (!u)
            throw new common_1.NotFoundException('User not found');
        if (TrustService_1.isVerified(u)) {
            return { status: 'verified', documentType: u.identityVerification?.documentType, reviewedAt: u.identityVerification?.reviewedAt };
        }
        const iv = u.identityVerification ?? {};
        return {
            status: iv.status ?? 'unverified',
            documentType: iv.documentType,
            submittedAt: iv.submittedAt,
            reviewedAt: iv.reviewedAt,
            rejectionReason: iv.status === 'rejected' ? iv.rejectionReason : undefined,
        };
    }
    async submitIdentity(userId, buffer, documentType) {
        const u = await this.userModel.findById(userId).select('identityVerification hostProfile.verificationStatus').lean().exec();
        if (!u)
            throw new common_1.NotFoundException('User not found');
        if (TrustService_1.isVerified(u))
            throw new common_1.BadRequestException('Your identity is already verified');
        const upload = await new Promise((resolve, reject) => {
            const stream = cloudinary_1.v2.uploader.upload_stream({ folder: 'horohouse/identity', resource_type: 'image', type: 'authenticated' }, (err, result) => (err ? reject(err) : resolve(result)));
            stream.end(buffer);
        });
        const previous = u.identityVerification?.documentPublicId;
        await this.userModel.updateOne({ _id: userId }, {
            $set: {
                identityVerification: {
                    status: 'pending',
                    documentType,
                    documentPublicId: upload.public_id,
                    submittedAt: new Date(),
                },
            },
        });
        if (previous && previous !== upload.public_id) {
            cloudinary_1.v2.uploader.destroy(previous, { type: 'authenticated', resource_type: 'image' }).catch(() => undefined);
        }
        this.notifications
            ?.notifyAdmins({
            title: 'Identity to review',
            message: 'A user uploaded an ID document for verification.',
            link: '/admin/identity',
            metadata: { userId },
        })
            .catch(() => undefined);
        return this.getMyIdentity(userId);
    }
    async listPending(page = 1, limit = 20) {
        const safeLimit = Math.min(Math.max(1, limit), 100);
        const query = { 'identityVerification.status': 'pending' };
        const [items, total] = await Promise.all([
            this.userModel
                .find(query)
                .select('name email phoneNumber profilePicture role identityVerification.documentType identityVerification.submittedAt createdAt')
                .sort({ 'identityVerification.submittedAt': 1 })
                .skip((Math.max(1, page) - 1) * safeLimit)
                .limit(safeLimit)
                .lean()
                .exec(),
            this.userModel.countDocuments(query),
        ]);
        return { items, total, page: Math.max(1, page), totalPages: Math.ceil(total / safeLimit) };
    }
    async documentUrl(userId) {
        if (!mongoose_2.Types.ObjectId.isValid(userId))
            throw new common_1.BadRequestException('Invalid user ID');
        const u = await this.userModel.findById(userId).select('identityVerification.documentPublicId').lean().exec();
        const publicId = u?.identityVerification?.documentPublicId;
        if (!publicId)
            throw new common_1.NotFoundException('No ID document on file');
        return {
            url: cloudinary_1.v2.url(publicId, {
                type: 'authenticated',
                resource_type: 'image',
                sign_url: true,
                secure: true,
                expires_at: Math.floor(Date.now() / 1000) + 600,
            }),
        };
    }
    async review(userId, approve, reason, admin) {
        if (admin.role !== user_schema_1.UserRole.ADMIN)
            throw new common_1.ForbiddenException('Admins only');
        if (!mongoose_2.Types.ObjectId.isValid(userId))
            throw new common_1.BadRequestException('Invalid user ID');
        const u = await this.userModel.findById(userId).select('identityVerification').lean().exec();
        if (!u?.identityVerification?.documentPublicId)
            throw new common_1.NotFoundException('No ID document on file');
        if (!approve && !reason?.trim())
            throw new common_1.BadRequestException('Give a reason so the user knows what to fix');
        await this.userModel.updateOne({ _id: userId }, {
            $set: {
                'identityVerification.status': approve ? 'verified' : 'rejected',
                'identityVerification.reviewedAt': new Date(),
                'identityVerification.rejectionReason': approve ? null : reason.trim().slice(0, 300),
            },
        });
        this.notifications
            ?.create({
            userId,
            type: notification_schema_1.NotificationType.SYSTEM,
            title: approve ? 'Your identity is verified ✅' : 'We could not verify your ID',
            message: approve
                ? 'Hosts now see a verified badge on your profile.'
                : `Reason: ${reason.trim().slice(0, 200)}. You can upload a new photo.`,
            link: '/profile/verify-identity',
        })
            .catch((e) => this.logger.warn(`identity notification failed: ${e?.message}`));
        return this.getMyIdentity(userId);
    }
    async guestProfile(guestId, requester) {
        if (!mongoose_2.Types.ObjectId.isValid(guestId))
            throw new common_1.BadRequestException('Invalid guest ID');
        const isAdmin = requester.role === user_schema_1.UserRole.ADMIN;
        if (!isAdmin) {
            const link = await this.bookingModel.exists({
                guestId: new mongoose_2.Types.ObjectId(guestId),
                hostId: requester._id,
            });
            if (!link)
                throw new common_1.ForbiddenException('You can only see guests who booked or asked to book your place');
        }
        const u = await this.userModel
            .findById(guestId)
            .select('name profilePicture createdAt languages emailVerified phoneVerified identityVerification.status hostProfile.verificationStatus')
            .lean()
            .exec();
        if (!u)
            throw new common_1.NotFoundException('Guest not found');
        const gid = new mongoose_2.Types.ObjectId(guestId);
        const yearAgo = new Date(Date.now() - 365 * 86_400_000);
        const [completedStays, guestCancellations, ratingAgg, reviews] = await Promise.all([
            this.bookingModel.countDocuments({ guestId: gid, status: booking_schema_1.BookingStatus.COMPLETED }),
            this.bookingModel.countDocuments({
                guestId: gid,
                status: booking_schema_1.BookingStatus.CANCELLED,
                'cancellation.cancelledBy': 'guest',
                'cancellation.cancelledAt': { $gte: yearAgo },
            }),
            this.reviewModel.aggregate([
                { $match: { reviewType: review_schema_1.ReviewType.GUEST, reviewedUserId: gid, isPublished: true, isActive: { $ne: false } } },
                { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } },
            ]),
            this.reviewModel
                .find({ reviewType: review_schema_1.ReviewType.GUEST, reviewedUserId: gid, isPublished: true, isActive: { $ne: false } })
                .select('userName rating comment guestSubRatings createdAt')
                .sort({ createdAt: -1 })
                .limit(5)
                .lean()
                .exec(),
        ]);
        const firstName = String(u.name ?? '').trim().split(/\s+/)[0] || 'Guest';
        return {
            id: String(u._id),
            firstName,
            profilePicture: u.profilePicture ?? null,
            memberSince: u.createdAt ?? null,
            languages: Array.isArray(u.languages) ? u.languages : [],
            verifications: {
                email: !!u.emailVerified,
                phone: !!u.phoneVerified,
                identity: TrustService_1.isVerified(u),
            },
            completedStays,
            guestCancellations12m: guestCancellations,
            rating: ratingAgg[0] ? Math.round(ratingAgg[0].avg * 100) / 100 : null,
            reviewCount: ratingAgg[0]?.count ?? 0,
            reviews: reviews.map((r) => ({
                hostFirstName: String(r.userName ?? '').trim().split(/\s+/)[0] || 'Host',
                rating: r.rating,
                comment: r.comment ?? '',
                subRatings: r.guestSubRatings ?? null,
                createdAt: r.createdAt,
            })),
        };
    }
};
exports.TrustService = TrustService;
exports.TrustService = TrustService = TrustService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(user_schema_1.User.name)),
    __param(1, (0, mongoose_1.InjectModel)(booking_schema_1.Booking.name)),
    __param(2, (0, mongoose_1.InjectModel)(review_schema_1.Review.name)),
    __param(3, (0, common_1.Optional)()),
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model,
        notifications_service_1.NotificationsService])
], TrustService);
//# sourceMappingURL=trust.service.js.map