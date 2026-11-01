import { Model } from 'mongoose';
import { Report, ReportDocument } from './schemas/report.schema';
import { PropertyDocument } from '../properties/schemas/property.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { CreateReportDto } from './dto/create-report.dto';
import { UpdateReportStatusDto } from './dto/update-report-status.dto';
import { SendWarningDto } from './dto/send-warning.dto';
import { EmailService } from '../email/email.service';
import { NotificationsService } from '../notifications/notifications.service';
export declare class ReportsService {
    private readonly reportModel;
    private readonly propertyModel;
    private readonly userModel;
    private readonly emailService;
    private readonly notificationsService;
    private readonly logger;
    constructor(reportModel: Model<ReportDocument>, propertyModel: Model<PropertyDocument>, userModel: Model<UserDocument>, emailService: EmailService, notificationsService: NotificationsService);
    create(createReportDto: CreateReportDto, reporterId: string, propertyId: string): Promise<Report>;
    findAll(query: any): Promise<{
        data: Report[];
        total: number;
        page: number;
        limit: number;
    }>;
    findOne(id: string): Promise<Report>;
    updateStatus(id: string, updateDto: UpdateReportStatusDto): Promise<Report>;
    remove(id: string): Promise<void>;
    getStats(): Promise<any>;
    deleteReportedProperty(reportId: string, admin: User): Promise<{
        message: string;
    }>;
    warnOwner(reportId: string, dto: SendWarningDto, admin: User): Promise<{
        message: string;
    }>;
}
