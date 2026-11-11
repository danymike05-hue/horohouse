import {
    Injectable, NotFoundException, BadRequestException, ConflictException, Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, isValidObjectId } from 'mongoose';
import { Report, ReportDocument } from './schemas/report.schema';
import { ApprovalStatus, Property, PropertyDocument } from '../properties/schemas/property.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { CreateReportDto } from './dto/create-report.dto';
import { UpdateReportStatusDto } from './dto/update-report-status.dto';
import { SendWarningDto, WarningSeverity } from './dto/send-warning.dto';
import { EmailService } from '../email/email.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/schemas/notification.schema';

const OPEN_STATUSES = ['pending', 'reviewed'];

@Injectable()
export class ReportsService {
    private readonly logger = new Logger(ReportsService.name);

    constructor(
        @InjectModel(Report.name)
        private readonly reportModel: Model<ReportDocument>,

        @InjectModel(Property.name)
        private readonly propertyModel: Model<PropertyDocument>,

        @InjectModel(User.name)
        private readonly userModel: Model<UserDocument>,

        private readonly emailService: EmailService,
        private readonly notificationsService: NotificationsService,
    ) {}

    // ── Create ────────────────────────────────────────────────────────────────

    async create(
        createReportDto: CreateReportDto,
        reporterId: string,
        propertyId: string,
    ): Promise<Report> {
        if (!isValidObjectId(propertyId)) throw new NotFoundException('Listing not found');
        const property: any = await this.propertyModel.findById(propertyId).select('ownerId agentId title').lean();
        if (!property) throw new NotFoundException('Listing not found');
        if ([String(property.ownerId), String(property.agentId ?? '')].includes(String(reporterId))) {
            throw new BadRequestException('You can’t report your own listing');
        }
        const already = await this.reportModel.exists({ reporter: reporterId, property: propertyId, status: 'pending' });
        if (already) throw new ConflictException('You already reported this listing');

        const report = new this.reportModel({
            ...createReportDto,
            reporter: reporterId,
            property: propertyId,
        });
        const saved = await report.save();

        // The report is saved: a failed notice must not lose it.
        try {
            await this.notificationsService.notifyAdmins({
                title: 'Listing reported',
                message: `${property.title ?? 'A listing'} was reported: ${createReportDto.reason}.`,
                link: '/admin/reports',
                metadata: { propertyId: String(propertyId), reportId: String((saved as any)._id) },
            });
        } catch (err: any) {
            this.logger.warn(`Report ${(saved as any)._id}: admins not notified: ${err?.message}`);
        }
        return saved;
    }

    // ── List ──────────────────────────────────────────────────────────────────

    async findAll(
        query: any,
    ): Promise<{ data: any[]; total: number; openCount: number; page: number; limit: number }> {
        const { status, propertyId, state } = query;
        const page = Math.max(1, Number(query.page) || 1);
        const limit = Math.min(100, Math.max(1, Number(query.limit) || 10));
        const skip = (page - 1) * limit;

        const filter: any = {};
        if (state === 'open') filter.status = { $in: OPEN_STATUSES };
        else if (state === 'closed') filter.status = { $in: ['resolved', 'dismissed'] };
        else if (status) filter.status = status;
        if (propertyId) filter.property = propertyId;

        const [reports, total, openCount] = await Promise.all([
            this.reportModel
                .find(filter)
                .populate('reporter', 'name email phoneNumber profilePicture')
                .populate({
                    path: 'property',
                    select: 'title city address images approvalStatus isActive ownerId',
                    populate: { path: 'ownerId', select: 'name email phoneNumber' },
                })
                // The queue is worked oldest first; everything else reads newest first.
                .sort({ createdAt: state === 'open' ? 1 : -1 })
                .skip(skip)
                .limit(limit)
                .lean()
                .exec(),
            this.reportModel.countDocuments(filter).exec(),
            this.reportModel.countDocuments({ status: { $in: OPEN_STATUSES } }).exec(),
        ]);

        // Several people reporting one listing is worth knowing when deciding.
        const propertyIds = reports.map((r: any) => r.property?._id).filter(Boolean);
        const counts: { _id: any; count: number }[] = propertyIds.length
            ? await this.reportModel.aggregate([
                { $match: { property: { $in: propertyIds }, status: { $in: OPEN_STATUSES } } },
                { $group: { _id: '$property', count: { $sum: 1 } } },
            ])
            : [];
        const countById = new Map(counts.map((c) => [String(c._id), c.count]));
        const data = reports.map((r: any) => ({
            ...r,
            openOnListing: r.property?._id ? countById.get(String(r.property._id)) ?? 0 : 0,
        }));

        return { data, total, openCount, page, limit };
    }

