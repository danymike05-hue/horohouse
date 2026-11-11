import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { v2 as cloudinary } from 'cloudinary';
import { User, UserDocument, UserRole } from '../users/schemas/user.schema';
import { Booking, BookingDocument, BookingStatus } from '../bookings/schema/booking.schema';
import { Review, ReviewDocument, ReviewType } from '../reviews/schemas/review.schema';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/schemas/notification.schema';

export const ID_DOCUMENT_TYPES = ['national_id', 'passport', 'residence_permit', 'driving_licence'] as const;
export type IdDocumentType = (typeof ID_DOCUMENT_TYPES)[number];
export const ID_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
export const ID_MAX_BYTES = 10 * 1024 * 1024;

export interface IdentityStatus {
  status: 'unverified' | 'pending' | 'verified' | 'rejected';
  documentType?: IdDocumentType;
  submittedAt?: Date;
  reviewedAt?: Date;
  rejectionReason?: string;
}

/**
 * Trust between guests and hosts (Airbnb "verified identity" + guest profile):
 *  - any user uploads an ID photo, an admin approves or rejects it;
 *  - a host sees a guest's verifications, stays and reviews from other hosts before
 *    accepting a request.
 */
import { isIdentityVerified } from '../common/identity.util';

@Injectable()
export class TrustService {
  private readonly logger = new Logger(TrustService.name);

  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Booking.name) private readonly bookingModel: Model<BookingDocument>,
    @InjectModel(Review.name) private readonly reviewModel: Model<ReviewDocument>,
    @Optional() private readonly notifications?: NotificationsService,
  ) {}

  // ── Identity ───────────────────────────────────────────────────────────────

  /** Verified through the new flow, or as a host through the host ID check */
  static isVerified(u: any): boolean {
    return isIdentityVerified(u);
  }

  async getMyIdentity(userId: string): Promise<IdentityStatus> {
    const u: any = await this.userModel
      .findById(userId)
      .select('identityVerification hostProfile.verificationStatus')
      .lean()
      .exec();
    if (!u) throw new NotFoundException('User not found');
    if (TrustService.isVerified(u)) {
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

  async submitIdentity(userId: string, buffer: Buffer, documentType: IdDocumentType): Promise<IdentityStatus> {
    const u: any = await this.userModel.findById(userId).select('identityVerification hostProfile.verificationStatus').lean().exec();
    if (!u) throw new NotFoundException('User not found');
    if (TrustService.isVerified(u)) throw new BadRequestException('Your identity is already verified');

    // "authenticated": the file can't be opened from a URL; admins get a signed link.
    const upload = await new Promise<any>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: 'horohouse/identity', resource_type: 'image', type: 'authenticated' },
        (err, result) => (err ? reject(err) : resolve(result)),
      );
      stream.end(buffer);
    });

    const previous = u.identityVerification?.documentPublicId;
    await this.userModel.updateOne(
      { _id: userId },
      {
        $set: {
          identityVerification: {
            status: 'pending',
            documentType,
            documentPublicId: upload.public_id,
            submittedAt: new Date(),
          },
        },
      },
    );
    if (previous && previous !== upload.public_id) {
      cloudinary.uploader.destroy(previous, { type: 'authenticated', resource_type: 'image' }).catch(() => undefined);
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

  /** Admin only: signed link to the ID photo, valid 10 minutes */
  async documentUrl(userId: string): Promise<{ url: string }> {
    if (!Types.ObjectId.isValid(userId)) throw new BadRequestException('Invalid user ID');
    const u: any = await this.userModel.findById(userId).select('identityVerification.documentPublicId').lean().exec();
    const publicId = u?.identityVerification?.documentPublicId;
    if (!publicId) throw new NotFoundException('No ID document on file');
    return {
      url: cloudinary.url(publicId, {
        type: 'authenticated',
        resource_type: 'image',
        sign_url: true,
        secure: true,
        expires_at: Math.floor(Date.now() / 1000) + 600,
      } as any),
    };
  }

  async review(userId: string, approve: boolean, reason: string | undefined, admin: User): Promise<IdentityStatus> {
    if (admin.role !== UserRole.ADMIN) throw new ForbiddenException('Admins only');
    if (!Types.ObjectId.isValid(userId)) throw new BadRequestException('Invalid user ID');
    const u: any = await this.userModel.findById(userId).select('identityVerification').lean().exec();
    if (!u?.identityVerification?.documentPublicId) throw new NotFoundException('No ID document on file');
    if (!approve && !reason?.trim()) throw new BadRequestException('Give a reason so the user knows what to fix');

    await this.userModel.updateOne(
      { _id: userId },
      {
        $set: {
          'identityVerification.status': approve ? 'verified' : 'rejected',
          'identityVerification.reviewedAt': new Date(),
          'identityVerification.rejectionReason': approve ? null : reason!.trim().slice(0, 300),
        },
      },
    );

    this.notifications
      ?.create({
        userId,
        type: NotificationType.SYSTEM,
        title: approve ? 'Your identity is verified ✅' : 'We could not verify your ID',
        message: approve
          ? 'Hosts now see a verified badge on your profile.'
          : `Reason: ${reason!.trim().slice(0, 200)}. You can upload a new photo.`,
        fr: { title: approve ? 'Votre identité est vérifiée ✅' : "Nous n'avons pas pu vérifier votre pièce d'identité", message: approve ? 'Les hôtes voient maintenant un badge vérifié sur votre profil.' : `Motif : ${reason!.trim().slice(0, 200)}. Vous pouvez envoyer une nouvelle photo.` },
        link: '/profile/verify-identity',
      } as any)
      .catch((e: any) => this.logger.warn(`identity notification failed: ${e?.message}`));

    return this.getMyIdentity(userId);
  }

  // ── Guest profile for hosts ────────────────────────────────────────────────

  /**
   * What a host sees about a guest before accepting: verifications, stays, reviews
   * left by other hosts. Only for hosts who have a booking (any status) with this guest.
   */
  async guestProfile(guestId: string, requester: User) {
    if (!Types.ObjectId.isValid(guestId)) throw new BadRequestException('Invalid guest ID');
    const isAdmin = requester.role === UserRole.ADMIN;
    if (!isAdmin) {
      const link = await this.bookingModel.exists({
        guestId: new Types.ObjectId(guestId),
        hostId: requester._id,
      });
      if (!link) throw new ForbiddenException('You can only see guests who booked or asked to book your place');
    }

    const u: any = await this.userModel
      .findById(guestId)
      .select('name profilePicture createdAt languages emailVerified phoneVerified identityVerification.status hostProfile.verificationStatus')
      .lean()
      .exec();
    if (!u) throw new NotFoundException('Guest not found');

    const gid = new Types.ObjectId(guestId);
    const yearAgo = new Date(Date.now() - 365 * 86_400_000);
    const [completedStays, guestCancellations, ratingAgg, reviews] = await Promise.all([
      this.bookingModel.countDocuments({ guestId: gid, status: BookingStatus.COMPLETED }),
      this.bookingModel.countDocuments({
        guestId: gid,
        status: BookingStatus.CANCELLED,
        'cancellation.cancelledBy': 'guest',
        'cancellation.cancelledAt': { $gte: yearAgo },
      }),
      this.reviewModel.aggregate([
        { $match: { reviewType: ReviewType.GUEST, reviewedUserId: gid, isPublished: true, isActive: { $ne: false } } },
        { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } },
      ]),
      this.reviewModel
        .find({ reviewType: ReviewType.GUEST, reviewedUserId: gid, isPublished: true, isActive: { $ne: false } })
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
        identity: TrustService.isVerified(u),
      },
      completedStays,
      guestCancellations12m: guestCancellations,
      rating: ratingAgg[0] ? Math.round(ratingAgg[0].avg * 100) / 100 : null,
      reviewCount: ratingAgg[0]?.count ?? 0,
      reviews: reviews.map((r: any) => ({
        hostFirstName: String(r.userName ?? '').trim().split(/\s+/)[0] || 'Host',
        rating: r.rating,
        comment: r.comment ?? '',
        subRatings: r.guestSubRatings ?? null,
        createdAt: r.createdAt,
      })),
    };
  }
}
