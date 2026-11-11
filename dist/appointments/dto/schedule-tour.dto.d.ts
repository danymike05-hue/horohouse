import { AppointmentType } from '../schemas/appointment.schema';
export declare class ScheduleTourDto {
    propertyId: string;
    agentId?: string;
    viewingDate: string;
    viewingTime: string;
    tourType: AppointmentType;
    name: string;
    email: string;
    phone: string;
    message?: string;
}