    // ── Detail ────────────────────────────────────────────────────────────────

    async findOne(id: string): Promise<Report> {
        const report = await this.reportModel
            .findById(id)
            .populate('reporter', 'name email profilePicture phoneNumber')
            .populate({
                path: 'property',
                select: 'title description address city price images approvalStatus isActive ownerId',
                populate: { path: 'ownerId', select: 'name email phoneNumber' },
            })
            .exec();

        if (!report) {
            throw new NotFoundException(`Report with ID ${id} not found`);
        }
        return report;
    }

    // ── Update status ─────────────────────────────────────────────────────────

    async updateStatus(id: string, updateDto: UpdateReportStatusDto): Promise<Report> {
        const before = isValidObjectId(id)
            ? await this.reportModel.findById(id).select('status').lean().exec()
            : null;
        const report = await this.reportModel
            .findByIdAndUpdate(id, updateDto, { new: true })
            .populate('reporter', 'name email profilePicture')
            .populate('property', 'title city')
            .exec();

        if (!report) {
            throw new NotFoundException(`Report with ID ${id} not found`);
        }
        // Closing an open report: tell the person who sent it.
        const closedNow = OPEN_STATUSES.includes(String(before?.status)) && ['resolved', 'dismissed'].includes(report.status);
        if (closedNow) {
            const reporterId = (report.reporter as any)?._id ?? report.reporter;
            await this.notifyReporters(
                [reporterId],
                (report.property as any)?.title,
                report.status === 'dismissed' ? 'dismissed' : 'resolved',
            );
        }
        return report;
    }

    /**
     * Lets the people who reported a listing know what came of it. Only the outcome: what
     * was reported and by whom stays private, and the owner is told separately.
     */
    private async notifyReporters(
        reporterIds: any[],
        propertyTitle: string | undefined,
        outcome: 'removed' | 'resolved' | 'dismissed',
    ): Promise<void> {
        const ids = [...new Set(reporterIds.filter(Boolean).map(String))];
        const listing = propertyTitle ? `"${propertyTitle}"` : 'the listing';
        const annonce = propertyTitle ? `« ${propertyTitle} »` : "l'annonce";
        const text = {
            removed: {
                en: { title: 'Thanks for your report', message: `We reviewed your report about ${listing} and took it off HoroHouse.` },
                fr: { title: 'Merci pour votre signalement', message: `Nous avons examiné votre signalement concernant ${annonce} et l'avons retirée de HoroHouse.` },
            },
            resolved: {
                en: { title: 'Thanks for your report', message: `We reviewed your report about ${listing} and dealt with it.` },
                fr: { title: 'Merci pour votre signalement', message: `Nous avons examiné votre signalement concernant ${annonce} et l'avons traité.` },
            },
            dismissed: {
                en: { title: 'We reviewed your report', message: `We looked into your report about ${listing} and found it follows our rules, so it stays up. Thanks for helping keep HoroHouse safe.` },
                fr: { title: 'Nous avons examiné votre signalement', message: `Nous avons vérifié votre signalement concernant ${annonce} : elle respecte nos règles et reste en ligne. Merci de nous aider à garder HoroHouse sûr.` },
            },
        }[outcome];
        for (const userId of ids) {
            try {
                await this.notificationsService.create(
                    { userId, type: NotificationType.SYSTEM, title: text.en.title, message: text.en.message, metadata: { outcome } },
                    text.fr,
                );
            } catch (err: any) {
                this.logger.warn(`Reporter ${userId} wasn't told the outcome: ${err?.message}`);
            }
        }
    }

    // ── Delete report record ──────────────────────────────────────────────────

    async remove(id: string): Promise<void> {
        const result = await this.reportModel.findByIdAndDelete(id).exec();
        if (!result) {
            throw new NotFoundException(`Report with ID ${id} not found`);
        }
    }

    // ── Stats ─────────────────────────────────────────────────────────────────

    async getStats(): Promise<any> {
        const [total, pending, resolved, dismissed] = await Promise.all([
            this.reportModel.countDocuments(),
            this.reportModel.countDocuments({ status: 'pending' }),
            this.reportModel.countDocuments({ status: 'resolved' }),
            this.reportModel.countDocuments({ status: 'dismissed' }),
        ]);
        return { total, pending, resolved, dismissed };
    }

