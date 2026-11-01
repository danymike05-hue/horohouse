import { Model, Types } from 'mongoose';
import { Property, PropertyDocument } from '../properties/schemas/property.schema';
import { UserDocument, UserRole } from '../users/schemas/user.schema';
import { StudentPropertySearchDto, MarkStudentFriendlyDto } from './dto/student-property.dto';
import { NotificationsService } from '../notifications/notifications.service';
export declare class StudentPropertiesService {
    private propertyModel;
    private userModel;
    private notificationsService;
    private readonly logger;
    constructor(propertyModel: Model<PropertyDocument>, userModel: Model<UserDocument>, notificationsService: NotificationsService);
    searchStudentProperties(dto: StudentPropertySearchDto): Promise<{
        properties: Property[];
        total: number;
        page: number;
        totalPages: number;
    }>;
    markAsStudentFriendly(propertyId: string, requestingUser: {
        _id: Types.ObjectId;
        role: UserRole;
    }, dto: MarkStudentFriendlyDto): Promise<Property>;
    removeStudentFriendly(propertyId: string, requestingUser: {
        _id: Types.ObjectId;
        role: UserRole;
    }): Promise<Property>;
    grantStudentApproved(propertyId: string, adminId: string): Promise<Property>;
    revokeStudentApproved(propertyId: string, adminId: string): Promise<Property>;
    getStudentPropertyStats(): Promise<{
        total: number;
        studentApproved: number;
        byCity: Array<{
            city: string;
            count: number;
        }>;
        byWaterSource: Record<string, number>;
        byElectricityBackup: Record<string, number>;
        withAvailableBeds: number;
    }>;
}
