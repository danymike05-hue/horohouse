import { Model } from 'mongoose';
import { Inquiry, InquiryDocument, InquiryStatus, InquiryType } from './schemas/inquiry.schema';
import { PropertyDocument } from './schemas/property.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { HistoryService } from '../history/history.service';
import { NotificationsService } from '../notifications/notifications.service';
export interface CreateInquiryDto {
    propertyId: string;
    message: string;
    type?: InquiryType;
    preferredContactMethod?: string;
    preferredContactTime?: string;
    viewingDate?: Date;
    budget?: number;
    moveInDate?: Date;
    contactEmail?: string;
    contactPhone?: string;
}
export interface UpdateInquiryDto {
    response?: string;
    status?: InquiryStatus;
}
export interface InquiryFilters {
    propertyId?: string;
    agentId?: string;
    userId?: string;
    status?: InquiryStatus;
    type?: InquiryType;
    isRead?: boolean;
}
export interface InquiryOptions {
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
}
export declare class InquiryService {
    private inquiryModel;
    private propertyModel;
    private userModel;
    private historyService;
    private notificationsService;
    private readonly logger;
    constructor(inquiryModel: Model<InquiryDocument>, propertyModel: Model<PropertyDocument>, userModel: Model<UserDocument>, historyService: HistoryService, notificationsService: NotificationsService);
    create(createInquiryDto: CreateInquiryDto, user: User): Promise<Inquiry>;
    findAll(filters: InquiryFilters | undefined, options: InquiryOptions | undefined, user: User): Promise<{
        inquiries: Inquiry[];
        total: number;
        page: number;
        totalPages: number;
    }>;
    findOne(id: string, user: User): Promise<Inquiry>;
    update(id: string, updateInquiryDto: UpdateInquiryDto, user: User): Promise<Inquiry>;
    remove(id: string, user: User): Promise<void>;
    getInquiriesForProperty(propertyId: string, user: User): Promise<Inquiry[]>;
    getInquiryStats(user: User): Promise<any>;
    markAsRead(id: string, user: User): Promise<Inquiry>;
}