    // ── NEW: Delete the reported property ─────────────────────────────────────

    /**
     * Permanently removes the reported property from the platform.
     * - Deletes the Property document
     * - Marks all reports for that property as 'resolved'
     * - Sends an in-app notification to the property owner
     * - Optionally sends an email to the owner
     */
    async deleteReportedProperty(reportId: string, admin: User): Promise<{ message: string }> {
        // 1. Load the report and populate property + owner
        const report = await this.reportModel
            .findById(reportId)
            .populate({
                path: 'property',
                populate: { path: 'ownerId', select: 'name firstName lastName email' },
            })
            .exec();

        if (!report) {
            throw new NotFoundException(`Report with ID ${reportId} not found`);
        }

        const property = report.property as any;
        if (!property || !property._id) {
            throw new BadRequestException(
                'The property associated with this report has already been deleted.',
            );
        }

        const propertyId = property._id.toString();
        const propertyTitle: string = property.title ?? 'Untitled Property';
        const owner = property.ownerId as any;

        // 2. Delete the property
        await this.propertyModel.findByIdAndDelete(propertyId).exec();
        this.logger.log(
            `Property ${propertyId} ("${propertyTitle}") deleted by admin ${(admin as any)._id} via report ${reportId}`,
        );

        // 3. Resolve all open reports on this property, and tell those who sent them
        const openReports = await this.reportModel
            .find({ property: propertyId, status: { $in: ['pending', 'reviewed'] } })
            .select('reporter')
            .lean()
            .exec();
        await this.reportModel.updateMany(
            { property: propertyId, status: { $in: ['pending', 'reviewed'] } },
            { status: 'resolved', adminNotes: `Property deleted by admin on ${new Date().toLocaleDateString()}` },
        );

        await this.notifyReporters(openReports.map((x: any) => x.reporter), propertyTitle, 'removed');

        // 4. Notify the property owner in-app (non-blocking)
        if (owner?._id) {
            const ownerId = owner._id.toString();
            this.notificationsService
                .create({
                    userId: ownerId,
                    type: NotificationType.SYSTEM,
                    title: 'Your property has been removed',
                    message: `Your listing "${propertyTitle}" has been removed from the platform following a report review by our admin team. If you believe this is a mistake, please contact support.`,
                    fr: { title: 'Votre logement a été retiré', message: `Votre annonce « ${propertyTitle} » a été retirée de la plateforme après examen d'un signalement par notre équipe. Si vous pensez qu'il s'agit d'une erreur, contactez le support.` },
                    link: '/dashboard',
                    metadata: { propertyTitle },
                })
                .catch((err) =>
                    this.logger.error('Failed to send deletion notification to owner', err),
                );

            // 5. Send email to owner (non-blocking)
            if (owner.email) {
                const ownerName: string =
                    owner.firstName ?? owner.name ?? 'Property Owner';
                this.emailService
                    .sendPropertyRemovedEmail(owner.email, ownerName, propertyTitle)
                    .catch((err) =>
                        this.logger.error('Failed to send property removal email', err),
                    );
            }
        }

        return { message: `Property "${propertyTitle}" has been permanently deleted.` };
    }

    // ── Hide the reported property ───────────────────────────────────────────────

