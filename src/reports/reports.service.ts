import {
    Injectable, NotFoundException, BadRequestException, Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Report, ReportDocument } from './schemas/report.schema';
import { Property, PropertyDocument } from '../properties/schemas/property.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { CreateReportDto } from './dto/create-report.dto';
import { UpdateReportStatusDto } from './dto/update-report-status.dto';
import { SendWarningDto, WarningSeverity } from './dto/send-warning.dto';
import { EmailService } from '../email/email.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/schemas/notification.schema';

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
        const report = new this.reportModel({
            ...createReportDto,
            reporter: reporterId,
            property: propertyId,
        });
        return report.save();
    }

    // ── List ──────────────────────────────────────────────────────────────────

    async findAll(
        query: any,
    ): Promise<{ data: Report[]; total: number; page: number; limit: number }> {
        const { page = 1, limit = 10, status, propertyId } = query;
        const skip = (page - 1) * limit;

        const filter: any = {};
        if (status) filter.status = status;
        if (propertyId) filter.property = propertyId;

        const [data, total] = await Promise.all([
            this.reportModel
                .find(filter)
                .populate('reporter', 'firstName lastName email profilePicture')
                .populate('property', 'title location currentPrice images')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(Number(limit))
                .exec(),
            this.reportModel.countDocuments(filter).exec(),
        ]);

        return { data, total, page: Number(page), limit: Number(limit) };
    }

    // ── Detail ────────────────────────────────────────────────────────────────

    async findOne(id: string): Promise<Report> {
        const report = await this.reportModel
            .findById(id)
            .populate('reporter', 'firstName lastName email profilePicture phoneNumber')
            .populate({
                path: 'property',
                select: 'title description location address city currentPrice images status ownerId',
                populate: { path: 'ownerId', select: 'firstName lastName email name' },
            })
            .exec();

        if (!report) {
            throw new NotFoundException(`Report with ID ${id} not found`);
        }
        return report;
    }

    // ── Update status ─────────────────────────────────────────────────────────

    async updateStatus(id: string, updateDto: UpdateReportStatusDto): Promise<Report> {
        const report = await this.reportModel
            .findByIdAndUpdate(id, updateDto, { new: true })
            .populate('reporter', 'firstName lastName email profilePicture')
            .populate('property', 'title location')
            .exec();

        if (!report) {
            throw new NotFoundException(`Report with ID ${id} not found`);
        }
        return report;
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

        // 3. Resolve all open reports on this property
        await this.reportModel.updateMany(
            { property: propertyId, status: { $in: ['pending', 'reviewed'] } },
            { status: 'resolved', adminNotes: `Property deleted by admin on ${new Date().toLocaleDateString()}` },
        );

        // 4. Notify the property owner in-app (non-blocking)
        if (owner?._id) {
            const ownerId = owner._id.toString();
            this.notificationsService
                .create({
                    userId: ownerId,
                    type: NotificationType.SYSTEM,
                    title: 'Your property has been removed',
                    message: `Your listing "${propertyTitle}" has been removed from the platform following a report review by our admin team. If you believe this is a mistake, please contact support.`,
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