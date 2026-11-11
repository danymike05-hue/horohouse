import { InquiryService, UpdateInquiryDto } from './inquiry.service';
import { Request } from 'express';
export declare class InquiryController {
    private readonly inquiryService;
    private readonly logger;
    constructor(inquiryService: InquiryService);
    health(): {
        status: string;
    };
    create(body: any, req: Request): Promise<import("./schemas/inquiry.schema").Inquiry>;
    findAll(propertyId: string, agentId: string, userId: string, status: string, type: string, isRead: string, page: string | undefined, limit: string | undefined, sortBy: string | undefined, sortOrder: "asc" | "desc" | undefined, req: Request): Promise<{
        inquiries: import("./schemas/inquiry.schema").Inquiry[];
        total: number;
        page: number;
        totalPages: number;
    }>;
    stats(req: Request): Promise<any>;
    forProperty(propertyId: string, req: Request): Promise<import("./schemas/inquiry.schema").Inquiry[]>;
    findOne(id: string, req: Request): Promise<import("./schemas/inquiry.schema").Inquiry>;
    update(id: string, updateInquiryDto: UpdateInquiryDto, req: Request): Promise<import("./schemas/inquiry.schema").Inquiry>;
    markAsRead(id: string, req: Request): Promise<import("./schemas/inquiry.schema").Inquiry>;
    remove(id: string, req: Request): Promise<{
        success: boolean;
    }>;
}