    /**
     * Takes the listing off the platform without destroying anything, by rejecting it.
     * Unlike isActive alone, an owner can't undo this: only an admin can approve it again,
     * from Properties Moderation. Existing bookings are left alone.
     */
    async hideListing(reportId: string, reason: string, admin: User): Promise<{ message: string }> {
        if (!isValidObjectId(reportId)) throw new NotFoundException('Report not found');
        const report = await this.reportModel.findById(reportId).select('property').lean().exec();
        if (!report) throw new NotFoundException('Report not found');

        const property: any = await this.propertyModel
            .findByIdAndUpdate(
                report.property,
                { approvalStatus: ApprovalStatus.REJECTED, isActive: false, rejectionReason: reason },
            )
            .select('title ownerId')
            .lean()
            .exec();
        if (!property) throw new BadRequestException('This listing no longer exists.');

        // Every open report on it has now been dealt with.
        const openReports = await this.reportModel
            .find({ property: property._id, status: { $in: OPEN_STATUSES } })
            .select('reporter')
            .lean()
            .exec();
        await this.reportModel.updateMany(
            { property: property._id, status: { $in: OPEN_STATUSES } },
            { status: 'resolved', adminNotes: `Listing hidden: ${reason}` },
        );
        await this.notifyReporters(openReports.map((x: any) => x.reporter), property.title, 'removed');
        this.logger.log(`Listing ${property._id} hidden by admin ${(admin as any)._id} via report ${reportId}`);

        if (property.ownerId) {
            try {
                await this.notificationsService.create({
                    userId: String(property.ownerId),
                    type: NotificationType.SYSTEM,
                    title: 'Your listing has been hidden',
                    message: `"${property.title ?? 'Your listing'}" was hidden after a report: ${reason}`,
                    metadata: { propertyId: String(property._id), reportId },
                }, {
                    title: 'Votre annonce a été masquée',
                    message: `« ${property.title ?? 'Votre annonce'} » a été masquée suite à un signalement : ${reason}`,
                });
            } catch (err: any) {
                this.logger.warn(`Listing ${property._id} hidden, but the owner wasn't notified: ${err?.message}`);
            }
        }
        return { message: `"${property.title ?? 'The listing'}" is hidden.` };
    }

    // ── NEW: Send warning to property owner ───────────────────────────────────

    /**
     * Sends a warning message to the property owner via:
     *  - In-app notification (real-time via WebSocket)
     *  - Email (if the owner has an email address on file)
     *
     * The report is updated to 'reviewed' if it was still 'pending'.
     */
    async warnOwner(
        reportId: string,
        dto: SendWarningDto,
        admin: User,
    ): Promise<{ message: string }> {
        // 1. Load report with property + owner
        const report = await this.reportModel
            .findById(reportId)
            .populate({
                path: 'property',
                select: 'title ownerId address city',
                populate: { path: 'ownerId', select: 'name firstName lastName email' },
            })
            .exec();

        if (!report) {
            throw new NotFoundException(`Report with ID ${reportId} not found`);
        }

        const property = report.property as any;
        if (!property || !property._id) {
            throw new BadRequestException(
                'Cannot send a warning — the reported property no longer exists.',
            );
        }

        const owner = property.ownerId as any;
        if (!owner?._id) {
            throw new BadRequestException(
                'Cannot send a warning — property owner information is unavailable.',
            );
        }

        const ownerId: string = owner._id.toString();
        const ownerName: string = owner.firstName ?? owner.name ?? 'Property Owner';
        const propertyTitle: string = property.title ?? 'Untitled Property';
        const severity = dto.severity ?? WarningSeverity.WARNING;

        const isFinal = severity === WarningSeverity.FINAL_WARNING;
        const notifTitle = isFinal
            ? `⚠️ Final Warning: Action required on your listing`
            : `⚠️ Warning regarding your listing`;

        // 2. Send in-app notification
        await this.notificationsService.create({
            userId: ownerId,
            type: NotificationType.SYSTEM,
            title: notifTitle,
            message: `Regarding your property "${propertyTitle}": ${dto.message}`,
            fr: { title: isFinal ? '⚠️ Dernier avertissement : action requise sur votre annonce' : '⚠️ Avertissement concernant votre annonce', message: `Concernant votre logement « ${propertyTitle} » : ${dto.message}` },
            link: `/dashboard/properties`,
            metadata: {
                propertyTitle,
                propertyId: property._id.toString(),
                reportId,
                severity,
            },
        });

        // 3. Send warning email (non-blocking; don't fail the request if email fails)
        if (owner.email) {
            this.emailService
                .sendPropertyWarningEmail(
                    owner.email,
                    ownerName,
                    propertyTitle,
                    dto.message,
                    severity,
                )
                .catch((err) =>
                    this.logger.error('Failed to send warning email to owner', err),
                );
        }

        // 4. Move report to 'reviewed' if still pending
        if (report.status === 'pending') {
            await this.reportModel.findByIdAndUpdate(reportId, {
                status: 'reviewed',
                adminNotes: `Warning sent to owner on ${new Date().toLocaleDateString()}. ${
                    (report as any).adminNotes ?? ''
                }`.trim(),
            });
        }

        this.logger.log(
            `Warning (severity: ${severity}) sent to owner ${ownerId} for property "${propertyTitle}" by admin ${(admin as any)._id}`,
        );

        return {
            message: `Warning successfully sent to ${ownerName} (${owner.email ?? 'no email on file'}).`,
        };
    }
}