import { ReportsService } from './reports.service';
import { CreateReportDto } from './dto/create-report.dto';
import { UpdateReportStatusDto } from './dto/update-report-status.dto';
import { SendWarningDto } from './dto/send-warning.dto';
export declare class ReportsController {
    private readonly reportsService;
    constructor(reportsService: ReportsService);
    create(propertyId: string, createReportDto: CreateReportDto, req: any): Promise<import("./schemas/report.schema").Report>;
    findAll(query: any): Promise<{
        data: import("./schemas/report.schema").Report[];
        total: number;
        page: number;
        limit: number;
    }>;
    getStats(): Promise<any>;
    findOne(id: string): Promise<import("./schemas/report.schema").Report>;
    updateStatus(id: string, updateReportStatusDto: UpdateReportStatusDto): Promise<import("./schemas/report.schema").Report>;
    remove(id: string): Promise<void>;
    deleteReportedProperty(id: string, req: any): Promise<{
        message: string;
    }>;
    warnOwner(id: string, sendWarningDto: SendWarningDto, req: any): Promise<{
        message: string;
    }>;
}
