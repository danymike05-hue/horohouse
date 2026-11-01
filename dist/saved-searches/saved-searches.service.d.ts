import { Model, Types } from 'mongoose';
import { SavedSearch, SavedSearchDocument } from './schemas/saved-search.schema';
import { UserDocument } from '../users/schemas/user.schema';
import { Property, PropertyDocument } from '../properties/schemas/property.schema';
import { EmailService } from '../email/email.service';
import { CreateSavedSearchDto, UpdateSavedSearchDto } from './dto/saved-search.dto';
export declare class SavedSearchesService {
    private savedSearchModel;
    private userModel;
    private propertyModel;
    private emailService;
    private readonly logger;
    constructor(savedSearchModel: Model<SavedSearchDocument>, userModel: Model<UserDocument>, propertyModel: Model<PropertyDocument>, emailService: EmailService);
    create(createDto: CreateSavedSearchDto, userId: string): Promise<SavedSearch>;
    private performImmediateCheck;
    findAllByUser(userId: string): Promise<SavedSearch[]>;
    findOne(id: string, userId: string): Promise<SavedSearch>;
    update(id: string, updateDto: UpdateSavedSearchDto, userId: string): Promise<SavedSearch>;
    remove(id: string, userId: string): Promise<void>;
    getMatchingProperties(id: string, userId: string, page?: number, limit?: number): Promise<{
        properties: Property[];
        total: number;
        page: number;
        totalPages: number;
    }>;
    checkForNewMatches(): Promise<void>;
    sendDailyNotifications(): Promise<void>;
    sendInstantNotifications(): Promise<void>;
    sendWeeklyNotifications(): Promise<void>;
    private sendNotifications;
    private updateNewMatches;
    private getMatchingPropertiesCount;
    private buildPropertyQuery;
    getStatistics(userId: string): Promise<any>;
    triggerManualCheck(userId: string): Promise<Array<{
        searchId: Types.ObjectId;
        name: string;
        newMatches: number;
        resultsCount: number;
    }>>;
}
