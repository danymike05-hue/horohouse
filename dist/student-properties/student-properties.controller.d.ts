import { FastifyRequest } from 'fastify';
import { StudentPropertiesService } from './student-properties.service';
import { StudentPropertySearchDto, MarkStudentFriendlyDto } from './dto/student-property.dto';
import { User } from '../users/schemas/user.schema';
export declare class StudentPropertiesController {
    private readonly studentPropertiesService;
    constructor(studentPropertiesService: StudentPropertiesService);
    search(dto: StudentPropertySearchDto): Promise<{
        properties: import("../properties/schemas/property.schema").Property[];
        total: number;
        page: number;
        totalPages: number;
    }>;
    getStats(): Promise<{
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
    enrollProperty(propertyId: string, req: FastifyRequest & {
        user: User;
    }, dto: MarkStudentFriendlyDto): Promise<import("../properties/schemas/property.schema").Property>;
    updateEnrollment(propertyId: string, req: FastifyRequest & {
        user: User;
    }, dto: MarkStudentFriendlyDto): Promise<import("../properties/schemas/property.schema").Property>;
    removeEnrollment(propertyId: string, req: FastifyRequest & {
        user: User;
    }): Promise<import("../properties/schemas/property.schema").Property>;
    grantStudentApproved(propertyId: string, req: FastifyRequest & {
        user: User;
    }): Promise<import("../properties/schemas/property.schema").Property>;
    revokeStudentApproved(propertyId: string, req: FastifyRequest & {
        user: User;
    }): Promise<import("../properties/schemas/property.schema").Property>;
}
