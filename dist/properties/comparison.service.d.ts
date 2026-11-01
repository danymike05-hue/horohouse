import { Model } from 'mongoose';
import { Comparison, ComparisonDocument } from './schemas/comparison.schema';
import { PropertyDocument } from './schemas/property.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { HistoryService } from '../history/history.service';
export interface CreateComparisonDto {
    name: string;
    propertyIds: string[];
    isPublic?: boolean;
}
export interface UpdateComparisonDto {
    name?: string;
    propertyIds?: string[];
    isPublic?: boolean;
}
export declare class ComparisonService {
    private comparisonModel;
    private propertyModel;
    private userModel;
    private historyService;
    private readonly logger;
    constructor(comparisonModel: Model<ComparisonDocument>, propertyModel: Model<PropertyDocument>, userModel: Model<UserDocument>, historyService: HistoryService);
    create(createComparisonDto: CreateComparisonDto, user: User): Promise<Comparison>;
    findAll(user: User): Promise<Comparison[]>;
    findOne(id: string, user?: User): Promise<Comparison>;
    findByShareToken(shareToken: string): Promise<Comparison>;
    update(id: string, updateComparisonDto: UpdateComparisonDto, user: User): Promise<Comparison>;
    remove(id: string, user: User): Promise<void>;
    getPublicComparisons(limit?: number): Promise<Comparison[]>;
    generateShareUrl(id: string, user: User): Promise<{
        shareUrl: string;
        shareToken: string;
    }>;
}
